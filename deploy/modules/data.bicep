// Postgres (private, one database), its private DNS zone, Blob Storage and Key Vault.

param location string
param prefix string
param vnetId string
param postgresSubnetId string
param pgAdminLogin string

@description('Availability zone for the server; empty lets Azure choose.')
param pgZone string = ''

@description('false skips the PostgreSQL server and everything on it (configurations, database). For while the subscription cannot create the size yet.')
param deployDatabase bool = true

@description('Browser origins allowed to upload to and read from media\'s storage (CORS).')
param appOrigins array = ['https://skilient.com', 'https://www.skilient.com']

@secure()
param pgAdminPassword string

resource dnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${prefix}.private.postgres.database.azure.com'
  location: 'global'
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsZone
  name: '${prefix}-vnet-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = if (deployDatabase) {
  name: '${prefix}-pg'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    availabilityZone: empty(pgZone) ? null : pgZone
    administratorLogin: pgAdminLogin
    administratorLoginPassword: pgAdminPassword
    storage: {
      // Classic Premium SSD. Left unset, Azure may pick Premium SSD v2, which refuses Burstable sizes
      // (the first deploy failed with SkuNotAvailable; decision 2026-11-26).
      type: 'Premium_LRS'
      tier: 'P4'
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: postgresSubnetId
      privateDnsZoneArmResourceId: dnsZone.id
      publicNetworkAccess: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled'
    }
  }
  dependsOn: [
    dnsLink
  ]
}

@description('Extensions services may create (packages/platform/migrations/0003_extensions.sql; docs/azure/prd.md, "Extensions kept").')
param pgExtensions string = 'PG_TRGM,UNACCENT,BTREE_GIN,PGCRYPTO,PG_STAT_STATEMENTS'

// Azure only lets a database create allow-listed extensions (decision 2026-11-25, W2 Q6). pg_stat_statements
// also needs `shared_preload_libraries` to include it, which takes a server restart; neither has been
// compiled or deployed yet (decision 2026-11-22: Bicep is uncompiled in the sandbox).
resource pgExtensionsConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = if (deployDatabase) {
  parent: pg
  name: 'azure.extensions'
  properties: {
    value: pgExtensions
    source: 'user-override'
  }
}

resource pgPreload 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = if (deployDatabase) {
  parent: pg
  name: 'shared_preload_libraries'
  properties: {
    value: 'pg_stat_statements'
    source: 'user-override'
  }
  dependsOn: [pgExtensionsConfig]
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = if (deployDatabase) {
  parent: pg
  name: 'skilient'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower(take('${replace(prefix, '-', '')}st${uniqueString(resourceGroup().id)}', 24))
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    // Only media's five public buckets allow anonymous reads (their containers say so); the rest are private and
    // read through links media signs. No account key is used anywhere (managed identities and user-delegation SAS).
    allowBlobPublicAccess: true
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Media's buckets (services/media/src/domain/buckets.ts), one container each; browsers PUT uploads straight here.
var publicBuckets = ['avatars', 'covers', 'post-media', 'society-media', 'university-media']
var privateBuckets = ['chat-media', 'credentials', 'cv-exports', 'event-receipts', 'feedback', 'org-documents', 'society-documents', 'university-claims']

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: appOrigins
          allowedMethods: ['PUT', 'GET', 'HEAD']
          allowedHeaders: ['content-type', 'x-ms-blob-type', 'x-ms-version']
          exposedHeaders: ['etag']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource publicContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for b in publicBuckets: {
  parent: blobService
  name: b
  properties: {
    publicAccess: 'Blob'
  }
}]

resource privateContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for b in privateBuckets: {
  parent: blobService
  name: b
  properties: {
    publicAccess: 'None'
  }
}]

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${prefix}-kv-${uniqueString(resourceGroup().id)}', 24)
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

output postgresFqdn string = deployDatabase ? pg!.properties.fullyQualifiedDomainName : ''
output storageAccountName string = storage.name
output blobEndpoint string = replace(storage.properties.primaryEndpoints.blob, '.net/', '.net')
output keyVaultName string = kv.name

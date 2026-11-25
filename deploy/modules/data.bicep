// Postgres (private, one database), its private DNS zone, Blob Storage and Key Vault.

param location string
param prefix string
param vnetId string
param postgresSubnetId string
param pgAdminLogin string

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

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${prefix}-pg'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '17'
    administratorLogin: pgAdminLogin
    administratorLoginPassword: pgAdminPassword
    storage: {
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
resource pgExtensionsConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'azure.extensions'
  properties: {
    value: pgExtensions
    source: 'user-override'
  }
}

resource pgPreload 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'shared_preload_libraries'
  properties: {
    value: 'pg_stat_statements'
    source: 'user-override'
  }
  dependsOn: [pgExtensionsConfig]
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
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
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

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

output postgresFqdn string = pg.properties.fullyQualifiedDomainName
output storageAccountName string = storage.name
output keyVaultName string = kv.name

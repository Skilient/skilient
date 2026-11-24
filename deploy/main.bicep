// The floor from docs/azure/prd.md ("Azure resources and deployment layout").
// web + core-a + core-b + realtime (Container Apps) and four jobs, on one private
// PostgreSQL server, with Key Vault, Blob Storage and Log Analytics.
// NOT YET COMPILED: run `az bicep build --file deploy/main.bicep` before any deploy.

targetScope = 'resourceGroup'

@description('Azure region. The PRD fixes Central India.')
param location string = 'centralindia'

@description('Resource name prefix. Lowercase letters and digits only.')
@minLength(3)
@maxLength(12)
param prefix string = 'skilient'

@description('PostgreSQL admin login. Not a secret.')
param pgAdminLogin string = 'skilientadmin'

@secure()
@description('PostgreSQL admin password. Typed at deploy time from the password manager. Never stored in the repo or in GitHub.')
param pgAdminPassword string

@secure()
param ghcrToken string

param ghcrUsername string

@description('Image for web. Pin to a commit tag.')
param webImage string

@description('Image for the service containers (core-a, core-b, realtime). One image, the SERVICES variable picks what each container hosts.')
param serviceImage string

@description('Image for the jobs (render, harvest, batch, migrate). The JOB variable picks which one runs.')
param jobImage string

@description('Cloudflare address ranges allowed to reach web and realtime. Empty until cutover, when they are added.')
param cloudflareIpRanges array = []

@description('Budget alert recipients.')
param budgetContactEmails array

@description('First day of the budget period, UTC.')
param budgetStartDate string = '2026-12-01T00:00:00Z'

@description('Batch job schedule, cron in UTC. 20:00 UTC is 01:00 in Pakistan.')
param batchCron string = '0 20 * * *'

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    location: location
    prefix: prefix
  }
}

module observability 'modules/observability.bicep' = {
  name: 'observability'
  params: {
    location: location
    prefix: prefix
  }
}

module data 'modules/data.bicep' = {
  name: 'data'
  params: {
    location: location
    prefix: prefix
    vnetId: network.outputs.vnetId
    postgresSubnetId: network.outputs.postgresSubnetId
    pgAdminLogin: pgAdminLogin
    pgAdminPassword: pgAdminPassword
  }
}

module apps 'modules/apps.bicep' = {
  name: 'apps'
  params: {
    location: location
    prefix: prefix
    acaSubnetId: network.outputs.acaSubnetId
    workspaceName: observability.outputs.workspaceName
    keyVaultName: data.outputs.keyVaultName
    storageAccountName: data.outputs.storageAccountName
    postgresFqdn: data.outputs.postgresFqdn
    webImage: webImage
    serviceImage: serviceImage
    jobImage: jobImage
    cloudflareIpRanges: cloudflareIpRanges
    batchCron: batchCron
    ghcrToken: ghcrToken
    ghcrUsername: ghcrUsername
  }
}

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: '${prefix}-rg-budget'
  properties: {
    category: 'Cost'
    // $55 total; the first alert fires at about 73% of it, which is $40.
    amount: 55
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
    }
    notifications: {
      alert40: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 73
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
      }
      alert55: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: budgetContactEmails
      }
    }
  }
}

output webFqdn string = apps.outputs.webFqdn
output realtimeFqdn string = apps.outputs.realtimeFqdn
output postgresFqdn string = data.outputs.postgresFqdn
output keyVaultName string = data.outputs.keyVaultName

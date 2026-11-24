// Container Apps environment, the four always-on containers, four jobs, one managed
// identity per container, and the role assignments each one needs.
// Only web and realtime have external ingress. core-a and core-b stay internal.
// The service containers and the jobs use the same images as the services they host.

param location string
param prefix string
param acaSubnetId string
param workspaceName string
param keyVaultName string
param storageAccountName string
param postgresFqdn string
param webImage string
param serviceImage string
param jobImage string
param cloudflareIpRanges array
param batchCron string

// Built-in role definition IDs.
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

var cfRestrictions = [for (range, i) in cloudflareIpRanges: {
  name: 'cloudflare-${i}'
  ipAddressRange: range
  action: 'Allow'
}]

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: workspaceName
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource webId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-web-id'
  location: location
}

resource coreAId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-core-a-id'
  location: location
}

resource coreBId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-core-b-id'
  location: location
}

resource realtimeId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-realtime-id'
  location: location
}

resource jobsId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-jobs-id'
  location: location
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: acaSubnetId
      internal: false
    }
  }
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-web'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        ipSecurityRestrictions: cfRestrictions
      }
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'CORE_A_URL'
              value: 'https://${coreA.properties.configuration.ingress.fqdn}'
            }
            {
              name: 'CORE_B_URL'
              value: 'https://${coreB.properties.configuration.ingress.fqdn}'
            }
            {
              name: 'REALTIME_URL'
              value: 'https://${realtime.properties.configuration.ingress.fqdn}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'concurrent-requests'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
}

resource coreA 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-core-a'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${coreAId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: false
        targetPort: 8080
        transport: 'http2'
      }
    }
    template: {
      containers: [
        {
          name: 'core-a'
          image: serviceImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'SERVICES'
              value: 'identity,people,content,notify,trust,media'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
            {
              name: 'KEY_VAULT_URL'
              value: kv.properties.vaultUri
            }
            {
              name: 'STORAGE_ACCOUNT'
              value: storage.name
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'concurrent-requests'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

resource coreB 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-core-b'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${coreBId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: false
        targetPort: 8080
        transport: 'http2'
      }
    }
    template: {
      containers: [
        {
          name: 'core-b'
          image: serviceImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'SERVICES'
              value: 'messaging,community,work,ranking,credentials,market,billing'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
            {
              name: 'KEY_VAULT_URL'
              value: kv.properties.vaultUri
            }
            {
              name: 'STORAGE_ACCOUNT'
              value: storage.name
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'concurrent-requests'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

resource realtime 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-realtime'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${realtimeId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
        ipSecurityRestrictions: cfRestrictions
      }
    }
    template: {
      containers: [
        {
          name: 'realtime'
          image: serviceImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'SERVICES'
              value: 'realtime'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
            {
              name: 'KEY_VAULT_URL'
              value: kv.properties.vaultUri
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'concurrent-requests'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

resource renderJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${prefix}-render'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${jobsId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
    }
    template: {
      containers: [
        {
          name: 'render'
          image: jobImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'JOB'
              value: 'render'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
            {
              name: 'KEY_VAULT_URL'
              value: kv.properties.vaultUri
            }
            {
              name: 'STORAGE_ACCOUNT'
              value: storage.name
            }
          ]
        }
      ]
    }
  }
}

resource harvestJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${prefix}-harvest'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${jobsId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
    }
    template: {
      containers: [
        {
          name: 'harvest'
          image: jobImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'JOB'
              value: 'harvest'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
            {
              name: 'KEY_VAULT_URL'
              value: kv.properties.vaultUri
            }
          ]
        }
      ]
    }
  }
}

resource batchJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${prefix}-batch'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${jobsId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 1800
      replicaRetryLimit: 0
      scheduleTriggerConfig: {
        cronExpression: batchCron
        parallelism: 1
        replicaCompletionCount: 1
      }
    }
    template: {
      containers: [
        {
          name: 'batch'
          image: jobImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'JOB'
              value: 'batch'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
            {
              name: 'KEY_VAULT_URL'
              value: kv.properties.vaultUri
            }
          ]
        }
      ]
    }
  }
}

resource migrateJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${prefix}-migrate'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${jobsId.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: jobImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'JOB'
              value: 'migrate'
            }
            {
              name: 'POSTGRES_HOST'
              value: postgresFqdn
            }
          ]
        }
      ]
    }
  }
}

// Key Vault: the four service identities read secrets. web holds none.
resource kvCoreA 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, coreAId.id, keyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: coreAId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource kvCoreB 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, coreBId.id, keyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: coreBId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource kvRealtime 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, realtimeId.id, keyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: realtimeId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource kvJobs 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, jobsId.id, keyVaultSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: jobsId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Blob Storage: the containers that write files (core-a, core-b, the render and batch jobs).
resource storageCoreA 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, coreAId.id, storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: coreAId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageCoreB 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, coreBId.id, storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: coreBId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageJobs 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, jobsId.id, storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: jobsId.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output webFqdn string = web.properties.configuration.ingress.fqdn
output realtimeFqdn string = realtime.properties.configuration.ingress.fqdn

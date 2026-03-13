// ============================================
// Main Bicep Orchestrator
// Deploys all Azure resources for the blog
// ============================================

targetScope = 'resourceGroup'

@description('Environment name (preprod or prod)')
@allowed(['preprod', 'prod'])
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for all resources')
param baseName string = 'blog'

@description('Admin email for the blog')
@secure()
param adminEmail string

@description('PostgreSQL admin username')
param dbAdminUsername string = 'blogadmin'

@description('PostgreSQL admin password')
@secure()
param dbAdminPassword string

@description('AKS node VM size')
param aksNodeVmSize string = environment == 'prod' ? 'Standard_B4ms' : 'Standard_B2s'

@description('AKS node count')
param aksNodeCount int = environment == 'prod' ? 2 : 1

// Naming convention
var namePrefix = '${baseName}-${environment}'
var tags = {
  project: 'personal-blog'
  environment: environment
  managedBy: 'bicep'
}

// ============================================
// Container Registry (shared across environments)
// ============================================
module acr 'modules/acr.bicep' = {
  name: 'acr-deployment'
  params: {
    name: replace('${baseName}acr${uniqueString(resourceGroup().id)}', '-', '')
    location: location
    tags: tags
  }
}

// ============================================
// Key Vault
// ============================================
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    name: '${namePrefix}-kv'
    location: location
    tags: tags
  }
}

// ============================================
// Log Analytics & Application Insights
// ============================================
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  params: {
    namePrefix: namePrefix
    location: location
    tags: tags
  }
}

// ============================================
// PostgreSQL Flexible Server
// ============================================
module postgresql 'modules/postgresql.bicep' = {
  name: 'postgresql-deployment'
  params: {
    name: '${namePrefix}-pg'
    location: location
    tags: tags
    administratorLogin: dbAdminUsername
    administratorPassword: dbAdminPassword
    skuName: environment == 'prod' ? 'Standard_D2s_v3' : 'Standard_B1ms'
    skuTier: environment == 'prod' ? 'GeneralPurpose' : 'Burstable'
    storageSizeGB: environment == 'prod' ? 64 : 32
  }
}

// ============================================
// Redis Cache
// ============================================
module redis 'modules/redis.bicep' = {
  name: 'redis-deployment'
  params: {
    name: '${namePrefix}-redis'
    location: location
    tags: tags
    skuName: environment == 'prod' ? 'Standard' : 'Basic'
    skuFamily: 'C'
    skuCapacity: environment == 'prod' ? 1 : 0
  }
}

// ============================================
// Storage Account (for blog images)
// ============================================
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    name: take(replace('${baseName}${environment}st${uniqueString(resourceGroup().id)}', '-', ''), 24)
    location: location
    tags: tags
    containerName: 'blog-images'
  }
}

// ============================================
// AKS Cluster
// ============================================
module aks 'modules/aks.bicep' = {
  name: 'aks-deployment'
  params: {
    name: '${namePrefix}-aks'
    location: location
    tags: tags
    nodeVmSize: aksNodeVmSize
    nodeCount: aksNodeCount
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ============================================
// Azure Event Hubs (Kafka-compatible telemetry streaming)
// ============================================
module eventHubs 'modules/eventhubs.bicep' = {
  name: 'eventhubs-deployment'
  params: {
    namePrefix: namePrefix
    location: location
    tags: tags
    skuTier: environment == 'prod' ? 'Standard' : 'Standard'
    capacity: environment == 'prod' ? 2 : 1
    kafkaEnabled: true
    messageRetentionDays: environment == 'prod' ? 7 : 3
    partitionCount: environment == 'prod' ? 8 : 4
  }
}

// ============================================
// Azure Data Explorer (KQL analytics + Power BI)
// ============================================
module dataExplorer 'modules/dataexplorer.bicep' = {
  name: 'dataexplorer-deployment'
  params: {
    namePrefix: namePrefix
    location: location
    tags: tags
    skuName: environment == 'prod' ? 'Standard_E2a_v4' : 'Dev(No SLA)_Standard_E2a_v4'
    capacity: environment == 'prod' ? 2 : 1
    retentionDays: environment == 'prod' ? 365 : 90
    cacheDays: environment == 'prod' ? 31 : 7
    eventHubResourceId: eventHubs.outputs.namespaceName != '' ? '${resourceGroup().id}/providers/Microsoft.EventHub/namespaces/${eventHubs.outputs.namespaceName}/eventhubs/telemetry-events' : ''
    eventHubConsumerGroup: 'adx-consumer'
    eventHubNamespaceId: eventHubs.outputs.namespaceId
  }
}

// ============================================
// Telemetry Pipeline Monitoring & Alerts
// ============================================
module alerts 'modules/alerts.bicep' = {
  name: 'alerts-deployment'
  params: {
    namePrefix: namePrefix
    tags: tags
    eventHubNamespaceId: eventHubs.outputs.namespaceId
    adxClusterId: dataExplorer.outputs.clusterId
    appInsightsId: monitoring.outputs.appInsightsId
    alertEmail: adminEmail
  }
}

// ============================================
// Store secrets in Key Vault
// ============================================
module secrets 'modules/keyvault-secrets.bicep' = {
  name: 'secrets-deployment'
  params: {
    keyVaultName: keyVault.outputs.name
    secrets: [
      {
        name: 'database-url'
        value: 'postgresql://${dbAdminUsername}:${dbAdminPassword}@${postgresql.outputs.fqdn}:5432/blogdb?sslmode=require'
      }
      {
        name: 'admin-email'
        value: adminEmail
      }
      {
        name: 'appinsights-connection-string'
        value: monitoring.outputs.appInsightsConnectionString
      }
      {
        name: 'azure-storage-account-name'
        value: storage.outputs.name
      }
      {
        name: 'azure-storage-account-key'
        value: storage.outputs.primaryKey
      }
      {
        name: 'acr-login-server'
        value: acr.outputs.loginServer
      }
      {
        name: 'eventhub-connection-string'
        value: eventHubs.outputs.sendConnectionString
      }
      {
        name: 'eventhub-namespace'
        value: eventHubs.outputs.namespaceFqdn
      }
      {
        name: 'eventhub-name'
        value: eventHubs.outputs.telemetryEventHubName
      }
      {
        name: 'eventhub-otel-connection-string'
        value: eventHubs.outputs.otelConnectionString
      }
      {
        name: 'adx-cluster-uri'
        value: dataExplorer.outputs.clusterUri
      }
    ]
  }
}

// ============================================
// Outputs
// ============================================
output aksClusterName string = aks.outputs.clusterName
output acrLoginServer string = acr.outputs.loginServer
output keyVaultName string = keyVault.outputs.name
output keyVaultUri string = keyVault.outputs.uri
output postgresqlFqdn string = postgresql.outputs.fqdn
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString
output storageAccountName string = storage.outputs.name
output eventHubNamespace string = eventHubs.outputs.namespaceFqdn
output eventHubName string = eventHubs.outputs.telemetryEventHubName
output adxClusterUri string = dataExplorer.outputs.clusterUri
output adxDatabaseName string = dataExplorer.outputs.databaseName

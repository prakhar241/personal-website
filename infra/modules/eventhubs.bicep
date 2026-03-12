// ============================================
// Azure Event Hubs Namespace (Kafka-compatible)
//
// Provides Kafka-protocol streaming for telemetry
// events. Events flow from Next.js app → Event Hubs
// → consumed by ADX, Databricks, and OTel Collector.
// ============================================

@description('Resource name prefix')
param namePrefix string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('SKU tier: Basic, Standard, or Premium')
@allowed(['Basic', 'Standard', 'Premium'])
param skuTier string = 'Standard'

@description('Throughput units (1-20 for Standard)')
@minValue(1)
@maxValue(20)
param capacity int = 1

@description('Enable Kafka support')
param kafkaEnabled bool = true

@description('Message retention in days')
@minValue(1)
@maxValue(7)
param messageRetentionDays int = 3

@description('Number of partitions per event hub')
@minValue(1)
@maxValue(32)
param partitionCount int = 4

// ---- Event Hubs Namespace ----

var namespaceName = '${namePrefix}-ehns'

resource eventHubNamespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: length(namespaceName) >= 6 ? namespaceName : '${namespaceName}-ns'
  location: location
  tags: tags
  sku: {
    name: skuTier
    tier: skuTier
    capacity: capacity
  }
  properties: {
    isAutoInflateEnabled: skuTier == 'Standard'
    maximumThroughputUnits: skuTier == 'Standard' ? 10 : 0
    kafkaEnabled: kafkaEnabled
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    zoneRedundant: skuTier == 'Premium'
  }
}

// ---- Telemetry Events Hub ----

resource telemetryEventsHub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: eventHubNamespace
  name: 'telemetry-events'
  properties: {
    messageRetentionInDays: messageRetentionDays
    partitionCount: partitionCount
    status: 'Active'
  }
}

// Consumer group for Azure Data Explorer
resource adxConsumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: telemetryEventsHub
  name: 'adx-consumer'
  properties: {
    userMetadata: 'Consumer group for Azure Data Explorer ingestion'
  }
}

// Consumer group for Azure Databricks
resource databricksConsumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: telemetryEventsHub
  name: 'databricks-consumer'
  properties: {
    userMetadata: 'Consumer group for Azure Databricks streaming'
  }
}

// Consumer group for OTel Collector traces
resource otelConsumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: telemetryEventsHub
  name: 'otel-consumer'
  properties: {
    userMetadata: 'Consumer group for OpenTelemetry Collector'
  }
}

// ---- OTel Traces Hub (from Collector Kafka exporter) ----

resource otelTracesHub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: eventHubNamespace
  name: 'otel-traces'
  properties: {
    messageRetentionInDays: messageRetentionDays
    partitionCount: 2
    status: 'Active'
  }
}

// ---- Authorization Rules ----

// Send-only policy for the Next.js app
resource sendPolicy 'Microsoft.EventHub/namespaces/authorizationRules@2024-01-01' = {
  parent: eventHubNamespace
  name: 'app-send-policy'
  properties: {
    rights: [
      'Send'
    ]
  }
}

// Listen-only policy for consumers (ADX, Databricks)
resource listenPolicy 'Microsoft.EventHub/namespaces/authorizationRules@2024-01-01' = {
  parent: eventHubNamespace
  name: 'consumer-listen-policy'
  properties: {
    rights: [
      'Listen'
    ]
  }
}

// Full access for OTel Collector (needs Send for Kafka exporter)
resource otelPolicy 'Microsoft.EventHub/namespaces/authorizationRules@2024-01-01' = {
  parent: eventHubNamespace
  name: 'otel-policy'
  properties: {
    rights: [
      'Send'
      'Listen'
    ]
  }
}

// ---- Outputs ----

output namespaceName string = eventHubNamespace.name
output namespaceId string = eventHubNamespace.id
output namespaceFqdn string = '${eventHubNamespace.name}.servicebus.windows.net'
output sendConnectionString string = sendPolicy.listKeys().primaryConnectionString
output listenConnectionString string = listenPolicy.listKeys().primaryConnectionString
output otelConnectionString string = otelPolicy.listKeys().primaryConnectionString
output telemetryEventHubName string = telemetryEventsHub.name
output otelTracesHubName string = otelTracesHub.name

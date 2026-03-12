// ============================================
// Azure Data Explorer (Kusto) Cluster
//
// Ingests telemetry events from Event Hubs for:
//   - KQL queries (real-time analytics)
//   - Power BI dashboards (via ADX connector)
//   - Geo-analysis (country, region, city)
//   - User behavior analytics
// ============================================

@description('Resource name prefix')
param namePrefix string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('ADX SKU name')
@allowed(['Dev(No SLA)_Standard_E2a_v4', 'Standard_E2a_v4', 'Standard_E4a_v4'])
param skuName string = 'Dev(No SLA)_Standard_E2a_v4'

@description('Number of instances')
@minValue(1)
@maxValue(10)
param capacity int = 1

@description('Database retention in days')
@minValue(1)
@maxValue(3650)
param retentionDays int = 365

@description('Database cache period in days')
@minValue(1)
@maxValue(3650)
param cacheDays int = 31

@description('Event Hub resource ID for data connection')
param eventHubResourceId string = ''

@description('Event Hub consumer group for ADX')
param eventHubConsumerGroup string = 'adx-consumer'

@description('Event Hub namespace resource ID (for role assignment)')
param eventHubNamespaceId string = ''

// ---- ADX Cluster ----

resource adxCluster 'Microsoft.Kusto/clusters@2023-08-15' = {
  name: '${replace(namePrefix, '-', '')}adx'
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName == 'Dev(No SLA)_Standard_E2a_v4' ? 'Basic' : 'Standard'
    capacity: capacity
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    enableStreamingIngest: true
    enableAutoStop: true
    enablePurge: false
    publicNetworkAccess: 'Enabled'
  }
}

// ---- Telemetry Database ----

resource telemetryDb 'Microsoft.Kusto/clusters/databases@2023-08-15' = {
  parent: adxCluster
  name: 'TelemetryDb'
  location: location
  kind: 'ReadWrite'
  properties: {
    softDeletePeriod: 'P${retentionDays}D'
    hotCachePeriod: 'P${cacheDays}D'
  }
}

// ---- Table Schema Script ----
// Creates the telemetry tables and ingestion mappings

resource tableScript 'Microsoft.Kusto/clusters/databases/scripts@2023-08-15' = {
  parent: telemetryDb
  name: 'create-tables'
  properties: {
    scriptContent: '''
      // Page view and interaction events from Event Hubs
      .create-merge table TelemetryEvents (
        EventType: string,
        Timestamp: datetime,
        SessionId: string,
        VisitorId: string,
        Url: string,
        Path: string,
        Referrer: string,
        UserAgent: string,
        ScreenWidth: int,
        ScreenHeight: int,
        Language: string,
        Timezone: string,
        Country: string,
        City: string,
        Region: string,
        Properties: dynamic
      )

      // JSON ingestion mapping for Event Hub data
      .create-or-alter table TelemetryEvents ingestion json mapping 'TelemetryEventsMapping' '[{"column":"EventType","path":"$.eventType","datatype":"string"},{"column":"Timestamp","path":"$.timestamp","datatype":"datetime"},{"column":"SessionId","path":"$.sessionId","datatype":"string"},{"column":"VisitorId","path":"$.visitorId","datatype":"string"},{"column":"Url","path":"$.url","datatype":"string"},{"column":"Path","path":"$.path","datatype":"string"},{"column":"Referrer","path":"$.referrer","datatype":"string"},{"column":"UserAgent","path":"$.userAgent","datatype":"string"},{"column":"ScreenWidth","path":"$.screenWidth","datatype":"int"},{"column":"ScreenHeight","path":"$.screenHeight","datatype":"int"},{"column":"Language","path":"$.language","datatype":"string"},{"column":"Timezone","path":"$.timezone","datatype":"string"},{"column":"Country","path":"$.country","datatype":"string"},{"column":"City","path":"$.city","datatype":"string"},{"column":"Region","path":"$.region","datatype":"string"},{"column":"Properties","path":"$.properties","datatype":"dynamic"}]'

      // Materialized view for page views per day per country
      .create-or-alter materialized-view PageViewsByCountry on table TelemetryEvents
      {
        TelemetryEvents
        | where EventType == "page_view" or EventType == "blog_view"
        | summarize ViewCount = count(), UniqueVisitors = dcount(VisitorId)
          by Country, Path, bin(Timestamp, 1d)
      }

      // Materialized view for daily unique visitors
      .create-or-alter materialized-view DailyUniqueVisitors on table TelemetryEvents
      {
        TelemetryEvents
        | where EventType == "page_view" or EventType == "blog_view"
        | summarize UniqueVisitors = dcount(VisitorId), TotalViews = count()
          by bin(Timestamp, 1d)
      }

      // Retention policy: keep raw data for 365 days
      .alter-merge table TelemetryEvents policy retention softdelete = 365d

      // Caching policy: hot cache for 31 days
      .alter-merge table TelemetryEvents policy caching hot = 31d
    '''
    continueOnErrors: true
    forceUpdateTag: 'v1'
  }
}

// ---- Role Assignment: ADX → Event Hub Data Receiver ----
// ADX managed identity needs read access to Event Hub for data ingestion

resource eventHubRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (eventHubNamespaceId != '') {
  name: guid(adxCluster.id, eventHubNamespaceId, 'a638d3c7-ab3a-488d-b6eb-53e5f7cc5e4f') // Azure Event Hubs Data Receiver
  scope: eventHubNamespaceRef
  properties: {
    principalId: adxCluster.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a638d3c7-ab3a-488d-b6eb-53e5f7cc5e4f')
    principalType: 'ServicePrincipal'
  }
}

resource eventHubNamespaceRef 'Microsoft.EventHub/namespaces@2024-01-01' existing = if (eventHubNamespaceId != '') {
  name: last(split(eventHubNamespaceId, '/'))
}

// ---- Event Hub Data Connection ----
// Auto-ingests from Event Hubs into ADX

resource dataConnection 'Microsoft.Kusto/clusters/databases/dataConnections@2023-08-15' = if (eventHubResourceId != '') {
  parent: telemetryDb
  name: 'eh-telemetry-ingestion'
  location: location
  kind: 'EventHub'
  properties: {
    eventHubResourceId: eventHubResourceId
    consumerGroup: eventHubConsumerGroup
    tableName: 'TelemetryEvents'
    mappingRuleName: 'TelemetryEventsMapping'
    dataFormat: 'MULTIJSON'
    compression: 'None'
    managedIdentityResourceId: adxCluster.id
  }
  dependsOn: [
    tableScript
    eventHubRoleAssignment
  ]
}

// ---- Outputs ----

output clusterName string = adxCluster.name
output clusterId string = adxCluster.id
output clusterUri string = adxCluster.properties.uri
output databaseName string = telemetryDb.name
output principalId string = adxCluster.identity.principalId

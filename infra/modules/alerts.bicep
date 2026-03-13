// ============================================
// Telemetry Pipeline Monitoring & Alerts
//
// Alerts for:
//   - Event Hub ingestion failures & throttling
//   - ADX ingestion latency & failures
//   - Telemetry API error rate (App Insights)
//   - Web app availability (App Insights)
// ============================================

@description('Resource name prefix')
param namePrefix string

@description('Resource tags')
param tags object

@description('Event Hub namespace resource ID')
param eventHubNamespaceId string

@description('ADX cluster resource ID')
param adxClusterId string

@description('Application Insights resource ID')
param appInsightsId string

@description('Email address for alert notifications')
@secure()
param alertEmail string

// ---- Action Group (email notification) ----

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${namePrefix}-telemetry-alerts-ag'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'TelAlerts'
    enabled: true
    emailReceivers: [
      {
        name: 'AdminEmail'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// ============================================
// Event Hub Alerts
// ============================================

// Alert: Event Hub incoming message drop (no messages for 1 hour)
resource eventHubNoIncomingMessages 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-eh-no-incoming-messages'
  location: 'global'
  tags: tags
  properties: {
    description: 'No incoming messages to Event Hub for 1 hour — telemetry pipeline may be down.'
    severity: 1
    enabled: true
    scopes: [eventHubNamespaceId]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'NoIncomingMessages'
          metricName: 'IncomingMessages'
          metricNamespace: 'Microsoft.EventHub/namespaces'
          operator: 'LessThanOrEqual'
          threshold: 0
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: Event Hub throttled requests
resource eventHubThrottled 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-eh-throttled-requests'
  location: 'global'
  tags: tags
  properties: {
    description: 'Event Hub is throttling requests — consider scaling throughput units.'
    severity: 2
    enabled: true
    scopes: [eventHubNamespaceId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ThrottledRequests'
          metricName: 'ThrottledRequests'
          metricNamespace: 'Microsoft.EventHub/namespaces'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: Event Hub server errors
resource eventHubServerErrors 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-eh-server-errors'
  location: 'global'
  tags: tags
  properties: {
    description: 'Event Hub server errors detected — messages may be lost.'
    severity: 1
    enabled: true
    scopes: [eventHubNamespaceId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricName: 'ServerErrors'
          metricNamespace: 'Microsoft.EventHub/namespaces'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// ============================================
// ADX (Data Explorer) Alerts
// ============================================

// Alert: ADX ingestion latency high
resource adxIngestionLatency 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-adx-ingestion-latency'
  location: 'global'
  tags: tags
  properties: {
    description: 'ADX ingestion latency exceeds 5 minutes — data may be delayed in dashboards.'
    severity: 2
    enabled: true
    scopes: [adxClusterId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'IngestionLatency'
          metricName: 'IngestionLatencyInSeconds'
          metricNamespace: 'Microsoft.Kusto/clusters'
          operator: 'GreaterThan'
          threshold: 300
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: ADX ingestion failures
resource adxIngestionFailures 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-adx-ingestion-failures'
  location: 'global'
  tags: tags
  properties: {
    description: 'ADX ingestion failures detected — telemetry events may not be reaching analytics.'
    severity: 1
    enabled: true
    scopes: [adxClusterId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'IngestionFailures'
          metricName: 'IngestionResult'
          metricNamespace: 'Microsoft.Kusto/clusters'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
          dimensions: [
            {
              name: 'IngestionResultDetails'
              operator: 'Include'
              values: ['Permanent_Failure', 'Transient_Failure']
            }
          ]
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: ADX cluster stopped (CPU drops to 0)
resource adxClusterStopped 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-adx-cluster-stopped'
  location: 'global'
  tags: tags
  properties: {
    description: 'ADX cluster appears stopped — ingestion pipeline is broken.'
    severity: 1
    enabled: true
    scopes: [adxClusterId]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ClusterCPU'
          metricName: 'CPU'
          metricNamespace: 'Microsoft.Kusto/clusters'
          operator: 'LessThanOrEqual'
          threshold: 0
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// ============================================
// Application Insights Alerts (Telemetry API)
// ============================================

// Alert: Telemetry API error rate spike
resource telemetryApiErrors 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-ai-telemetry-api-errors'
  location: 'global'
  tags: tags
  properties: {
    description: 'Telemetry API returning >5% error rate — client events may be dropping.'
    severity: 2
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FailedRequests'
          metricName: 'requests/failed'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: Web app availability (response time > 5s)
resource webAppSlowResponse 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-ai-slow-response'
  location: 'global'
  tags: tags
  properties: {
    description: 'Web app response time exceeds 5 seconds — possible performance degradation.'
    severity: 2
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'SlowResponse'
          metricName: 'requests/duration'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 5000
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// ---- Outputs ----

output actionGroupId string = actionGroup.id
output actionGroupName string = actionGroup.name

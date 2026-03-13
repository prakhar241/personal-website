// ============================================
// Azure Communication Services - Email
// ============================================

@description('Name prefix for resources')
param namePrefix string

@description('Tags for all resources')
param tags object = {}

@description('Data location for ACS (e.g. United States)')
param dataLocation string = 'United States'

// ---- Email Service & Domain (created first) ----

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${namePrefix}-email'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: dataLocation
  }
}

// Azure-managed domain (DoNotReply@<guid>.azurecomm.net) — works out of the box
resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

// ---- Communication Service (linked to email domain) ----

resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${namePrefix}-acs'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: dataLocation
    linkedDomains: [
      azureManagedDomain.id
    ]
  }
}

// ---- Outputs ----

@description('ACS connection string for sending emails')
output connectionString string = acs.listKeys().primaryConnectionString

@description('ACS resource name')
output name string = acs.name

@description('Default sender address (Azure managed domain)')
output defaultSenderAddress string = 'DoNotReply@${azureManagedDomain.properties.mailFromSenderDomain}'

@description('Storage account name (must be globally unique, alphanumeric, lowercase)')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Blob container name')
param containerName string

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'Blob'
  }
}

output name string = storage.name
output primaryKey string = storage.listKeys().keys[0].value
output blobEndpoint string = storage.properties.primaryEndpoints.blob

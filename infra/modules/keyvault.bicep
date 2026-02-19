@description('Key Vault name')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

output name string = keyVault.name
output uri string = keyVault.properties.vaultUri
output id string = keyVault.id

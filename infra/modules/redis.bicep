@description('Redis cache name')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('SKU name')
@allowed(['Basic', 'Standard', 'Premium'])
param skuName string

@description('SKU family')
param skuFamily string

@description('SKU capacity')
param skuCapacity int

resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
      family: skuFamily
      capacity: skuCapacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

output hostname string = redis.properties.hostName
output port int = redis.properties.sslPort
output name string = redis.name

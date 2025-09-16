@description('Search service location')
param location string

@description('Search service name')
param name string

@description('Replica count')
param replicaCount int = 1

@description('Partition count')
param partitionCount int = 1

@description('Environment name for tagging')
param environmentName string = 'dev'

resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: name
  location: location
  sku: {
    name: 'free'
  }
  properties: {
    replicaCount: replicaCount
    partitionCount: partitionCount
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    networkRuleSet: {
      ipRules: []
    }
  }
  tags: {
    environment: environmentName
    'azd-env-name': environmentName
    application: 'socbot'
    component: 'search'
  }
}

output searchServiceName string = searchService.name
output searchServiceId string = searchService.id
output searchServiceUrl string = 'https://${searchService.name}.search.windows.net/'

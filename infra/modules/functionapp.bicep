@description('Function App location')
param location string

@description('Function App name')
param name string

@description('Plan name')
param planName string

@description('Plan SKU (Y1, EP1, S1, etc)')
param planSku string = 'Y1'

@description('Node (major) runtime version, e.g. 20 or 22')
param nodeVersion string = '20'

@description('Deploy on Linux (true) or Windows (false)')
param useLinux bool = true

@description('Max elastic workers (Consumption/E*)')
param maxElasticWorkers int = 1

@description('Optional App Insights resource ID to tag for deep linking')
param appInsightsResourceId string = ''

@description('Backing storage account name (for AzureWebJobsStorage)')
param storageAccountName string

@description('Optional additional app settings (array of objects { name, value })')
param additionalAppSettings array = []

@description('User-assigned managed identity resource ID to attach')
param userAssignedIdentityResourceId string = ''

@description('Environment name for resource tagging')
param environmentName string = 'dev'

@description('Function App scale limit')
param functionAppScaleLimit int = 100

@description('Function runtime memory MB')
param functionRuntimeMemoryMB int = 1536

// Derive tier from sku
var planTier = startsWith(planSku, 'Y') ? 'Dynamic' : (startsWith(planSku, 'EP') ? 'ElasticPremium' : 'Standard')

// Get storage key for connection string
var storageKey = listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value
var azureWebJobsStorage = 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${storageKey};EndpointSuffix=core.windows.net'

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  sku: {
    name: planSku
    capacity: planSku == 'Y1' ? 0 : 1
  }
  properties: {
    maximumElasticWorkerCount: planTier == 'Dynamic' ? maxElasticWorkers : null
    reserved: useLinux
  }
  tags: {
    environment: environmentName
    'azd-env-name': environmentName
    application: 'socbot'
    component: 'function-app-plan'
  }
}

// Build base app settings
var baseAppSettings = [
  {
    name: 'FUNCTIONS_WORKER_RUNTIME'
    value: 'node'
  }
  {
    name: 'WEBSITE_NODE_DEFAULT_VERSION'
    value: nodeVersion
  }
  {
    name: 'AzureWebJobsStorage'
    value: azureWebJobsStorage
  }
  {
    name: 'WEBSITE_RUN_FROM_PACKAGE'
    value: '1'
  }
  {
    name: 'FUNCTIONS_EXTENSION_VERSION'
    value: '~4'
  }
  {
    name: 'RUNTIME_MEMORY_MB'
    value: string(functionRuntimeMemoryMB)
  }
]

// Windows content share settings (avoid for Linux to prevent 403 issues)
var contentShareSettings = useLinux ? [] : [
  {
    name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
    value: azureWebJobsStorage
  }
  {
    name: 'WEBSITE_CONTENTSHARE'
    value: toLower(replace(name, '-', ''))
  }
]

resource func 'Microsoft.Web/sites@2023-01-01' = {
  name: name
  location: location
  kind: useLinux ? 'functionapp,linux' : 'functionapp'
  identity: empty(userAssignedIdentityResourceId) ? null : {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityResourceId}': {}
    }
  }
  tags: union({
    environment: environmentName
    'azd-env-name': environmentName
    application: 'socbot'
    component: 'function-app'
  }, empty(appInsightsResourceId) ? {} : {
    'hidden-link: /app-insights-resource-id': appInsightsResourceId
  })
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: useLinux ? 'NODE|${nodeVersion}' : null
      appSettings: union(union(baseAppSettings, contentShareSettings), additionalAppSettings)
      cors: {
        allowedOrigins: ['*']
      }
      functionAppScaleLimit: functionAppScaleLimit
      // Note: functionRuntimeMemoryMB is informational for documentation
    }
  }
}

output hostname string = func.properties.defaultHostName
output functionAppName string = func.name
output functionAppId string = func.id
output functionAppUrl string = 'https://${func.properties.defaultHostName}'
output planId string = plan.id

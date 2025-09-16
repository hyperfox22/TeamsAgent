@description('Bot service location')
param location string = 'global'

@description('Bot service name')
param name string

@description('Bot service SKU')
param sku string = 'F0'

@description('Enable Teams channel')
param enableTeamsChannel bool = true

@description('Microsoft App ID')
param msaAppId string

@description('Bot endpoint URL')
param endpoint string

@description('Environment name for tagging')
param environmentName string = 'dev'

resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  name: name
  location: location
  sku: {
    name: sku
  }
  kind: 'azurebot'
  properties: {
    displayName: 'SOCBot'
    description: 'Security Operations Center Teams Bot'
    endpoint: endpoint
    msaAppId: msaAppId
    msaAppType: 'SingleTenant'
    msaAppTenantId: tenant().tenantId
    schemaTransformationVersion: '1.3'
  }
  tags: {
    environment: environmentName
    'azd-env-name': environmentName
    application: 'socbot'
    component: 'bot-service'
  }
}

resource teamsChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = if (enableTeamsChannel) {
  parent: botService
  name: 'MsTeamsChannel'
  location: location
  properties: {
    channelName: 'MsTeamsChannel'
    properties: {
      isEnabled: true
    }
  }
}

output botId string = botService.id
output botName string = botService.name
output botEndpoint string = botService.properties.endpoint

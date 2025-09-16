@description('Bot service name')
param name string

@description('Location for the bot service')
param location string = 'global'

@description('Microsoft App ID for the bot')
param microsoftAppId string

@description('Bot endpoint URL')
param endpoint string

@description('Bot display name')
param displayName string

@description('Bot description text')
param botDescription string = 'SOCBot - Security Operations Center Teams Bot'

@description('Environment name for resource tagging')
param environmentName string = 'dev'

@description('Pricing tier for the bot service')
@allowed(['F0', 'S1'])
param pricingTier string = 'F0'

@description('App type for the bot')
@allowed(['MultiTenant', 'SingleTenant', 'UserAssignedMSI'])
param appType string = 'SingleTenant'

resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  name: name
  location: location
  sku: {
    name: pricingTier
  }
  kind: 'azurebot'
  properties: {
    displayName: displayName
    description: botDescription
    endpoint: endpoint
    msaAppId: microsoftAppId
    msaAppType: appType
    schemaTransformationVersion: '1.3'
  }
  tags: {
    environment: environmentName
    'azd-env-name': environmentName
    application: 'socbot'
    component: 'bot-service'
  }
}

// Configure Teams channel
resource teamsChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
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

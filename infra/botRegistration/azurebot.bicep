@description('Name of the bot')
param botName string = 'socbot-${uniqueString(resourceGroup().id)}'

@description('The globally unique and immutable bot ID. Also used to configure the displayName of the bot, which is mutable.')
param botAppId string

@description('Location for all resources.')
param location string = resourceGroup().location

@description('The messaging endpoint of the bot')
param messagingEndpoint string

@description('Description of the bot')
param botDescription string = 'SOCBot - AI-powered Security Operations Center assistant for Microsoft Teams'

@description('The pricing tier of the Bot Service')
@allowed([
  'F0'
  'S1'
])
param sku string = 'F0'

@description('Kind of Bot. Possible values are: azurebot, bot, designer, function, sdk.')
@allowed([
  'azurebot'
  'bot'
  'designer'
  'function'
  'sdk'
])
param kind string = 'azurebot'

@description('Tenant to deploy the Azure Bot Service to')
param tenantId string = subscription().tenantId

// Bot Service
resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  name: botName
  location: location
  kind: kind
  sku: {
    name: sku
  }
  properties: {
    displayName: 'SOCBot'
    description: botDescription
    iconUrl: 'https://docs.botframework.com/static/devportal/client/images/bot-framework-default.png'
    endpoint: messagingEndpoint
    msaAppId: botAppId
    msaAppTenantId: tenantId
    msaAppType: 'SingleTenant'
    luisAppIds: []
    schemaTransformationVersion: '1.3'
    isCmekEnabled: false
    publicNetworkAccess: 'Enabled'
  }
  tags: {
    'azd-env-name': botName
  }
}

// Teams Channel
resource teamsChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: botService
  name: 'MsTeamsChannel'
  location: location
  properties: {
    channelName: 'MsTeamsChannel'
    properties: {
      enableCalling: false
      isEnabled: true
      acceptedTerms: true
    }
  }
}

// WebChat Channel (for testing)
resource webChatChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: botService
  name: 'WebChatChannel'
  location: location
  properties: {
    channelName: 'WebChatChannel'
    properties: {
      sites: [
        {
          siteName: 'Default Site'
          isEnabled: true
          isV1Enabled: true
          isV3Enabled: true
          isWebchatPreviewEnabled: true
        }
      ]
    }
  }
}

// Output
@description('Bot Service resource ID')
output botServiceId string = botService.id

@description('Bot Service name')
output botServiceName string = botService.name

@description('Bot Framework App ID')
output botAppId string = botService.properties.msaAppId

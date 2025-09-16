@description('Azure region for deployment')
param location string = resourceGroup().location

@description('Base name (short) used as prefix in resource names')
param baseName string = 'socai'

@description('Environment - drives naming and tags')
@allowed([ 'dev', 'qa', 'prod' ])
param env string = 'dev'

// Feature toggles
@description('Deploy Bot Service registration')
param deployBot bool = true
@description('Enable Teams channel (post-provision configuration may still be needed)')
param enableTeamsChannel bool = true
@description('Deploy Azure OpenAI (preview / gated access)')
param deployOpenAI bool = false
@description('Deploy AI Foundry (Azure AI Services) account with project & model')
param deployAiFoundry bool = true

// Identity data-plane / service access role toggles
@description('Storage blob role mode for UAMI')
@allowed([ 'None','Contributor','Owner' ])
param storageBlobRoleMode string = 'Contributor'

@description('Assign Monitoring Metrics Publisher on App Insights to allow custom metric emission')
param assignMonitoringMetricsPublisher bool = true

@description('Assign Cognitive Services OpenAI User role when OpenAI deployed')
param assignOpenAIUserRole bool = true

@description('Assign Search Service Contributor & Search Index Data Contributor roles')
param assignSearchRoles bool = true

@description('Assign Key Vault Secrets User role to the managed identity')
param assignKvSecretsUser bool = true

// Role assignment controls
@description('Assign a control plane Cosmos DB role (e.g., DocumentDB Account Contributor) to the user-assigned managed identity')
param assignCosmosControlPlaneRole bool = false
@description('Control plane Cosmos DB role definition ID (default: DocumentDB Account Contributor)')
param cosmosControlPlaneRoleDefinitionId string = '5bd9cd88-fe45-4216-938b-f97437e15450'

// Cosmos DB customization
@description('Cosmos DB database name')
param cosmosDbName string = 'appdb'
@description('Override region for Cosmos DB (leave empty to use overall location)')
param cosmosLocation string = ''
@description('Optional explicit Cosmos DB account name (must be globally unique). Leave empty to derive.')
param cosmosAccountNameOverride string = ''
@description('Optional random suffix seed (leave empty to skip). When provided, a uniqueString() hash will be appended to Cosmos account name unless override is used.')
param cosmosAccountRandomSuffix string = ''
@description('Enable Cosmos DB free tier (only allowed once per subscription).')
param enableCosmosFreeTier bool = false
@description('Cosmos DB containers specification')
param cosmosContainers array = [
  {
    name: 'conversations'
    partitionKey: '/id'
  }
  {
    name: 'incidents'
    partitionKey: '/id'
  }
  {
    name: 'messages'
    partitionKey: '/conversationId'
  }
]

// Function App
@description('Node.js version for Function runtime')
param functionNodeVersion string = '20'
@description('Plan SKU (Y1 = Consumption, EP1 = Elastic Premium, S1 = Standard)')
param functionPlanSku string = 'Y1'
@description('Max elastic workers (Consumption/E* tiers)')
param functionMaxElasticWorkers int = 1
@description('Run Function App on Linux (true) or Windows (false)')
param functionUseLinux bool = true
@description('Optional Function App name override (leave empty to use derived)')
param functionAppNameOverride string = ''
@description('Function App instance scale limit')
param functionAppScaleLimit int = 100
@description('Function runtime memory MB (advisory)')
param functionRuntimeMemoryMB int = 1536

// Storage / Key Vault
@description('Storage SKU')
param storageSku string = 'Standard_LRS'
@description('Optional explicit Storage Account name (3-24 lowercase letters/numbers). Leave empty to derive.')
param storageAccountNameOverride string = ''
@description('Optional random suffix seed for Storage Account. Adds 4-char deterministic hash if provided.')
param storageAccountRandomSuffix string = ''
@description('Key Vault SKU')
@allowed(['standard','premium'])
param keyVaultSku string = 'standard'
@description('Attempt restore of soft-deleted Key Vault with same name')
param restoreKeyVault bool = false

// Search
@description('Azure AI Search replica count')
param searchReplicaCount int = 1
@description('Azure AI Search partition count')
param searchPartitionCount int = 1

// Bot
@description('Bot Service SKU')
@allowed(['F0','S1'])
param botSku string = 'F0'

// OpenAI
@description('Deploy OpenAI chat model capacity units')
param openAIChatCapacity int = 30

// Teams packaging convenience
@description('Microsoft Teams App (manifest) ID')
param teamsAppId string = '00000000-0000-0000-0000-000000000000'

@description('Existing Bot AAD (MSA) App Registration Client ID (required when deployBot=true)')
@minLength(36)
param botMsaAppId string

@description('Name of user-assigned managed identity (will be created)')
param userAssignedIdentityName string = '${baseName}${toLower(env)}-uami'

// AI Foundry model parameters
@description('Chat model deployment name')
param chatModelName string = 'gpt-4.1-mini'
@description('Chat model version')
param chatModelVersion string = '2025-04-14'
@description('AI Foundry project name')
param aiFoundryProjectName string = '${baseName}-project'

// Derived naming
var lowerEnv = toLower(env)
var nameRoot = toLower('${baseName}${lowerEnv}')
var storageBaseName = '${nameRoot}st'
var storageWithSuffix = empty(storageAccountRandomSuffix) ? storageBaseName : '${storageBaseName}${substring(uniqueString(resourceGroup().id, storageAccountRandomSuffix),0,4)}'
var storageNameRaw = empty(storageAccountNameOverride) ? storageWithSuffix : storageAccountNameOverride
var storageName = length(storageNameRaw) > 24 ? substring(toLower(storageNameRaw), 0, 24) : toLower(storageNameRaw)
var kvName = '${nameRoot}-kv'
var funcBaseName = '${nameRoot}-funcapp'
var funcName = empty(functionAppNameOverride) ? funcBaseName : functionAppNameOverride
var aiName = '${nameRoot}-appi'
var cosmosName = '${nameRoot}-cos'
var cosmosBase = cosmosName
var cosmosWithSuffix = empty(cosmosAccountRandomSuffix) ? cosmosBase : '${cosmosBase}${substring(uniqueString(resourceGroup().id, cosmosAccountRandomSuffix),0,6)}'
var effectiveCosmosName = empty(cosmosAccountNameOverride) ? cosmosWithSuffix : cosmosAccountNameOverride
var effectiveCosmosLocation = empty(cosmosLocation) ? location : cosmosLocation
var searchName = '${nameRoot}-srch'
var botName = '${nameRoot}-bot'
var openAIName = '${nameRoot}-oai'
var aiFoundryName = '${nameRoot}-aifoundry'
var functionAppDefaultHostname = '${funcName}.azurewebsites.net'

// User-assigned managed identity
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: userAssignedIdentityName
  location: location
  tags: {
    environment: env
    'azd-env-name': env
    application: 'socbot'
    component: 'identity'
  }
}

// Application Insights
resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: aiName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
  tags: {
    environment: env
    'azd-env-name': env
    application: 'socbot'
    component: 'monitoring'
  }
}

// Modules
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    name: storageName
    skuName: storageSku
    environmentName: env
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    name: kvName
    skuName: keyVaultSku
    restore: restoreKeyVault
    environmentName: env
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: effectiveCosmosLocation
    accountName: effectiveCosmosName
    dbName: cosmosDbName
    containers: cosmosContainers
    enableFreeTier: enableCosmosFreeTier
    environmentName: env
  }
}

module search 'modules/search.bicep' = {
  name: 'search'
  params: {
    location: location
    name: searchName
    replicaCount: searchReplicaCount
    partitionCount: searchPartitionCount
    environmentName: env
  }
}

module bot 'modules/bot.bicep' = if (deployBot) {
  name: 'bot'
  params: {
    location: 'global'
    name: botName
    sku: botSku
    enableTeamsChannel: enableTeamsChannel
    msaAppId: botMsaAppId
    endpoint: 'https://${functionAppDefaultHostname}/api/messages'
    environmentName: env
  }
}

module aifoundry 'modules/aifoundry.bicep' = if (deployAiFoundry) {
  name: 'aifoundry'
  params: {
    location: location
    accountName: aiFoundryName
    userAssignedIdentityResourceId: uami.id
    deployModel: true
    modelName: chatModelName
    modelVersion: chatModelVersion
    modelSkuName: 'GlobalStandard'
    modelCapacity: openAIChatCapacity
    projectName: aiFoundryProjectName
    deployDefenderForAI: false
    defenderForAIState: 'Disabled'
    deployRaiPolicyDefault: true
    deployRaiPolicyDefaultV2: true
    modelRaiPolicyName: 'Microsoft.DefaultV2'
  }
}

// Build dynamic function app settings
var functionExtraAppSettingsBase = [
  {
    name: 'COSMOS_ACCOUNT_NAME'
    value: cosmos.outputs.accountName
  }
  {
    name: 'COSMOS_DATABASE'
    value: cosmosDbName
  }
  {
    name: 'COSMOS_CONTAINER'
    value: 'conversations'
  }
  {
    name: 'KEYVAULT_NAME'
    value: kvName
  }
  {
    name: 'SEARCH_SERVICE_NAME'
    value: search.outputs.searchServiceName
  }
  {
    name: 'TEAMS_APP_ID'
    value: teamsAppId
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appi.properties.ConnectionString
  }
  {
    name: 'AI_FOUNDRY_ACCOUNT_NAME'
    value: deployAiFoundry ? aiFoundryName : ''
  }
  {
    name: 'AI_FOUNDRY_ENDPOINT'
    value: deployAiFoundry ? 'https://${aiFoundryName}.cognitiveservices.azure.com/' : ''
  }
  {
    name: 'AI_FOUNDRY_PROJECT_NAME'
    value: deployAiFoundry ? 'socbot' : ''
  }
]

module functionapp 'modules/functionapp.bicep' = {
  name: 'functionapp'
  params: {
    location: location
    name: funcName
    planName: '${funcName}-plan'
    planSku: functionPlanSku
    nodeVersion: functionNodeVersion
    maxElasticWorkers: functionMaxElasticWorkers
    storageAccountName: storage.outputs.storageAccountName
    additionalAppSettings: functionExtraAppSettingsBase
    userAssignedIdentityResourceId: uami.id
    useLinux: functionUseLinux
    appInsightsResourceId: appi.id
    functionAppScaleLimit: functionAppScaleLimit
    functionRuntimeMemoryMB: functionRuntimeMemoryMB
    environmentName: env
  }
}

// Consolidated identity role assignments
module identityRoles 'modules/identityRoles.bicep' = {
  name: 'identityRoles'
  params: {
    principalId: uami.properties.principalId
    keyVaultName: kvName
    assignKvSecretsUser: assignKvSecretsUser
    assignCosmosControlPlaneRole: assignCosmosControlPlaneRole
    cosmosControlPlaneRoleDefinitionId: cosmosControlPlaneRoleDefinitionId
    cosmosAccountName: effectiveCosmosName
    storageAccountName: storageName
    searchServiceName: searchName
    openAIAccountName: openAIName
    deployOpenAI: deployOpenAI
    storageBlobRoleMode: storageBlobRoleMode
    assignMonitoringMetricsPublisher: assignMonitoringMetricsPublisher
    appInsightsName: aiName
    assignSearchRoles: assignSearchRoles
    assignOpenAIUserRole: assignOpenAIUserRole
  }
  dependsOn: [
    storage
    keyvault
    search
    appi
    cosmos
  ]
}

// Outputs
output functionAppHostname string = functionapp.outputs.hostname
output functionAppName string = functionapp.outputs.functionAppName
output functionAppUrl string = 'https://${functionapp.outputs.hostname}'
output botServiceName string = deployBot ? botName : ''
output storageAccountName string = storage.outputs.storageAccountName
output searchServiceName string = search.outputs.searchServiceName
output cosmosAccountName string = cosmos.outputs.accountName
output aiFoundryAccountName string = deployAiFoundry ? aiFoundryName : ''
output aiFoundryEndpoint string = deployAiFoundry ? 'https://${aiFoundryName}.cognitiveservices.azure.com/' : ''
output keyVaultName string = kvName
output resourceGroupName string = resourceGroup().name
output environmentName string = env

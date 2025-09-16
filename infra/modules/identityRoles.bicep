@description('Managed identity principal ID')
param principalId string

@description('Key Vault name')
param keyVaultName string

@description('Assign Key Vault Secrets User role')
param assignKvSecretsUser bool = true

@description('Assign Cosmos control plane role')
param assignCosmosControlPlaneRole bool = false

@description('Cosmos control plane role definition ID')
param cosmosControlPlaneRoleDefinitionId string = '5bd9cd88-fe45-4216-938b-f97437e15450'

@description('Cosmos account name')
param cosmosAccountName string

@description('Storage account name')
param storageAccountName string

@description('Search service name')
param searchServiceName string

@description('OpenAI account name')
param openAIAccountName string

@description('Deploy OpenAI flag')
param deployOpenAI bool = false

@description('Storage blob role mode')
@allowed(['None', 'Contributor', 'Owner'])
param storageBlobRoleMode string = 'Contributor'

@description('Assign monitoring metrics publisher role')
param assignMonitoringMetricsPublisher bool = true

@description('Application Insights name')
param appInsightsName string

@description('Assign search roles')
param assignSearchRoles bool = true

@description('Assign OpenAI user role')
param assignOpenAIUserRole bool = true

// Role Definition IDs
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataContributorRoleId = '17d1049b-9a84-46fb-8f53-869881c3d3ab'
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var monitoringMetricsPublisherRoleId = '3913510d-42f4-4e42-8a64-420c390055eb'
var searchServiceContributorRoleId = '7ca78c08-252a-4471-8644-bb5ff32d4ba0'
var searchIndexDataContributorRoleId = '1243389d-3a3e-41f8-aee6-ef6e7fea8a4e'
var cognitiveServicesOpenAIUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// Get resource references
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

resource searchService 'Microsoft.Search/searchServices@2023-11-01' existing = {
  name: searchServiceName
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource openAIAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = if (deployOpenAI) {
  name: openAIAccountName
}

// Key Vault Secrets User
resource kvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignKvSecretsUser) {
  name: guid(keyVault.id, principalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Storage Blob Role
resource storageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (storageBlobRoleMode != 'None') {
  name: guid(storageAccount.id, principalId, storageBlobRoleMode == 'Owner' ? storageBlobDataOwnerRoleId : storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobRoleMode == 'Owner' ? storageBlobDataOwnerRoleId : storageBlobDataContributorRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Cosmos Control Plane Role
resource cosmosControlPlaneRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignCosmosControlPlaneRole) {
  name: guid(cosmosAccount.id, principalId, cosmosControlPlaneRoleDefinitionId)
  scope: cosmosAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cosmosControlPlaneRoleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Monitoring Metrics Publisher
resource monitoringMetricsPublisherAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignMonitoringMetricsPublisher) {
  name: guid(appInsights.id, principalId, monitoringMetricsPublisherRoleId)
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', monitoringMetricsPublisherRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Search Service Contributor
resource searchServiceContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignSearchRoles) {
  name: guid(searchService.id, principalId, searchServiceContributorRoleId)
  scope: searchService
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', searchServiceContributorRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Search Index Data Contributor
resource searchIndexDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (assignSearchRoles) {
  name: guid(searchService.id, principalId, searchIndexDataContributorRoleId)
  scope: searchService
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', searchIndexDataContributorRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// OpenAI User Role
resource openAIUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployOpenAI && assignOpenAIUserRole) {
  name: guid(openAIAccount.id, principalId, cognitiveServicesOpenAIUserRoleId)
  scope: openAIAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAIUserRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output roleIds object = {
  keyVaultSecretsUser: keyVaultSecretsUserRoleId
  storageBlobDataContributor: storageBlobDataContributorRoleId
  storageBlobDataOwner: storageBlobDataOwnerRoleId
  monitoringMetricsPublisher: monitoringMetricsPublisherRoleId
  searchServiceContributor: searchServiceContributorRoleId
  searchIndexDataContributor: searchIndexDataContributorRoleId
  cognitiveServicesOpenAIUser: cognitiveServicesOpenAIUserRoleId
}

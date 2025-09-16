@description('The name of the function app that you wish to create.')
param appName string = 'socbot-${uniqueString(resourceGroup().id)}'

@description('The language worker runtime to load in the function app.')
@allowed([
  'node'
  'dotnet'
  'java'
])
param runtime string = 'node'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('The pricing tier for the hosting plan.')
@allowed([
  'FC1'
  'EP1'
  'EP2'
  'EP3'
])
param sku string = 'FC1'

@description('Azure AI Foundry project connection string')
@secure()
param projectConnectionString string = ''

@description('Azure AI Foundry agent ID')
param agentId string = ''

@description('Microsoft Bot Framework App ID')
param botAppId string = ''

@description('Microsoft Bot Framework App Password')
@secure()
param botAppPassword string = ''

@description('Microsoft 365 App Client ID')
param m365ClientId string = ''

@description('Microsoft 365 App Client Secret')
@secure()
param m365ClientSecret string = ''

@description('Microsoft 365 Tenant ID')
param m365TenantId string = ''

@description('Azure AI Foundry project resource group name (if different from current)')
param aiProjectResourceGroup string = resourceGroup().name

@description('Azure AI Foundry project name')
param aiProjectName string = ''

@description('Azure Cognitive Services account name for AI Foundry')
param cognitiveServicesAccountName string = ''

// Variables
var functionAppName = appName
var hostingPlanName = appName
var applicationInsightsName = appName
var storageAccountName = 'socbot${uniqueString(resourceGroup().id)}'
var userAssignedIdentityName = '${appName}-identity'
var logAnalyticsName = '${appName}-logs'

// User Assigned Managed Identity
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: userAssignedIdentityName
  location: location
  tags: {
    'azd-env-name': appName
  }
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      searchVersion: 1
      legacy: 0
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
  tags: {
    'azd-env-name': appName
  }
}

// Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
  tags: {
    'azd-env-name': appName
  }
}

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'Storage'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
    allowBlobPublicAccess: false
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
  tags: {
    'azd-env-name': appName
  }
}

// App Service Plan with Flex Consumption
resource hostingPlan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: hostingPlanName
  location: location
  sku: {
    name: sku
  }
  kind: 'functionapp'
  properties: {
    reserved: true
  }
  tags: {
    'azd-env-name': appName
  }
}

// Function App
resource functionApp 'Microsoft.Web/sites@2024-11-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: hostingPlan.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}deployments'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: userAssignedIdentity.id
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: runtime
        version: '20'
      }
    }
    siteConfig: {
      cors: {
        allowedOrigins: ['*']
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storageAccount.name
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: userAssignedIdentity.properties.clientId
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: runtime
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        // Azure AI Foundry Configuration
        {
          name: 'PROJECT_CONNECTION_STRING'
          value: projectConnectionString
        }
        {
          name: 'AGENT_ID'
          value: agentId
        }
        {
          name: 'clientId'
          value: userAssignedIdentity.properties.clientId
        }
        // Bot Framework Configuration
        {
          name: 'MicrosoftAppId'
          value: botAppId
        }
        {
          name: 'MicrosoftAppPassword'
          value: botAppPassword
        }
        {
          name: 'BOT_ID'
          value: botAppId
        }
        {
          name: 'BOT_PASSWORD'
          value: botAppPassword
        }
        // Microsoft 365 Configuration
        {
          name: 'M365_CLIENT_ID'
          value: m365ClientId
        }
        {
          name: 'M365_CLIENT_SECRET'
          value: m365ClientSecret
        }
        {
          name: 'M365_TENANT_ID'
          value: m365TenantId
        }
        {
          name: 'M365_AUTHORITY_HOST'
          value: environment().authentication.loginEndpoint
        }
        {
          name: 'TEAMS_APP_ID'
          value: m365ClientId
        }
      ]
    }
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
  }
  tags: {
    'azd-env-name': appName
  }
}

// Give the managed identity Storage Blob Data Contributor role on the storage account
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, userAssignedIdentity.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  properties: {
    principalId: userAssignedIdentity.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalType: 'ServicePrincipal'
  }
}

// Give the managed identity Storage Account Contributor role for WebJobs storage operations
resource storageAccountRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, userAssignedIdentity.id, '17d1049b-9a84-46fb-8f53-869881c3d3ab')
  properties: {
    principalId: userAssignedIdentity.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '17d1049b-9a84-46fb-8f53-869881c3d3ab') // Storage Account Contributor
    principalType: 'ServicePrincipal'
  }
}

// Give the managed identity Cognitive Services User role for AI Foundry access (resource group level)
resource cognitiveServicesRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (cognitiveServicesAccountName != '') {
  scope: resourceGroup()
  name: guid(resourceGroup().id, userAssignedIdentity.id, 'a97b65f3-24c7-4388-baec-2e87135dc908')
  properties: {
    principalId: userAssignedIdentity.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908') // Cognitive Services User
    principalType: 'ServicePrincipal'
  }
}

// Give the managed identity Azure AI Developer role for AI Foundry agent operations (resource group level)
resource aiDeveloperRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (aiProjectName != '') {
  scope: resourceGroup()
  name: guid(resourceGroup().id, userAssignedIdentity.id, '64702f94-c441-49e6-a78b-ef80e0188fee')
  properties: {
    principalId: userAssignedIdentity.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '64702f94-c441-49e6-a78b-ef80e0188fee') // Azure AI Developer
    principalType: 'ServicePrincipal'
  }
}

// Give the managed identity Monitoring Metrics Publisher role for Application Insights
resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: applicationInsights
  name: guid(applicationInsights.id, userAssignedIdentity.id, '3913510d-42f4-4e42-8a64-420c390055eb')
  properties: {
    principalId: userAssignedIdentity.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb') // Monitoring Metrics Publisher
    principalType: 'ServicePrincipal'
  }
}

// Give the managed identity Log Analytics Contributor role for workspace access
resource logAnalyticsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: logAnalyticsWorkspace
  name: guid(logAnalyticsWorkspace.id, userAssignedIdentity.id, '92aaf0da-9dab-42b6-94a3-d43ce8d16293')
  properties: {
    principalId: userAssignedIdentity.properties.principalId
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '92aaf0da-9dab-42b6-94a3-d43ce8d16293') // Log Analytics Contributor
    principalType: 'ServicePrincipal'
  }
}

// Diagnostic Settings for the Function App
resource functionAppDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: functionApp
  name: 'default'
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// Output values
@description('Name of the function app')
output functionAppName string = functionApp.name

@description('Hostname of the function app')
output functionAppHostName string = functionApp.properties.defaultHostName

@description('Resource ID of the function app')
output functionAppResourceId string = functionApp.id

@description('Client ID of the user-assigned managed identity')
output managedIdentityClientId string = userAssignedIdentity.properties.clientId

@description('Principal ID of the user-assigned managed identity')
output managedIdentityPrincipalId string = userAssignedIdentity.properties.principalId

@description('Application Insights Instrumentation Key')
output applicationInsightsInstrumentationKey string = applicationInsights.properties.InstrumentationKey

@description('Application Insights Connection String')
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString

@description('Resource ID of the User Assigned Managed Identity')
output managedIdentityResourceId string = userAssignedIdentity.id

@description('Storage Account name')
output storageAccountName string = storageAccount.name

@description('Log Analytics Workspace ID')
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id

// Security and RBAC documentation outputs
@description('Summary of RBAC role assignments configured')
output rbacConfiguration object = {
  userAssignedManagedIdentity: {
    resourceId: userAssignedIdentity.id
    clientId: userAssignedIdentity.properties.clientId
    principalId: userAssignedIdentity.properties.principalId
  }
  roleAssignments: [
    {
      scope: storageAccount.name
      role: 'Storage Blob Data Contributor'
      roleId: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
      purpose: 'Function app deployment storage access'
    }
    {
      scope: storageAccount.name
      role: 'Storage Account Contributor' 
      roleId: '17d1049b-9a84-46fb-8f53-869881c3d3ab'
      purpose: 'WebJobs storage operations'
    }
    {
      scope: 'Resource Group'
      role: 'Cognitive Services User'
      roleId: 'a97b65f3-24c7-4388-baec-2e87135dc908'
      purpose: 'Azure AI Foundry agent access'
      condition: cognitiveServicesAccountName != '' ? 'Applied' : 'Skipped'
    }
    {
      scope: 'Resource Group'
      role: 'Azure AI Developer'
      roleId: '64702f94-c441-49e6-a78b-ef80e0188fee'
      purpose: 'AI Foundry project operations'
      condition: aiProjectName != '' ? 'Applied' : 'Skipped'
    }
    {
      scope: applicationInsights.name
      role: 'Monitoring Metrics Publisher'
      roleId: '3913510d-42f4-4e42-8a64-420c390055eb'
      purpose: 'Application Insights telemetry publishing'
    }
    {
      scope: logAnalyticsWorkspace.name
      role: 'Log Analytics Contributor'
      roleId: '92aaf0da-9dab-42b6-94a3-d43ce8d16293'
      purpose: 'Log Analytics workspace access'
    }
  ]
}

@description('Security configuration summary')
output securityConfiguration object = {
  managedIdentity: {
    type: 'User Assigned'
    authenticationMethod: 'Microsoft Entra ID (Azure AD)'
    keyBasedAccess: 'Disabled where possible'
  }
  storage: {
    httpsOnly: true
    publicBlobAccess: false
    defaultOAuthAuthentication: true
    keyBasedAccess: 'Minimized (content share only)'
  }
  functionApp: {
    httpsOnly: true
    systemAssignedIdentity: false
    userAssignedIdentity: true
    tlsVersion: 'Latest'
  }
  monitoring: {
    applicationInsights: true
    logAnalytics: true
    diagnosticSettings: true
    rbacBasedAccess: true
  }
}

@description('Minimum required permissions for deployment service principal')
output deploymentRequirements object = {
  subscriptionLevel: [
    {
      role: 'User Access Administrator'
      purpose: 'Required to assign RBAC roles during deployment'
      scope: 'Resource Group'
    }
  ]
  resourceGroupLevel: [
    {
      role: 'Contributor'
      purpose: 'Required to create and manage Azure resources'
      scope: 'Resource Group'
    }
  ]
  additionalConsiderations: [
    'Service principal needs federated identity credentials for OIDC authentication from GitHub'
    'AI Foundry access may require additional permissions at the AI project level'
    'Bot Framework app registration must be done separately with appropriate permissions'
  ]
}

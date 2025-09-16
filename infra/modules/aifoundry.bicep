@description('Location for AI Foundry (Azure AI Services) account')
param location string

@description('AI Foundry account name')
param accountName string

@description('User-assigned managed identity resource ID to attach')
param userAssignedIdentityResourceId string

@description('Deploy model deployment')
param deployModel bool = true

@description('Model (deployment) name')
param modelName string = 'gpt-4.1-mini'

@description('Model version')
param modelVersion string = '2025-04-14'

@description('Model SKU name (e.g. GlobalStandard, Standard)')
param modelSkuName string = 'GlobalStandard'

@description('Model capacity units')
@minValue(1)
param modelCapacity int = 30

@description('AI Foundry project name')
param projectName string = 'hyperSOC'

@description('Deploy Defender for AI settings resource')
param deployDefenderForAI bool = false

@description('Defender for AI state (Enabled/Disabled)')
@allowed([ 'Enabled', 'Disabled' ])
param defenderForAIState string = 'Disabled'

@description('Deploy Microsoft.Default RAI Policy')
param deployRaiPolicyDefault bool = true

@description('Deploy Microsoft.DefaultV2 RAI Policy')
param deployRaiPolicyDefaultV2 bool = true

@description('RAI policy name to associate with model deployment (must match one deployed)')
@allowed([ 'Microsoft.Default', 'Microsoft.DefaultV2' ])
param modelRaiPolicyName string = 'Microsoft.DefaultV2'

// Account (AIServices kind)
resource aiFoundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'AIServices'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityResourceId}': {}
    }
  }
  properties: {
    apiProperties: {}
    customSubDomainName: accountName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    allowProjectManagement: true
    defaultProject: projectName
    associatedProjects: [ projectName ]
    publicNetworkAccess: 'Enabled'
  }
}

resource defenderForAISettings 'Microsoft.CognitiveServices/accounts/defenderForAISettings@2025-06-01' = if (deployDefenderForAI) {
  name: 'Default'
  parent: aiFoundry
  properties: {
    state: defenderForAIState
  }
}

// RAI Policies (content filters mirrored from provided snippet)
resource raiPolicyDefault 'Microsoft.CognitiveServices/accounts/raiPolicies@2025-06-01' = if (deployRaiPolicyDefault) {
  name: 'Microsoft.Default'
  parent: aiFoundry
  properties: {
    mode: 'Blocking'
    contentFilters: [
      {
        name: 'Hate'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Hate'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Sexual'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Sexual'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Violence'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Violence'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Selfharm'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Selfharm'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
    ]
  }
}

resource raiPolicyDefaultV2 'Microsoft.CognitiveServices/accounts/raiPolicies@2025-06-01' = if (deployRaiPolicyDefaultV2) {
  name: 'Microsoft.DefaultV2'
  parent: aiFoundry
  properties: {
    mode: 'Blocking'
    contentFilters: [
      {
        name: 'Hate'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Hate'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Sexual'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Sexual'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Violence'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Violence'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Selfharm'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Selfharm'
        severityThreshold: 'Medium'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Jailbreak'
        blocking: true
        enabled: true
        source: 'Prompt'
      }
      {
        name: 'Protected Material Text'
        blocking: true
        enabled: true
        source: 'Completion'
      }
      {
        name: 'Protected Material Code'
        blocking: false
        enabled: true
        source: 'Completion'
      }
    ]
  }
}

// Project
resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  name: projectName
  parent: aiFoundry
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    description: 'Default project created with the resource'
    displayName: projectName
  }
}

// Model deployment
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deployModel) {
  name: modelName
  parent: aiFoundry
  sku: {
    name: modelSkuName
    capacity: modelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
    currentCapacity: modelCapacity
    raiPolicyName: modelRaiPolicyName
  }
  dependsOn: [ project ]
}

output aiFoundryAccountName string = aiFoundry.name
output aiFoundryProjectName string = project.name
output aiFoundryModelDeploymentName string = deployModel ? modelDeployment.name : ''
output aiFoundryRaiPolicyUsed string = modelRaiPolicyName
output aiFoundryEndpoint string = aiFoundry.properties.endpoint

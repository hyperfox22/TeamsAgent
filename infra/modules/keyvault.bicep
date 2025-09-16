@description('Key Vault location')
param location string

@description('Key Vault name')
param name string

@description('Key Vault SKU name')
@allowed(['standard', 'premium'])
param skuName string = 'standard'

@description('Restore soft-deleted Key Vault')
param restore bool = false

@description('Environment name for tagging')
param environmentName string = 'dev'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  properties: {
    sku: {
      family: 'A'
      name: skuName
    }
    tenantId: tenant().tenantId
    enabledForDeployment: false
    enabledForTemplateDeployment: false
    enabledForDiskEncryption: false
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    // Note: restore parameter is used during deployment planning
    createMode: restore ? 'recover' : 'default'
  }
  tags: {
    environment: environmentName
    'azd-env-name': environmentName
    application: 'socbot'
    component: 'keyvault'
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

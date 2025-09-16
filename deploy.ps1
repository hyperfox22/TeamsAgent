# Teams Agent Infrastructure Deployment Script
# Usage: .\deploy.ps1 -EnvName "dev|qa|prod"

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'qa', 'prod')]
    [string]$EnvName,
    
    [Parameter(Mandatory = $false)]
    [string]$SubscriptionId = "f78f3a8d-0993-4fd7-8af4-589173e9f16b",
    
    [Parameter(Mandatory = $false)]
    [string]$Location = "eastus2"
)

# Set error handling
$ErrorActionPreference = "Stop"

# Define variables
$Rg = "teamsagent-rg-$EnvName"
$ParamFile = "infra/parameters.$EnvName.json"

Write-Host "Teams Agent Infrastructure Deployment" -ForegroundColor Green
Write-Host "Environment: $EnvName" -ForegroundColor Yellow
Write-Host "Resource Group: $Rg" -ForegroundColor Yellow
Write-Host "Location: $Location" -ForegroundColor Yellow
Write-Host "Parameters File: $ParamFile" -ForegroundColor Yellow

# Set the subscription
Write-Host "Setting Azure subscription..." -ForegroundColor Blue
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to set subscription. Please check your subscription ID." -ForegroundColor Red
    exit 1
}

# Verify parameters file exists
if (-not (Test-Path $ParamFile)) {
    Write-Host "Parameters file not found: $ParamFile" -ForegroundColor Red
    Write-Host "Available parameter files:" -ForegroundColor Yellow
    Get-ChildItem "infra/parameters.*.json" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    exit 1
}

# Build the Bicep template
Write-Host "Building Bicep template..." -ForegroundColor Blue
az bicep build --file infra/main.bicep
if ($LASTEXITCODE -ne 0) {
    Write-Host "Bicep build failed!" -ForegroundColor Red
    exit 1
}

# Create resource group if it doesn't exist
Write-Host "Creating resource group if it doesn't exist..." -ForegroundColor Blue
az group create --name $Rg --location $Location --output none
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create resource group!" -ForegroundColor Red
    exit 1
}

# Deploy the infrastructure
Write-Host "Deploying infrastructure..." -ForegroundColor Blue
$deploymentName = "teamsagent-$EnvName-$(Get-Date -Format 'yyyyMMddHHmmss')"

az deployment group create `
    -g $Rg `
    -f infra/main.bicep `
    -p "@$ParamFile" `
    -p deployOpenAI=true `
    --name $deploymentName `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Host "Infrastructure deployment completed successfully!" -ForegroundColor Green
    
    # Get deployment outputs
    Write-Host "Retrieving deployment outputs..." -ForegroundColor Cyan
    $outputs = az deployment group show --resource-group $Rg --name $deploymentName --query "properties.outputs" --output json | ConvertFrom-Json
    
    Write-Host "========================================" -ForegroundColor Gray
    Write-Host "Deployment Outputs for ${EnvName}:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Gray
    
    if ($outputs.functionAppName.value) {
        Write-Host "Function App: $($outputs.functionAppName.value)" -ForegroundColor White
        Write-Host "Function App URL: $($outputs.functionAppUrl.value)" -ForegroundColor White
    }
    
    if ($outputs.aiFoundryAccountName.value) {
        Write-Host "AI Foundry Account: $($outputs.aiFoundryAccountName.value)" -ForegroundColor White
        Write-Host "AI Foundry Endpoint: $($outputs.aiFoundryEndpoint.value)" -ForegroundColor White
        Write-Host "AI Foundry Project: $($outputs.aiFoundryProjectName.value)" -ForegroundColor White
    }
    
    if ($outputs.botServiceName.value) {
        Write-Host "Bot Service: $($outputs.botServiceName.value)" -ForegroundColor White
    }
    
    if ($outputs.storageAccountName.value) {
        Write-Host "Storage Account: $($outputs.storageAccountName.value)" -ForegroundColor White
    }
    
    if ($outputs.cosmosAccountName.value) {
        Write-Host "Cosmos DB Account: $($outputs.cosmosAccountName.value)" -ForegroundColor White
    }
    
    if ($outputs.searchServiceName.value) {
        Write-Host "Search Service: $($outputs.searchServiceName.value)" -ForegroundColor White
    }
    
    if ($outputs.keyVaultName.value) {
        Write-Host "Key Vault: $($outputs.keyVaultName.value)" -ForegroundColor White
    }
    
    Write-Host "========================================" -ForegroundColor Gray
    
    # Save environment variables for GitHub Actions
    $envVars = @"
# Teams Agent - $EnvName Environment Variables
AZURE_FUNCTIONAPP_NAME=$($outputs.functionAppName.value)
AZURE_RESOURCE_GROUP=$Rg
AZURE_BOT_NAME=$($outputs.botServiceName.value)
FUNCTION_APP_URL=$($outputs.functionAppUrl.value)
AI_FOUNDRY_ENDPOINT=$($outputs.aiFoundryEndpoint.value)
AI_FOUNDRY_PROJECT=$($outputs.aiFoundryProjectName.value)
ENVIRONMENT=$EnvName
DEPLOYMENT_TIMESTAMP=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
"@
    
    $envFileName = "deployment-outputs-$EnvName.txt"
    $envVars | Out-File -FilePath $envFileName -Encoding utf8
    Write-Host "Environment variables saved to: $envFileName" -ForegroundColor Green
    
} else {
    Write-Host "Infrastructure deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Teams Agent infrastructure deployment completed!" -ForegroundColor Green
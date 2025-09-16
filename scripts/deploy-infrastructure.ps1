# SOCBot Infrastructure Deployment Script
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('dev', 'qa', 'prod')]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory = $false)]
    [string]$Location = "eastus",
    
    [Parameter(Mandatory = $false)]
    [string]$BaseName = "socai",
    
    [Parameter(Mandatory = $false)]
    [string]$ResourceGroupName = "",
    
    [Parameter(Mandatory = $false)]
    [switch]$CreateResourceGroup = $false
)

# Set error handling
$ErrorActionPreference = "Stop"

# Derive resource group name if not provided
if ([string]::IsNullOrEmpty($ResourceGroupName)) {
    $ResourceGroupName = "$BaseName-$Environment-rg"
}

Write-Host "🚀 Starting SOCBot Infrastructure Deployment" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Location: $Location" -ForegroundColor Yellow  
Write-Host "Base Name: $BaseName" -ForegroundColor Yellow
Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Yellow

# Check if logged in to Azure
try {
    $context = az account show --output json | ConvertFrom-Json
    Write-Host "✅ Logged in as: $($context.user.name)" -ForegroundColor Green
    Write-Host "📋 Subscription: $($context.name) ($($context.id))" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Not logged in to Azure. Please run 'az login'" -ForegroundColor Red
    exit 1
}

# Create resource group if it doesn't exist or if explicitly requested
if ($CreateResourceGroup -or $null -eq (az group show --name $ResourceGroupName 2>$null)) {
    Write-Host "📦 Creating resource group: $ResourceGroupName..." -ForegroundColor Blue
    az group create --name $ResourceGroupName --location $Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create resource group!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Resource group $ResourceGroupName already exists" -ForegroundColor Green
}

# Deploy the infrastructure
Write-Host "🏗️ Deploying SOCBot infrastructure for $Environment environment..." -ForegroundColor Blue
$deploymentName = "socbot-$Environment-$(Get-Date -Format 'yyyyMMddHHmmss')"
$parametersFile = "infra/main.parameters.$Environment.json"

if (-not (Test-Path $parametersFile)) {
    Write-Host "❌ Parameters file not found: $parametersFile" -ForegroundColor Red
    Write-Host "Available parameter files:" -ForegroundColor Yellow
    Get-ChildItem "infra/main.parameters.*.json" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    exit 1
}

Write-Host "📄 Using parameters file: $parametersFile" -ForegroundColor Cyan

try {
    # Deploy the Bicep template
    $deploymentResult = az deployment group create `
        --resource-group $ResourceGroupName `
        --name $deploymentName `
        --template-file "infra/main.bicep" `
        --parameters "@$parametersFile" `
        --output json

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Infrastructure deployment completed successfully!" -ForegroundColor Green
        
        # Parse deployment outputs
        $outputs = ($deploymentResult | ConvertFrom-Json).properties.outputs
        
        Write-Host "📋 Deployment Outputs:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host "🔗 Function App:" -ForegroundColor White
        Write-Host "   Name: $($outputs.functionAppName.value)" -ForegroundColor White
        Write-Host "   URL: $($outputs.functionAppUrl.value)" -ForegroundColor White
        Write-Host "   Hostname: $($outputs.functionAppHostname.value)" -ForegroundColor White
        
        if ($outputs.botServiceName.value) {
            Write-Host "🤖 Bot Service:" -ForegroundColor White
            Write-Host "   Name: $($outputs.botServiceName.value)" -ForegroundColor White
        }
        
        if ($outputs.aiFoundryAccountName.value) {
            Write-Host "🧠 AI Foundry:" -ForegroundColor White
            Write-Host "   Account: $($outputs.aiFoundryAccountName.value)" -ForegroundColor White
            Write-Host "   Endpoint: $($outputs.aiFoundryEndpoint.value)" -ForegroundColor White
        }
        
        Write-Host "💾 Storage:" -ForegroundColor White
        Write-Host "   Account: $($outputs.storageAccountName.value)" -ForegroundColor White
        
        Write-Host "🔍 Search:" -ForegroundColor White
        Write-Host "   Service: $($outputs.searchServiceName.value)" -ForegroundColor White
        
        Write-Host "🗄️ Cosmos DB:" -ForegroundColor White
        Write-Host "   Account: $($outputs.cosmosAccountName.value)" -ForegroundColor White
        
        Write-Host "🔐 Key Vault:" -ForegroundColor White
        Write-Host "   Name: $($outputs.keyVaultName.value)" -ForegroundColor White
        
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        
        # Save GitHub environment variables
        $githubEnv = @"
# SOCBot - $Environment Environment Variables for GitHub Actions
AZURE_FUNCTIONAPP_NAME=$($outputs.functionAppName.value)
AZURE_RESOURCE_GROUP=$ResourceGroupName
AZURE_BOT_NAME=$($outputs.botServiceName.value)
FUNCTION_APP_URL=$($outputs.functionAppUrl.value)
AI_FOUNDRY_ENDPOINT=$($outputs.aiFoundryEndpoint.value)
ENVIRONMENT=$Environment
DEPLOYMENT_TIMESTAMP=$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')
"@
        
        $envFileName = "github-env-$Environment.txt"
        $githubEnv | Out-File -FilePath $envFileName -Encoding utf8
        Write-Host "💾 GitHub environment variables saved to '$envFileName'" -ForegroundColor Green
        
        # Save Function App settings template
        $appSettingsTemplate = @"
# Function App Configuration Template for $Environment
# Add these settings to your Function App Configuration in Azure Portal

MicrosoftAppId=cadbcc4d-867d-4f2b-b11f-eda4b75555dc
MicrosoftAppPassword=[YOUR_BOT_PASSWORD]
BOT_ID=cadbcc4d-867d-4f2b-b11f-eda4b75555dc
AGENT_ID=[YOUR_AI_FOUNDRY_AGENT_ID]
"@
        
        $appSettingsFileName = "function-app-settings-$Environment.txt"
        $appSettingsTemplate | Out-File -FilePath $appSettingsFileName -Encoding utf8
        Write-Host "⚙️ Function App settings template saved to '$appSettingsFileName'" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Infrastructure deployment failed!" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Deployment error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 SOCBot infrastructure deployment completed!" -ForegroundColor Green
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Configure Function App settings using: $appSettingsFileName" -ForegroundColor White
Write-Host "   2. Add GitHub secrets using values from: $envFileName" -ForegroundColor White
Write-Host "   3. Deploy application code via GitHub Actions" -ForegroundColor White
Write-Host "   4. Test SOCBot in Microsoft Teams" -ForegroundColor White
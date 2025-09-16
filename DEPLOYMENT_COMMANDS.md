# SOCBot Infrastructure Deployment Commands

## Quick Deployment

```powershell
# Set your secrets (replace with actual values)
$appPassword = "YOUR_APP_PASSWORD"  
$connectionString = "YOUR_PROJECT_CONNECTION_STRING"
$agentId = "YOUR_AGENT_ID"

# Deploy infrastructure
.\scripts\deploy-infrastructure.ps1 `
  -MicrosoftAppPassword $appPassword `
  -ProjectConnectionString $connectionString `
  -AgentId $agentId
```

## Manual Step-by-Step Deployment

### 1. Create Resource Group
```bash
az group create --name socbot-dev-rg --location eastus
```

### 2. Deploy Infrastructure
```bash
az deployment group create \
  --resource-group socbot-dev-rg \
  --name socbot-deployment \
  --template-file infra/main.bicep \
  --parameters \
    microsoftAppPassword="YOUR_APP_PASSWORD" \
    projectConnectionString="YOUR_PROJECT_CONNECTION_STRING" \
    agentId="YOUR_AGENT_ID"
```

## Resource Naming Convention

- **Resource Group**: `socbot-{env}-rg` (e.g., `socbot-dev-rg`)
- **Storage Account**: `socbot{env}storage` (e.g., `socbotdevstorage`)  
- **Function App**: `socbot-{env}-func` (e.g., `socbot-dev-func`)
- **App Service Plan**: `socbot-{env}-plan` (e.g., `socbot-dev-plan`)
- **Bot Service**: `socbot-{env}-bot` (e.g., `socbot-dev-bot`)

## Environment Variables Required

- `microsoftAppPassword`: Bot Framework app password
- `projectConnectionString`: Azure AI Foundry project connection
- `agentId`: Your AI Foundry agent identifier

## Expected Outputs

After deployment, you'll get:
- Function App URL for bot endpoint
- Function App name for GitHub Actions
- Bot service name for configuration
- Storage account for app data

## GitHub Actions Setup

The deployment script creates `github-env.txt` with required secrets:
- `AZURE_FUNCTIONAPP_NAME`
- `AZURE_RESOURCE_GROUP` 
- `AZURE_BOT_NAME`
- `FUNCTION_APP_URL`
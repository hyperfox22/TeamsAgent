# 🤖 SOCBot - Security Operations Center Teams Bot

SOCBot is an intelligent Microsoft Teams bot powered by Azure AI Foundry, designed for security operations teams. It provides AI-powered security assistance, proactive notifications, and incident management capabilities directly within your Teams environment.

## Features

🛡️ **AI-Powered Security Assistant**
- Intelligent threat analysis and incident response
- Security best practices recommendations  
- Compliance framework guidance
- Risk assessment and vulnerability insights

🔔 **Rich Notifications**
- HTTP-triggered notifications with Adaptive Cards
- Multi-scope deployment (personal, team, group chat)
- Interactive notification responses
- Real-time security alerts

⚡ **Azure Integration**
- Azure AI Foundry agent connectivity
- Azure Functions hosting (Flex Consumption plan)
- Managed Identity authentication
- Application Insights monitoring

🎯 **Teams Native Experience**
- Welcome messages for new installations
- @mention support in channels
- Direct message conversations
- Command suggestions and help

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Teams Client  │◄──►│  Azure Function │◄──►│ Azure AI Foundry │
│                 │    │    (SOCBot)     │    │     Agent        │
└─────────────────┘    └─────────────────┘    └──────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │  Bot Framework  │
                       │    Service      │
                       └─────────────────┘
```

### Key Components

- **Azure Functions v4**: Serverless hosting with Node.js 20 runtime
- **Bot Framework SDK**: Teams bot protocol handling
- **Azure AI Projects SDK**: AI Foundry agent integration
- **Adaptive Cards**: Rich notification templates
- **Managed Identity**: Secure authentication to Azure services

## Quick Start

### Prerequisites

- Node.js 20 or later
- Azure subscription
- Azure AI Foundry project with deployed agent
- Microsoft 365 tenant with Teams
- Azure Functions Core Tools v4

### 1. Clone and Setup

```bash
git clone <repository-url>
cd TeamsAgent
npm install
```

### 2. Configure Environment

Update `local.settings.json` with your values:

```json
{
  "Values": {
    "PROJECT_CONNECTION_STRING": "your-ai-foundry-connection",
    "AGENT_ID": "your-agent-id",
    "MicrosoftAppId": "your-bot-app-id",
    "MicrosoftAppPassword": "your-bot-app-password",
    "M365_CLIENT_ID": "your-m365-app-id",
    "M365_CLIENT_SECRET": "your-m365-app-secret",
    "M365_TENANT_ID": "your-tenant-id"
  }
}
```

### 3. Local Development

```bash
# Start the Azure Functions runtime
npm run dev

# The bot will be available at http://localhost:7071
# Configure ngrok or similar for Teams testing:
ngrok http 7071
```

## 🚀 Production Deployment with GitHub

### Step 1: Fork and Clone Repository
1. Fork this repository to your GitHub account
2. Clone your fork locally

### Step 2: Create Azure Resources

Run these commands to create the required Azure infrastructure:

```bash
# Set variables (customize as needed)
$resourceGroup = "socbot-rg-$(Get-Random -Minimum 100 -Maximum 999)"
$location = "eastus"
$botName = "socbot-$(Get-Random -Minimum 100 -Maximum 999)" 
$functionAppName = "socbot-func-$(Get-Random -Minimum 100 -Maximum 999)"
$storageAccount = "socbotstorage$(Get-Random -Minimum 100 -Maximum 999)"

# Create resource group
az group create --name $resourceGroup --location $location

# Create App Registration for Bot
$appRegResult = az ad app create --display-name "SOCBot-$botName" --sign-in-audience AzureADMyOrg | ConvertFrom-Json
$appId = $appRegResult.appId
$secretResult = az ad app credential reset --id $appId --display-name "SOCBot-Secret" --end-date "2025-12-16" | ConvertFrom-Json
$appPassword = $secretResult.password

# Create Bot Service  
az bot create --resource-group $resourceGroup --name $botName --app-type "SingleTenant" --appid $appId --sku "F0"

# Create Storage Account
az storage account create --name $storageAccount --location $location --resource-group $resourceGroup --sku Standard_LRS

# Create Function App (Windows, Node.js 20)
az functionapp create --resource-group $resourceGroup --consumption-plan-location $location --runtime node --runtime-version 20 --functions-version 4 --name $functionAppName --storage-account $storageAccount --os-type Windows
```

### Step 3: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `AZURE_FUNCTIONAPP_NAME`: Your Function App name
- `AZURE_RESOURCE_GROUP`: Your Resource Group name
- `AZURE_BOT_NAME`: Your Bot Service name  
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`: Download from Azure Portal → Function App → Get publish profile

### Step 4: Configure Function App Settings

Set environment variables in your Function App:

```bash
az functionapp config appsettings set \
  --name $functionAppName \
  --resource-group $resourceGroup \
  --settings \
    MicrosoftAppId="$appId" \
    MicrosoftAppPassword="$appPassword" \
    AZURE_AI_PROJECT_ENDPOINT="[Your AI Project Endpoint]" \
    PROJECT_CONNECTION_STRING="[Your AI Project Connection String]" \
    AGENT_ID="[Your Agent ID]"
```

### Step 5: Deploy via GitHub Actions

1. Update `.env.example` with your configuration
2. Push your code to the `main` branch
3. GitHub Actions will automatically build and deploy
4. The bot messaging endpoint will be updated automatically

### Step 6: Configure Teams App and Deploy

1. Update `appPackage/manifest.json` with your App ID
2. Add your changes to Git and push to trigger deployment:

```bash
# Add all files (excluding .env which is in .gitignore)  
git add .

# Commit your configuration
git commit -m "Configure SOCBot for deployment"

# Push to trigger GitHub Actions deployment
git push origin main
```

3. Check GitHub Actions tab for deployment progress
4. Once deployed, zip the `appPackage` folder contents 
5. Upload to Teams (Apps → Upload a custom app)

### 4. Deploy Infrastructure

```bash
# Deploy using Azure CLI
az deployment group create \
  --resource-group myResourceGroup \
  --template-file infra/azure.bicep \
  --parameters @infra/azure.parameters.json

# Deploy bot registration
az deployment group create \
  --resource-group myResourceGroup \
  --template-file infra/botRegistration/azurebot.bicep \
  --parameters botAppId=<your-app-id> messagingEndpoint=<your-function-url>
```

### 5. Deploy Application

```bash
# Build and deploy
npm run build
func azure functionapp publish <your-function-app-name>
```

## 🔧 Available Endpoints

Once deployed, your Function App provides these endpoints:

### Bot Messages
- **Endpoint**: `POST /api/messages`  
- **Purpose**: Teams bot messaging endpoint
- **Auth**: Bot Framework authentication

### Proactive Notifications
- **Endpoint**: `POST /api/notification`
- **Purpose**: Send general notifications to Teams
- **Auth**: Function key authentication

**Example request**:
```bash
curl -X POST "https://your-function-app.azurewebsites.net/api/notification" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_FUNCTION_KEY" \
  -d '{
    "prompt": "Security briefing: Latest threat intelligence report available",
    "title": "Daily Security Update"
  }'
```

### Security Alert Notifications  
- **Endpoint**: `POST /api/securityAlert`
- **Purpose**: Send security-specific alerts with rich formatting
- **Auth**: Function key authentication

**Example request**:
```bash
curl -X POST "https://your-function-app.azurewebsites.net/api/securityAlert" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_FUNCTION_KEY" \
  -d '{
    "id": "alert-001",
    "title": "Critical Security Alert",
    "description": "Suspicious login activity detected from unusual location",
    "severity": "high", 
    "category": "authentication",
    "source": "Identity Protection"
  }'
```

### Health Check
- **Endpoint**: `GET /api/health`
- **Purpose**: Health monitoring and diagnostics
- **Auth**: Public endpoint

**Example response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-16T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "bot": "connected",
    "aiFoundry": "connected",
    "teams": "2 installations"
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PROJECT_CONNECTION_STRING` | Azure AI Foundry project endpoint | ✅ |
| `AGENT_ID` | Target AI agent identifier | ✅ |
| `MicrosoftAppId` | Bot Framework app ID | ✅ |
| `MicrosoftAppPassword` | Bot Framework app password | ✅ |
| `M365_CLIENT_ID` | Microsoft 365 app client ID | ✅ |
| `M365_CLIENT_SECRET` | Microsoft 365 app secret | ✅ |
| `M365_TENANT_ID` | Microsoft 365 tenant ID | ✅ |
| `clientId` | Managed Identity client ID (Azure only) | 🔶 |

### Teams App Manifest

Configure in `appPackage/manifest.json`:
- Update bot ID and Microsoft App ID placeholders
- Customize app name, description, and branding
- Configure required permissions and scopes

### Azure Infrastructure

The Bicep templates provision:
- **Function App**: Flex Consumption plan (FC1)
- **User-Assigned Managed Identity**: For secure Azure service access
- **Application Insights**: Monitoring and logging
- **Storage Account**: Function app artifacts and logs
- **Bot Service**: Teams channel registration

## Development

### Project Structure

```
src/
├── httpTrigger.ts          # Main HTTP endpoints
├── agentConnector.ts       # AI Foundry integration
├── teamsBot.ts            # Bot handlers
├── internal/
│   ├── initialize.ts       # Bot setup
│   └── messageHandler.ts   # Message routing
└── adaptiveCards/
    └── notification-default.json # Card templates

infra/                      # Infrastructure as Code
├── azure.bicep            # Main resources
├── azure.parameters.json  # Deployment parameters
└── botRegistration/
    └── azurebot.bicep     # Bot service

appPackage/                 # Teams app
├── manifest.json          # App manifest
├── color.png             # App icons
└── outline.png
```

### Testing

```bash
# Run TypeScript compilation
npm run build

# Start local development
npm run dev

# Test with ngrok tunnel
ngrok http 7071
```

### Debugging

1. **F5 Debugging**: Use Teams Toolkit in VS Code
2. **Local Testing**: Configure ngrok tunnel for Teams
3. **Application Insights**: Monitor deployed function logs
4. **Bot Framework Emulator**: Test bot protocol locally

## Security Considerations

### Authentication
- **Managed Identity**: Used for Azure AI Foundry access
- **Bot Framework**: Handles Teams authentication
- **Function Keys**: Protect HTTP notification endpoint

### Data Protection
- All secrets stored in Azure Key Vault or App Settings
- HTTPS enforced for all communications
- Bot conversations encrypted in transit

### Permissions
- **Teams**: Limited to configured scopes (personal, team, groupchat)
- **Azure**: Least-privilege access with role assignments
- **AI Foundry**: Scoped to specific project and agent

## Monitoring

### Application Insights
- Function execution metrics
- Bot conversation analytics  
- Error tracking and alerts
- Performance monitoring

### Bot Framework Analytics
- Message volume and patterns
- User engagement metrics
- Channel usage statistics

### Azure Monitor
- Infrastructure health
- Resource utilization
- Security and compliance status

## Troubleshooting

### Common Issues

**Bot not responding in Teams**
- Verify Bot Framework app registration
- Check messaging endpoint configuration
- Validate Teams app manifest

**AI agent connection failures**
- Confirm Azure AI Foundry project connection string
- Verify agent ID and deployment status
- Check managed identity permissions

**Notification delivery issues**
- Ensure conversation references are stored
- Validate adaptive card template syntax
- Check Function app authentication

### Logs and Diagnostics

```bash
# View function logs
func logs --follow

# Check Application Insights
az monitor app-insights query --app <app-name> --analytics-query "requests | limit 10"
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- 📚 [Documentation](https://aka.ms/teams-toolkit-docs)
- 🐛 [Issues](https://github.com/microsoft/teams-ai/issues)  
- 💬 [Teams AI GitHub](https://github.com/microsoft/teams-ai)
- 🔧 [Azure AI Foundry](https://azure.microsoft.com/en-us/products/ai-foundry)

---

Built with 💙 by the SOC Team using Microsoft Teams AI framework and Azure AI services.
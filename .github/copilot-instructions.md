# SOCBot - Azure Functions Teams Bot AI Instructions

## Architecture Overview

This is a **Microsoft Teams security bot** built as an **Azure Functions v4 app** with Node.js 20, integrating **Azure AI Foundry agents** and **Bot Framework SDK**. The dual-bot architecture provides fallback capabilities and enhanced Teams integration.

### Core Flow
```
Teams Client → Bot Framework → Azure Function (/api/messages) → Dual Bot Handlers → AgentConnector → Azure AI Foundry
```

## Key Components & Patterns

### 1. **Dual Bot Implementation** (`src/teamsBot.ts`)
- **TeamsBot**: `TeamsActivityHandler` for standard Bot Framework features
- **AgentBot**: `AgentApplication` using M365 Agents SDK for enhanced capabilities  
- Both bots call `AgentConnector.processPrompt()` for AI integration
- Fallback mechanism: tries AgentBot first, falls back to TeamsBot

### 2. **Azure Function Endpoints** (`src/httpTrigger.ts`)
- `/api/messages`: Main Bot Framework endpoint (handled by `messageHandler`)
- `/api/notification`: Proactive notifications with Adaptive Cards
- `/api/security-alert`: Security-specific notifications with rich formatting
- `/api/health`: Health check endpoint

### 3. **AI Integration** (`src/agentConnector.ts`)
- Uses **ManagedIdentityCredential** for secure Azure AI Foundry access
- Thread management: Maps Teams conversation IDs to AI thread IDs  
- Required env vars: `PROJECT_CONNECTION_STRING`, `AGENT_ID`, `clientId`

### 4. **Infrastructure as Code** (`infra/`)
- **main.bicep**: Comprehensive Bicep template with modular architecture
- **parameters.dev.json**: Environment-specific configuration  
- Uses `hypersoc` naming convention (e.g., `hypersocdev-funcapp`)
- Managed Identity for secure service-to-service authentication

## Development Patterns

### Bot Message Handling
```typescript
// Standard pattern for both bot implementations
private async handleMessage(context: TurnContext): Promise<void> {
  const userMessage = context.activity.text;
  const cleanMessage = this.removeMentions(userMessage);
  const conversationId = context.activity.conversation.id;
  
  await context.sendActivity({ type: 'typing' });
  const response = await this.agentConnector.processPrompt(cleanMessage, conversationId);
  await context.sendActivity(MessageFactory.text(response.message));
}
```

### Function App Structure
- **HTTP Triggers**: All endpoints use `@azure/functions` v4 syntax
- **Bot Initialization**: Lazy-loaded via `BotInitializer` singleton pattern
- **Error Handling**: Comprehensive try-catch with fallback mechanisms
- **Logging**: Uses Azure Functions context logging (`context.log`)

### Configuration Management
- **Environment Variables**: All secrets/config through Azure App Settings
- **Local Development**: Uses `local.settings.json` (never commit!)
- **Managed Identity**: No stored connection secrets for Azure services

## Critical Commands & Workflows

### Local Development
```bash
npm run dev                    # Build & start Functions runtime
ngrok http 7071               # Expose localhost for Teams testing
```

### Deployment
```powershell
# From deployment scripts
az deployment group create --resource-group hypersoc-rg-dev --template-file infra/main.bicep --parameters @infra/parameters.dev.json
```

### Bot Registration Requirements
- **Bot Endpoint**: `https://your-function-app.azurewebsites.net/api/messages`
- **Bot Location**: Must be 'global' (not regional)
- **Tenant ID**: Required for SingleTenant bot type

## Integration Points

### Teams Manifest (`appPackage/manifest.json`)
- **Bot ID**: Must match Azure Bot Service App Registration ID
- **Scopes**: personal, team, groupchat
- **Commands**: Defined in manifest for Teams UI integration

### Azure AI Foundry Connection
- **Authentication**: Uses Function App's Managed Identity
- **Thread Management**: Persistent conversations via thread caching
- **Error Handling**: Graceful degradation when AI services unavailable

### Adaptive Cards (`src/adaptiveCards/`)
- **Security Alerts**: Rich formatting with severity indicators
- **Proactive Notifications**: Template-based rendering
- **Card Schema**: Uses Adaptive Cards v1.3+ features

## Project-Specific Conventions

- **Naming**: All Azure resources use `{baseName}{env}` pattern (e.g., `hypersocdev-`)
- **Error Messages**: Security-themed, professional tone with emoji indicators
- **Bot Responses**: Always prefixed with "🔒 **SOCBot Analysis**" for branding
- **Configuration**: Feature toggles via Bicep parameters for modular deployment
- **Security**: Cosmos DB in Central US, all other resources in East US

## Testing & Debugging

### Bot Testing
- Use **Bot Framework Emulator** for local testing
- **ngrok** tunnel required for Teams integration testing  
- **WebChat channel** available for quick validation

### Function App Debugging
- **Application Insights**: Automatic logging integration
- **Health endpoint**: `GET /api/health` for deployment verification
- **Local debugging**: VS Code with Azure Functions extension

When working with this codebase, remember that it's a **security-focused** Teams bot requiring proper Azure service integration and careful handling of authentication patterns.
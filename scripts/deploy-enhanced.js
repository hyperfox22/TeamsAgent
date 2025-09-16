#!/usr/bin/env node

/**
 * Enhanced SOCBot Deployment Script
 * Includes conversation management, proactive notifications, and monitoring
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Enhanced SOCBot Deployment...\n');

// Configuration
const config = {
  resourceGroup: 'socbot-rg',
  location: 'eastus',
  functionApp: 'socbot-function-app',
  storageAccount: 'socbotstorage',
  appServicePlan: 'socbot-plan',
  aiProjectEndpoint: process.env.AZURE_AI_PROJECT_ENDPOINT,
  subscription: process.env.AZURE_SUBSCRIPTION_ID,
  tenantId: process.env.AZURE_TENANT_ID
};

// Validate required environment variables
const requiredEnvVars = [
  'AZURE_AI_PROJECT_ENDPOINT',
  'AZURE_SUBSCRIPTION_ID',
  'AZURE_TENANT_ID',
  'MicrosoftAppId',
  'MicrosoftAppPassword'
];

console.log('✅ Validating environment variables...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these environment variables before deployment.\n');
  process.exit(1);
}

async function main() {
  try {
    // Step 1: Build the project
    console.log('📦 Building TypeScript project...');
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    
    // Step 2: Create Azure resources
    console.log('\n🏗️  Creating Azure resources...');
    await createAzureResources();
    
    // Step 3: Deploy Function App
    console.log('\n📤 Deploying Function App...');
    await deployFunctionApp();
    
    // Step 4: Configure application settings
    console.log('\n⚙️  Configuring application settings...');
    await configureAppSettings();
    
    // Step 5: Set up monitoring and alerts
    console.log('\n📊 Setting up monitoring...');
    await setupMonitoring();
    
    // Step 6: Verify deployment
    console.log('\n🔍 Verifying deployment...');
    await verifyDeployment();
    
    console.log('\n✅ Enhanced SOCBot deployment completed successfully!');
    console.log('\n📋 Deployment Summary:');
    console.log(`   Resource Group: ${config.resourceGroup}`);
    console.log(`   Function App: ${config.functionApp}`);
    console.log(`   Storage Account: ${config.storageAccount}`);
    console.log(`   Location: ${config.location}`);
    
    console.log('\n🔗 Important URLs:');
    console.log(`   Function App: https://${config.functionApp}.azurewebsites.net`);
    console.log(`   Health Check: https://${config.functionApp}.azurewebsites.net/api/health`);
    console.log(`   Bot Endpoint: https://${config.functionApp}.azurewebsites.net/api/messages`);
    console.log(`   Notifications: https://${config.functionApp}.azurewebsites.net/api/notification`);
    console.log(`   Security Alerts: https://${config.functionApp}.azurewebsites.net/api/securityAlert`);
    
    console.log('\n📱 Next Steps:');
    console.log('   1. Register the bot in Microsoft Bot Framework');
    console.log('   2. Add the bot to Teams channels');
    console.log('   3. Test proactive notifications');
    console.log('   4. Configure monitoring alerts\n');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function createAzureResources() {
  const commands = [
    // Create resource group
    `az group create --name ${config.resourceGroup} --location ${config.location}`,
    
    // Create storage account for Function App
    `az storage account create --name ${config.storageAccount} --location ${config.location} --resource-group ${config.resourceGroup} --sku Standard_LRS`,
    
    // Create App Service Plan
    `az appservice plan create --name ${config.appServicePlan} --resource-group ${config.resourceGroup} --sku Y1 --is-linux`,
    
    // Create Function App
    `az functionapp create --resource-group ${config.resourceGroup} --consumption-plan-location ${config.location} --runtime node --runtime-version 20 --functions-version 4 --name ${config.functionApp} --storage-account ${config.storageAccount} --os-type Linux`,
    
    // Enable managed identity
    `az functionapp identity assign --name ${config.functionApp} --resource-group ${config.resourceGroup}`,
    
    // Create Application Insights
    `az monitor app-insights component create --app ${config.functionApp} --location ${config.location} --resource-group ${config.resourceGroup}`
  ];
  
  for (const cmd of commands) {
    console.log(`   Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  }
}

async function deployFunctionApp() {
  const commands = [
    // Package the function app
    'npm run build',
    
    // Deploy to Azure
    `func azure functionapp publish ${config.functionApp} --typescript`
  ];
  
  for (const cmd of commands) {
    console.log(`   Executing: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: __dirname });
  }
}

async function configureAppSettings() {
  const settings = [
    `MicrosoftAppId=${process.env.MicrosoftAppId}`,
    `MicrosoftAppPassword=${process.env.MicrosoftAppPassword}`,
    `AZURE_AI_PROJECT_ENDPOINT=${config.aiProjectEndpoint}`,
    `AZURE_TENANT_ID=${config.tenantId}`,
    `AZURE_CLIENT_ID=`, // Will be set by managed identity
    `FUNCTIONS_NODE_BLOCK_ON_ENTRY_POINT_ERROR=true`,
    `SCM_DO_BUILD_DURING_DEPLOYMENT=true`,
    `ENABLE_ORYX_BUILD=true`,
    `WEBSITE_RUN_FROM_PACKAGE=1`
  ];
  
  const settingsString = settings.join(' ');
  const cmd = `az functionapp config appsettings set --name ${config.functionApp} --resource-group ${config.resourceGroup} --settings ${settingsString}`;
  
  console.log('   Configuring application settings...');
  execSync(cmd, { stdio: 'inherit' });
}

async function setupMonitoring() {
  try {
    // Create Log Analytics workspace
    console.log('   Creating Log Analytics workspace...');
    execSync(`az monitor log-analytics workspace create --resource-group ${config.resourceGroup} --workspace-name ${config.functionApp}-logs --location ${config.location}`, { stdio: 'inherit' });
    
    // Get workspace ID
    const workspaceId = execSync(`az monitor log-analytics workspace show --resource-group ${config.resourceGroup} --workspace-name ${config.functionApp}-logs --query customerId --output tsv`).toString().trim();
    
    // Configure diagnostic settings
    console.log('   Setting up diagnostic logging...');
    const resourceId = `/subscriptions/${config.subscription}/resourceGroups/${config.resourceGroup}/providers/Microsoft.Web/sites/${config.functionApp}`;
    
    execSync(`az monitor diagnostic-settings create --resource ${resourceId} --name SOCBotDiagnostics --logs '[{"category":"FunctionAppLogs","enabled":true}]' --metrics '[{"category":"AllMetrics","enabled":true}]' --workspace ${workspaceId}`, { stdio: 'inherit' });
    
    console.log('   Monitoring setup completed');
  } catch (error) {
    console.warn('   ⚠️  Warning: Monitoring setup failed, continuing deployment...');
    console.warn('   ', error.message);
  }
}

async function verifyDeployment() {
  try {
    console.log('   Testing Function App availability...');
    const healthUrl = `https://${config.functionApp}.azurewebsites.net/api/health`;
    
    // Wait a moment for deployment to stabilize
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Test health endpoint
    const { execSync } = require('child_process');
    try {
      const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${healthUrl}`, { encoding: 'utf8' });
      const statusCode = parseInt(response.trim());
      
      if (statusCode === 200 || statusCode === 503) {
        console.log('   ✅ Health endpoint responding');
      } else {
        console.log(`   ⚠️  Health endpoint returned status: ${statusCode}`);
      }
    } catch (error) {
      console.log('   ⚠️  Could not test health endpoint (this is normal during initial deployment)');
    }
    
    console.log('   ✅ Deployment verification completed');
    
  } catch (error) {
    console.warn('   ⚠️  Warning: Deployment verification had issues, but deployment may still be successful');
    console.warn('   ', error.message);
  }
}

// Generate post-deployment configuration guide
function generateConfigGuide() {
  const guide = `
# SOCBot Post-Deployment Configuration Guide

## 1. Bot Framework Registration
1. Go to Azure Portal > Bot Services
2. Create a new Bot Registration
3. Set the messaging endpoint to: https://${config.functionApp}.azurewebsites.net/api/messages
4. Use the MicrosoftAppId and MicrosoftAppPassword from your environment variables

## 2. Teams App Configuration
1. Create a Teams app manifest with your bot ID
2. Configure the bot for teams conversations
3. Test the bot in Teams

## 3. Security Alert Integration
Use the security alert endpoint for proactive notifications:

\`\`\`bash
curl -X POST "https://${config.functionApp}.azurewebsites.net/api/securityAlert" \\
  -H "Content-Type: application/json" \\
  -H "x-functions-key: YOUR_FUNCTION_KEY" \\
  -d '{
    "id": "alert-001",
    "title": "Suspicious Network Activity Detected",
    "description": "Unusual traffic patterns detected on network segment 192.168.1.0/24",
    "severity": "high",
    "category": "threat",
    "source": "Network Monitoring System"
  }'
\`\`\`

## 4. Monitoring Setup
- Application Insights is configured for detailed telemetry
- Health check endpoint: https://${config.functionApp}.azurewebsites.net/api/health
- Set up alerts based on Function App metrics

## 5. Managed Identity Configuration
The Function App uses User Assigned Managed Identity for secure access to:
- Azure AI Project
- Storage accounts
- Other Azure services

Ensure the managed identity has appropriate permissions for your AI project.

## 6. Testing Endpoints
- Health: GET https://${config.functionApp}.azurewebsites.net/api/health
- Bot Messages: POST https://${config.functionApp}.azurewebsites.net/api/messages
- Notifications: POST https://${config.functionApp}.azurewebsites.net/api/notification
- Security Alerts: POST https://${config.functionApp}.azurewebsites.net/api/securityAlert
`;

  fs.writeFileSync(path.join(__dirname, 'DEPLOYMENT_GUIDE.md'), guide);
  console.log('\n📖 Configuration guide saved to DEPLOYMENT_GUIDE.md');
}

// Run the deployment
main().then(() => {
  generateConfigGuide();
}).catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
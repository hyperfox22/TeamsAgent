# SOCBot Azure Deployment Guide

This guide provides step-by-step instructions for deploying SOCBot to Azure using User Assigned Managed Identity with minimum privilege access and secure CI/CD through GitHub Actions.

## 🔐 Security Overview

### User Assigned Managed Identity (UAMI)
SOCBot uses User Assigned Managed Identity for all Azure service authentication, eliminating the need for stored secrets and providing enhanced security:

- **Storage Access**: Blob Data Contributor and Account Contributor for Function App operations
- **AI Foundry Access**: Cognitive Services User and Azure AI Developer roles for agent communication
- **Monitoring Access**: Metrics Publisher and Log Analytics Contributor for telemetry
- **No Access Keys**: All authentication uses Azure AD tokens where possible

### GitHub Actions Security
- **OIDC Federation**: No secrets stored in GitHub - uses federated identity credentials
- **Least Privilege**: Service principal has minimum required permissions per environment
- **Environment Protection**: Production deployments require manual approval
- **Security Scanning**: Automated vulnerability scanning with Trivy

## 📋 Prerequisites

Before starting deployment, ensure you have:

### Required Tools
- **Azure CLI** (v2.50+): `az --version`
- **GitHub CLI** (v2.0+): `gh --version`
- **Node.js** (v20+): `node --version`
- **Git**: For repository operations

### Required Access
- **Azure Subscription**: Contributor and User Access Administrator roles
- **Microsoft 365 Admin**: For Teams app registration and bot framework setup
- **GitHub Repository**: Admin access to hyperfox22 organization
- **Azure AI Foundry**: Access to AI project and deployed agents

### Azure Resources (Pre-deployment)
You'll need these resources before running deployment:

1. **Bot Framework App Registration**
   ```bash
   # Create via Azure Portal or CLI
   az ad app create --display-name "SOCBot" --available-to-other-tenants false
   ```

2. **Azure AI Foundry Project**
   - Project with deployed agent
   - Connection string and agent ID

3. **Microsoft 365 App Registration**
   - Teams app registration
   - Appropriate Microsoft Graph permissions

## 🚀 Deployment Steps

### Step 1: Initial Setup and Repository Creation

1. **Clone and Prepare Code**
   ```bash
   # If repository doesn't exist yet, create it locally first
   git clone <your-local-socbot-project>
   cd socbot
   
   # Add the GitHub remote
   git remote add origin https://github.com/hyperfox22/socbot.git
   ```

2. **Create GitHub Repository**
   ```bash
   # Create repository in hyperfox22 organization
   gh repo create hyperfox22/socbot --public --description "SOCBot - AI-powered Security Operations Center assistant for Microsoft Teams"
   ```

3. **Push Initial Code**
   ```bash
   git push -u origin main
   
   # Create develop branch for development deployments
   git checkout -b develop
   git push -u origin develop
   ```

### Step 2: Azure and GitHub Configuration

1. **Run Setup Script**
   ```bash
   # Make setup script executable
   chmod +x scripts/setup-github-deployment.sh
   
   # Run setup (requires Azure CLI and GitHub CLI authentication)
   ./scripts/setup-github-deployment.sh
   ```

   This script will:
   - Create Azure AD app registration with OIDC federation
   - Set up federated identity credentials for GitHub branches
   - Create development and production resource groups
   - Assign necessary RBAC permissions
   - Configure GitHub repository secrets

2. **Set Additional Secrets** (via GitHub UI or CLI)

   **Development Environment:**
   ```bash
   gh secret set BOT_APP_ID --body "your-dev-bot-app-id"
   gh secret set BOT_APP_PASSWORD --body "your-dev-bot-app-password"
   gh secret set AI_PROJECT_CONNECTION_STRING --body "your-dev-ai-connection"
   gh secret set AI_AGENT_ID --body "your-dev-agent-id"
   gh secret set M365_CLIENT_ID --body "your-m365-client-id"
   gh secret set M365_CLIENT_SECRET --body "your-m365-client-secret"
   gh secret set M365_TENANT_ID --body "your-tenant-id"
   ```

   **Production Environment:**
   ```bash
   gh secret set BOT_APP_ID_PROD --body "your-prod-bot-app-id"
   gh secret set BOT_APP_PASSWORD_PROD --body "your-prod-bot-app-password"
   gh secret set AI_PROJECT_CONNECTION_STRING_PROD --body "your-prod-ai-connection"
   gh secret set AI_AGENT_ID_PROD --body "your-prod-agent-id"
   gh secret set M365_CLIENT_ID_PROD --body "your-prod-m365-client-id"
   gh secret set M365_CLIENT_SECRET_PROD --body "your-prod-m365-client-secret"
   ```

3. **Configure Environment Variables** (via GitHub repository settings)
   
   Navigate to: `Settings → Environments → Create environment`
   
   **Development Environment (`dev`):**
   - `APP_NAME`: `socbot-dev`
   - `AI_PROJECT_NAME`: Your AI project name
   - `COGNITIVE_SERVICES_NAME`: Your Cognitive Services account name

   **Production Environment (`production`):**
   - `APP_NAME_PROD`: `socbot-prod`
   - `AI_PROJECT_NAME_PROD`: Your production AI project name
   - `COGNITIVE_SERVICES_NAME_PROD`: Your production Cognitive Services account name
   - **Protection Rules**: Enable "Required reviewers" for production deployments

### Step 3: Configure Deployment Parameters

1. **Update Parameter Files**
   
   Edit `infra/azure.parameters.json`:
   ```json
   {
     "parameters": {
       "appName": { "value": "socbot-dev" },
       "location": { "value": "East US" },
       "aiProjectName": { "value": "your-ai-project-name" },
       "cognitiveServicesAccountName": { "value": "your-cognitive-services-name" }
     }
   }
   ```

2. **Validate Configuration**
   ```bash
   # Test Bicep template locally
   az deployment group validate \
     --resource-group rg-socbot-dev \
     --template-file infra/azure.bicep \
     --parameters @infra/azure.parameters.json
   ```

### Step 4: Deploy to Development

1. **Push to Develop Branch**
   ```bash
   git checkout develop
   git add .
   git commit -m "feat: configure SOCBot for development deployment"
   git push origin develop
   ```

2. **Monitor Deployment**
   - Check GitHub Actions: `https://github.com/hyperfox22/socbot/actions`
   - Monitor Azure deployment progress in the Azure Portal
   - Review deployment logs for any issues

3. **Verify Development Deployment**
   ```bash
   # Check function app status
   az functionapp show --name socbot-dev --resource-group rg-socbot-dev
   
   # Test endpoint (after deployment completes)
   curl https://socbot-dev.azurewebsites.net/api/health
   ```

### Step 5: Deploy to Production

1. **Create Production Release**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Approve Production Deployment**
   - Navigate to GitHub Actions workflow
   - Review deployment plan
   - Approve production environment deployment

3. **Verify Production Deployment**
   ```bash
   # Check production function app
   az functionapp show --name socbot-prod --resource-group rg-socbot-prod
   ```

## 🔍 Post-Deployment Configuration

### Microsoft Teams Integration

1. **Update Teams App Manifest**
   - Update `appPackage/manifest.json` with production bot ID
   - Update messaging endpoint URLs
   - Package and upload to Teams admin center

2. **Configure Bot Channels**
   ```bash
   # Verify bot service registration
   az deployment group show \
     --resource-group rg-socbot-prod \
     --name botRegistration
   ```

### Application Insights Monitoring

1. **Set Up Alerts**
   ```bash
   # Create availability alerts
   az monitor metrics alert create \
     --name "SOCBot High Error Rate" \
     --resource-group rg-socbot-prod \
     --target-resource-id "your-function-app-resource-id" \
     --condition "exceptions/count > 10"
   ```

2. **Configure Dashboards**
   - Create Azure Monitor dashboards for key metrics
   - Set up Log Analytics queries for security incident tracking
   - Configure notification channels for critical alerts

### Security Hardening

1. **Network Security**
   ```bash
   # Enable private endpoints (optional)
   az network private-endpoint create \
     --name socbot-storage-pe \
     --resource-group rg-socbot-prod \
     --subnet your-subnet-id \
     --private-connection-resource-id your-storage-account-id
   ```

2. **Access Reviews**
   - Schedule regular RBAC permission reviews
   - Monitor managed identity usage in Azure AD logs
   - Review GitHub Actions deployment history

## 🛠️ Troubleshooting

### Common Deployment Issues

**1. RBAC Permission Errors**
```bash
# Check service principal permissions
az role assignment list --assignee your-service-principal-id

# Verify managed identity role assignments
az role assignment list --assignee your-managed-identity-principal-id
```

**2. Function App Deployment Failures**
```bash
# Check function app logs
az functionapp log tail --name socbot-dev --resource-group rg-socbot-dev

# Restart function app
az functionapp restart --name socbot-dev --resource-group rg-socbot-dev
```

**3. AI Agent Connection Issues**
```bash
# Test AI project connectivity
az ml workspace show --name your-ai-project-name --resource-group your-ai-rg

# Verify managed identity permissions for AI services
az role assignment list --scope your-ai-project-resource-id
```

### GitHub Actions Debugging

1. **OIDC Authentication Failures**
   - Verify federated identity credentials are correctly configured
   - Check that repository path matches exactly: `repo:hyperfox22/socbot:ref:refs/heads/main`
   - Ensure Azure AD app has correct issuer and audience

2. **Deployment Validation Failures**
   - Review Bicep template validation output
   - Check parameter file syntax and values
   - Verify resource naming conventions

3. **Secret Management**
   ```bash
   # List configured secrets (names only, not values)
   gh secret list --repo hyperfox22/socbot
   
   # Update a secret
   gh secret set SECRET_NAME --body "new-value" --repo hyperfox22/socbot
   ```

## 📊 Monitoring and Maintenance

### Key Metrics to Monitor

1. **Function App Health**
   - Request success rate
   - Response times
   - Error rates and exceptions
   - Memory and CPU utilization

2. **Bot Framework Metrics**
   - Message processing rates
   - Teams integration health
   - User engagement metrics

3. **AI Agent Performance**
   - Agent response times
   - Token consumption
   - Success/failure rates

4. **Security Metrics**
   - Authentication failures
   - Role assignment changes
   - Suspicious access patterns

### Maintenance Tasks

1. **Monthly Reviews**
   - RBAC permission audit
   - Cost optimization analysis
   - Security compliance check
   - Dependency updates

2. **Quarterly Updates**
   - Node.js runtime updates
   - Azure Functions runtime updates
   - Teams SDK updates
   - Security patches

## 🔗 Additional Resources

- [Azure Functions Security Best Practices](https://docs.microsoft.com/azure/azure-functions/security-concepts)
- [Managed Identity Best Practices](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/managed-identities-best-practice-recommendations)
- [GitHub Actions OIDC Guide](https://docs.github.com/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Teams Bot Framework Documentation](https://docs.microsoft.com/microsoftteams/platform/bots/what-are-bots)
- [Azure AI Foundry Documentation](https://docs.microsoft.com/azure/ai-foundry/)

---

## 🆘 Support

For deployment issues or questions:
1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check Azure Portal diagnostics
4. Contact your Azure administrator for permission issues

**Security Incidents**: Report immediately to your security team and disable affected components via Azure Portal if necessary.

---

*This deployment uses industry best practices for security, scalability, and maintainability. All components are designed with zero-trust principles and minimum privilege access.*
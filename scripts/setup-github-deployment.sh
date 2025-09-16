#!/bin/bash

# SOCBot Azure Deployment Setup Script
# This script configures GitHub repository with Azure OIDC federation and necessary secrets

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
REPO_URL="https://github.com/hyperfox22/socbot"
APP_NAME="socbot"
RESOURCE_GROUP_DEV="rg-socbot-dev"
RESOURCE_GROUP_PROD="rg-socbot-prod"
SUBSCRIPTION_ID=""
TENANT_ID=""

echo -e "${BLUE}🚀 SOCBot Azure Deployment Setup${NC}"
echo "=================================================="

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in to Azure
if ! az account show &> /dev/null; then
    print_error "Please login to Azure CLI first: az login"
    exit 1
fi

# Check if user is logged in to GitHub
if ! gh auth status &> /dev/null; then
    print_error "Please login to GitHub CLI first: gh auth login"
    exit 1
fi

print_status "Prerequisites check completed"

# Get Azure subscription and tenant info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
ACCOUNT_NAME=$(az account show --query user.name -o tsv)

echo -e "${BLUE}🔍 Azure Account Information:${NC}"
echo "  Subscription ID: $SUBSCRIPTION_ID"
echo "  Tenant ID: $TENANT_ID"
echo "  Account: $ACCOUNT_NAME"

# Create Azure AD App Registration for OIDC
echo -e "\n${BLUE}🔐 Creating Azure AD App Registration for OIDC...${NC}"

# Create app registration
APP_REG_OUTPUT=$(az ad app create \
    --display-name "socbot-github-oidc" \
    --query '{appId: appId, objectId: id}' \
    --output json)

APP_ID=$(echo $APP_REG_OUTPUT | jq -r '.appId')
OBJECT_ID=$(echo $APP_REG_OUTPUT | jq -r '.objectId')

print_status "App Registration created: $APP_ID"

# Create service principal
SP_OUTPUT=$(az ad sp create --id $APP_ID --query objectId -o tsv)
print_status "Service Principal created: $SP_OUTPUT"

# Create federated identity credentials for GitHub Actions
echo -e "\n${BLUE}🔗 Creating federated identity credentials...${NC}"

# For main branch (production)
az ad app federated-credential create \
    --id $APP_ID \
    --parameters '{
        "name": "socbot-main-branch",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:hyperfox22/socbot:ref:refs/heads/main",
        "description": "GitHub Actions deployment from main branch",
        "audiences": ["api://AzureADTokenExchange"]
    }'

# For develop branch (development)
az ad app federated-credential create \
    --id $APP_ID \
    --parameters '{
        "name": "socbot-develop-branch", 
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "repo:hyperfox22/socbot:ref:refs/heads/develop",
        "description": "GitHub Actions deployment from develop branch",
        "audiences": ["api://AzureADTokenExchange"]
    }'

# For pull requests
az ad app federated-credential create \
    --id $APP_ID \
    --parameters '{
        "name": "socbot-pull-requests",
        "issuer": "https://token.actions.githubusercontent.com", 
        "subject": "repo:hyperfox22/socbot:pull_request",
        "description": "GitHub Actions for pull request validation",
        "audiences": ["api://AzureADTokenExchange"]
    }'

print_status "Federated identity credentials created"

# Create resource groups if they don't exist
echo -e "\n${BLUE}🏗️  Creating resource groups...${NC}"

# Development resource group
if ! az group show --name $RESOURCE_GROUP_DEV &> /dev/null; then
    az group create --name $RESOURCE_GROUP_DEV --location "East US"
    print_status "Development resource group created: $RESOURCE_GROUP_DEV"
else
    print_status "Development resource group already exists: $RESOURCE_GROUP_DEV"
fi

# Production resource group  
if ! az group show --name $RESOURCE_GROUP_PROD &> /dev/null; then
    az group create --name $RESOURCE_GROUP_PROD --location "East US"
    print_status "Production resource group created: $RESOURCE_GROUP_PROD"
else
    print_status "Production resource group already exists: $RESOURCE_GROUP_PROD"
fi

# Assign RBAC permissions
echo -e "\n${BLUE}🔒 Assigning RBAC permissions...${NC}"

# Contributor role for development resource group
az role assignment create \
    --assignee $APP_ID \
    --role "Contributor" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_DEV"

# Contributor role for production resource group
az role assignment create \
    --assignee $APP_ID \
    --role "Contributor" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_PROD"

# User Access Administrator (needed for role assignments in Bicep)
az role assignment create \
    --assignee $APP_ID \
    --role "User Access Administrator" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_DEV"

az role assignment create \
    --assignee $APP_ID \
    --role "User Access Administrator" \
    --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP_PROD"

print_status "RBAC permissions assigned"

# Set GitHub repository secrets
echo -e "\n${BLUE}🔑 Setting GitHub repository secrets...${NC}"

# Check if repository exists, if not provide instructions
if ! gh repo view hyperfox22/socbot &> /dev/null; then
    print_warning "Repository hyperfox22/socbot does not exist yet."
    echo -e "\n${YELLOW}📝 Manual steps required:${NC}"
    echo "1. Create repository at: https://github.com/hyperfox22/socbot"
    echo "2. Push your SOCBot code to the repository"
    echo "3. Run the following commands to set secrets:"
    echo ""
    echo "gh repo set-secret AZURE_CLIENT_ID --body \"$APP_ID\" --repo hyperfox22/socbot"
    echo "gh repo set-secret AZURE_TENANT_ID --body \"$TENANT_ID\" --repo hyperfox22/socbot"  
    echo "gh repo set-secret AZURE_SUBSCRIPTION_ID --body \"$SUBSCRIPTION_ID\" --repo hyperfox22/socbot"
    echo "gh repo set-secret AZURE_RG --body \"$RESOURCE_GROUP_DEV\" --repo hyperfox22/socbot"
    echo "gh repo set-secret AZURE_RG_PROD --body \"$RESOURCE_GROUP_PROD\" --repo hyperfox22/socbot"
    echo ""
    echo -e "${YELLOW}Additional secrets to set manually:${NC}"
    echo "- BOT_APP_ID: Microsoft Bot Framework App ID"
    echo "- BOT_APP_PASSWORD: Microsoft Bot Framework App Password"
    echo "- BOT_APP_ID_PROD: Bot App ID for production"
    echo "- BOT_APP_PASSWORD_PROD: Bot App Password for production"
    echo "- AI_PROJECT_CONNECTION_STRING: Azure AI Foundry project connection"
    echo "- AI_AGENT_ID: Azure AI Foundry agent ID"
    echo "- AI_PROJECT_CONNECTION_STRING_PROD: Production AI project connection"
    echo "- AI_AGENT_ID_PROD: Production agent ID"
    echo "- M365_CLIENT_ID: Microsoft 365 app client ID"
    echo "- M365_CLIENT_SECRET: Microsoft 365 app client secret"
    echo "- M365_TENANT_ID: Microsoft 365 tenant ID"
    echo "- M365_CLIENT_ID_PROD: Production M365 client ID"
    echo "- M365_CLIENT_SECRET_PROD: Production M365 client secret"
else
    # Repository exists, set secrets
    gh secret set AZURE_CLIENT_ID --body "$APP_ID" --repo hyperfox22/socbot
    gh secret set AZURE_TENANT_ID --body "$TENANT_ID" --repo hyperfox22/socbot
    gh secret set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID" --repo hyperfox22/socbot
    gh secret set AZURE_RG --body "$RESOURCE_GROUP_DEV" --repo hyperfox22/socbot
    gh secret set AZURE_RG_PROD --body "$RESOURCE_GROUP_PROD" --repo hyperfox22/socbot
    
    print_status "GitHub secrets configured"
fi

# Create environment variables
echo -e "\n${BLUE}🌍 Setting GitHub environment variables...${NC}"
if gh repo view hyperfox22/socbot &> /dev/null; then
    # These would need to be set via GitHub UI or API since gh CLI doesn't support environment variables
    print_warning "Environment variables need to be set manually in GitHub repository settings:"
    echo "- APP_NAME: socbot-dev"
    echo "- APP_NAME_PROD: socbot-prod"
    echo "- AI_PROJECT_NAME: (your AI project name)"
    echo "- AI_PROJECT_NAME_PROD: (your production AI project name)"
    echo "- COGNITIVE_SERVICES_NAME: (your Cognitive Services account name)"
    echo "- COGNITIVE_SERVICES_NAME_PROD: (your production Cognitive Services name)"
fi

echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
echo "=================================================="
echo -e "${BLUE}Summary:${NC}"
echo "✅ Azure AD App Registration: $APP_ID"
echo "✅ Federated Identity Credentials configured"
echo "✅ Resource Groups created"
echo "✅ RBAC permissions assigned"
echo "✅ GitHub repository configured (if exists)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Create GitHub repository at: https://github.com/hyperfox22/socbot"
echo "2. Push your SOCBot code to the repository"
echo "3. Set the remaining GitHub secrets (Bot Framework, AI Foundry, M365)"
echo "4. Configure GitHub environments (dev, production) with protection rules"
echo "5. Test deployment by pushing to develop branch"
echo ""
echo -e "${BLUE}GitHub Actions will automatically:${NC}"
echo "- Validate Bicep templates on pull requests"
echo "- Deploy to dev environment on develop branch pushes"
echo "- Deploy to production environment on main branch pushes"
echo "- Use User Assigned Managed Identity with minimum required permissions"
echo ""
echo -e "${GREEN}Your SOCBot is ready for secure, automated deployments! 🤖${NC}"
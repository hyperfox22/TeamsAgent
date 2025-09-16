# 🚀 SOCBot Deployment Checklist

**Current Status: ⚠️ NOT READY TO DEPLOY**  
**Estimated Time to Deploy: 2-4 hours**

---

## 🔴 CRITICAL TASKS (Must Complete First)

### 1. Fix TypeScript Build Issues (15 minutes)
```powershell
# Run the quick fix script
./scripts/quick-fix.ps1

# Or manually:
npm install --save-dev @types/node@^20.0.0
npm install
npm run build
```
**Status: ⬜ Not Started**

### 2. Create Azure Bot Registration (30 minutes)
1. Go to [Azure Portal](https://portal.azure.com)
2. Create Resource > Bot Service
3. Get Microsoft App ID and Password
4. Save credentials securely

**Required Values:**
- Microsoft App ID: `_________________________`
- Microsoft App Password: `_________________________`
- Tenant ID: `_________________________`

**Status: ⬜ Not Started**

### 3. Configure Environment Variables (15 minutes)
Update `.env` file with real values:
```env
MicrosoftAppId=your-actual-bot-id
MicrosoftAppPassword=your-actual-password
AZURE_AI_PROJECT_ENDPOINT=your-ai-endpoint
```

**Status: ⬜ Not Started**

### 4. Fix Teams App Manifest (10 minutes)
Edit `appPackage/manifest.json`:
- Replace `{{BOT_ID}}` with your Microsoft App ID
- Replace `{{M365_APP_ID}}` with your M365 App ID

**Status: ⬜ Not Started**

---

## 🟡 AZURE DEPLOYMENT (1-2 hours)

### 5. Create Azure Resources
```bash
# Create resource group
az group create --name socbot-rg --location eastus

# Create Function App
az functionapp create \
  --resource-group socbot-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --name socbot-function-app \
  --storage-account socbotstorage
```

**Status: ⬜ Not Started**

### 6. Deploy Function App
```bash
# Deploy to Azure
func azure functionapp publish socbot-function-app --typescript
```

**Status: ⬜ Not Started**

### 7. Configure Function App Settings
```bash
az functionapp config appsettings set \
  --name socbot-function-app \
  --resource-group socbot-rg \
  --settings \
    MicrosoftAppId="your-bot-id" \
    MicrosoftAppPassword="your-password" \
    AZURE_AI_PROJECT_ENDPOINT="your-endpoint"
```

**Status: ⬜ Not Started**

### 8. Update Bot Messaging Endpoint
Set in Azure Portal > Bot Service > Configuration:
```
https://socbot-function-app.azurewebsites.net/api/messages
```

**Status: ⬜ Not Started**

---

## 🔵 TESTING & VALIDATION (30 minutes)

### 9. Test Health Endpoint
```bash
curl https://socbot-function-app.azurewebsites.net/api/health
```
**Expected Result:** HTTP 200 with health status

**Status: ⬜ Not Started**

### 10. Test Bot in Teams
1. Upload Teams app package
2. Start conversation with bot
3. Verify AI responses work

**Status: ⬜ Not Started**

### 11. Test Notification Endpoints
```bash
# Test notification endpoint
curl -X POST "https://socbot-function-app.azurewebsites.net/api/notification" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_KEY" \
  -d '{"prompt": "Test notification"}'

# Test security alert endpoint  
curl -X POST "https://socbot-function-app.azurewebsites.net/api/securityAlert" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_KEY" \
  -d '{"id": "test-1", "title": "Test Alert", "description": "Test"}'
```

**Status: ⬜ Not Started**

---

## ✅ COMPLETION CRITERIA

- [ ] All TypeScript compilation errors resolved
- [ ] Bot responds to messages in Teams
- [ ] Health endpoint returns HTTP 200
- [ ] Notification endpoint accepts requests
- [ ] Security alert endpoint works
- [ ] Application Insights logging active

---

## 🚨 CURRENT BLOCKERS

### **Blocker #1: TypeScript Compilation (137 errors)**
**Impact:** Cannot build or deploy
**Fix:** Run quick-fix script or install @types/node manually
**Estimated Time:** 15 minutes
**Priority:** 🔴 Critical

### **Blocker #2: No Bot Registration**
**Impact:** Teams integration impossible
**Fix:** Create Azure Bot Service resource
**Estimated Time:** 30 minutes  
**Priority:** 🔴 Critical

### **Blocker #3: Environment Variables**
**Impact:** Runtime configuration errors
**Fix:** Update .env with real credentials
**Estimated Time:** 15 minutes
**Priority:** 🔴 Critical

---

## 🎯 QUICK START COMMANDS

```powershell
# 1. Fix TypeScript issues
./scripts/quick-fix.ps1

# 2. Build and test locally
npm run build
npm run start

# 3. Deploy to Azure (after configuring credentials)
func azure functionapp publish socbot-function-app --typescript
```

---

## 📞 STATUS TRACKING

**Overall Progress:** 0% Complete  
**Next Action:** Run TypeScript fixes  
**Deployment ETA:** 2-4 hours after fixes applied  

**Last Updated:** $(Get-Date)  
**Updated By:** Deployment Script  

---

## 💡 HELPFUL TIPS

1. **Start with TypeScript fixes** - Nothing else will work without a successful build
2. **Get Bot Registration first** - You need the App ID for manifest updates  
3. **Test locally when possible** - Use Azure Functions Core Tools for local testing
4. **One step at a time** - Complete each section before moving to the next
5. **Keep credentials secure** - Never commit real passwords to source control

**Good luck with your deployment! 🚀**
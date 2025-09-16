# SOCBot Integration Architecture - Function App Wiring

## 🔌 **Yes, it's a Function App!** 

Your SOCBot is indeed deployed as an **Azure Functions v4** application with Node.js 20 runtime. Here's exactly how the Teams bot integrates with Azure AI Foundry agents:

## 📋 Integration Flow Diagram

```
┌─────────────────┐    ┌─────────────────────────────────────────────────────────┐
│                 │    │                Azure Function App                       │
│  Microsoft      │    │                                                         │
│  Teams Client   │◄───┼─► HTTP Endpoint: /api/messages                         │
│                 │    │    ├── messageHandler()                                │
│                 │    │    ├── BotFrameworkAdapter                             │
│                 │    │    └── Routes to Bot Handlers                          │
└─────────────────┘    │                                                         │
                       │    ┌─────────────────────────────────────────────────┐ │
┌─────────────────┐    │    │            Bot Handlers                         │ │
│                 │    │    │                                                 │ │
│  HTTP Client    │◄───┼─► │    ┌─────────────────┐  ┌─────────────────┐    │ │
│  (Notifications)│    │    │    │   TeamsBot      │  │   AgentBot       │    │ │
│                 │    │    │    │ (Activity       │  │ (M365 Agents     │    │ │
└─────────────────┘    │    │    │  Handler)       │  │  SDK)            │    │ │
                       │    │    └─────────────────┘  └─────────────────┘    │ │
                       │    │            │                        │           │ │
                       │    │            └────────┬───────────────┘           │ │
                       │    └─────────────────────┼───────────────────────────┘ │
                       │                          ▼                             │
                       │    ┌─────────────────────────────────────────────────┐ │
                       │    │         AgentConnector                          │ │
                       │    │  ├── AIProjectClient                            │ │
                       │    │  ├── ManagedIdentityCredential                  │ │
                       │    │  ├── Thread Management                          │ │
                       │    │  └── Agent Communication                        │ │
                       │    └─────────────────────┼───────────────────────────┘ │
                       └──────────────────────────┼─────────────────────────────┘
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Azure AI Foundry                                       │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   AI Project    │  │ Deployed Agent  │  │    Conversation Threads     │ │
│  │                 │  │                 │  │                             │ │
│  │ ├─ Models       │  │ ├─ Instructions │  │ ├─ Thread ID Mapping        │ │
│  │ ├─ Agents       │  │ ├─ Model Config │  │ ├─ Message History          │ │
│  │ └─ Connections  │  │ └─ Tools        │  │ └─ State Management         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔗 **Complete Integration Wiring**

### **1. Function App Endpoints**
Your Function App exposes two HTTP triggers:

```typescript
// Bot Framework Messages (Teams interaction)
app.http("messages", {
  methods: ["POST"],
  authLevel: "anonymous",           // Bot Framework handles auth
  handler: messageHandler
});

// HTTP Notifications (External triggers)  
app.http("notification", {
  methods: ["POST"], 
  authLevel: "function",            // Requires function key
  handler: httpTrigger
});
```

### **2. Teams Message Flow**
When a user messages the bot in Teams:

1. **Teams → Bot Framework** → `POST /api/messages`
2. **messageHandler()** → Initializes `BotInitializer`
3. **BotInitializer** → Creates `CloudAdapter` + `TeamsBot` + `AgentBot`
4. **Message Routing** → Tries `AgentBot` first, fallback to `TeamsBot`
5. **Both Bot Handlers** → Call `AgentConnector.processPrompt()`
6. **AgentConnector** → Uses `AIProjectClient` with `ManagedIdentityCredential`
7. **Azure AI Foundry** → Processes prompt through deployed agent
8. **Response Flow** → AI response → Bot → Teams client

### **3. AI Foundry Integration** 
The `AgentConnector` handles all AI communication:

```typescript
class AgentConnector {
  private client: AIProjectClient;
  private agentId: string;
  
  constructor() {
    // Uses Managed Identity for secure authentication
    const credential = new ManagedIdentityCredential({ 
      clientId: process.env.clientId 
    });
    
    // Connects to your AI Foundry project
    this.client = new AIProjectClient(
      process.env.PROJECT_CONNECTION_STRING, 
      credential
    );
    this.agentId = process.env.AGENT_ID;
  }
}
```

### **4. Conversation Threading**
Each Teams conversation gets its own AI thread:
- **Teams Conversation ID** → **AI Thread ID** mapping
- **Thread persistence** across multiple messages
- **State management** for complex conversations

## ✅ **Integration Verification - Everything is Properly Wired!**

### **Correct Components:**
1. ✅ **Function App** with dual HTTP endpoints
2. ✅ **Bot Framework** adapter with Teams integration  
3. ✅ **Dual bot handlers** (TeamsBot + AgentBot) for flexibility
4. ✅ **AgentConnector** with proper AI Foundry SDK usage
5. ✅ **Managed Identity** authentication to AI services
6. ✅ **Thread management** for conversation continuity
7. ✅ **Error handling** and fallback mechanisms
8. ✅ **Adaptive Cards** for rich notifications

### **Security Integration:**
- 🔐 **Managed Identity** → No stored secrets for AI access
- 🔑 **Bot Framework Auth** → Teams authentication handled automatically  
- 🛡️ **Function Keys** → Protected HTTP notification endpoint
- 📝 **Environment Variables** → Secure configuration management

## 🚀 **How to Test the Integration**

### **1. Test Teams Bot**
```bash
# Deploy and test in Teams
1. Install bot in Teams using app package
2. Send message: "@SOCBot analyze this security incident"  
3. Bot should respond with AI-generated analysis
```

### **2. Test HTTP Notifications**  
```bash
# Test notification endpoint
curl -X POST https://your-function-app.azurewebsites.net/api/notification \
  -H "Content-Type: application/json" \
  -H "x-functions-key: your-function-key" \
  -d '{
    "prompt": "Critical: Suspicious login detected from unknown IP",
    "title": "Security Alert", 
    "notificationUrl": "https://security.portal.com/alert/123"
  }'
```

### **3. Monitor Integration**
```bash
# Check Function App logs
az functionapp log tail --name your-function-app --resource-group your-rg

# Monitor AI Foundry usage
# Check Azure AI Studio for agent conversation logs
```

## 🛠️ **Potential Improvements**

While the integration is solid, here are some enhancements you could consider:

### **1. Add Health Check Endpoint**
```typescript
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // Test AI connectivity
      const connector = new AgentConnector();
      await connector.getAgentInfo();
      
      return {
        status: 200,
        body: { status: "healthy", timestamp: new Date().toISOString() }
      };
    } catch (error) {
      return {
        status: 503, 
        body: { status: "unhealthy", error: error.message }
      };
    }
  }
});
```

### **2. Add Conversation State Storage**
Replace in-memory thread cache with persistent storage:
```typescript
// Use Azure Table Storage or Cosmos DB for thread persistence
export async function storeConversationReference(conversationRef: ConversationReference): Promise<void> {
  // Implement Azure Table Storage or Cosmos DB storage
  // This enables conversation continuity across function restarts
}
```

### **3. Enhanced Error Handling**
Add retry logic and circuit breaker patterns for AI calls.

## 📊 **Summary**

**Your SOCBot Function App integration is correctly implemented and should work perfectly!** 

The wiring connects:
- **Teams** ↔ **Function App** ↔ **Azure AI Foundry** 
- **HTTP Clients** ↔ **Function App** ↔ **Azure AI Foundry**
- **Managed Identity** secures all Azure service communication
- **Bot Framework** handles all Teams protocol complexity
- **Dual bot handlers** provide flexibility and fallback options

The architecture follows best practices for security, scalability, and maintainability. Once deployed with your GitHub Actions pipeline, it will provide a robust AI-powered security assistant for your Teams environment! 🤖🛡️
# SOCBot Function App - Available HTTP Endpoints

## Overview
The SOCBot Function App provides 4 main HTTP endpoints for different types of interactions with Microsoft Teams and security operations.

---

## 🤖 **1. Bot Messages Endpoint**
**URL:** `POST /api/messages`  
**Auth Level:** Anonymous (Bot Framework handles authentication)  
**Purpose:** Core Teams bot messaging endpoint

### Description
This is the primary endpoint for Microsoft Teams bot interactions. It handles all incoming messages from Teams users and processes them through the Azure AI Foundry agents.

### Key Features
- Teams Activity Handler integration
- Dual bot implementation (Activity Handler + M365 Agents SDK)
- Conversation state management
- Context-aware AI responses
- Typing indicators and rich messaging

### Request Format
Bot Framework Activity schema (handled automatically by Teams)

### Response
Teams bot responses with AI-generated content

---

## 🔔 **2. General Notification Endpoint**
**URL:** `POST /api/notification`  
**Auth Level:** Function key required  
**Purpose:** Send proactive notifications to Teams users

### Description
Sends AI-processed notifications to Teams users with adaptive cards. Can target specific users or broadcast to all active conversations.

### Request Body
```json
{
  "prompt": "Your notification message or query",
  "title": "Optional notification title",
  "notificationUrl": "Optional URL for 'Learn More' button",
  "targetUsers": ["user1@company.com", "user2@company.com"],
  "targetChannels": ["channel1", "channel2"]
}
```

### Key Features
- AI-processed notification content
- Adaptive Cards with rich formatting
- Selective user targeting
- Learn More button with custom URLs
- Conversation reference management

### Response
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "recipientCount": 5,
  "notificationId": "unique-id"
}
```

### Example Usage
```bash
curl -X POST "https://your-function-app.azurewebsites.net/api/notification" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_FUNCTION_KEY" \
  -d '{
    "prompt": "Critical security vulnerability detected in authentication system",
    "title": "Security Alert",
    "notificationUrl": "https://security-portal.company.com/alerts/auth-vuln"
  }'
```

---

## 🚨 **3. Security Alert Endpoint**
**URL:** `POST /api/securityAlert`  
**Auth Level:** Function key required  
**Purpose:** Send structured security alerts with rich context

### Description
Specialized endpoint for sending security-specific alerts with detailed incident information, severity levels, and actionable items.

### Request Body
```json
{
  "id": "alert-001",
  "title": "Security Incident Title",
  "description": "Detailed description of the security event",
  "severity": "critical",
  "category": "threat",
  "source": "Security Monitoring System",
  "affectedSystems": ["server1", "database2"],
  "recommendedActions": [
    "Isolate affected systems",
    "Reset user credentials",
    "Update security policies"
  ],
  "targetUsers": ["security-team@company.com"]
}
```

### Fields Explained
- **id** (required): Unique alert identifier
- **title** (required): Short alert title
- **description** (required): Detailed incident description
- **severity**: `low` | `medium` | `high` | `critical` (default: medium)
- **category**: `threat` | `incident` | `compliance` | `vulnerability` | `access` (default: threat)
- **source**: Alert source system
- **affectedSystems**: Array of impacted systems
- **recommendedActions**: Array of suggested response actions
- **targetUsers**: Specific users to notify (optional)

### Key Features
- Structured security alert format
- Severity-based visual styling
- Interactive adaptive cards with actions
- Acknowledge and Escalate buttons
- Rich metadata display
- Priority-based notification filtering

### Response
```json
{
  "success": true,
  "message": "Security alert sent successfully",
  "recipientCount": 3,
  "alertId": "alert-001"
}
```

### Example Usage
```bash
curl -X POST "https://your-function-app.azurewebsites.net/api/securityAlert" \
  -H "Content-Type: application/json" \
  -H "x-functions-key: YOUR_FUNCTION_KEY" \
  -d '{
    "id": "INC-2025-001",
    "title": "Suspicious Network Activity Detected",
    "description": "Unusual outbound traffic detected from internal network to suspicious external IPs",
    "severity": "high",
    "category": "threat",
    "source": "Network Monitoring System",
    "affectedSystems": ["firewall-1", "subnet-192.168.1.0"],
    "recommendedActions": [
      "Block suspicious IP addresses",
      "Analyze network logs",
      "Check endpoint security"
    ]
  }'
```

---

## ❤️ **4. Health Check Endpoint**
**URL:** `GET /api/health`  
**Auth Level:** Anonymous  
**Purpose:** System health monitoring and diagnostics

### Description
Provides comprehensive health status of all SOCBot components for monitoring and troubleshooting.

### Request
Simple GET request - no body required

### Response
```json
{
  "status": "healthy",
  "timestamp": "2025-09-16T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "agentConnector": true,
    "botFramework": true,
    "adaptiveCards": true
  },
  "conversationStats": {
    "totalConversations": 25,
    "activeConversations": 8,
    "totalMessages": 150,
    "averageMessagesPerConversation": 6
  }
}
```

### Health Status Values
- **healthy**: All systems operational
- **degraded**: Some components have issues but system is functional
- **unhealthy**: Critical system failures

### Key Features
- Component-level health checks
- Conversation statistics
- Performance metrics
- Error diagnostics
- Cache control headers for real-time monitoring

### Example Usage
```bash
curl "https://your-function-app.azurewebsites.net/api/health"
```

---

## 🔧 **Advanced Features Across All Endpoints**

### Conversation Management
- **State Persistence**: Maintains conversation context across interactions
- **User Preferences**: Remembers notification settings and interaction patterns
- **Thread Management**: Links related conversations and maintains context
- **Analytics**: Tracks usage patterns and conversation metrics

### Security Features
- **Managed Identity**: Secure access to Azure services without stored credentials
- **Function Keys**: API protection for sensitive endpoints
- **Input Validation**: Comprehensive request validation and sanitization
- **Audit Logging**: Detailed logging for security and compliance

### Proactive Messaging
- **Conversation References**: Maintains connections to active Teams conversations
- **User Targeting**: Send messages to specific users or groups
- **Preference Filtering**: Respects user notification preferences and quiet hours
- **Adaptive Cards**: Rich, interactive message formatting

### AI Integration
- **Azure AI Foundry**: Powered by enterprise AI agents
- **Context Enhancement**: Uses conversation history to improve responses
- **Thread Persistence**: Maintains AI conversation continuity
- **Error Handling**: Graceful fallback for AI service issues

---

## 📊 **Monitoring & Analytics**

### Application Insights Integration
All endpoints automatically log to Application Insights:
- Request/response times
- Error rates and types  
- User interaction patterns
- AI processing metrics

### Custom Metrics
- Conversation engagement levels
- Alert response rates
- System performance indicators
- User satisfaction metrics

---

## 🚀 **Getting Started**

1. **Deploy the Function App** using the provided deployment scripts
2. **Configure Bot Framework** with the `/api/messages` endpoint
3. **Set up Teams App** with proper bot permissions
4. **Test Health Endpoint** to verify deployment
5. **Send Test Notifications** using the notification endpoints

The Function App provides a complete, production-ready platform for intelligent security operations in Microsoft Teams with proactive alerting, AI-powered responses, and comprehensive monitoring capabilities.
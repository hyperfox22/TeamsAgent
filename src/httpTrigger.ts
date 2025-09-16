import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BotFrameworkAdapter, TurnContext, ConversationReference, ConversationParameters } from "botbuilder";
import { AgentConnector } from "./agentConnector";
import { BotInitializer } from "./internal/initialize";
import { Template } from "adaptivecards-templating";
import { conversationManager } from "./conversationManager";
import { createProactiveNotifier, SecurityAlert } from "./proactiveNotifier";
import * as fs from 'fs';
import * as path from 'path';

interface NotificationRequest {
  prompt: string;
  title?: string;
  notificationUrl?: string;
  targetUsers?: string[];
  targetChannels?: string[];
}

interface SecurityAlertRequest {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'threat' | 'incident' | 'compliance' | 'vulnerability' | 'access';
  source: string;
  affectedSystems?: string[];
  recommendedActions?: string[];
  targetUsers?: string[];
}

interface NotificationResponse {
  success: boolean;
  message: string;
  recipientCount?: number;
  errorDetails?: string;
}

let botInitializer: BotInitializer;
let agentConnector: AgentConnector;
let adaptiveCardTemplate: any;

/**
 * HTTP Trigger for sending notifications through Teams bot
 * POST /api/notification
 */
async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log("HTTP notification trigger activated");

  try {
    // Initialize components if not already done
    if (!botInitializer) {
      const config = BotInitializer.getConfigFromEnvironment();
      botInitializer = new BotInitializer(config);
      agentConnector = new AgentConnector();
      
      // Load adaptive card template
      adaptiveCardTemplate = loadAdaptiveCardTemplate();
    }

    // Validate HTTP method
    if (request.method !== "POST") {
      return {
        status: 405,
        body: { error: "Method not allowed. Only POST requests are supported." },
        headers: { "Content-Type": "application/json" }
      };
    }

    // Parse request body
    const requestBody = await request.json() as NotificationRequest;
    
    if (!requestBody.prompt) {
      return {
        status: 400,
        body: { error: "Missing required 'prompt' field in request body" },
        headers: { "Content-Type": "application/json" }
      };
    }

    // Process prompt through AI agent
    context.log("Processing prompt through AI agent:", requestBody.prompt);
    const agentResponse = await agentConnector.processPrompt(requestBody.prompt);

    // Create notification content
    const notificationData = {
      title: requestBody.title || "SOCBot Security Alert",
      appName: "SOCBot",
      description: agentResponse.message,
      notificationUrl: requestBody.notificationUrl || "https://docs.microsoft.com/en-us/security"
    };

    // Generate adaptive card
    const adaptiveCard = generateAdaptiveCard(notificationData);

    // Send notifications to all bot installations
    const recipientCount = await sendNotificationsToAllInstallations(
      adaptiveCard,
      requestBody.targetUsers,
      requestBody.targetChannels,
      context
    );

    const response: NotificationResponse = {
      success: true,
      message: "Notifications sent successfully",
      recipientCount: recipientCount
    };

    return {
      status: 200,
      body: response,
      headers: { "Content-Type": "application/json" }
    };

  } catch (error) {
    context.log.error("Error in notification handler:", error);
    
    const errorResponse: NotificationResponse = {
      success: false,
      message: "Failed to send notifications",
      errorDetails: error instanceof Error ? error.message : "Unknown error"
    };

    return {
      status: 500,
      body: errorResponse,
      headers: { "Content-Type": "application/json" }
    };
  }
}

/**
 * Load adaptive card template from file
 */
function loadAdaptiveCardTemplate(): any {
  try {
    const templatePath = path.join(__dirname, 'adaptiveCards', 'notification-default.json');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return JSON.parse(templateContent);
  } catch (error) {
    console.warn("Could not load adaptive card template, using fallback:", error);
    // Fallback template
    return {
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "type": "AdaptiveCard",
      "version": "1.5",
      "body": [
        {
          "type": "TextBlock",
          "text": "${title}",
          "weight": "Bolder",
          "size": "Medium",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "From: ${appName}",
          "isSubtle": true,
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "${description}",
          "wrap": true,
          "spacing": "Medium"
        }
      ],
      "actions": [
        {
          "type": "Action.OpenUrl",
          "title": "Learn More",
          "url": "${notificationUrl}"
        }
      ]
    };
  }
}

/**
 * Generate adaptive card with data
 */
function generateAdaptiveCard(data: any): any {
  try {
    const template = new Template(adaptiveCardTemplate);
    return template.expand({ $root: data });
  } catch (error) {
    console.error("Error generating adaptive card:", error);
    // Return simple fallback card
    return {
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "type": "AdaptiveCard",
      "version": "1.5",
      "body": [
        {
          "type": "TextBlock",
          "text": data.title || "SOCBot Notification",
          "weight": "Bolder",
          "size": "Medium"
        },
        {
          "type": "TextBlock",
          "text": data.description || "Security notification from SOCBot",
          "wrap": true
        }
      ]
    };
  }
}

/**
 * Send notifications to all bot installations
 */
async function sendNotificationsToAllInstallations(
  adaptiveCard: any,
  targetUsers?: string[],
  targetChannels?: string[],
  context?: InvocationContext
): Promise<number> {
  let sentCount = 0;
  
  try {
    // Get conversation references for all installations
    // Note: In a real implementation, you would store conversation references
    // when the bot is installed and retrieve them from storage (e.g., Azure Table Storage)
    
    const conversationReferences = await getStoredConversationReferences();
    
    if (conversationReferences.length === 0) {
      context?.log.warn("No conversation references found. Bot may not be installed anywhere.");
      return 0;
    }

    // Send to each installation
    for (const conversationRef of conversationReferences) {
      try {
        // Skip if targeting specific users/channels and this doesn't match
        if (targetUsers && targetUsers.length > 0) {
          const userId = conversationRef.user?.id;
          if (userId && !targetUsers.includes(userId)) {
            continue;
          }
        }

        if (targetChannels && targetChannels.length > 0) {
          const channelId = conversationRef.channelId;
          if (!targetChannels.includes(channelId)) {
            continue;
          }
        }

        await botInitializer.adapter.continueConversationAsync(
          process.env.MicrosoftAppId || "",
          conversationRef,
          async (turnContext: TurnContext) => {
            const message = {
              type: 'message',
              attachments: [
                {
                  contentType: 'application/vnd.microsoft.card.adaptive',
                  content: adaptiveCard
                }
              ]
            };
            await turnContext.sendActivity(message);
          }
        );

        sentCount++;
        context?.log(`Notification sent to conversation: ${conversationRef.conversation.id}`);

      } catch (error) {
        context?.log.error(`Failed to send notification to conversation ${conversationRef.conversation.id}:`, error);
      }
    }

  } catch (error) {
    context?.log.error("Error sending notifications:", error);
    throw error;
  }

  return sentCount;
}

/**
 * Get stored conversation references
 * In production, implement proper storage mechanism
 */
async function getStoredConversationReferences(): Promise<ConversationReference[]> {
  // TODO: Implement proper storage retrieval
  // This would typically read from Azure Table Storage, Cosmos DB, etc.
  // For now, returning empty array - conversations would be stored when bot is installed
  
  const storedRefs: ConversationReference[] = [];
  
  // Example of what stored conversation references might look like:
  /*
  storedRefs.push({
    activityId: undefined,
    user: { id: "user-id", name: "User Name" },
    bot: { id: process.env.MicrosoftAppId || "", name: "SOCBot" },
    conversation: { id: "conversation-id" },
    channelId: "msteams",
    serviceUrl: "https://smba.trafficmanager.net/amer/"
  });
  */
  
  return storedRefs;
}

/**
 * Store conversation reference when bot is installed
 * This would be called from the bot's onMembersAdded handler
 */
export async function storeConversationReference(conversationRef: ConversationReference): Promise<void> {
  // TODO: Implement proper storage mechanism
  // Store to Azure Table Storage, Cosmos DB, etc.
  console.log("Would store conversation reference:", conversationRef.conversation.id);
}

// Register the HTTP trigger
app.http("notification", {
  methods: ["POST"],
  authLevel: "function",
  handler: httpTrigger
});

// Also register the bot messages endpoint
app.http("messages", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    // Import and use the message handler
    const { messageHandler } = await import("./internal/messageHandler");
    return await messageHandler(request, context);
  }
});

// Health check endpoint for monitoring and testing
app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log("Health check requested");
    
    try {
      const healthData = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: "production", // Simplified to avoid process reference
        checks: {
          agentConnector: false,
          botFramework: false,
          adaptiveCards: false
        }
      };

      // Test AgentConnector initialization
      try {
        const agentConnector = new AgentConnector();
        healthData.checks.agentConnector = true;
      } catch (error: any) {
        context.log("AgentConnector health check failed:", error?.message || "Unknown error");
      }

      // Test Bot initialization
      try {
        const config = BotInitializer.getConfigFromEnvironment();
        const botInitializer = new BotInitializer(config);
        healthData.checks.botFramework = !!(botInitializer.adapter && botInitializer.teamsBot);
      } catch (error: any) {
        context.log("Bot Framework health check failed:", error?.message || "Unknown error");
      }

      // Test Adaptive Cards template
      try {
        const templateExists = !!adaptiveCardTemplate || loadAdaptiveCardTemplate();
        healthData.checks.adaptiveCards = !!templateExists;
      } catch (error: any) {
        context.log("Adaptive Cards health check failed:", error?.message || "Unknown error");
      }

      // Determine overall health
      const allChecksPass = Object.values(healthData.checks).every(Boolean);
      const statusCode = allChecksPass ? 200 : 503;
      healthData.status = allChecksPass ? "healthy" : "degraded";

      return {
        status: statusCode,
        body: healthData,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      };

    } catch (error: any) {
      context.log.error("Health check error:", error);
      
      return {
        status: 503,
        body: {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error?.message || "Unknown error occurred"
        },
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      };
    }
  }
});

// Register security alert endpoint
app.http("securityAlert", {
  methods: ["POST"],
  authLevel: "function", // Requires function key for security
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log("Security alert endpoint called");

    try {
      // Parse request body
      const alertRequest: SecurityAlertRequest = await request.json() as SecurityAlertRequest;
      
      if (!alertRequest.id || !alertRequest.title || !alertRequest.description) {
        return {
          status: 400,
          body: {
            success: false,
            message: "Missing required fields: id, title, description"
          },
          headers: { "Content-Type": "application/json" }
        };
      }

      // Initialize components if not already done
      if (!botInitializer) {
        const config = BotInitializer.getConfigFromEnvironment();
        botInitializer = new BotInitializer(config);
        agentConnector = new AgentConnector();
      }

      // Create security alert
      const alert: SecurityAlert = {
        id: alertRequest.id,
        title: alertRequest.title,
        description: alertRequest.description,
        severity: alertRequest.severity || 'medium',
        category: alertRequest.category || 'threat',
        timestamp: new Date().toISOString(),
        source: alertRequest.source || 'Security System',
        affectedSystems: alertRequest.affectedSystems,
        recommendedActions: alertRequest.recommendedActions
      };

      // Create proactive notifier
      const adapter = botInitializer.adapter;
      const proactiveNotifier = createProactiveNotifier(adapter);

      // Send alert
      await proactiveNotifier.sendSecurityAlert(alert, alertRequest.targetUsers);

      // Get conversation statistics for response
      const stats = conversationManager.getStatistics();

      return {
        status: 200,
        body: {
          success: true,
          message: "Security alert sent successfully",
          recipientCount: stats.activeConversations,
          alertId: alert.id
        },
        headers: { "Content-Type": "application/json" }
      };

    } catch (error: any) {
      context.log.error("Error sending security alert:", error);
      
      return {
        status: 500,
        body: {
          success: false,
          message: "Failed to send security alert",
          errorDetails: error?.message || "Unknown error"
        },
        headers: { "Content-Type": "application/json" }
      };
    }
  }
});

export default httpTrigger;
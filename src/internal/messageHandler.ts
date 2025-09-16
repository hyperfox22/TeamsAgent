import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BotInitializer } from "./initialize";

let botInitializer: BotInitializer;

/**
 * Azure Function for handling Bot Framework messages
 * This handles the /api/messages endpoint for Teams bot interactions
 */
export async function messageHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log("Bot Framework message handler triggered");

  try {
    // Initialize bot components if not already done
    if (!botInitializer) {
      const config = BotInitializer.getConfigFromEnvironment();
      botInitializer = new BotInitializer(config);
    }

    // Handle the request through Bot Framework adapter
    const response = await botInitializer.adapter.process(request, {
      send: async (responseData) => {
        return {
          status: 200,
          body: responseData,
          headers: {
            "Content-Type": "application/json"
          }
        };
      }
    } as any, async (context) => {
      // Route to appropriate bot handler
      try {
        // Try Agent Application first for enhanced features
        await botInitializer.agentBot.getApp().run(context);
      } catch (agentError) {
        context.log("Agent bot failed, falling back to Teams bot:", agentError);
        // Fallback to standard Teams bot
        await botInitializer.teamsBot.run(context);
      }
    });

    return response;

  } catch (error) {
    context.log.error("Error in message handler:", error);
    
    return {
      status: 500,
      body: {
        error: "Internal server error",
        message: "An error occurred while processing the bot message"
      },
      headers: {
        "Content-Type": "application/json"
      }
    };
  }
}

/**
 * Validate incoming Bot Framework requests
 */
function validateBotFrameworkRequest(request: HttpRequest): boolean {
  // Check if it's a POST request
  if (request.method !== "POST") {
    return false;
  }

  // Check for Bot Framework specific headers
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    // In development, we might allow requests without auth header
    const isDevelopment = process.env.NODE_ENV === "development";
    return isDevelopment;
  }

  // Bot Framework requests should have Bearer token
  return authHeader.startsWith("Bearer ");
}

/**
 * Get bot information for health checks
 */
export function getBotInfo() {
  try {
    const config = BotInitializer.getConfigFromEnvironment();
    return {
      status: "healthy",
      botId: config.MicrosoftAppId ? "configured" : "not configured",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    };
  }
}
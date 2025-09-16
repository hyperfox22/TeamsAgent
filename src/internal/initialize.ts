import { CloudAdapter, ConfigurationBotFrameworkAuthentication } from "botbuilder";
import { TeamsBot, AgentBot } from "../teamsBot";

export interface BotConfiguration {
  MicrosoftAppId: string;
  MicrosoftAppPassword: string;
  MicrosoftAppType?: string;
  MicrosoftAppTenantId?: string;
}

/**
 * Initialize bot framework components
 */
export class BotInitializer {
  public adapter: CloudAdapter;
  public teamsBot: TeamsBot;
  public agentBot: AgentBot;

  constructor(config: BotConfiguration) {
    // Create Bot Framework Adapter
    const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication({
      MicrosoftAppId: config.MicrosoftAppId,
      MicrosoftAppPassword: config.MicrosoftAppPassword,
      MicrosoftAppType: config.MicrosoftAppType || "",
      MicrosoftAppTenantId: config.MicrosoftAppTenantId || ""
    });

    this.adapter = new CloudAdapter(botFrameworkAuthentication);

    // Error handling
    this.adapter.onTurnError = async (context, error) => {
      console.error("Bot Framework Adapter Error:", error);
      
      // Send a message to the user
      await context.sendActivity(`Sorry, an error occurred: ${error.message}`);
      
      // Clear conversation state if applicable
      // await conversationState.clear(context);
      // await conversationState.saveChanges(context);
    };

    // Initialize bot instances
    this.teamsBot = new TeamsBot();
    this.agentBot = new AgentBot();

    console.log("Bot components initialized successfully");
  }

  /**
   * Get configuration from environment variables
   */
  static getConfigFromEnvironment(): BotConfiguration {
    const config: BotConfiguration = {
      MicrosoftAppId: process.env.MicrosoftAppId || process.env.BOT_ID || "",
      MicrosoftAppPassword: process.env.MicrosoftAppPassword || process.env.BOT_PASSWORD || "",
      MicrosoftAppType: process.env.MicrosoftAppType || "",
      MicrosoftAppTenantId: process.env.MicrosoftAppTenantId || process.env.M365_TENANT_ID || ""
    };

    // Validate configuration
    if (!config.MicrosoftAppId || !config.MicrosoftAppPassword) {
      throw new Error("Missing required bot configuration. Please set MicrosoftAppId and MicrosoftAppPassword environment variables.");
    }

    console.log("Bot configuration loaded:", {
      MicrosoftAppId: config.MicrosoftAppId ? "***" : "NOT SET",
      MicrosoftAppPassword: config.MicrosoftAppPassword ? "***" : "NOT SET",
      MicrosoftAppType: config.MicrosoftAppType || "NOT SET",
      MicrosoftAppTenantId: config.MicrosoftAppTenantId ? "***" : "NOT SET"
    });

    return config;
  }
}
import {
  TeamsActivityHandler,
  TurnContext,
  MessageFactory,
  ChannelInfo,
  TeamsChannelAccount
} from "botbuilder";
import { AgentApplication } from "@microsoft/agents-hosting";
import { AgentConnector } from "./agentConnector";
import { conversationManager } from "./conversationManager";

/**
 * Teams Activity Handler Bot implementation
 * Handles direct messages and mentions with AI agent integration
 */
export class TeamsBot extends TeamsActivityHandler {
  private agentConnector: AgentConnector;

  constructor() {
    super();

    this.agentConnector = new AgentConnector();

    // Handle member additions (welcome message)
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      if (membersAdded) {
        for (const member of membersAdded) {
          if (member.id !== context.activity.recipient.id) {
            const welcomeText = `Welcome to SOCBot! 🛡️\n\n` +
              `I'm your Security Operations Center assistant, powered by Azure AI. ` +
              `I can help you with:\n\n` +
              `• Security incident analysis\n` +
              `• Threat intelligence insights\n` +
              `• Security best practices\n` +
              `• Compliance guidance\n\n` +
              `Just send me a message or mention me in a channel to get started!`;
            
            const welcomeMessage = MessageFactory.text(welcomeText);
            await context.sendActivity(welcomeMessage);
          }
        }
      }
      await next();
    });

    // Handle messages
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });
  }

  /**
   * Handle incoming messages with AI agent integration and conversation management
   */
  private async handleMessage(context: TurnContext): Promise<void> {
    try {
      const userMessage = context.activity.text;
      if (!userMessage) {
        return;
      }

      // Update conversation state with enhanced context
      const conversationState = await conversationManager.updateConversationState(context);

      // Strip @mentions from the message
      const cleanMessage = this.removeMentions(userMessage);
      
      // Generate conversation ID for thread persistence
      const conversationId = context.activity.conversation.id;

      // Enhance prompt with conversation context
      const enhancedMessage = conversationManager.enhancePromptWithContext(cleanMessage, conversationId);

      // Send typing indicator
      await context.sendActivity({ type: 'typing' });

      // Process message through AI agent with enhanced context
      const response = await this.agentConnector.processPrompt(enhancedMessage, conversationId);
      
      // Send AI response back to user
      const replyActivity = MessageFactory.text(response.message);
      await context.sendActivity(replyActivity);

    } catch (error) {
      console.error("Error handling message:", error);
      const errorMessage = MessageFactory.text(
        "I'm sorry, I encountered an error processing your message. Please try again later."
      );
      await context.sendActivity(errorMessage);
    }
  }

  /**
   * Remove @mentions from the message text
   */
  private removeMentions(text: string): string {
    // Remove HTML-style mentions like <at>BotName</at>
    let cleanText = text.replace(/<at>.*?<\/at>/gi, '').trim();
    
    // Remove @BotName mentions
    cleanText = cleanText.replace(/@\w+/g, '').trim();
    
    return cleanText;
  }

  /**
   * Handle Teams channel mentions
   */
  protected async onTeamsChannelCreated(
    context: TurnContext,
    channelInfo: ChannelInfo,
    next: () => Promise<void>
  ): Promise<void> {
    const message = MessageFactory.text(
      `Hello! I'm SOCBot, your Security Operations Center assistant. ` +
      `Mention me with your security-related questions and I'll help you analyze threats, ` +
      `understand compliance requirements, and provide security guidance. 🛡️`
    );
    await context.sendActivity(message);
    await next();
  }
}

/**
 * Agent Application Bot implementation
 * Uses the Microsoft 365 Agents SDK for enhanced capabilities
 */
export class AgentBot {
  private app: AgentApplication;
  private agentConnector: AgentConnector;

  constructor() {
    this.agentConnector = new AgentConnector();
    
    // Initialize Agent Application
    this.app = new AgentApplication();

    // Configure welcome message
    this.app.activity("membersAdded", async (context, state) => {
      const membersAdded = context.activity.membersAdded;
      if (membersAdded) {
        for (const member of membersAdded) {
          if (member.id !== context.activity.recipient.id) {
            const welcomeText = `🚀 **Welcome to SOCBot!**\n\n` +
              `I'm your AI-powered Security Operations Center assistant, ready to help you with:\n\n` +
              `🔍 **Threat Analysis** - Analyze security incidents and IOCs\n` +
              `📊 **Risk Assessment** - Evaluate security risks and vulnerabilities\n` +
              `📋 **Compliance** - Get guidance on security frameworks\n` +
              `🛡️ **Best Practices** - Learn security implementation strategies\n\n` +
              `Just mention me or send a direct message to get started!`;
            
            await context.sendActivity(MessageFactory.text(welcomeText));
          }
        }
      }
    });

    // Configure message handling with AI integration
    this.app.message(async (context, state) => {
      try {
        const userMessage = context.activity.text;
        if (!userMessage) {
          return;
        }

        // Clean the message and extract prompt
        const cleanMessage = this.removeMentions(userMessage);
        
        if (!cleanMessage.trim()) {
          await context.sendActivity(MessageFactory.text(
            "Hi! I'm SOCBot. How can I help you with security operations today?"
          ));
          return;
        }

        // Generate conversation ID for thread persistence
        const conversationId = context.activity.conversation.id;

        // Send typing indicator
        await context.sendActivity({ type: 'typing' });

        // Process through AI agent
        const response = await this.agentConnector.processPrompt(cleanMessage, conversationId);
        
        // Format and send response
        const formattedResponse = this.formatResponse(response.message, cleanMessage);
        await context.sendActivity(MessageFactory.text(formattedResponse));

      } catch (error) {
        console.error("Error in AgentBot message handler:", error);
        await context.sendActivity(MessageFactory.text(
          "⚠️ I encountered an issue processing your request. Please try again or rephrase your question."
        ));
      }
    });
  }

  /**
   * Get the agent application instance
   */
  public getApp(): AgentApplication {
    return this.app;
  }

  /**
   * Remove @mentions from message text
   */
  private removeMentions(text: string): string {
    // Remove HTML-style mentions
    let cleanText = text.replace(/<at>.*?<\/at>/gi, '').trim();
    
    // Remove @mentions
    cleanText = cleanText.replace(/@\w+/g, '').trim();
    
    return cleanText;
  }

  /**
   * Format the AI response with context
   */
  private formatResponse(aiResponse: string, originalPrompt: string): string {
    // Add SOCBot branding and ensure professional formatting
    let formattedResponse = `🔒 **SOCBot Analysis**\n\n${aiResponse}`;
    
    // Add helpful footer for complex queries
    if (originalPrompt.length > 50 || aiResponse.length > 500) {
      formattedResponse += `\n\n💡 *Need more specific information? Feel free to ask follow-up questions!*`;
    }
    
    return formattedResponse;
  }
}
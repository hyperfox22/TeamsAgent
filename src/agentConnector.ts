import { AIProjectClient } from "@azure/ai-projects";
import { ManagedIdentityCredential } from "@azure/identity";

export interface AgentResponse {
  message: string;
  threadId: string;
}

export class AgentConnector {
  private client: AIProjectClient;
  private agentId: string;
  private threadCache = new Map<string, string>();

  constructor() {
    const connectionString = process.env.PROJECT_CONNECTION_STRING;
    const agentId = process.env.AGENT_ID;
    const clientId = process.env.clientId;

    if (!connectionString) {
      throw new Error("PROJECT_CONNECTION_STRING environment variable is required");
    }

    if (!agentId) {
      throw new Error("AGENT_ID environment variable is required");
    }

    const credential = clientId 
      ? new ManagedIdentityCredential({ clientId })
      : new ManagedIdentityCredential();

    this.client = new AIProjectClient(connectionString, credential);
    this.agentId = agentId;
  }

  /**
   * Process a prompt through the AI agent and return the response
   * @param prompt - The user's prompt or question
   * @param conversationId - Optional conversation ID for thread persistence
   * @returns Promise containing the AI response and thread ID
   */
  async processPrompt(prompt: string, conversationId?: string): Promise<AgentResponse> {
    try {
      // Get or create conversation thread
      let threadId = conversationId ? this.threadCache.get(conversationId) : undefined;
      
      if (!threadId) {
        const thread = await this.client.agents.createThread();
        threadId = thread.id;
        
        if (conversationId && threadId) {
          this.threadCache.set(conversationId, threadId);
        }
      }

      // Ensure we have a valid thread ID
      if (!threadId) {
        throw new Error("Failed to create or retrieve thread ID");
      }

      // Create message in thread
      await this.client.agents.createMessage(threadId, {
        role: "user",
        content: prompt
      });

      // Create and poll agent run
      const run = await this.client.agents.createAndPollRun(threadId, {
        assistantId: this.agentId,
        maxPollInterval: 1000,
        pollInterval: 500
      });

      if (run.status === "completed") {
        // Get messages from the thread
        const messages = await this.client.agents.listMessages(threadId, {
          order: "desc",
          limit: 1
        });

        if (messages.data && messages.data.length > 0) {
          const latestMessage = messages.data[0];
          if (latestMessage.content && latestMessage.content.length > 0) {
            const content = latestMessage.content[0];
            if (content.type === "text" && content.text) {
              return {
                message: content.text.value,
                threadId: threadId
              };
            }
          }
        }
      }

      // Handle run failure or no response
      if (run.status === "failed") {
        console.error("Agent run failed:", run.lastError);
        throw new Error(`Agent run failed: ${run.lastError?.message || 'Unknown error'}`);
      }

      return {
        message: "I'm sorry, I couldn't process your request at the moment. Please try again later.",
        threadId: threadId
      };

    } catch (error) {
      console.error("Error processing prompt with AI agent:", error);
      throw error;
    }
  }

  /**
   * Clean up old thread cache entries
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  cleanupThreadCache(maxAge: number = 3600000): void {
    // This is a simple implementation - in production, you might want to use Redis or similar
    // For now, we'll just clear the cache periodically
    if (this.threadCache.size > 100) {
      this.threadCache.clear();
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(): Promise<any> {
    try {
      return await this.client.agents.getAgent(this.agentId);
    } catch (error) {
      console.error("Error getting agent info:", error);
      throw error;
    }
  }
}
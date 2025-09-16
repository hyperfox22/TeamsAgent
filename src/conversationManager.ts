import { ConversationReference, TurnContext } from "botbuilder";

/**
 * Enhanced conversation state management for SOCBot
 * Handles thread persistence, user context, and conversation continuity
 */

export interface ConversationState {
  conversationId: string;
  threadId?: string;
  userId: string;
  userName?: string;
  lastActivity: string;
  messageCount: number;
  context: {
    currentTopic?: string;
    securityLevel?: 'low' | 'medium' | 'high' | 'critical';
    previousQueries: string[];
    userPreferences?: {
      detailLevel: 'brief' | 'detailed' | 'comprehensive';
      responseFormat: 'text' | 'structured';
    };
  };
}

export interface NotificationPreferences {
  userId: string;
  channels: string[];
  alertTypes: string[];
  quietHours?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  escalationRules?: {
    highPriority: boolean;
    criticalOnly: boolean;
    immediateForKeywords: string[];
  };
}

export class ConversationManager {
  private conversationStates = new Map<string, ConversationState>();
  private conversationReferences = new Map<string, ConversationReference>();
  private userPreferences = new Map<string, NotificationPreferences>();

  /**
   * Initialize or update conversation state from Teams context
   */
  public async updateConversationState(context: TurnContext, threadId?: string): Promise<ConversationState> {
    const conversationId = context.activity.conversation.id;
    const userId = context.activity.from.id;
    const userName = context.activity.from.name;

    let state = this.conversationStates.get(conversationId);

    if (!state) {
      state = {
        conversationId,
        userId,
        userName,
        lastActivity: new Date().toISOString(),
        messageCount: 1,
        context: {
          previousQueries: [],
          userPreferences: {
            detailLevel: 'detailed',
            responseFormat: 'text'
          }
        }
      };
    } else {
      state.lastActivity = new Date().toISOString();
      state.messageCount++;
    }

    if (threadId) {
      state.threadId = threadId;
    }

    // Track user query for context
    if (context.activity.text) {
      const query = context.activity.text.toLowerCase().trim();
      state.context.previousQueries.push(query);
      
      // Keep only last 5 queries to maintain context without memory bloat
      if (state.context.previousQueries.length > 5) {
        state.context.previousQueries = state.context.previousQueries.slice(-5);
      }

      // Detect security level from keywords
      state.context.securityLevel = this.detectSecurityLevel(query);
      state.context.currentTopic = this.detectCurrentTopic(query);
    }

    this.conversationStates.set(conversationId, state);

    // Store conversation reference for proactive messages
    const conversationReference = TurnContext.getConversationReference(context.activity);
    this.conversationReferences.set(conversationId, conversationReference);

    return state;
  }

  /**
   * Get conversation state
   */
  public getConversationState(conversationId: string): ConversationState | undefined {
    return this.conversationStates.get(conversationId);
  }

  /**
   * Get conversation reference for proactive messaging
   */
  public getConversationReference(conversationId: string): ConversationReference | undefined {
    return this.conversationReferences.get(conversationId);
  }

  /**
   * Get all conversation references (for broadcast notifications)
   */
  public getAllConversationReferences(): ConversationReference[] {
    return Array.from(this.conversationReferences.values());
  }

  /**
   * Set user notification preferences
   */
  public setUserPreferences(userId: string, preferences: NotificationPreferences): void {
    this.userPreferences.set(userId, preferences);
  }

  /**
   * Get user notification preferences
   */
  public getUserPreferences(userId: string): NotificationPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  /**
   * Check if user should receive notification based on preferences
   */
  public shouldNotifyUser(userId: string, alertType: string, priority: string): boolean {
    const prefs = this.userPreferences.get(userId);
    
    if (!prefs) {
      return true; // Default to notify if no preferences set
    }

    // Check quiet hours
    if (prefs.quietHours && this.isQuietHours(prefs.quietHours)) {
      // Only allow critical alerts during quiet hours
      if (priority !== 'critical') {
        return false;
      }
    }

    // Check alert type preferences
    if (prefs.alertTypes.length > 0 && !prefs.alertTypes.includes(alertType)) {
      return false;
    }

    // Check escalation rules
    if (prefs.escalationRules) {
      if (prefs.escalationRules.criticalOnly && priority !== 'critical') {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate contextual prompt enhancement based on conversation history
   */
  public enhancePromptWithContext(prompt: string, conversationId: string): string {
    const state = this.conversationStates.get(conversationId);
    
    if (!state || state.context.previousQueries.length === 0) {
      return prompt;
    }

    let enhancedPrompt = prompt;

    // Add context about current security focus
    if (state.context.currentTopic) {
      enhancedPrompt += `\n\nContext: This conversation is focusing on ${state.context.currentTopic}.`;
    }

    // Add recent conversation context
    if (state.context.previousQueries.length > 1) {
      const recentQueries = state.context.previousQueries.slice(-3).join(', ');
      enhancedPrompt += `\n\nRecent discussion topics: ${recentQueries}`;
    }

    // Add user preference context
    if (state.context.userPreferences?.detailLevel) {
      enhancedPrompt += `\n\nUser preference: Provide ${state.context.userPreferences.detailLevel} responses.`;
    }

    return enhancedPrompt;
  }

  /**
   * Clean up old conversation states (call periodically)
   */
  public cleanupOldStates(maxAgeHours: number = 24): number {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - maxAgeHours);
    const cutoffTime = cutoff.toISOString();

    let cleanedCount = 0;

    for (const [conversationId, state] of this.conversationStates.entries()) {
      if (state.lastActivity < cutoffTime) {
        this.conversationStates.delete(conversationId);
        this.conversationReferences.delete(conversationId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Detect security priority level from message content
   */
  private detectSecurityLevel(query: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalKeywords = ['breach', 'attack', 'compromise', 'malware', 'ransomware', 'critical', 'urgent', 'emergency'];
    const highKeywords = ['threat', 'suspicious', 'alert', 'incident', 'vulnerability', 'exploit'];
    const mediumKeywords = ['security', 'audit', 'compliance', 'policy', 'review'];

    const lowerQuery = query.toLowerCase();

    if (criticalKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return 'critical';
    } else if (highKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return 'high';
    } else if (mediumKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Detect current conversation topic
   */
  private detectCurrentTopic(query: string): string {
    const topics = {
      'incident response': ['incident', 'response', 'containment', 'recovery'],
      'threat analysis': ['threat', 'analysis', 'intelligence', 'ioc', 'indicators'],
      'compliance': ['compliance', 'audit', 'framework', 'standards', 'regulation'],
      'vulnerability management': ['vulnerability', 'patch', 'cve', 'scanning'],
      'access control': ['access', 'permissions', 'authentication', 'authorization'],
      'network security': ['network', 'firewall', 'intrusion', 'traffic'],
      'malware analysis': ['malware', 'virus', 'trojan', 'payload', 'analysis']
    };

    const lowerQuery = query.toLowerCase();

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return topic;
      }
    }

    return 'general security';
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(quietHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const startTime = this.parseTimeString(quietHours.start);
    const endTime = this.parseTimeString(quietHours.end);

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Parse time string (HH:MM) to minutes
   */
  private parseTimeString(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 100 + minutes;
  }

  /**
   * Get conversation statistics for monitoring
   */
  public getStatistics(): {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    securityLevelDistribution: Record<string, number>;
  } {
    const total = this.conversationStates.size;
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const oneDayAgoStr = oneDayAgo.toISOString();

    let totalMessages = 0;
    let activeCount = 0;
    const securityLevels: Record<string, number> = {
      low: 0, medium: 0, high: 0, critical: 0
    };

    for (const state of this.conversationStates.values()) {
      totalMessages += state.messageCount;
      
      if (state.lastActivity > oneDayAgoStr) {
        activeCount++;
      }

      if (state.context.securityLevel) {
        securityLevels[state.context.securityLevel]++;
      }
    }

    return {
      totalConversations: total,
      activeConversations: activeCount,
      totalMessages,
      averageMessagesPerConversation: total > 0 ? Math.round(totalMessages / total) : 0,
      securityLevelDistribution: securityLevels
    };
  }
}

// Global conversation manager instance
export const conversationManager = new ConversationManager();
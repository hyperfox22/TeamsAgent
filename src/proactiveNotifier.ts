import { BotFrameworkAdapter, TurnContext, ActivityTypes } from "botbuilder";
import { conversationManager } from "./conversationManager";

/**
 * Proactive notification system for SOCBot
 * Handles security alerts, incident notifications, and scheduled updates
 */

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'threat' | 'incident' | 'compliance' | 'vulnerability' | 'access';
  timestamp: string;
  source: string;
  affectedSystems?: string[];
  recommendedActions?: string[];
  metadata?: Record<string, any>;
}

export interface NotificationPayload {
  type: 'alert' | 'incident' | 'update' | 'reminder';
  alert?: SecurityAlert;
  message?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetUsers?: string[]; // If empty, broadcasts to all users
  channels?: string[];    // Specific Teams channels
}

export class ProactiveNotifier {
  private adapter: BotFrameworkAdapter;

  constructor(adapter: BotFrameworkAdapter) {
    this.adapter = adapter;
  }

  /**
   * Send security alert to specified users or broadcast to all
   */
  public async sendSecurityAlert(alert: SecurityAlert, targetUsers?: string[]): Promise<void> {
    const notification: NotificationPayload = {
      type: 'alert',
      alert,
      priority: alert.severity
    };

    await this.sendNotification(notification, targetUsers);
  }

  /**
   * Send general notification message
   */
  public async sendMessage(
    message: string, 
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    targetUsers?: string[]
  ): Promise<void> {
    const notification: NotificationPayload = {
      type: 'update',
      message,
      priority
    };

    await this.sendNotification(notification, targetUsers);
  }

  /**
   * Send incident notification with adaptive card
   */
  public async sendIncidentNotification(
    incidentId: string,
    title: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    targetUsers?: string[]
  ): Promise<void> {
    const alert: SecurityAlert = {
      id: incidentId,
      title,
      description,
      severity,
      category: 'incident',
      timestamp: new Date().toISOString(),
      source: 'SOCBot Monitoring'
    };

    await this.sendSecurityAlert(alert, targetUsers);
  }

  /**
   * Core notification delivery method
   */
  private async sendNotification(payload: NotificationPayload, targetUsers?: string[]): Promise<void> {
    const conversationReferences = conversationManager.getAllConversationReferences();
    
    if (!conversationReferences || conversationReferences.length === 0) {
      console.warn("No conversation references found for proactive messaging");
      return;
    }

    const deliveryPromises: Promise<void>[] = [];

    for (const conversationReference of conversationReferences) {
      // Check if this user should receive the notification
      if (targetUsers && targetUsers.length > 0) {
        const userId = conversationReference.user?.id;
        if (!userId || !targetUsers.includes(userId)) {
          continue;
        }
      }

      // Check user preferences
      if (conversationReference.user?.id) {
        const shouldNotify = conversationManager.shouldNotifyUser(
          conversationReference.user.id,
          payload.type,
          payload.priority
        );
        
        if (!shouldNotify) {
          continue;
        }
      }

      // Send notification to this conversation
      const promise = this.adapter.continueConversation(
        conversationReference,
        async (turnContext: TurnContext) => {
          await this.sendNotificationMessage(turnContext, payload);
        }
      );

      deliveryPromises.push(promise);
    }

    // Wait for all notifications to be sent
    try {
      await Promise.all(deliveryPromises);
      console.log(`Proactive notification sent to ${deliveryPromises.length} conversations`);
    } catch (error) {
      console.error("Error sending proactive notifications:", error);
    }
  }

  /**
   * Send formatted notification message based on payload type
   */
  private async sendNotificationMessage(context: TurnContext, payload: NotificationPayload): Promise<void> {
    let message: string;
    let card: any = null;

    switch (payload.type) {
      case 'alert':
        if (payload.alert) {
          message = this.formatAlertMessage(payload.alert);
          card = this.createAlertCard(payload.alert);
        } else {
          message = "Security alert received";
        }
        break;

      case 'incident':
        if (payload.alert) {
          message = this.formatIncidentMessage(payload.alert);
          card = this.createIncidentCard(payload.alert);
        } else {
          message = "Security incident reported";
        }
        break;

      case 'update':
        message = payload.message || "System update";
        break;

      case 'reminder':
        message = payload.message || "Scheduled reminder";
        break;

      default:
        message = payload.message || "Notification from SOCBot";
    }

    // Add priority indicator
    const priorityEmoji = this.getPriorityEmoji(payload.priority);
    const finalMessage = `${priorityEmoji} **SOCBot Alert**\n\n${message}`;

    try {
      if (card) {
        // Send adaptive card if available
        await context.sendActivity({
          type: ActivityTypes.Message,
          text: finalMessage,
          attachments: [card]
        });
      } else {
        // Send text message
        await context.sendActivity({
          type: ActivityTypes.Message,
          text: finalMessage
        });
      }
    } catch (error) {
      console.error("Error sending notification message:", error);
    }
  }

  /**
   * Format security alert as text message
   */
  private formatAlertMessage(alert: SecurityAlert): string {
    let message = `**${alert.title}**\n\n`;
    message += `**Severity:** ${alert.severity.toUpperCase()}\n`;
    message += `**Category:** ${alert.category}\n`;
    message += `**Source:** ${alert.source}\n`;
    message += `**Time:** ${new Date(alert.timestamp).toLocaleString()}\n\n`;
    message += `**Description:**\n${alert.description}`;

    if (alert.affectedSystems && alert.affectedSystems.length > 0) {
      message += `\n\n**Affected Systems:**\n${alert.affectedSystems.join(', ')}`;
    }

    if (alert.recommendedActions && alert.recommendedActions.length > 0) {
      message += `\n\n**Recommended Actions:**`;
      alert.recommendedActions.forEach((action, index) => {
        message += `\n${index + 1}. ${action}`;
      });
    }

    return message;
  }

  /**
   * Format incident message
   */
  private formatIncidentMessage(alert: SecurityAlert): string {
    return `**SECURITY INCIDENT: ${alert.title}**\n\n` +
           `**Incident ID:** ${alert.id}\n` +
           `**Severity:** ${alert.severity.toUpperCase()}\n` +
           `**Time:** ${new Date(alert.timestamp).toLocaleString()}\n\n` +
           `${alert.description}`;
  }

  /**
   * Create adaptive card for security alerts
   */
  private createAlertCard(alert: SecurityAlert): any {
    const severityColor = this.getSeverityColor(alert.severity);
    
    return {
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "Container",
            style: "emphasis",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: `🛡️ SOCBot Alert`,
                        weight: "bolder",
                        size: "medium",
                        color: "attention"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "auto",
                    items: [
                      {
                        type: "TextBlock",
                        text: alert.severity.toUpperCase(),
                        weight: "bolder",
                        color: severityColor,
                        horizontalAlignment: "right"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            type: "TextBlock",
            text: alert.title,
            weight: "bolder",
            size: "large",
            wrap: true
          },
          {
            type: "TextBlock",
            text: alert.description,
            wrap: true,
            spacing: "medium"
          },
          {
            type: "FactSet",
            facts: [
              {
                title: "Alert ID:",
                value: alert.id
              },
              {
                title: "Category:",
                value: alert.category
              },
              {
                title: "Source:",
                value: alert.source
              },
              {
                title: "Timestamp:",
                value: new Date(alert.timestamp).toLocaleString()
              }
            ]
          }
        ],
        actions: [
          {
            type: "Action.Submit",
            title: "Acknowledge",
            data: {
              action: "acknowledge",
              alertId: alert.id
            }
          },
          {
            type: "Action.Submit",
            title: "Escalate",
            data: {
              action: "escalate",
              alertId: alert.id
            }
          }
        ]
      }
    };
  }

  /**
   * Create adaptive card for incidents
   */
  private createIncidentCard(alert: SecurityAlert): any {
    return {
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "Container",
            style: "attention",
            items: [
              {
                type: "TextBlock",
                text: "🚨 SECURITY INCIDENT",
                weight: "bolder",
                size: "large",
                color: "attention"
              }
            ]
          },
          {
            type: "TextBlock",
            text: alert.title,
            weight: "bolder",
            size: "large",
            wrap: true
          },
          {
            type: "TextBlock",
            text: `**Incident ID:** ${alert.id}`,
            weight: "bolder",
            wrap: true
          },
          {
            type: "TextBlock",
            text: alert.description,
            wrap: true,
            spacing: "medium"
          }
        ],
        actions: [
          {
            type: "Action.Submit",
            title: "Start Response",
            data: {
              action: "start_response",
              incidentId: alert.id
            }
          },
          {
            type: "Action.Submit",
            title: "View Details",
            data: {
              action: "view_details",
              incidentId: alert.id
            }
          }
        ]
      }
    };
  }

  /**
   * Get priority emoji indicator
   */
  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '🔵';
    }
  }

  /**
   * Get severity color for adaptive cards
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'attention';
      case 'high': return 'warning';
      case 'medium': return 'accent';
      case 'low': return 'good';
      default: return 'default';
    }
  }

  /**
   * Send daily security summary to all users
   */
  public async sendDailySummary(summary: {
    newAlerts: number;
    resolvedIncidents: number;
    activeThreats: number;
    systemHealth: 'good' | 'warning' | 'critical';
  }): Promise<void> {
    const healthEmoji = summary.systemHealth === 'good' ? '✅' : 
                       summary.systemHealth === 'warning' ? '⚠️' : '🚨';
    
    const message = `${healthEmoji} **Daily Security Summary**\n\n` +
                   `📊 **Today's Overview:**\n` +
                   `• New Alerts: ${summary.newAlerts}\n` +
                   `• Resolved Incidents: ${summary.resolvedIncidents}\n` +
                   `• Active Threats: ${summary.activeThreats}\n` +
                   `• System Health: ${summary.systemHealth.toUpperCase()}\n\n` +
                   `Ask me for details on any specific area!`;

    await this.sendMessage(message, 'low');
  }
}

// Factory function to create proactive notifier
export function createProactiveNotifier(adapter: BotFrameworkAdapter): ProactiveNotifier {
  return new ProactiveNotifier(adapter);
}
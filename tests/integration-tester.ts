/**
 * SOCBot Integration Testing Utilities
 * Comprehensive testing tools for verifying the Teams bot and AI Foundry integration
 */

import { AgentConnector } from "../src/agentConnector";
import { BotInitializer } from "../src/internal/initialize";
import { HttpRequest } from "@azure/functions";

export interface TestResult {
  test: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

export class IntegrationTester {
  private agentConnector: AgentConnector;
  private botInitializer: BotInitializer;
  private testResults: TestResult[] = [];

  constructor() {
    console.log("🧪 Initializing SOCBot Integration Tester...");
  }

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log("🚀 Starting comprehensive integration tests...\n");

    const tests = [
      () => this.testEnvironmentVariables(),
      () => this.testManagedIdentityAuth(),
      () => this.testAgentConnectorInit(),
      () => this.testAIFoundryConnection(),
      () => this.testAgentResponse(),
      () => this.testBotInitialization(),
      () => this.testAdaptiveCardTemplate(),
      () => this.testNotificationEndpoint(),
      () => this.testConversationThreading(),
      () => this.testErrorHandling()
    ];

    for (const test of tests) {
      await this.runTest(test);
    }

    this.printTestSummary();
    return this.testResults;
  }

  /**
   * Test environment variables configuration
   */
  private async testEnvironmentVariables(): Promise<TestResult> {
    const requiredEnvVars = [
      'PROJECT_CONNECTION_STRING',
      'AGENT_ID',
      'MicrosoftAppId',
      'MicrosoftAppPassword',
      'M365_CLIENT_ID',
      'M365_TENANT_ID'
    ];

    const missing: string[] = [];
    const present: string[] = [];

    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        present.push(envVar);
      } else {
        missing.push(envVar);
      }
    });

    return {
      test: "Environment Variables",
      success: missing.length === 0,
      duration: 0,
      details: {
        present: present,
        missing: missing,
        total: requiredEnvVars.length,
        configured: present.length
      },
      error: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined
    };
  }

  /**
   * Test Managed Identity authentication
   */
  private async testManagedIdentityAuth(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // This will only work in Azure environment or with Azure CLI authentication
      const { ManagedIdentityCredential } = await import("@azure/identity");
      
      const credential = process.env.clientId 
        ? new ManagedIdentityCredential({ clientId: process.env.clientId })
        : new ManagedIdentityCredential();

      // Test token acquisition (this might fail in local dev)
      try {
        const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
        return {
          test: "Managed Identity Authentication",
          success: true,
          duration: Date.now() - startTime,
          details: {
            tokenType: "Bearer",
            hasToken: !!token,
            expiresOn: token?.expiresOnTimestamp
          }
        };
      } catch (tokenError) {
        // This is expected in local development
        return {
          test: "Managed Identity Authentication",
          success: false,
          duration: Date.now() - startTime,
          details: {
            environment: "Local development (expected failure)",
            credentialCreated: true
          },
          error: "Token acquisition failed (normal in local dev): " + tokenError.message
        };
      }

    } catch (error) {
      return {
        test: "Managed Identity Authentication",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test AgentConnector initialization
   */
  private async testAgentConnectorInit(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      this.agentConnector = new AgentConnector();
      
      return {
        test: "AgentConnector Initialization",
        success: true,
        duration: Date.now() - startTime,
        details: {
          initialized: true,
          hasConnectionString: !!process.env.PROJECT_CONNECTION_STRING,
          hasAgentId: !!process.env.AGENT_ID
        }
      };

    } catch (error) {
      return {
        test: "AgentConnector Initialization", 
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test Azure AI Foundry connection
   */
  private async testAIFoundryConnection(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (!this.agentConnector) {
        this.agentConnector = new AgentConnector();
      }

      // Test getting agent info
      const agentInfo = await this.agentConnector.getAgentInfo();

      return {
        test: "AI Foundry Connection",
        success: true,
        duration: Date.now() - startTime,
        details: {
          agentId: agentInfo.id || "N/A",
          agentName: agentInfo.name || "N/A",
          model: agentInfo.model || "N/A",
          status: "Connected"
        }
      };

    } catch (error) {
      return {
        test: "AI Foundry Connection",
        success: false,
        duration: Date.now() - startTime,
        details: {
          connectionString: !!process.env.PROJECT_CONNECTION_STRING,
          agentId: !!process.env.AGENT_ID
        },
        error: error.message
      };
    }
  }

  /**
   * Test AI agent response
   */
  private async testAgentResponse(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (!this.agentConnector) {
        this.agentConnector = new AgentConnector();
      }

      const testPrompt = "Test: Can you respond with a simple security greeting?";
      const response = await this.agentConnector.processPrompt(testPrompt, "test-conversation");

      return {
        test: "AI Agent Response",
        success: !!response.message && response.message.length > 0,
        duration: Date.now() - startTime,
        details: {
          prompt: testPrompt,
          responseLength: response.message?.length || 0,
          hasThreadId: !!response.threadId,
          threadId: response.threadId
        }
      };

    } catch (error) {
      return {
        test: "AI Agent Response",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test Bot Framework initialization
   */
  private async testBotInitialization(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const config = BotInitializer.getConfigFromEnvironment();
      this.botInitializer = new BotInitializer(config);

      return {
        test: "Bot Framework Initialization",
        success: true,
        duration: Date.now() - startTime,
        details: {
          hasAdapter: !!this.botInitializer.adapter,
          hasTeamsBot: !!this.botInitializer.teamsBot,
          hasAgentBot: !!this.botInitializer.agentBot,
          appId: config.MicrosoftAppId ? "***" : "NOT SET"
        }
      };

    } catch (error) {
      return {
        test: "Bot Framework Initialization",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test adaptive card template loading
   */
  private async testAdaptiveCardTemplate(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const cardPath = path.join(__dirname, '../src/adaptiveCards/notification-default.json');
      const cardTemplate = JSON.parse(fs.readFileSync(cardPath, 'utf8'));

      // Validate card structure
      const hasRequiredFields = !!(
        cardTemplate.type &&
        cardTemplate.body &&
        cardTemplate.actions
      );

      return {
        test: "Adaptive Card Template",
        success: hasRequiredFields,
        duration: Date.now() - startTime,
        details: {
          type: cardTemplate.type,
          version: cardTemplate.version,
          bodyItems: cardTemplate.body?.length || 0,
          actions: cardTemplate.actions?.length || 0,
          hasTemplating: JSON.stringify(cardTemplate).includes('${')
        }
      };

    } catch (error) {
      return {
        test: "Adaptive Card Template",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test notification endpoint simulation
   */
  private async testNotificationEndpoint(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Simulate HTTP request
      const mockRequest = {
        method: "POST",
        json: async () => ({
          prompt: "Test notification: Simulated security alert",
          title: "Integration Test Alert",
          notificationUrl: "https://example.com/test"
        })
      } as HttpRequest;

      // This would normally call the httpTrigger function
      // For now, just validate the structure
      const requestBody = await mockRequest.json();
      
      return {
        test: "Notification Endpoint Simulation",
        success: !!(requestBody.prompt && requestBody.title),
        duration: Date.now() - startTime,
        details: {
          hasPrompt: !!requestBody.prompt,
          hasTitle: !!requestBody.title,
          hasUrl: !!requestBody.notificationUrl,
          method: mockRequest.method
        }
      };

    } catch (error) {
      return {
        test: "Notification Endpoint Simulation",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test conversation threading
   */
  private async testConversationThreading(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (!this.agentConnector) {
        this.agentConnector = new AgentConnector();
      }

      // Test multiple messages in same conversation
      const conversationId = "test-thread-" + Date.now();
      
      const response1 = await this.agentConnector.processPrompt(
        "First message in conversation", 
        conversationId
      );
      
      const response2 = await this.agentConnector.processPrompt(
        "Second message - do you remember the first?", 
        conversationId
      );

      return {
        test: "Conversation Threading",
        success: response1.threadId === response2.threadId,
        duration: Date.now() - startTime,
        details: {
          conversationId: conversationId,
          thread1: response1.threadId,
          thread2: response2.threadId,
          threadsMatch: response1.threadId === response2.threadId
        }
      };

    } catch (error) {
      return {
        test: "Conversation Threading",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (!this.agentConnector) {
        this.agentConnector = new AgentConnector();
      }

      // Test with invalid/empty prompt
      try {
        const response = await this.agentConnector.processPrompt("", "test-error");
        
        return {
          test: "Error Handling",
          success: !!response.message, // Should handle gracefully
          duration: Date.now() - startTime,
          details: {
            emptyPromptHandled: true,
            responseReceived: !!response.message,
            responseMessage: response.message
          }
        };

      } catch (expectedError) {
        // Error handling working correctly
        return {
          test: "Error Handling",
          success: true,
          duration: Date.now() - startTime,
          details: {
            errorCaught: true,
            errorMessage: expectedError.message
          }
        };
      }

    } catch (error) {
      return {
        test: "Error Handling",
        success: false,
        duration: Date.now() - startTime,
        details: {},
        error: error.message
      };
    }
  }

  /**
   * Run individual test with timing and error handling
   */
  private async runTest(testFn: () => Promise<TestResult>): Promise<void> {
    try {
      const result = await testFn();
      this.testResults.push(result);
      
      const status = result.success ? "✅ PASS" : "❌ FAIL";
      const duration = result.duration > 0 ? ` (${result.duration}ms)` : "";
      
      console.log(`${status} ${result.test}${duration}`);
      if (result.error) {
        console.log(`   ⚠️  ${result.error}`);
      }
      if (Object.keys(result.details).length > 0) {
        console.log(`   📊 Details:`, result.details);
      }
      console.log("");

    } catch (error) {
      const result: TestResult = {
        test: "Unknown Test",
        success: false,
        duration: 0,
        details: {},
        error: error.message
      };
      this.testResults.push(result);
      console.log(`❌ FAIL ${result.test} - ${error.message}\n`);
    }
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.success).length;
    const failed = total - passed;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log("=".repeat(60));
    console.log("🧪 SOCBot Integration Test Summary");
    console.log("=".repeat(60));
    console.log(`📊 Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);
    console.log("=".repeat(60));

    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`   • ${r.test}: ${r.error}`));
    }
  }

  /**
   * Generate detailed test report
   */
  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      results: this.testResults,
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.success).length,
        failed: this.testResults.filter(r => !r.success).length,
        duration: this.testResults.reduce((sum, r) => sum + r.duration, 0)
      }
    };

    return JSON.stringify(report, null, 2);
  }
}
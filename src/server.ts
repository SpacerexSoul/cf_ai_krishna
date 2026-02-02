import { routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt } from "agents/schedule";
import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { setApiConfig } from "./shared";

/**
 * Finance AI Agent - Built for Cloudflare Internship Application
 * By Krishna Dattani
 *
 * Features:
 * - Real-time stock/crypto prices
 * - Technical analysis (SMA)
 * - Price alerts with scheduled monitoring
 * - Persistent conversation state
 */
export class Chat extends AIChatAgent<Env> {
  // Initialize state for alerts
  initialState = {
    alerts: [] as Array<{
      id: string;
      symbol: string;
      targetPrice: number;
      condition: "above" | "below";
      createdAt: string;
      active: boolean;
    }>
  };

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal }
  ) {
    // Set API keys from environment for tools to use
    setApiConfig({
      alpacaApiKey: this.env.ALPACA_API_KEY || "",
      alpacaSecretKey: this.env.ALPACA_SECRET_KEY || ""
    });

    // Initialize Workers AI with Llama 3.1 (more stable for tools)
    const workersai = createWorkersAI({ binding: this.env.AI });
    // @ts-expect-error - Model exists but not yet in type definitions
    const model = workersai("@cf/meta/llama-3.1-70b-instruct");

    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cleanedMessages = cleanupMessages(this.messages);
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful financial assistant.

Tools available:
- getStockPrice: Get real-time stock data.
- getCryptoPrice: Get real-time crypto data.
- calculateSMA: Calculate Simple Moving Average.
- setPriceAlert/listAlerts/deleteAlert: Manage price alerts.

Guidelines:
- USE TOOLS DIRECTLY. Do not describe the tool call.
- Do not output raw JSON.
- Answer in friendly text.
- If the tool fails, apologize and explain why.

Date: ${new Date().toISOString().split("T")[0]}
`,
          messages: await convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // @ts-ignore - maxSteps is supported in runtime but types might be outdated
          maxSteps: 5,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10),
          abortSignal: options?.abortSignal
        });

        // Await the merge to ensure stream completes before closing
        await writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  /**
   * Execute scheduled tasks (for price alerts)
   */
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }

  /**
   * Check price alerts (called by scheduler)
   */
  async checkPriceAlerts(alertId: string) {
    interface AgentState {
      alerts: Array<{
        id: string;
        symbol: string;
        targetPrice: number;
        condition: "above" | "below";
        active: boolean;
      }>;
    }
    const state = this.state as AgentState;
    const alerts = state?.alerts || [];
    const alert = alerts.find((a) => a.id === alertId);

    if (!alert || !alert.active) return;

    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${alert.symbol}?interval=1d&range=1d`
      );
      const data = (await response.json()) as any;
      const currentPrice = data.chart?.result?.[0]?.meta?.regularMarketPrice;

      if (!currentPrice) return;

      const triggered =
        alert.condition === "above"
          ? currentPrice >= alert.targetPrice
          : currentPrice <= alert.targetPrice;

      if (triggered) {
        // Mark alert as triggered
        const updatedAlerts = alerts.map((a) =>
          a.id === alertId ? { ...a, active: false } : a
        );
        await this.setState({ alerts: updatedAlerts });

        // Add notification to chat
        await this.saveMessages([
          ...this.messages,
          {
            id: generateId(),
            role: "assistant",
            parts: [
              {
                type: "text",
                text: `🔔 **PRICE ALERT TRIGGERED!**\n\n${alert.symbol} has gone ${alert.condition} $${alert.targetPrice}!\n\nCurrent price: $${currentPrice.toFixed(2)}`
              }
            ],
            metadata: {
              createdAt: new Date()
            }
          }
        ]);
      } else {
        // Reschedule check in 5 minutes
        this.schedule(300, "checkPriceAlerts", alertId);
      }
    } catch (error) {
      console.error("Error checking price alert:", error);
    }
  }
}

/**
 * Worker entry point
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", agent: "FinanceAgent" });
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;

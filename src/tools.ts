/**
 * Finance AI Agent Tools
 * Tools for fetching stock/crypto prices, calculating moving averages, and managing price alerts
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";
import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { apiConfig } from "./shared";

// Type for price alerts
interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: "above" | "below";
  createdAt: string;
  active: boolean;
}

interface AgentState {
  alerts: PriceAlert[];
}

// ==================== MARKET DATA TOOLS ======================================

// API keys are stored in Cloudflare secrets and passed via env
// Set with: npx wrangler secret put ALPACA_API_KEY
//           npx wrangler secret put ALPACA_SECRET_KEY

/**
 * Get current stock price using Alpaca Markets API
 */
const getStockPrice = tool({
  description:
    "Get the current price of a stock by its ticker symbol (e.g., AAPL, TSLA, GOOGL)",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol like AAPL, TSLA, GOOGL")
  }),
  execute: async ({ symbol }) => {
    try {
      const upperSymbol = symbol.toUpperCase();

      // Get API keys from shared config (set by server)
      const apiKey = apiConfig.alpacaApiKey;
      const secretKey = apiConfig.alpacaSecretKey;

      if (!apiKey || !secretKey) {
        return "Alpaca API keys not configured. Please set ALPACA_API_KEY and ALPACA_SECRET_KEY secrets.";
      }

      // Use Alpaca Markets API for latest trade
      const response = await fetch(
        `https://data.alpaca.markets/v2/stocks/${upperSymbol}/trades/latest`,
        {
          headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": secretKey
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return `API error (${response.status}): ${errorText}`;
      }

      const data = (await response.json()) as any;
      const trade = data.trade;

      if (!trade || !trade.p) {
        return `Could not find stock: ${upperSymbol}. Make sure it's a valid US stock ticker.`;
      }

      const price = trade.p;
      const size = trade.s;
      const timestamp = new Date(trade.t).toLocaleString();

      // Get previous close for change calculation
      const barsResponse = await fetch(
        `https://data.alpaca.markets/v2/stocks/${upperSymbol}/bars?timeframe=1Day&limit=2`,
        {
          headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": secretKey
          }
        }
      );

      let change = 0;
      let changePercent = 0;
      let previousClose = 0;

      if (barsResponse.ok) {
        const barsData = (await barsResponse.json()) as any;
        const bars = barsData.bars;
        if (bars && bars.length >= 2) {
          previousClose = bars[bars.length - 2].c;
          change = price - previousClose;
          changePercent = (change / previousClose) * 100;
        }
      }

      return {
        symbol: upperSymbol,
        price: `$${price.toFixed(2)}`,
        previousClose: previousClose > 0 ? `$${previousClose.toFixed(2)}` : "N/A",
        change: `${change >= 0 ? "+" : ""}$${change.toFixed(2)}`,
        changePercent: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
        status: change >= 0 ? "📈 Up" : "📉 Down",
        lastTrade: timestamp,
        volume: size
      };
    } catch (error) {
      return `Error fetching stock price: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

/**
 * Get cryptocurrency price using CoinGecko API (no key required)
 */
const getCryptoPrice = tool({
  description:
    "Get the current price of a cryptocurrency (e.g., bitcoin, ethereum, solana)",
  inputSchema: z.object({
    coin: z
      .string()
      .describe("Cryptocurrency name like bitcoin, ethereum, solana")
  }),
  execute: async ({ coin }) => {
    try {
      // Map common names to symbols
      const map: Record<string, string> = {
        bitcoin: "BTC/USD",
        btc: "BTC/USD",
        ethereum: "ETH/USD",
        eth: "ETH/USD",
        solana: "SOL/USD",
        sol: "SOL/USD",
        dogecoin: "DOGE/USD",
        doge: "DOGE/USD",
        cardano: "ADA/USD",
        ada: "ADA/USD",
        ripple: "XRP/USD",
        xrp: "XRP/USD"
      };

      const cleanName = coin.toLowerCase().trim();
      const symbol = map[cleanName] || `${cleanName.toUpperCase()}/USD`;

      // Get API keys from shared config
      const apiKey = apiConfig.alpacaApiKey;
      const secretKey = apiConfig.alpacaSecretKey;

      if (!apiKey || !secretKey) {
        return "Alpaca API keys not configured.";
      }

      // Alpaca Crypto API
      const response = await fetch(
        `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${symbol}`,
        {
          headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": secretKey
          }
        }
      );

      if (!response.ok) {
        return `Could not find crypto: ${coin}. Try standard symbols like BTC, ETH, SOL.`;
      }

      const data = (await response.json()) as any;
      const trade = data.trades?.[symbol];

      if (!trade) {
        return `Could not find price for ${symbol}. Try: bitcoin, ethereum, solana.`;
      }

      const price = trade.p;
      const size = trade.s;

      return {
        coin: symbol,
        price: `$${price.toFixed(2)}`,
        status: "Live Price ⚡️",
        volume: size
      };
    } catch (error) {
      return `Error fetching crypto price: ${error}`;
    }
  }
});

/**
 * Calculate Simple Moving Average (SMA) for a stock
 */
const calculateSMA = tool({
  description:
    "Calculate the Simple Moving Average (SMA) for a stock over a specified number of days",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol"),
    days: z.number().min(5).max(200).describe("Number of days for SMA (5-200)")
  }),
  execute: async ({ symbol, days }) => {
    try {
      const upperSymbol = symbol.toUpperCase();

      // Get API keys from shared config
      const apiKey = apiConfig.alpacaApiKey;
      const secretKey = apiConfig.alpacaSecretKey;

      if (!apiKey || !secretKey) {
        return "Alpaca API keys not configured.";
      }

      // Fetch historical bars from Alpaca
      // We need to provide a start date slightly further back than 'days' to account for weekends/holidays
      const lookbackDays = Math.ceil(days * 2 + 10);
      const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(
        `https://data.alpaca.markets/v2/stocks/${upperSymbol}/bars?timeframe=1Day&start=${startDate}&limit=${1000}`,
        {
          headers: {
            "APCA-API-KEY-ID": apiKey,
            "APCA-API-SECRET-KEY": secretKey
          }
        }
      );

      if (!response.ok) {
        return `API error fetching history for ${upperSymbol}`;
      }

      const data = (await response.json()) as any;
      const bars = data.bars;

      if (!bars || bars.length < days) {
        return `Not enough historical data for ${days}-day SMA. Found ${bars?.length || 0} days.`;
      }

      // Use the last 'days' bars
      const relevantBars = bars.slice(-days);
      const closes = relevantBars.map((b: any) => b.c);
      const currentPrice = closes[closes.length - 1]; // Use latest close as current price reference

      const sma =
        closes.reduce((sum: number, price: number) => sum + price, 0) /
        closes.length;

      const percentFromSMA = ((currentPrice - sma) / sma) * 100;
      const trend = percentFromSMA > 0 ? "above" : "below";

      return {
        symbol: upperSymbol,
        currentPrice: `$${currentPrice.toFixed(2)}`,
        sma: `$${sma.toFixed(2)}`,
        period: `${days}-day`,
        percentFromSMA: percentFromSMA.toFixed(2) + "%",
        trend: `Price is ${Math.abs(percentFromSMA).toFixed(2)}% ${trend} the ${days}-day SMA`,
        signal:
          percentFromSMA > 0
            ? "Bullish (price above SMA)"
            : "Bearish (price below SMA)"
      };
    } catch (error) {
      return `Error calculating SMA: ${error}`;
    }
  }
});

/**
 * Get price change over a time period
 */
const getPriceChange = tool({
  description: "Get the price change of a stock over a specific time period",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol"),
    period: z
      .enum(["1d", "5d", "1mo", "3mo", "6mo", "1y"])
      .describe("Time period for comparison")
  }),
  execute: async ({ symbol, period }) => {
    try {
      const upperSymbol = symbol.toUpperCase();
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=${period}`
      );
      const data = (await response.json()) as any;

      if (data.chart?.error) {
        return `Could not find stock: ${upperSymbol}`;
      }

      const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      const meta = data.chart?.result?.[0]?.meta;

      if (!closes || closes.length === 0) {
        return `No data available for ${upperSymbol}`;
      }

      const validCloses = closes.filter((c: number | null) => c !== null);
      const startPrice = validCloses[0];
      const currentPrice = meta.regularMarketPrice;
      const change = currentPrice - startPrice;
      const changePercent = (change / startPrice) * 100;

      return {
        symbol: upperSymbol,
        period,
        startPrice: startPrice.toFixed(2),
        currentPrice: currentPrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2) + "%",
        performance: changePercent >= 0 ? "📈 Positive" : "📉 Negative"
      };
    } catch (error) {
      return `Error getting price change: ${error}`;
    }
  }
});

// ==================== PRICE ALERTS ====================

/**
 * Set a price alert for a stock
 */
const setPriceAlert = tool({
  description:
    "Set a price alert to be notified when a stock reaches a target price",
  inputSchema: z.object({
    symbol: z.string().describe("Stock ticker symbol"),
    targetPrice: z.number().describe("Target price to trigger the alert"),
    condition: z
      .enum(["above", "below"])
      .describe("Trigger when price goes above or below target")
  }),
  execute: async ({ symbol, targetPrice, condition }) => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const upperSymbol = symbol.toUpperCase();

      // Store alert in agent state
      const state = agent!.state as AgentState;
      const alerts = state?.alerts || [];
      const newAlert: PriceAlert = {
        id: `alert-${Date.now()}`,
        symbol: upperSymbol,
        targetPrice,
        condition,
        createdAt: new Date().toISOString(),
        active: true
      };

      await agent!.setState({
        alerts: [...alerts, newAlert]
      });

      // Schedule a check for this alert (every 5 minutes)
      agent!.schedule(300, "checkPriceAlerts", newAlert.id);

      return {
        success: true,
        message: `✅ Alert set: Notify when ${upperSymbol} goes ${condition} $${targetPrice}`,
        alertId: newAlert.id
      };
    } catch (error) {
      return `Error setting alert: ${error}`;
    }
  }
});

/**
 * List all active price alerts
 */
const listAlerts = tool({
  description: "List all active price alerts",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const state = agent!.state as AgentState;
      const alerts = state?.alerts || [];
      const activeAlerts = alerts.filter((a) => a.active);

      if (activeAlerts.length === 0) {
        return "No active price alerts. Use setPriceAlert to create one!";
      }

      return {
        count: activeAlerts.length,
        alerts: activeAlerts.map((a) => ({
          id: a.id,
          symbol: a.symbol,
          condition: a.condition,
          targetPrice: a.targetPrice,
          createdAt: a.createdAt
        }))
      };
    } catch (error) {
      return `Error listing alerts: ${error}`;
    }
  }
});

/**
 * Delete a price alert
 */
const deleteAlert = tool({
  description: "Delete a price alert by its ID",
  inputSchema: z.object({
    alertId: z.string().describe("The ID of the alert to delete")
  }),
  execute: async ({ alertId }) => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const state = agent!.state as AgentState;
      const alerts = state?.alerts || [];
      const updatedAlerts = alerts.filter((a) => a.id !== alertId);

      if (alerts.length === updatedAlerts.length) {
        return `Alert with ID ${alertId} not found`;
      }

      await agent!.setState({
        alerts: updatedAlerts
      });

      return `✅ Alert ${alertId} has been deleted`;
    } catch (error) {
      return `Error deleting alert: ${error}`;
    }
  }
});

// ==================== SCHEDULING ====================

const scheduleTask = tool({
  description:
    "Schedule a task to be executed at a later time (for recurring price checks)",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date
        : when.type === "delayed"
          ? when.delayInSeconds
          : when.type === "cron"
            ? when.cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Export all available tools
 */
export const tools = {
  getStockPrice,
  getCryptoPrice,
  calculateSMA,
  getPriceChange,
  setPriceAlert,
  listAlerts,
  deleteAlert,
  scheduleTask
} satisfies ToolSet;

/**
 * Empty executions - all our tools have execute functions
 */
export const executions = {};

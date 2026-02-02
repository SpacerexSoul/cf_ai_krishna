# cf_ai_krishna – Finance AI Agent 💰

A conversational AI-powered financial assistant built on Cloudflare's edge infrastructure. Ask questions about stock prices, cryptocurrencies, calculate technical indicators, and set price alerts – all through natural language.

**Built by Krishna Dattani** for Cloudflare Internship Application

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📈 **Stock Prices** | Real-time stock quotes (AAPL, TSLA, GOOGL, etc.) |
| 🪙 **Crypto Prices** | Live cryptocurrency prices (Bitcoin, Ethereum, Solana) |
| 📊 **SMA Calculator** | Calculate Simple Moving Averages (5-200 days) |
| 📉 **Performance Tracking** | Compare prices over time periods (1d to 1y) |
| 🔔 **Price Alerts** | Get notified when assets hit target prices |
| 💬 **Natural Language** | Just ask in plain English |
| 💾 **Persistent Memory** | Conversation history and alerts are saved |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Chat UI    │◄──►│   Finance   │◄──►│   Llama 3.3 │ │
│  │  (React)    │    │   Agent     │    │ Workers AI  │ │
│  └─────────────┘    │  (Durable   │    └─────────────┘ │
│                     │   Object)   │                     │
│                     └──────┬──────┘                     │
│                            │                            │
│              ┌─────────────┴─────────────┐             │
│              │    Scheduled Alarms       │             │
│              │    (Price Monitoring)     │             │
│              └───────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │     External APIs          │
              │  • Yahoo Finance (Stocks) │
              │  • CoinGecko (Crypto)     │
              └───────────────────────────┘
```

---

## 🛠️ Tech Stack (Cloudflare Requirements)

| Requirement | Implementation |
|-------------|----------------|
| **LLM** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI |
| **Workflow/Coordination** | Durable Objects for persistent agent state |
| **User Input** | React chat interface with WebSocket real-time updates |
| **Memory/State** | Durable Object state for alerts + conversation history |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account (free tier works)
- Wrangler CLI (`npm i -g wrangler`)

### Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/cf_ai_krishna.git
cd cf_ai_krishna

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:8787 in your browser.

### Deploy to Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Deploy
npm run deploy
```

---

## 💬 Example Conversations

```
You: What's the price of Apple stock?
Agent: Apple (AAPL) is trading at $189.50:
       • Change today: +$2.30 (+1.23%)
       • Previous close: $187.20

You: Calculate Tesla's 20-day moving average
Agent: Tesla (TSLA) 20-day SMA Analysis:
       • Current Price: $248.50
       • 20-day SMA: $242.15
       • Price is 2.62% above the SMA
       • Signal: Bullish (price above SMA)

You: Alert me when Bitcoin drops below $40000
Agent: ✅ Alert set: Notify when bitcoin goes below $40000
       I'll check the price every 5 minutes and let you know!

You: Show my alerts
Agent: You have 1 active alert:
       • BTC below $40,000 (created just now)
```

---

## 📁 Project Structure

```
cf_ai_krishna/
├── src/
│   ├── server.ts      # Main agent (Durable Object + Workers AI)
│   ├── tools.ts       # Finance tools (prices, SMA, alerts)
│   ├── app.tsx        # React chat UI
│   └── components/    # UI components
├── wrangler.jsonc     # Cloudflare config
├── README.md          # This file
└── PROMPTS.md         # AI prompts used in development
```

---

## 📊 Tools Available

| Tool | Description | Example Input |
|------|-------------|---------------|
| `getStockPrice` | Get real-time stock quote | "AAPL", "TSLA" |
| `getCryptoPrice` | Get crypto price | "bitcoin", "ethereum" |
| `calculateSMA` | Calculate moving average | Symbol + days (5-200) |
| `getPriceChange` | Get % change over period | Symbol + period (1d-1y) |
| `setPriceAlert` | Create price alert | Symbol + target + above/below |
| `listAlerts` | Show active alerts | - |
| `deleteAlert` | Remove an alert | Alert ID |

---

## 🔒 Data Sources

- **Stocks**: Yahoo Finance API (no API key required)
- **Crypto**: CoinGecko API (no API key required)

---

## 📝 License

MIT

---

## 👨‍💻 Author

**Krishna Dattani**
- BSc Computer Science (AI) – Royal Holloway University of London
- [Dattanikrishna407@gmail.com](mailto:Dattanikrishna407@gmail.com)

# cf_ai_krishna – Finance AI Agent 💰

A conversational AI-powered financial assistant built on Cloudflare's edge infrastructure. Ask questions about stock prices, cryptocurrencies, and set price alerts – all through natural language.

**Built by Krishna Dattani** for Cloudflare Internship Application

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📈 **Stock Prices** | Real-time stock quotes (AAPL, TSLA, GOOGL, etc.) |
| 🪙 **Crypto Prices** | Live cryptocurrency prices (Bitcoin, Ethereum, Solana) |
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
│  │  Chat UI    │◄──►│   Finance   │◄──►│   Llama 3.1 │ │
│  │  (React)    │    │   Agent     │    │ Workers AI  │ │
│  └─────────────┘    │  (Durable   │    └─────────────┘ │
│                     │   Object)   │                     │
│                     └──────┬──────┘                     │
│                            │                            │
│              ┌─────────────┴─────────────┐             │
│              │    Scheduled Alarms       │             │
│              │    (Price Monitoring)     │             │
│              └───────────────────────────┘             │
40: └─────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │     External APIs          │
              │  • Alpaca Markets API     │
              │  (Stocks & Crypto)        │
              └───────────────────────────┘
```

---

## 🛠️ Tech Stack (Cloudflare Requirements)

| Requirement | Implementation |
|-------------|----------------|
| **LLM** | `@cf/meta/llama-3.1-70b-instruct` via Workers AI |
| **Workflow/Coordination** | Durable Objects for persistent agent state |
| **User Input** | React chat interface with WebSocket real-time updates |
| **Memory/State** | Durable Object state for alerts + conversation history |

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- Cloudflare account (free tier works)
- Wrangler CLI (`npm i -g wrangler`)
- **Alpaca Markets Account** (Free paper trading account required for API keys)
  - Sign up at [alpaca.markets](https://alpaca.markets/)
  - Go to your Dashboard -> "Paper Trading" -> "View Keys"
  - You will need your **Key ID** and **Secret Key**

### 2. Local Development

```bash
# Clone the repository
git clone https://github.com/SpacerexSoul/cf_ai_krishna.git
cd cf_ai_krishna

# Install dependencies
npm install

# Set API Keys (Required for local dev)
# Create a .dev.vars file
echo "ALPACA_API_KEY=your_key_here" >> .dev.vars
echo "ALPACA_SECRET_KEY=your_secret_here" >> .dev.vars

# Start dev server
npm run dev
```

Open http://localhost:8787 in your browser.

### 3. Deploy to Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Set Secrets in Cloudflare (CRITICAL STEP)
npx wrangler secret put ALPACA_API_KEY
# (Enter your Key ID when prompted)

npx wrangler secret put ALPACA_SECRET_KEY
# (Enter your Secret Key when prompted)

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
│   ├── tools.ts       # Finance tools (Alpaca API, alerts)
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
| `getStockPrice` | Get real-time stock quote (Alpaca) | "AAPL", "TSLA" |
| `getCryptoPrice` | Get crypto price (Alpaca) | "bitcoin", "ethereum" |
| `setPriceAlert` | Create price alert | Symbol + target + above/below |
| `listAlerts` | Show active alerts | - |
| `deleteAlert` | Remove an alert | Alert ID |

---

## 🔒 Data Sources

- **Alpaca Markets API**: Used for both Real-time Stock and Crypto data. High reliability and latency-free.

---

## 📝 License

MIT

---

## 👨‍💻 Author

**Krishna Dattani**
- BSc Computer Science (AI) – Royal Holloway University of London
- [Dattanikrishna407@gmail.com](mailto:Dattanikrishna407@gmail.com)

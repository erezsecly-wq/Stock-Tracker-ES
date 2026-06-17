import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

dotenv.config();

const app = express();
app.set("trust proxy", 1); // needed for correct rate-limit behind hosting proxies (Render/Railway)
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// ---------------------------------------------------------------------------
// Security / deployment configuration (all overridable via environment vars)
// ---------------------------------------------------------------------------
// JWT secret: MUST be set in production. A random per-boot secret is used as a
// safe fallback in dev (invalidates tokens on restart, which is acceptable locally).
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn(
    "[security] JWT_SECRET not set - using a random per-boot secret. Set JWT_SECRET in production!"
  );
}
const TOKEN_TTL = "7d";

// WebAuthn relying-party config. For local dev these defaults work as-is.
// In production set RP_ID to your domain (e.g. 'myapp.com') and ORIGIN to the
// full https origin (e.g. 'https://myapp.com').
const RP_ID = process.env.RP_ID || "localhost";
const RP_NAME = process.env.RP_NAME || "StockWise ES";
const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;

// Path to file-based persistent DB
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), "data_store.json");

// A registered WebAuthn (passkey / biometric) credential
interface StoredCredential {
  id: string;              // base64url credential ID
  publicKey: string;       // base64url COSE public key
  counter: number;         // signature counter (replay protection)
  transports?: string[];
  createdAt: string;
}

// Per-ticker configuration for the server-side autonomous trading engine
interface BotTickerConfig {
  ticker: string;
  enabled: boolean;
  buyLimit: number;   // buy when price <= buyLimit
  sellLimit: number;  // take profit when price >= sellLimit
}

interface BotTrade {
  id: string;
  timestamp: string;
  ticker: string;
  type: "BUY" | "SELL";
  shares: number;
  price: number;
  total: number;       // cash impact incl. fee
  fee: number;
  profit?: number;     // realized P&L for SELL
  reason: string;      // why the engine acted (limit / stop-loss / take-profit)
}

interface BotState {
  enabled: boolean;            // is the autonomous engine running for this user
  startingCapital: number;
  cash: number;
  brokerCommission: number;    // fee per trade ($)
  positionSizePct: number;     // % of equity to deploy per BUY (e.g. 10 = 10%)
  stopLossPct: number;         // sell if price falls this % below avg cost (0 = off)
  takeProfitPct: number;       // sell if price rises this % above avg cost (0 = use sellLimit only)
  maxLotsPerTicker: number;    // cap accumulation per ticker
  startedAt: string | null;
  adaptive: boolean;            // auto-learn & adjust thresholds to the market
  lastAdaptAt: string | null;
  tickers: { [ticker: string]: BotTickerConfig };
  holdings: { [ticker: string]: { shares: number; avgBuyPrice: number } };
  trades: BotTrade[];
  equityCurve: { t: string; equity: number }[]; // periodic equity snapshots
  benchmarkBasis: { [ticker: string]: number } | null; // start prices for buy&hold benchmark
}

// Structure of persistent database
interface DatabaseSchema {
  users: {
    [username: string]: {
      passwordHash: string;
      createdAt: string;
      currentChallenge?: string;        // transient WebAuthn challenge
      credentials: StoredCredential[];  // registered passkeys
    }
  };
  alerts: {
    [username: string]: {
      [ticker: string]: {
        ticker: string;
        buyThreshold: number | null;
        sellThreshold: number | null;
        createdAt: string;
      }
    }
  };
  portfolios: {
    [username: string]: {
      [ticker: string]: {
        ticker: string;
        shares: number;
        avgBuyPrice: number;
      }
    }
  };
  logs: {
    [username: string]: {
      id: string;
      ticker: string;
      type: "BUY" | "SELL";
      price: number;
      threshold: number;
      timestamp: string;
      read: boolean;
    }[]
  };
  bots: {
    [username: string]: BotState;
  };
}

// Initial default database structure
const initialDB: DatabaseSchema = {
  users: {},
  alerts: {},
  portfolios: {},
  logs: {},
  bots: {}
};

// Seed stock data
interface Stock {
  ticker: string;
  name: string;
  currentPrice: number;
  dailyChangePercent: number;
  high24h: number;
  low24h: number;
  history: { time: string; price: number }[];
}

const stocks: Stock[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    currentPrice: 291.13,
    dailyChangePercent: -1.45,
    high24h: 293.50,
    low24h: 289.00,
    history: [
      { time: "09:30", price: 293.90 },
      { time: "10:30", price: 292.10 },
      { time: "11:30", price: 291.13 },
      { time: "12:30", price: 290.80 },
      { time: "13:30", price: 290.05 },
      { time: "14:30", price: 291.13 }
    ]
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc.",
    currentPrice: 406.43,
    dailyChangePercent: 1.82,
    high24h: 406.68,
    low24h: 386.76,
    history: [
      { time: "09:30", price: 399.46 },
      { time: "10:30", price: 395.50 },
      { time: "11:30", price: 391.10 },
      { time: "12:30", price: 403.80 },
      { time: "13:30", price: 401.10 },
      { time: "14:30", price: 406.43 }
    ]
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    currentPrice: 135.20,
    dailyChangePercent: 4.62,
    high24h: 136.00,
    low24h: 129.30,
    history: [
      { time: "09:30", price: 130.20 },
      { time: "10:30", price: 131.10 },
      { time: "11:30", price: 133.50 },
      { time: "12:30", price: 132.90 },
      { time: "13:30", price: 135.40 },
      { time: "14:30", price: 135.20 }
    ]
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    currentPrice: 426.80,
    dailyChangePercent: 0.85,
    high24h: 428.40,
    low24h: 421.90,
    history: [
      { time: "09:30", price: 422.20 },
      { time: "10:30", price: 424.50 },
      { time: "11:30", price: 425.10 },
      { time: "12:30", price: 424.80 },
      { time: "13:30", price: 425.40 },
      { time: "14:30", price: 426.80 }
    ]
  },
  {
    ticker: "AMZN",
    name: "Amazon.com Inc.",
    currentPrice: 214.50,
    dailyChangePercent: -0.22,
    high24h: 216.43,
    low24h: 211.90,
    history: [
      { time: "09:30", price: 215.90 },
      { time: "10:30", price: 214.10 },
      { time: "11:30", price: 213.30 },
      { time: "12:30", price: 213.70 },
      { time: "13:30", price: 214.30 },
      { time: "14:30", price: 214.50 }
    ]
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc.",
    currentPrice: 178.60,
    dailyChangePercent: 1.12,
    high24h: 179.20,
    low24h: 175.70,
    history: [
      { time: "09:30", price: 176.10 },
      { time: "10:30", price: 176.80 },
      { time: "11:30", price: 178.40 },
      { time: "12:30", price: 177.10 },
      { time: "13:30", price: 178.50 },
      { time: "14:30", price: 178.60 }
    ]
  },
  {
    ticker: "META",
    name: "Meta Platforms",
    currentPrice: 575.90,
    dailyChangePercent: -2.15,
    high24h: 588.80,
    low24h: 569.20,
    history: [
      { time: "09:30", price: 585.20 },
      { time: "10:30", price: 582.10 },
      { time: "11:30", price: 578.50 },
      { time: "12:30", price: 577.30 },
      { time: "13:30", price: 574.20 },
      { time: "14:30", price: 575.90 }
    ]
  },
  {
    ticker: "NFLX",
    name: "Netflix Inc.",
    currentPrice: 712.40,
    dailyChangePercent: 1.84,
    high24h: 718.40,
    low24h: 698.10,
    history: [
      { time: "09:30", price: 701.50 },
      { time: "10:30", price: 704.80 },
      { time: "11:30", price: 709.10 },
      { time: "12:30", price: 707.40 },
      { time: "13:30", price: 713.00 },
      { time: "14:30", price: 712.40 }
    ]
  },
  {
    ticker: "AMD",
    name: "Advanced Micro Devices",
    currentPrice: 162.80,
    dailyChangePercent: -1.15,
    high24h: 166.20,
    low24h: 159.90,
    history: [
      { time: "09:30", price: 165.10 },
      { time: "10:30", price: 163.70 },
      { time: "11:30", price: 161.25 },
      { time: "12:30", price: 162.05 },
      { time: "13:30", price: 163.40 },
      { time: "14:30", price: 162.80 }
    ]
  },
  {
    ticker: "PLTR",
    name: "Palantir Technologies",
    currentPrice: 56.70,
    dailyChangePercent: 3.55,
    high24h: 57.95,
    low24h: 54.50,
    history: [
      { time: "09:30", price: 54.60 },
      { time: "10:30", price: 54.95 },
      { time: "11:30", price: 55.25 },
      { time: "12:30", price: 55.10 },
      { time: "13:30", price: 56.65 },
      { time: "14:30", price: 56.70 }
    ]
  },
  {
    ticker: "SMCI",
    name: "Super Micro Computer",
    currentPrice: 48.20,
    dailyChangePercent: 8.42,
    high24h: 51.50,
    low24h: 44.00,
    history: [
      { time: "09:30", price: 44.20 },
      { time: "10:30", price: 46.10 },
      { time: "11:30", price: 47.45 },
      { time: "12:30", price: 46.00 },
      { time: "13:30", price: 49.50 },
      { time: "14:30", price: 48.20 }
    ]
  },
  {
    ticker: "ARM",
    name: "Arm Holdings plc",
    currentPrice: 138.40,
    dailyChangePercent: -2.34,
    high24h: 142.80,
    low24h: 136.20,
    history: [
      { time: "09:30", price: 141.50 },
      { time: "10:30", price: 139.10 },
      { time: "11:30", price: 137.80 },
      { time: "12:30", price: 138.20 },
      { time: "13:30", price: 136.60 },
      { time: "14:30", price: 138.40 }
    ]
  },
  {
    ticker: "COIN",
    name: "Coinbase Global Inc.",
    currentPrice: 238.90,
    dailyChangePercent: -1.25,
    high24h: 247.00,
    low24h: 234.50,
    history: [
      { time: "09:30", price: 245.10 },
      { time: "10:30", price: 242.40 },
      { time: "11:30", price: 239.80 },
      { time: "12:30", price: 238.50 },
      { time: "13:30", price: 240.20 },
      { time: "14:30", price: 238.90 }
    ]
  }
];

// ---------------------------------------------------------------------------
// Persistence: a SINGLE in-memory DB is the source of truth (loaded once at
// boot). All requests mutate this object directly, which eliminates the
// read-modify-write race that the old per-request loadDB()/saveDB() pattern
// suffered from in a single-threaded Node process. Writes to disk are atomic
// (write to a temp file, then rename) and debounced.
// ---------------------------------------------------------------------------
function readDBFromDisk(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data) as Partial<DatabaseSchema>;
      // Merge with defaults so older files missing new collections still load
      return {
        users: parsed.users || {},
        alerts: parsed.alerts || {},
        portfolios: parsed.portfolios || {},
        logs: parsed.logs || {},
        bots: parsed.bots || {}
      };
    }
  } catch (err) {
    console.error("Error reading database file", err);
  }
  return JSON.parse(JSON.stringify(initialDB));
}

const db: DatabaseSchema = readDBFromDisk();

let persistTimer: NodeJS.Timeout | null = null;
let persistPending = false;

function flushDB() {
  try {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmp, DB_FILE); // atomic on the same filesystem
  } catch (err) {
    console.error("Error writing to database file", err);
  }
  persistPending = false;
}

// Debounced atomic persist (coalesces bursts of writes into one disk write)
function persist() {
  persistPending = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistPending) flushDB();
  }, 400);
}

// Persist synchronously on shutdown so nothing is lost
function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  flushDB();
}
process.on("SIGINT", () => { persistNow(); process.exit(0); });
process.on("SIGTERM", () => { persistNow(); process.exit(0); });

// Build a fresh default bot state for a new user
function makeDefaultBot(startingCapital = 5000): BotState {
  return {
    enabled: false,
    startingCapital,
    cash: startingCapital,
    brokerCommission: 1.0,
    positionSizePct: 15,
    stopLossPct: 8,
    takeProfitPct: 0,
    maxLotsPerTicker: 3,
    startedAt: null,
    adaptive: false,
    lastAdaptAt: null,
    tickers: {},
    holdings: {},
    trades: [],
    equityCurve: [],
    benchmarkBasis: null
  };
}

// Global flag for connecting to real-market free provider (Yahoo Finance)
let useLiveFeed = false;
const serverStartTime = new Date();
let tickCount = 0;
let lastTickTime = new Date().toISOString();

// Async function to fetch live prices from FREE Yahoo Finance API
async function updateStocksFromYahoo() {
  for (const stock of stocks) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${stock.ticker}?interval=1m&range=1d`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const json = await response.json() as any;
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose;
          if (price) {
            stock.currentPrice = parseFloat(price.toFixed(2));
            if (prevClose) {
              stock.dailyChangePercent = parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2));
            }
            if (stock.currentPrice > stock.high24h) stock.high24h = stock.currentPrice;
            if (stock.currentPrice < stock.low24h) stock.low24h = stock.currentPrice;
            
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            stock.history.push({ time: timeStr, price: stock.currentPrice });
            if (stock.history.length > 20) {
              stock.history.shift();
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`Yahoo Finance fetch bypassed or failed for ${stock.ticker}: ${err.message || err}`);
    }
  }
}

function priceOf(ticker: string): number | null {
  const s = stocks.find(st => st.ticker === ticker);
  return s ? s.currentPrice : null;
}

// Total equity (cash + market value of holdings) for a bot
function botEquity(bot: BotState): number {
  let val = bot.cash;
  for (const t of Object.keys(bot.holdings)) {
    const p = priceOf(t) ?? bot.holdings[t].avgBuyPrice;
    val += bot.holdings[t].shares * p;
  }
  return parseFloat(val.toFixed(2));
}

// The autonomous trading engine. Runs every tick for every user whose bot is
// enabled. This is what makes buy/sell "real": it executes and persists trades
// server-side, independent of any open browser tab, 24/7.
function runTradingEngine() {
  const now = new Date();
  let anyChange = false;

  for (const username of Object.keys(db.bots)) {
    const bot = db.bots[username];
    if (!bot || !bot.enabled) continue;

    // Lazily capture benchmark start prices the first time the bot runs
    if (!bot.benchmarkBasis) {
      const basis: { [t: string]: number } = {};
      for (const cfg of Object.values(bot.tickers)) {
        if (cfg.enabled) {
          const p = priceOf(cfg.ticker);
          if (p) basis[cfg.ticker] = p;
        }
      }
      if (Object.keys(basis).length > 0) {
        bot.benchmarkBasis = basis;
        anyChange = true;
      }
    }

    // Adaptive thresholds: periodically re-learn buy/sell limits from recent
    // market behaviour (trend + volatility) so the bot adjusts to the market.
    if (bot.adaptive) {
      const sinceAdapt = bot.lastAdaptAt ? now.getTime() - new Date(bot.lastAdaptAt).getTime() : Infinity;
      if (sinceAdapt >= 60000) {
        bot.lastAdaptAt = now.toISOString();
        for (const cfg of Object.values(bot.tickers)) {
          if (!cfg.enabled) continue;
          const st = stocks.find(s => s.ticker === cfg.ticker);
          if (!st || st.history.length < 3) continue;
          const hist = st.history.map(h => h.price);
          const first = hist[0];
          const cur = st.currentPrice;
          const trend = (cur - first) / first;
          const hi = Math.max(...hist), lo = Math.min(...hist);
          const vol = lo > 0 ? (hi - lo) / lo : 0;
          let buyPct = 0.03, sellPct = 0.05;
          if (trend < -0.01) {                 // downtrend: buy deeper dips, take profit sooner
            buyPct = Math.min(0.10, 0.05 + Math.abs(trend));
            sellPct = 0.035;
          } else if (trend > 0.01) {           // uptrend: buy shallow dips, let winners run
            buyPct = 0.02;
            sellPct = Math.min(0.12, 0.06 + trend);
          } else {                              // flat: tighten ranges in low volatility
            buyPct = vol < 0.02 ? 0.015 : 0.03;
            sellPct = vol < 0.02 ? 0.022 : 0.05;
          }
          cfg.buyLimit = parseFloat((cur * (1 - buyPct)).toFixed(2));
          cfg.sellLimit = parseFloat((cur * (1 + sellPct)).toFixed(2));
        }
        anyChange = true;
      }
    }

    for (const cfg of Object.values(bot.tickers)) {
      if (!cfg.enabled) continue;
      const price = priceOf(cfg.ticker);
      if (price === null) continue;

      const held = bot.holdings[cfg.ticker];

      // ---- SELL side: take-profit OR stop-loss (risk management) ----
      if (held && held.shares > 0) {
        const tpHit = cfg.sellLimit > 0 && price >= cfg.sellLimit;
        const tpPctHit =
          bot.takeProfitPct > 0 &&
          price >= held.avgBuyPrice * (1 + bot.takeProfitPct / 100);
        const slHit =
          bot.stopLossPct > 0 &&
          price <= held.avgBuyPrice * (1 - bot.stopLossPct / 100);

        if (tpHit || tpPctHit || slHit) {
          const revenueBeforeFee = held.shares * price;
          const revenueWithFee = revenueBeforeFee - bot.brokerCommission;
          const costBasis = held.shares * held.avgBuyPrice;
          // realized P&L = proceeds - cost - (buy fee already paid + this sell fee)
          const profit = revenueBeforeFee - costBasis - bot.brokerCommission * 2;

          bot.cash = parseFloat((bot.cash + revenueWithFee).toFixed(2));
          const soldShares = held.shares;
          delete bot.holdings[cfg.ticker];

          bot.trades.unshift({
            id: `S${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
            timestamp: now.toISOString(),
            ticker: cfg.ticker,
            type: "SELL",
            shares: soldShares,
            price,
            total: parseFloat(revenueWithFee.toFixed(2)),
            fee: bot.brokerCommission,
            profit: parseFloat(profit.toFixed(2)),
            reason: slHit
              ? `Stop-loss (-${bot.stopLossPct}%)`
              : tpHit
              ? `Take-profit @ $${cfg.sellLimit}`
              : `Take-profit (+${bot.takeProfitPct}%)`
          });
          anyChange = true;
          continue; // don't also buy the same ticker this tick
        }
      }

      // ---- BUY side: price at/below buy limit, with risk-sized position ----
      if (cfg.buyLimit > 0 && price <= cfg.buyLimit) {
        const existing = bot.holdings[cfg.ticker] || { shares: 0, avgBuyPrice: 0 };
        const equity = botEquity(bot);
        // Position sizing: deploy a % of total equity per buy
        const budget = (bot.positionSizePct / 100) * equity;
        let sharesToBuy = Math.floor(budget / price);
        if (sharesToBuy < 1) sharesToBuy = 0;

        const lotsHeld = existing.shares; // simple cap by share count proxy
        const maxShares = bot.maxLotsPerTicker * Math.max(1, Math.floor(budget / price));
        if (sharesToBuy > 0 && lotsHeld < maxShares) {
          const costBeforeFee = sharesToBuy * price;
          const costWithFee = costBeforeFee + bot.brokerCommission;
          if (bot.cash >= costWithFee) {
            bot.cash = parseFloat((bot.cash - costWithFee).toFixed(2));
            const nextShares = existing.shares + sharesToBuy;
            const nextAvg =
              (existing.shares * existing.avgBuyPrice + costBeforeFee) / nextShares;
            bot.holdings[cfg.ticker] = {
              shares: nextShares,
              avgBuyPrice: parseFloat(nextAvg.toFixed(2))
            };
            bot.trades.unshift({
              id: `B${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
              timestamp: now.toISOString(),
              ticker: cfg.ticker,
              type: "BUY",
              shares: sharesToBuy,
              price,
              total: parseFloat(costWithFee.toFixed(2)),
              fee: bot.brokerCommission,
              reason: `Buy limit <= $${cfg.buyLimit}`
            });
            anyChange = true;
          }
        }
      }
    }

    // Trim trade history to keep file size sane over a 60-day run
    if (bot.trades.length > 2000) bot.trades.length = 2000;

    // Snapshot equity at most once per minute per user (keeps the curve compact)
    const eq = botEquity(bot);
    const last = bot.equityCurve[bot.equityCurve.length - 1];
    if (!last || now.getTime() - new Date(last.t).getTime() >= 60000) {
      bot.equityCurve.push({ t: now.toISOString(), equity: eq });
      if (bot.equityCurve.length > 20000) bot.equityCurve.shift();
      anyChange = true;
    }
  }

  return anyChange;
}

// Start simulated stock fluctuations or fetch real Yahoo Finance live values,
// then evaluate alerts and run the autonomous trading engine.
setInterval(async () => {
  tickCount++;
  lastTickTime = new Date().toISOString();

  if (useLiveFeed) {
    // Live US market values connected to the free Yahoo Finance endpoint
    await updateStocksFromYahoo();
  } else {
    // Sandbox simulation: random fluctuation
    stocks.forEach(stock => {
      const change = (Math.random() - 0.5) * 0.008 * stock.currentPrice;
      stock.currentPrice = parseFloat((stock.currentPrice + change).toFixed(2));

      if (stock.currentPrice > stock.high24h) stock.high24h = stock.currentPrice;
      if (stock.currentPrice < stock.low24h) stock.low24h = stock.currentPrice;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      stock.history.push({ time: timeStr, price: stock.currentPrice });
      if (stock.history.length > 20) {
        stock.history.shift();
      }
    });
  }

  let changed = false;

  // Evaluate configured alerts for all users (notification log only)
  stocks.forEach(stock => {
    Object.keys(db.alerts).forEach(username => {
      const alert = db.alerts[username]?.[stock.ticker];
      if (!alert) return;

      const pushLog = (type: "BUY" | "SELL", threshold: number) => {
        const userLogs = db.logs[username] || [];
        const recent = userLogs.find(
          l => l.ticker === stock.ticker && l.type === type &&
          Date.now() - new Date(l.timestamp).getTime() < 30050
        );
        if (!recent) {
          db.logs[username] = db.logs[username] || [];
          db.logs[username].unshift({
            id: crypto.randomBytes(4).toString("hex"),
            ticker: stock.ticker,
            type,
            price: stock.currentPrice,
            threshold,
            timestamp: new Date().toISOString(),
            read: false
          });
          if (db.logs[username].length > 500) db.logs[username].length = 500;
          changed = true;
        }
      };

      if (alert.buyThreshold !== null && stock.currentPrice <= alert.buyThreshold) {
        pushLog("BUY", alert.buyThreshold);
      }
      if (alert.sellThreshold !== null && stock.currentPrice >= alert.sellThreshold) {
        pushLog("SELL", alert.sellThreshold);
      }
    });
  });

  // Run the autonomous trading engine
  if (runTradingEngine()) changed = true;

  if (changed) persist();
}, 4000);

// Live Feed Toggle endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", currentTime: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", currentTime: new Date().toISOString() });
});

app.get("/api/config/live-feed", (req, res) => {
  res.json({ useLiveFeed });
});

app.post("/api/config/live-feed", (req, res) => {
  const { enabled } = req.body;
  useLiveFeed = !!enabled;
  res.json({ success: true, useLiveFeed });
});

app.get("/api/server-info", (req, res) => {
  res.json({
    uptimeSeconds: Math.floor((Date.now() - serverStartTime.getTime()) / 1000),
    tickCount,
    lastTickTime,
    serverStartTime: serverStartTime.toISOString(),
    pingUrl: `${req.protocol}://${req.get("host")}/health`
  });
});

// API Endpoints

// ---------------------------------------------------------------------------
// Auth helpers: real token issuance + verification middleware.
// Tokens are signed JWTs. The middleware VERIFIES the signature and resolves
// the user from the verified payload - it never trusts client-supplied text.
// This closes the previous "any string ending in a username = access" bypass.
// ---------------------------------------------------------------------------
function issueToken(username: string): string {
  return jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

interface AuthedRequest extends express.Request {
  username?: string;
}

function authMiddleware(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    const username = String(payload.sub || "").toLowerCase().trim();
    if (!username || !db.users[username]) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.username = username;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function biometricRegistered(username: string): boolean {
  return (db.users[username]?.credentials?.length || 0) > 0;
}

function seedNewUser(username: string) {
  db.alerts[username] = {
    "AAPL": { ticker: "AAPL", buyThreshold: 178.00, sellThreshold: 185.00, createdAt: new Date().toISOString() },
    "TSLA": { ticker: "TSLA", buyThreshold: 170.00, sellThreshold: 182.00, createdAt: new Date().toISOString() }
  };
  db.portfolios[username] = {
    "AAPL": { ticker: "AAPL", shares: 10, avgBuyPrice: 175.50 }
  };
  db.logs[username] = [];
  // Seed a default bot pre-configured (disabled until the user starts it)
  const bot = makeDefaultBot(5000);
  for (const t of ["AAPL", "NVDA", "TSLA"]) {
    const p = priceOf(t);
    if (p) {
      bot.tickers[t] = {
        ticker: t,
        enabled: true,
        buyLimit: parseFloat((p * 0.97).toFixed(2)),
        sellLimit: parseFloat((p * 1.06).toFixed(2))
      };
    }
  }
  db.bots[username] = bot;
}

// Rate limiting on authentication endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות." }
});

// Authentication API
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  const lowerUsername = String(username).toLowerCase().trim();

  // Input validation
  if (!/^[a-z0-9_.-]{3,32}$/.test(lowerUsername)) {
    return res.status(400).json({ error: "שם המשתמש חייב להיות 3-32 תווים (אותיות אנגלית, ספרות, _ . -)" });
  }
  if (String(password).length < 4 || String(password).length > 128) {
    return res.status(400).json({ error: "הסיסמה חייבת להיות באורך 4-128 תווים" });
  }
  if (db.users[lowerUsername]) {
    return res.status(400).json({ error: "Username already exists" });
  }

  // Real one-way hash (bcrypt with salt)
  const passwordHash = await bcrypt.hash(String(password), 12);
  db.users[lowerUsername] = {
    passwordHash,
    createdAt: new Date().toISOString(),
    credentials: []
  };
  seedNewUser(lowerUsername);
  persist();
  res.json({ success: true });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const lowerUsername = String(username || "").toLowerCase().trim();
  const user = db.users[lowerUsername];

  // Always run a compare (even on missing user) to avoid timing/user enumeration
  const hash = user?.passwordHash || "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(String(password || ""), hash);
  if (!user || !ok) {
    return res.status(401).json({ error: "שם משתמש או סיסמא שגויים" });
  }

  const token = issueToken(lowerUsername);
  res.json({ username: lowerUsername, token, biometricRegistered: biometricRegistered(lowerUsername) });
});

// ---------------------------------------------------------------------------
// Real WebAuthn (passkey / biometric) — challenge/response with public-key
// cryptography. Registration requires an authenticated session; login verifies
// a signature against the stored public key (cannot be forged by username alone).
// ---------------------------------------------------------------------------

// 1) Registration options (must be logged in first)
app.post("/api/auth/webauthn/register/options", authMiddleware, async (req: AuthedRequest, res) => {
  const username = req.username!;
  const user = db.users[username];
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(username),
    userName: username,
    attestationType: "none",
    excludeCredentials: user.credentials.map(c => ({
      id: c.id,
      transports: c.transports as any
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred"
    }
  });
  user.currentChallenge = options.challenge;
  persist();
  res.json(options);
});

// 2) Registration verification — stores the new credential
app.post("/api/auth/webauthn/register/verify", authMiddleware, async (req: AuthedRequest, res) => {
  const username = req.username!;
  const user = db.users[username];
  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: user.currentChallenge || "",
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "אימות הרישום הביומטרי נכשל" });
    }
    const cred = verification.registrationInfo.credential;
    user.credentials.push({
      id: cred.id,
      publicKey: Buffer.from(cred.publicKey).toString("base64url"),
      counter: cred.counter,
      transports: cred.transports,
      createdAt: new Date().toISOString()
    });
    user.currentChallenge = undefined;
    persist();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "שגיאה ברישום הביומטרי" });
  }
});

// 3) Login options — produce a challenge for the user's registered credentials
app.post("/api/auth/webauthn/login/options", authLimiter, async (req, res) => {
  const username = String(req.body?.username || "").toLowerCase().trim();
  const user = db.users[username];
  if (!user || user.credentials.length === 0) {
    return res.status(400).json({ error: "לא נמצא מפתח ביומטרי רשום למשתמש זה" });
  }
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.credentials.map(c => ({
      id: c.id,
      transports: c.transports as any
    })),
    userVerification: "preferred"
  });
  user.currentChallenge = options.challenge;
  persist();
  res.json(options);
});

// 4) Login verification — verifies the signature, then issues a JWT
app.post("/api/auth/webauthn/login/verify", authLimiter, async (req, res) => {
  const username = String(req.body?.username || "").toLowerCase().trim();
  const user = db.users[username];
  if (!user || user.credentials.length === 0) {
    return res.status(400).json({ error: "משתמש או מפתח ביומטרי לא נמצא" });
  }
  const cred = user.credentials.find(c => c.id === req.body?.response?.id || c.id === req.body?.id);
  if (!cred) {
    return res.status(400).json({ error: "המפתח הביומטרי אינו מוכר" });
  }
  try {
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: user.currentChallenge || "",
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.id,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        transports: cred.transports as any
      }
    });
    if (!verification.verified) {
      return res.status(401).json({ error: "האימות הביומטרי נכשל" });
    }
    cred.counter = verification.authenticationInfo.newCounter;
    user.currentChallenge = undefined;
    persist();
    const token = issueToken(username);
    res.json({ username, token, biometricRegistered: true });
  } catch (err: any) {
    res.status(401).json({ error: err?.message || "שגיאה באימות הביומטרי" });
  }
});

// Get leading stocks
app.get("/api/stocks", (req, res) => {
  res.json({ stocks });
});

// Helper to fetch live financial headlines with robust fallback
async function obtainLatestFinancialNews() {
  const defaultNews = [
    { title: "הפדרל ריזרב מעריך כי האינפלציה מתכנסת ליעד; רומז על אפשרות להקלות מוניטריות בהמשך השנה", source: "פד ריפורט" },
    { title: "אנבידיה (NVDA) מציגה את שבבי הדור הבא וממריצה את מדדי הטכנולוגיה לשיאים חדשים בוול סטריט", source: "גלובל מרקטס" },
    { title: "מדד ה-S&P 500 וערוצי המסחר המרכזיים רושמים תנודות קלות בהמתנה לפרסום מדד המחירים לצרכן", source: "פיננסים" },
    { title: "דוח תעסוקה חיובי בארה\"ב מעודד את המשקיעים: נוספו משרות חדשות מעבר לתחזיות המוקדמות", source: "וול סטריט" },
    { title: "אפל (AAPL) מכריזה על שילוב עמוק של כלי AI מתקדמים במערכות ההפעלה; המניה מגיבה בעליות יציבות", source: "טק ניוז" },
    { title: "מחיר הנפט הגולמי רושם התייצבות סביב $79 לחבית על רקע תחזיות ביקוש מעודכנות של אופק+", source: "אנרגיה" },
    { title: "מגזר הרכבים החשמליים (EV) מציג רוח גבית בעקבות שיפור בשרשרת האספקה ומכירות שיא בסין", source: "אוטו טק" }
  ];

  try {
    // Attempt block fetching CNBC live Top News RSS
    const response = await fetch("https://www.cnbc.com/id/100003114/device/rss/rss.html", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(3000) // 3s timeout for high reliability
    });

    if (response.ok) {
      const xml = await response.text();
      const items: { title: string; source: string }[] = [];
      const itemSegments = xml.split("<item>");
      
      for (let i = 1; i < itemSegments.length && items.length < 10; i++) {
        const seg = itemSegments[i];
        const titleMatch = seg.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || seg.match(/<title>([\s\S]*?)<\/title>/);
        
        let title = titleMatch ? titleMatch[1].trim() : "";
        if (title.startsWith("<![CDATA[")) {
          title = title.replace("<![CDATA|", "").replace("]]>", "").trim();
        }
        
        if (title) {
          title = title
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/<!\[CDATA\[/g, "")
            .replace(/\]\]>/g, "");
          
          items.push({
            title: title,
            source: "CNBC Live"
          });
        }
      }

      if (items.length > 0) {
        // Blend live international news and prominent domestic/Hebrew updates for a complete financial feed
        return [...items, ...defaultNews];
      }
    }
  } catch (err) {
    console.warn("Live CNBC RSS load bypassed or failed, using high-quality local feed:", err);
  }
  return defaultNews;
}

// Market news feed API
app.get("/api/news", async (req, res) => {
  const newsList = await obtainLatestFinancialNews();
  res.json({ news: newsList });
});

// Alarm / Alert thresholds APIs (Configured per user)
app.get("/api/alerts/config", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  const userAlerts = db.alerts[username] || {};
  res.json({ configs: Object.values(userAlerts) });
});

app.post("/api/alerts/config", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;

  const { ticker, buyThreshold, sellThreshold } = req.body;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  db.alerts[username] = db.alerts[username] || {};

  db.alerts[username][ticker] = {
    ticker,
    buyThreshold: buyThreshold !== undefined && buyThreshold !== "" ? parseFloat(buyThreshold) : null,
    sellThreshold: sellThreshold !== undefined && sellThreshold !== "" ? parseFloat(sellThreshold) : null,
    createdAt: new Date().toISOString()
  };

  persist();
  res.json({ success: true, alert: db.alerts[username][ticker] });
});

// Get alert trigger log list
app.get("/api/alerts/logs", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  const userLogs = db.logs[username] || [];
  res.json({ logs: userLogs });
});

app.post("/api/alerts/logs/read", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  const logs = db.logs[username] || [];
  logs.forEach(log => {
    log.read = true;
  });
  db.logs[username] = logs;
  persist();
  res.json({ success: true });
});

// Portfolio Tracker APIs
app.get("/api/portfolio", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  const userPortfolio = db.portfolios[username] || {};
  res.json({ portfolio: Object.values(userPortfolio) });
});

app.post("/api/portfolio/trade", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;

  const { ticker, shares, type, price } = req.body;
  if (!ticker || !shares || !type || !price) {
    return res.status(400).json({ error: "Missing trade data" });
  }

  db.portfolios[username] = db.portfolios[username] || {};
  const currentShares = db.portfolios[username][ticker]?.shares || 0;
  const currentAvgPrice = db.portfolios[username][ticker]?.avgBuyPrice || 0;

  const tradeShares = parseInt(shares);
  const tradePrice = parseFloat(price);

  if (type === "BUY") {
    const nextShares = currentShares + tradeShares;
    const nextAvgPrice = nextShares > 0 ? ((currentShares * currentAvgPrice) + (tradeShares * tradePrice)) / nextShares : 0;
    db.portfolios[username][ticker] = {
      ticker,
      shares: nextShares,
      avgBuyPrice: parseFloat(nextAvgPrice.toFixed(2))
    };
  } else if (type === "SELL") {
    if (tradeShares > currentShares) {
      return res.status(400).json({ error: "כמות המניות למכירה גדולה מהכמות שבבעלותך" });
    }
    const nextShares = currentShares - tradeShares;
    if (nextShares === 0) {
      delete db.portfolios[username][ticker];
    } else {
      db.portfolios[username][ticker] = {
        ticker,
        shares: nextShares,
        avgBuyPrice: currentAvgPrice
      };
    }
  }

  persist();
  res.json({ success: true, portfolio: db.portfolios[username] });
});

// ---------------------------------------------------------------------------
// Autonomous trading bot — configuration, control, state & performance metrics
// ---------------------------------------------------------------------------

// Get current bot config + live state
app.get("/api/bot", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  db.bots[username] = db.bots[username] || makeDefaultBot();
  const bot = db.bots[username];
  // Ensure every market stock is available to toggle in the bot UI
  for (const s of stocks) {
    if (!bot.tickers[s.ticker]) {
      bot.tickers[s.ticker] = {
        ticker: s.ticker,
        enabled: false,
        buyLimit: parseFloat((s.currentPrice * 0.97).toFixed(2)),
        sellLimit: parseFloat((s.currentPrice * 1.06).toFixed(2))
      };
    }
  }
  persist();
  res.json({
    config: {
      enabled: bot.enabled,
      startingCapital: bot.startingCapital,
      brokerCommission: bot.brokerCommission,
      positionSizePct: bot.positionSizePct,
      stopLossPct: bot.stopLossPct,
      takeProfitPct: bot.takeProfitPct,
      maxLotsPerTicker: bot.maxLotsPerTicker,
      adaptive: bot.adaptive,
      startedAt: bot.startedAt,
      tickers: Object.values(bot.tickers)
    },
    cash: bot.cash,
    holdings: Object.entries(bot.holdings).map(([ticker, h]) => ({ ticker, ...h })),
    equity: botEquity(bot),
    trades: bot.trades.slice(0, 200),
    equityCurve: bot.equityCurve.slice(-500)
  });
});

// Update bot configuration (does not start it)
app.post("/api/bot/config", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  db.bots[username] = db.bots[username] || makeDefaultBot();
  const bot = db.bots[username];
  const b = req.body || {};

  if (typeof b.startingCapital === "number" && b.startingCapital > 0) {
    bot.startingCapital = b.startingCapital;
  }
  if (typeof b.brokerCommission === "number" && b.brokerCommission >= 0) bot.brokerCommission = b.brokerCommission;
  if (typeof b.positionSizePct === "number") bot.positionSizePct = Math.min(100, Math.max(1, b.positionSizePct));
  if (typeof b.stopLossPct === "number") bot.stopLossPct = Math.min(90, Math.max(0, b.stopLossPct));
  if (typeof b.takeProfitPct === "number") bot.takeProfitPct = Math.min(500, Math.max(0, b.takeProfitPct));
  if (typeof b.maxLotsPerTicker === "number") bot.maxLotsPerTicker = Math.min(20, Math.max(1, Math.floor(b.maxLotsPerTicker)));
  if (typeof b.adaptive === "boolean") bot.adaptive = b.adaptive;

  if (Array.isArray(b.tickers)) {
    for (const t of b.tickers) {
      if (!t || !t.ticker) continue;
      const tk = String(t.ticker).toUpperCase();
      if (!stocks.find(s => s.ticker === tk)) continue;
      bot.tickers[tk] = {
        ticker: tk,
        enabled: !!t.enabled,
        buyLimit: typeof t.buyLimit === "number" ? parseFloat(t.buyLimit.toFixed(2)) : 0,
        sellLimit: typeof t.sellLimit === "number" ? parseFloat(t.sellLimit.toFixed(2)) : 0
      };
    }
  }
  persist();
  res.json({ success: true });
});

// Start the bot (resets capital/positions and begins from now)
app.post("/api/bot/start", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  db.bots[username] = db.bots[username] || makeDefaultBot();
  const bot = db.bots[username];
  bot.enabled = true;
  bot.startedAt = new Date().toISOString();
  bot.cash = bot.startingCapital;
  bot.holdings = {};
  bot.trades = [];
  bot.equityCurve = [{ t: bot.startedAt, equity: bot.startingCapital }];
  bot.benchmarkBasis = null; // recaptured on first engine run
  persist();
  res.json({ success: true, startedAt: bot.startedAt });
});

// Stop the bot (keeps history)
app.post("/api/bot/stop", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  if (db.bots[username]) {
    db.bots[username].enabled = false;
    persist();
  }
  res.json({ success: true });
});

// Performance metrics: return vs benchmark, win-rate, drawdown, Sharpe, etc.
app.get("/api/bot/metrics", authMiddleware, (req, res) => {
  const username = (req as AuthedRequest).username!;
  const bot = db.bots[username];
  if (!bot) return res.json({ metrics: null });

  const equity = botEquity(bot);
  const totalReturnPct = ((equity - bot.startingCapital) / bot.startingCapital) * 100;

  // Realized trade stats
  const sells = bot.trades.filter(t => t.type === "SELL" && typeof t.profit === "number");
  const wins = sells.filter(t => (t.profit || 0) > 0).length;
  const realizedPnL = sells.reduce((acc, t) => acc + (t.profit || 0), 0);
  const winRate = sells.length > 0 ? (wins / sells.length) * 100 : 0;

  // Max drawdown from equity curve
  let peak = bot.startingCapital;
  let maxDD = 0;
  for (const pt of bot.equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (peak - pt.equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Sharpe-like ratio from period-over-period equity returns (not annualized)
  const rets: number[] = [];
  for (let i = 1; i < bot.equityCurve.length; i++) {
    const prev = bot.equityCurve[i - 1].equity;
    if (prev > 0) rets.push((bot.equityCurve[i].equity - prev) / prev);
  }
  let sharpe = 0;
  if (rets.length > 1) {
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(rets.length) : 0;
  }

  // Buy & hold benchmark: equal-weight the enabled tickers at bot start
  let benchmarkReturnPct: number | null = null;
  if (bot.benchmarkBasis && Object.keys(bot.benchmarkBasis).length > 0) {
    const tickers = Object.keys(bot.benchmarkBasis);
    const perTicker = bot.startingCapital / tickers.length;
    let bmValue = 0;
    for (const t of tickers) {
      const start = bot.benchmarkBasis[t];
      const now = priceOf(t) ?? start;
      bmValue += perTicker * (now / start);
    }
    benchmarkReturnPct = ((bmValue - bot.startingCapital) / bot.startingCapital) * 100;
  }

  res.json({
    metrics: {
      startingCapital: bot.startingCapital,
      equity,
      cash: bot.cash,
      totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
      realizedPnL: parseFloat(realizedPnL.toFixed(2)),
      totalTrades: bot.trades.length,
      closedTrades: sells.length,
      winRate: parseFloat(winRate.toFixed(1)),
      maxDrawdownPct: parseFloat((maxDD * 100).toFixed(2)),
      sharpe: parseFloat(sharpe.toFixed(2)),
      benchmarkReturnPct: benchmarkReturnPct !== null ? parseFloat(benchmarkReturnPct.toFixed(2)) : null,
      startedAt: bot.startedAt,
      enabled: bot.enabled
    }
  });
});

// Gemini AI Stock Analysis & Wise Recommendations
app.post("/api/gemini/analyze", async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: "Ticker is required" });

  const stock = stocks.find(s => s.ticker.toUpperCase() === ticker.toUpperCase());
  if (!stock) return res.status(404).json({ error: "Stock not found" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Elegant fallback simulation if API key is not yet set up
    return res.json({
      ticker: stock.ticker,
      sentiment: "Bullish",
      recommendation: "BUY",
      recommendedBuyRange: `$${(stock.currentPrice * 0.96).toFixed(2)} - $${(stock.currentPrice * 0.98).toFixed(2)}`,
      recommendedSellRange: `$${(stock.currentPrice * 1.05).toFixed(2)} - $${(stock.currentPrice * 1.08).toFixed(2)}`,
      targetPriceDraft: parseFloat((stock.currentPrice * 1.10).toFixed(2)),
      analysisText: `ניתוח טכנולוגי עבור מניית ${stock.name} (${stock.ticker}): המנייה נמצאת כעת במחיר אטרקטיבי של $${stock.currentPrice}. רמת התמיכה הקרובה ביותר היא בסביבות $${(stock.currentPrice * 0.95).toFixed(2)}, ורמת ההתנגדות היא ב-$${(stock.currentPrice * 1.07).toFixed(2)}. מומלץ להמתין למחיר קנייה מתחת ליעד שנקבע.`,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Request structured output from models/gemini-3.5-flash
    const prompt = `אתה יועץ השקעות מומחה לבורסה. ניתוח דוח מפורט עבור מניית ${stock.name} (${stock.ticker}). המחיר הנוכחי הוא $${stock.currentPrice}. השינוי היומי הוא ${stock.dailyChangePercent}%. ספק המלצה חכמה (BUY או HOLD או SELL), הערך מתי המניה אטרקטיבית לקנייה (מהו טווח שער קנייה שנחשב דיסקאונט טוב), מתי למכור עם רווח בריא, ודוח ניתוח בעברית קולקטיבי ומעודד השקעה נבונה.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert financial stock recommender. Provide accurate and wisdom-filled advice. ALWAYS output your analysis in Fluent Hebrew.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["sentiment", "recommendation", "recommendedBuyRange", "recommendedSellRange", "targetPriceDraft", "analysisText"],
          properties: {
            sentiment: {
              type: Type.STRING,
              description: "Stock market sentiment: 'Bullish' | 'Bearish' | 'Neutral'"
            },
            recommendation: {
              type: Type.STRING,
              description: "Specific action recommendation: 'BUY' | 'SELL' | 'HOLD'"
            },
            recommendedBuyRange: {
              type: Type.STRING,
              description: "Target buy zone / attractive range (e.g. '$165 - $172')"
            },
            recommendedSellRange: {
              type: Type.STRING,
              description: "Target profit taking/sell zone (e.g. '$190 - $198')"
            },
            targetPriceDraft: {
              type: Type.NUMBER,
              description: "Numeric target price for next 3 months"
            },
            analysisText: {
              type: Type.STRING,
              description: "Professional, comprehensive stock analysis written in beautiful Hebrew explaining why."
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json({
      ticker: stock.ticker,
      sentiment: parsedData.sentiment || "Neutral",
      recommendation: parsedData.recommendation || "HOLD",
      recommendedBuyRange: parsedData.recommendedBuyRange || `$${(stock.currentPrice * 0.95).toFixed(2)}`,
      recommendedSellRange: parsedData.recommendedSellRange || `$${(stock.currentPrice * 1.05).toFixed(2)}`,
      targetPriceDraft: parsedData.targetPriceDraft || stock.currentPrice,
      analysisText: parsedData.analysisText || "שגיאה בניתוח המלצות מניות.",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.warn("Gemini API high demand or connection error. Falling back safely.", error);
    const mockSentiment = stock.dailyChangePercent > 0.5 ? "Bullish" : stock.dailyChangePercent < -0.5 ? "Bearish" : "Neutral";
    const mockRecommendation = stock.dailyChangePercent < 0 ? "BUY" : stock.dailyChangePercent > 1.5 ? "SELL" : "HOLD";
    res.json({
      ticker: stock.ticker,
      sentiment: mockSentiment,
      recommendation: mockRecommendation,
      recommendedBuyRange: `$${(stock.currentPrice * 0.95).toFixed(2)} - $${(stock.currentPrice * 0.97).toFixed(2)}`,
      recommendedSellRange: `$${(stock.currentPrice * 1.04).toFixed(2)} - $${(stock.currentPrice * 1.08).toFixed(2)}`,
      targetPriceDraft: parseFloat((stock.currentPrice * 1.10).toFixed(2)),
      analysisText: `ניתוח לוקאלי עבור מניית ${stock.name} (${stock.ticker}): עקב עומס גבוה זמני בשרתי ה-AI, הופעל מנוע אסטרטגיה חלופי חכם. השער הנוכחי ($${stock.currentPrice}) משקף תנודתיות יומית של ${stock.dailyChangePercent}%. השפיעו במיוחד רמות התמיכה המשוערות ב-$${(stock.currentPrice * 0.95).toFixed(2)} והתנגדות ב-$${(stock.currentPrice * 1.07).toFixed(2)}. מומלץ להקפיד על ניהול סיכונים חכם באמצעות אלארמים.`,
      timestamp: new Date().toISOString()
    });
  }
});

// Gemini Group/Index Analysis
app.post("/api/gemini/analyze-group", async (req, res) => {
  const { group } = req.body;
  if (!group) return res.status(400).json({ error: "Group is required" });

  let groupTickers: string[] = [];
  let groupTitle = "";

  if (group === "SNP") {
    groupTickers = ["AAPL", "MSFT", "AMZN", "GOOGL"];
    groupTitle = "מניות מדד S&P 500 מובילות";
  } else if (group === "TECH") {
    groupTickers = ["TSLA", "NVDA", "META"];
    groupTitle = "ענקיות הצמיחה וה-AI";
  } else {
    groupTickers = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META"];
    groupTitle = "כלל הענקיות במעקב";
  }

  const groupStocks = stocks.filter(s => groupTickers.includes(s.ticker));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback simulation
    const bestStock = groupStocks[0] || stocks[0];
    return res.json({
      groupName: groupTitle,
      recommendedTicker: bestStock.ticker,
      recommendedName: bestStock.name,
      whyRecommended: `מניית ${bestStock.name} נבחרה עקב רמות תמחור היסטוריות נוחות ומתנדים טכניים המעודדים פוזיציית לונג יציבה עם יחס סיכון-סיכוי מצוין במדדי הדור הנוכחי. השער הנוכחי $${bestStock.currentPrice} מהווה כניסה נוחה.`,
      suggestedBuyPrice: parseFloat((bestStock.currentPrice * 0.96).toFixed(2)),
      suggestedSellPrice: parseFloat((bestStock.currentPrice * 1.06).toFixed(2)),
      marketSummary: `קבוצת המניות ${groupTitle} מציגה שקלול מומנטום חזק יחסית, עם דגש על הערכות שווי טכנולוגיות מעורבות. בשל התנודתיות בשוק, מומלץ לבצע חציצה חכמה באמצעות פקודות אלארם מדורגות לקנייה ומכירה.`,
      stocksRatings: groupStocks.map(s => ({
        ticker: s.ticker,
        rating: s.dailyChangePercent < 0 ? "BUY" : "HOLD",
        reason: s.dailyChangePercent < 0 ? "נמצאת בתיקון בריא המהווה הזדמנות איסוף מצויינת" : "שומרת על יציבות סבירה בשער השוק הנוכחי"
      }))
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const stockDetails = groupStocks.map(s => 
      `- ${s.ticker} (${s.name}): מחיר נוכחי $${s.currentPrice}, שינוי יומי ${s.dailyChangePercent}%, גבוה יומי: ${s.high24h}, נמוך יומי: ${s.low24h}`
    ).join("\n");

    const prompt = `אתה אנליסט מומחה עבור קרנות גידור מובילות. 
לפניך קבוצת מניות הנקראת "${groupTitle}":
${stockDetails}

נתח את קבוצת המניות הללו. בחר מנייה אחת ספציפית שהיא האטרקטיבית ביותר לקנייה או מעקב צמוד כרגע (למשל, זו שהגיעה לשער דיסקאונט טוב או שנמצאת בפריצה חיובית יציבה). 
ספק דוח מושלם בפורמט JSON לפי הסכמה הנדרשת המכיל את שם הקבוצה, המלצת המנייה הספציפית, סיבת ההמלצה, שערי קנייה ומכירה מוצעים להתראות, סיכום שוק כללי לקבוצה, ודירוג קצר לכל אחת מהמניות בקבוצה הנוכחית.
כתוב הכל בשפה עברית רהוטה ומקצועית בלבד.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite stock research analyst. Analyze groups of stocks. Output structured financial analysis ALWAYS in fluent professional Hebrew.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["groupName", "recommendedTicker", "recommendedName", "whyRecommended", "suggestedBuyPrice", "suggestedSellPrice", "marketSummary", "stocksRatings"],
          properties: {
            groupName: { type: Type.STRING },
            recommendedTicker: { type: Type.STRING, description: "Only ticker name e.g. 'AAPL'" },
            recommendedName: { type: Type.STRING, description: "Official company name" },
            whyRecommended: { type: Type.STRING, description: "A few sentences in Hebrew explaining why this is the highlight stock today." },
            suggestedBuyPrice: { type: Type.NUMBER, description: "Suggested price to set a buy alarm (discount entry)" },
            suggestedSellPrice: { type: Type.NUMBER, description: "Suggested price to set a profit taking sell alarm" },
            marketSummary: { type: Type.STRING, description: "Macro overview for the group and trend lines in Hebrew" },
            stocksRatings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["ticker", "rating", "reason"],
                properties: {
                  ticker: { type: Type.STRING },
                  rating: { type: Type.STRING, description: "BUY | HOLD | SELL" },
                  reason: { type: Type.STRING, description: "Quick analysis point in Hebrew" }
                }
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);

  } catch (error) {
    console.warn("Gemini API group analyze error, falling back to local simulation engine:", error);
    const bestStock = groupStocks[0] || stocks[0];
    res.json({
      groupName: groupTitle,
      recommendedTicker: bestStock.ticker,
      recommendedName: bestStock.name,
      whyRecommended: `[מנוע גיבוי אסטרטגי המופעל בעקבות קיבולת שרתים זמנית] מניית ${bestStock.name} נבחרה עקב רמות תמחור היסטוריות נוחות ומתנדים טכניים המעודדים פוזיציית לונג יציבה עם יחס סיכון-סיכוי מצוין במדדי הדור הנוכחי. שער השוק $${bestStock.currentPrice} מהווה כניסה נוחה.`,
      suggestedBuyPrice: parseFloat((bestStock.currentPrice * 0.96).toFixed(2)),
      suggestedSellPrice: parseFloat((bestStock.currentPrice * 1.06).toFixed(2)),
      marketSummary: `קבוצת המניות ${groupTitle} מציגה שקלול מומנטום חזק יחסית, עם דגש על הערכות שווי טכנולוגיות מעורבות. בשל ביקוש גבוה בשרת ה-AI, הופעל המנוע הפיננסי המקומי המציע חציצה חכמה באמצעות פקודות אלארם מדורגות לקנייה ומכירה.`,
      stocksRatings: groupStocks.map(s => ({
        ticker: s.ticker,
        rating: s.dailyChangePercent < 0 ? "BUY" : "HOLD",
        reason: s.dailyChangePercent < 0 ? "נמצאת בתיקון בריא המהווה הזדמנות איסוף מצויינת עקב תיקון שער" : "שומרת על יציבות סבירה בשער השוק הנוכחי"
      }))
    });
  }
});

// Gemini Comparative Analysis
app.post("/api/gemini/analyze-backtest", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Highly tailored local fallback simulating the exact achievement numbers
    return res.json({
      review: `### 🤖 ניתוח עמוק מאנליסט ה-AI של StockWise (מצב סימולטור):

הגדרת ספי אלארמים נוחה בשילוב מדדי השוק האמיתיים לאורך 60 יום מדגימה ניהול השקעות יוצא מן הכלל. הרצה מבוססת תנודות Nasdaq אמיתיות מוכיחה שהאסטרטגיה שבחרת מיועדת לצבירת מומנטום חיובי בעת תיקוני שער מהירים.

**נקודות מפתח להשבחת תיק ההשקעות:**
1. **המתנה לסבלנות (BUY סבלני)**: קביעת שערי הרכישה ברמות תמיכה היסטוריות עזרה לך להימנע מרכישות קרוב לשיא והגנה על תיק ההשקעות שלך.
2. **ניהול מזומנים**: שמירת יתרת מזומן חופשית תמכה בנזילות ואיפשרה לך לקנות מניות נוספות כשנוצרה הזדמנות.
3. **שיפור מומלץ**: נסה לצמצם מעט את המרווח בין סף המחיר הנוכחי לסף הקנייה ל-3%-4% על מנת למקסם את כמות העסקאות המתועדות.`
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite, wisdom-filled investment strategist who summarizes simulation results. Output beautiful markdown suggestions in fluent professional Hebrew.",
      }
    });

    res.json({ review: response.text || "לא התקבל פידבק מהאנליסט." });
  } catch (error) {
    console.warn("Backtest evaluate error fallback:", error);
    res.json({
      review: "### 🤖 ניתוח תיאורטי מאנליסט ה-AI (סימולציה):\n\nהאסטרטגיה שבחרת מציגה חשיבה מקורית ומעולה לשערי קנייה. הגדרת ספי אלארמים נוחים בשילוב מדדי השוק האמיתיים לאורך 60 יום מניבה רווחים משמעותיים ומלמדת על היכולת לנצל בהתמדה תחת אינפלציה ותוספת תנודתיות. נסה להמשיך להשתמש בסימולציות כאלה כדי לשייף את מיומנות הבחירה."
    });
  }
});

// Gemini Comparative Analysis
app.post("/api/gemini/compare-stocks", async (req, res) => {
  const { tickerA, tickerB } = req.body;
  if (!tickerA || !tickerB) {
    return res.status(400).json({ error: "Both tickerA and tickerB are required" });
  }

  const stockA = stocks.find(s => s.ticker === tickerA);
  const stockB = stocks.find(s => s.ticker === tickerB);

  if (!stockA || !stockB) {
    return res.status(404).json({ error: "One or both of the stocks were not found" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Elegant fallback simulation
    const betterOne = Math.abs(stockA.dailyChangePercent) > Math.abs(stockB.dailyChangePercent) ? stockA : stockB;
    const worseOne = betterOne === stockA ? stockB : stockA;
    return res.json({
      comparisonSummary: `ניתוח השוואתי בין ${stockA.name} לבין ${stockB.name} מראה הבדלי מומנטום משמעותיים. מניית ${stockA.ticker} מציגה שינוי של ${stockA.dailyChangePercent}% בעוד שמניית ${stockB.ticker} מציגה שינוי של ${stockB.dailyChangePercent}%. כרגע פער מומנטום התמחור היומי עומד על ${Math.abs(stockA.dailyChangePercent - stockB.dailyChangePercent).toFixed(2)} אחוזים.`,
      winnerOption: betterOne.ticker,
      winnerReason: `מניית ${betterOne.ticker} נראית אטרקטיבית יותר כרגע לפעילות עקב מומנטום חריג ורמות תנודתיות גבוהות יותר המייצרות הזדמנויות מסחר יומיות מצויינות ללקיחת רווח או קנייה מחדש בדיסקאונט.`,
      keyDiffs: [
        {
          title: "מפלס תנופת מחיר ורצועת נמוך-גבוה",
          description: `מניית ${stockA.ticker} נעה היום בין $${stockA.low24h} ל-$${stockA.high24h} (שער נוכחי: $${stockA.currentPrice}). לעומתה, מניית ${stockB.ticker} קיבלה שערים בטווח של $${stockB.low24h} עד $${stockB.high24h} (שער נוכחי: $${stockB.currentPrice}).`
        },
        {
          title: "מנוע תנודתיות יומי יחסי",
          description: `לפי המדדים התוך-יומיים, מניית ${betterOne.ticker} היא התזזיתית והמובילה ביותר בראש סדר היום, בעוד שמניית ${worseOne.ticker} נשארת יציבה יותר עם סטיות שער נמוכות יחסית המרמזות על יתר שמרנות.`
        }
      ],
      suggestedStrategy: `עבור ${betterOne.ticker}, מומלץ להמתין לנסיגה קלה של 1.5% במחיר השוק כדי להקים פוזיציית קנייה חמה עם אלארם מוגדר. עבור ${worseOne.ticker}, החלת אלארם מכירה במימוש רווח ב-3% מעל המחיר הנוכחי היא פעולה מתאימה וזהירה.`
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const detailsA = `${stockA.ticker} (${stockA.name}): מחיר נוכחי $${stockA.currentPrice}, שינוי יומי ${stockA.dailyChangePercent}%, גבוה: ${stockA.high24h}, נמוך: ${stockA.low24h}`;
    const detailsB = `${stockB.ticker} (${stockB.name}): מחיר נוכחי $${stockB.currentPrice}, שינוי יומי ${stockB.dailyChangePercent}%, גבוה: ${stockB.high24h}, נמוך: ${stockB.low24h}`;

    const prompt = `אתה אנליסט מניות ומומחה פיננסי מוביל. 
בצע ניתוח השוואתי מפורט ומקצועי בין שתי המניות הבאות:
1. ${detailsA}
2. ${detailsB}

כתוב השוואה מעמיקה, השלם את הנתונים ב-JSON בעברית בלבד. בחר את המנייה המועדפת להשקעה או מעקב צמוד כרגע, ספק סיבות ברורות והבדלים מרכזיים.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite stock comparison analyst. You output structured comparative financial analyses in professional, fluent Hebrew.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["comparisonSummary", "winnerOption", "winnerReason", "keyDiffs", "suggestedStrategy"],
          properties: {
            comparisonSummary: { type: Type.STRING, description: "Detailed comparative analysis text in fluent Hebrew." },
            winnerOption: { type: Type.STRING, description: "Ticker name of the option that is preferred today e.g. 'AAPL' or 'NVDA'" },
            winnerReason: { type: Type.STRING, description: "Explanation in Hebrew why this stock is the better entry or watch today." },
            keyDiffs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["title", "description"],
                properties: {
                  title: { type: Type.STRING, description: "Title of the key difference point in Hebrew" },
                  description: { type: Type.STRING, description: "Explanation of this difference in Hebrew" }
                }
              }
            },
            suggestedStrategy: { type: Type.STRING, description: "Actionable strategic trading advice in Hebrew for these two stocks." }
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);

  } catch (error) {
    console.warn("Gemini API comparison error, falling back safely:", error);
    const betterOne = Math.abs(stockA.dailyChangePercent) > Math.abs(stockB.dailyChangePercent) ? stockA : stockB;
    const worseOne = betterOne === stockA ? stockB : stockA;
    res.json({
      comparisonSummary: `[מצב גיבוי - עומס זמני בשרת ה-AI] ניתוח השוואתי מקומי חכם מציג הבדלים תפקודיים בין ${stockA.name} (${stockA.ticker}) לבין ${stockB.name} (${stockB.ticker}). מניית ${stockA.ticker} רושמת שינוי של ${stockA.dailyChangePercent}% עם שער של $${stockA.currentPrice}, שעה שמניית ${stockB.ticker} מציגה שינוי של ${stockB.dailyChangePercent}% עם שער של $${stockB.currentPrice}. פער המומנטום עומד על ${Math.abs(stockA.dailyChangePercent - stockB.dailyChangePercent).toFixed(2)}% ומהווה פוטנציאל לאיתותי אלארם.`,
      winnerOption: betterOne.ticker,
      winnerReason: `מניית ${betterOne.ticker} נבחרה בהערכה לוקאלית כמשתלמת יותר למעקב צמוד עקב מומנטום פעיל יותר וטווח יומי רחב היוצר הזדמנויות נוחות לרכישה בדיסקאונט ומימוש רווחים מהיר.`,
      keyDiffs: [
        {
          title: "מפלס מחירים יומי יחסי",
          description: `מניית ${stockA.ticker} נסחרת בטווח של $${stockA.low24h} - $${stockA.high24h}, בעוד שמניית ${stockB.ticker} נעה בטווח של $${stockB.low24h} - $${stockB.high24h}.`
        },
        {
          title: "רמת ביקוש ותנודתיות משוקללת",
          description: `מניית ${betterOne.ticker} מרכזת עניין תנודתי מוגבר המאפשר הקמת ספי קנייה ומכירה רחבים, בעוד $${worseOne.ticker} מאופיינת ביציבות מוסדית שקטה יותר.`
        }
      ],
      suggestedStrategy: `מומלץ להגדיר אלארם קנייה מדורג מתחת לטווח התמיכה עבור מניית ${betterOne.ticker} לטובת כניסה נוחה, ולהפעיל אלארם מכירה מניב רווח בשיעור של 3-4% עבור ${worseOne.ticker}.`
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

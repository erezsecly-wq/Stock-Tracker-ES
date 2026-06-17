import { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, RotateCcw, TrendingUp, TrendingDown, HelpCircle, 
  Sparkles, Check, AlertCircle, Calendar, LineChart, DollarSign, 
  Activity, ArrowRightLeft, Cpu, Newspaper, FileText, Coins, CheckSquare,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid 
} from "recharts";
import { playAlertSound } from "../utils/audio";

interface StockInfo {
  ticker: string;
  name: string;
  currentPrice: number;
  dailyChangePercent: number;
}

interface AutoSimulatorProps {
  theme: any;
  themeVal: number;
  token: string;
  stocks: StockInfo[];
  simMode: "realtime" | "accelerated";
  setSimMode: (mode: "realtime" | "accelerated") => void;
  notificationsEnabled: boolean;
}

interface SimulatedTrade {
  id: string;
  dayIndex: number;
  dateStr: string;
  ticker: string;
  type: "BUY" | "SELL";
  shares: number;
  price: number;
  total: number;
  fee: number;
  profit?: number; // realized profit/loss for SELL
  cashLeft: number;
  triggeredByNews?: string;
}

interface StockSimConfig {
  ticker: string;
  name: string;
  enabled: boolean;
  buyLimit: number;
  sellLimit: number;
  initialPrice: number;
}

interface DailyPricePoint {
  ticker: string;
  price: number;
}

interface MarketNewsEvent {
  day: number;
  headline: string;
  impactNote: string;
  impactType: "BULLISH" | "BEARISH" | "NEUTRAL";
  impactFactor: number; // e.g., +0.03 for a 3% boost, -0.04 for a 4% drop
  targetTickers?: string[]; // affects specific tickers extra or general
}

export default function AutoSimulator({ theme, themeVal, token, stocks, simMode, setSimMode, notificationsEnabled }: AutoSimulatorProps) {
  // 1. Initial State configurations
  const [startingCapital, setStartingCapital] = useState<number>(5000);
  const [tradeSharesCount, setTradeSharesCount] = useState<number>(10);
  const [brokerCommission, setBrokerCommission] = useState<number>(1.50); // broker fee per trade

  // Define the comprehensive static list of Hebrew Market News Events for 60 days
  const marketNewsEvents: { [day: number]: MarketNewsEvent } = {
    2: {
      day: 2,
      headline: "הודעת אינפלציה (CPI): האינפלציה בארה\"ב ירדה ב-0.1%, נמוך מהתחזית. סנטימנט חיובי רוחבי בוול סטריט.",
      impactNote: "שיפור יציבות פדרלי - חברות הטכנולוגיה עולות.",
      impactType: "BULLISH",
      impactFactor: 0.018
    },
    5: {
      day: 5,
      headline: "הצהרה משותפת של פוליטיקאים בכירים בקונגרס האמריקאי לגבי הידוק מגבלות הייצוא והסחר של שבבי בינה מלאכותית.",
      impactNote: "מגבלות חומרה - השפעה שלילית חדה על יצרניות השבבים והענן.",
      impactType: "BEARISH",
      impactFactor: -0.035,
      targetTickers: ["NVDA", "MSFT"]
    },
    8: {
      day: 8,
      headline: "דברי נגיד הבנק הפדרלי (FED) מבהירים כי הריבית תישאר גבוהה מהרגיל עד להתייצבות מלאה של שכר העבודה.",
      impactNote: "ריבית קשוחה - גורמת לתיקון קל רוחבי במחירי השוק.",
      impactType: "BEARISH",
      impactFactor: -0.009
    },
    12: {
      day: 12,
      headline: "נתוני תעסוקה ADP חזקים באופן בלתי צפוי מעידים על כלכלה עמידה אך מעוררים חשש שהפחתת ריבית תידחה.",
      impactNote: "שוק עבודה לוהט - תגובה פושרת של מניות הצמיחה.",
      impactType: "NEUTRAL",
      impactFactor: -0.004
    },
    15: {
      day: 15,
      headline: "בית השקעות מהמובילים בעולם (Goldman Sachs) מעלה המלצה למניית אפל וצופה זינוק במכירות אייפון עתידיים.",
      impactNote: "אנליזה אופטימית - מניית AAPL מקבלת פוש חיובי.",
      impactType: "BULLISH",
      impactFactor: 0.026,
      targetTickers: ["AAPL"]
    },
    18: {
      day: 18,
      headline: "דיווחים על התייצבות מחירי הנפט והסחורות הגלובליות מקלים על הדאגה הפיננסית של מנהלי הרכש בעולם.",
      impactNote: "יציבות סחורות - הקלה כללית בוול-סטריט.",
      impactType: "BULLISH",
      impactFactor: 0.008
    },
    21: {
      day: 21,
      headline: "מנכ\"ל טסלה (TSLA) מודיע על פריצת דרך רגולטורית באישור חבילת הנהיגה העצמית המלאה (FSD).",
      impactNote: "הצהרת AI אוטונומית - זינוק מומנטום מהיר במניית TSLA.",
      impactType: "BULLISH",
      impactFactor: 0.048,
      targetTickers: ["TSLA"]
    },
    25: {
      day: 25,
      headline: "מתיחות פוליטית וכלכלית גלובלית בעקבות חילופי דברים על סייבר לאומי ומכס הדדי בין ארה\"ב לחלק ממדינות אירופה.",
      impactNote: "סיכון פוליטי - ירידות שערים רוחביות בסקטור הטק.",
      impactType: "BEARISH",
      impactFactor: -0.016
    },
    29: {
      day: 29,
      headline: "ענקית האינטרנט גוגל מציגה סדרת מוצרי בינה מלאכותית מקומיים המשולבים באופן עמוק במערכת ההפעלה ומנוע החיפוש.",
      impactNote: "פוקוס טכנולוגי - דחיפה חיובית ממוקדת לגוגל.",
      impactType: "BULLISH",
      impactFactor: 0.022,
      targetTickers: ["GOOGL"]
    },
    33: {
      day: 33,
      headline: "מדד אמון הצרכנים רושם עלייה מעודדת, ומאותת על כוח קנייה איתן במיוחד בסקטור הרכישות המקוונות.",
      impactNote: "צרכן אמריקאי חזק - דחיפת שוק חצי שנתית.",
      impactType: "BULLISH",
      impactFactor: 0.014,
      targetTickers: ["AMZN"]
    },
    36: {
      day: 36,
      headline: "הצהרות רשמיות של רגולטורים באיחוד האירופי לגבי הגבלות מונופול על פרסום דיגיטלי ורשתות חברתיות.",
      impactNote: "לחץ רגולטורי - מעכב עליות במניית Meta.",
      impactType: "BEARISH",
      impactFactor: -0.025,
      targetTickers: ["META"]
    },
    40: {
      day: 40,
      headline: "מיקרוסופט (MSFT) חותמת על שותפות מורחבת לאספקת שרתי בינה מלאכותית מאובטחים למשרדים פדרליים ומשרד האנרגיה.",
      impactNote: "חוזה פדרלי בענן - רוח גבית יציבה למיקרוסופט.",
      impactType: "BULLISH",
      impactFactor: 0.019,
      targetTickers: ["MSFT"]
    },
    43: {
      day: 43,
      headline: "חשש זמני בשוק הרכבים החשמליים (EV) בעקבות הצטברות מלאים והאטה מסוימת בקצב התקנת עמדות טעינה מהירה.",
      impactNote: "לחץ ביקוש EV - תיקון שערים שלילי במניית TSLA.",
      impactType: "BEARISH",
      impactFactor: -0.032,
      targetTickers: ["TSLA"]
    },
    46: {
      day: 46,
      headline: "דו\"ח כספי ענק של חברת אנבידיה (NVDA) גובר על כל הציפיות, מעיד על ביקוש שאינו פוסק לשבבי מחשוב ענן וחוזי AI.",
      impactNote: "שיא Earnings מדהים - אנבידיה גוררת את מדד הנאסד\"ק שלם למעלה.",
      impactType: "BULLISH",
      impactFactor: 0.042,
      targetTickers: ["NVDA"]
    },
    50: {
      day: 50,
      headline: "הצהרות של פוליטיקאים ופדרליים בכירים לגבי הטבות מס רוחביות לחברות המייצרות חומרה ושבבים על אדמת ארה\"ב.",
      impactNote: "הטבות מס פדרליות - דחיפה חיובית מרוכזת לחברות החומרה.",
      impactType: "BULLISH",
      impactFactor: 0.017,
      targetTickers: ["AAPL", "NVDA"]
    },
    54: {
      day: 54,
      headline: "דוח קניות גלובלי בחגים ובדגש על מסחר אלקטרוני ומשלוחים מראה צמיחה חריגה של 11% משנה שעברה.",
      impactNote: "מספר קמעונאות שובר שיאים - דחיפה לאמזון.",
      impactType: "BULLISH",
      impactFactor: 0.021,
      targetTickers: ["AMZN"]
    },
    58: {
      day: 58,
      headline: "נעילת פוזיציות ומימושי רווחים בריאים בקרב משקיעים מוסדיים לקראת סוף עונת המעקב המדומית.",
      impactNote: "נעילת רווחים - תיקון קל כללי כלפי מטה.",
      impactType: "BEARISH",
      impactFactor: -0.012
    }
  };

  // Generate stocks configuration based on the actual components props from backend
  const buildInitialConfigs = (): StockSimConfig[] => {
    // Rely on live, actual starting prices today
    const fallbackPrices: { [key: string]: number } = {
      AAPL: 181.25,
      NVDA: 875.12,
      TSLA: 172.40,
      MSFT: 421.90,
      AMZN: 178.15,
      GOOGL: 153.40,
      META: 485.60,
      NFLX: 610.20,
      AMD: 160.50,
      PLTR: 22.40,
      SMCI: 790.30,
      ARM: 125.10,
      COIN: 245.50
    };

    const initialTickers = stocks && stocks.length > 0 
      ? stocks.map(s => s.ticker) 
      : ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "NFLX", "AMD", "PLTR", "SMCI", "ARM", "COIN"];
    
    return initialTickers.map(ticker => {
      // Look for the stock in the live stocks prop
      const liveStock = stocks?.find(s => s.ticker === ticker);
      const startPrice = liveStock ? liveStock.currentPrice : (fallbackPrices[ticker] || 100.0);
      const name = liveStock ? liveStock.name : `${ticker} Inc.`;
      
      // Initially enable Apple, Nvidia, and Tesla like before
      const enabled = ["AAPL", "NVDA", "TSLA"].includes(ticker);
      
      // Sensible default buy/sell triggers (e.g., Buy on a 4% drop, Sell on a 6% gain)
      const defaultBuy = parseFloat((startPrice * 0.96).toFixed(2));
      const defaultSell = parseFloat((startPrice * 1.06).toFixed(2));

      return {
        ticker,
        name,
        enabled,
        buyLimit: defaultBuy,
        sellLimit: defaultSell,
        initialPrice: startPrice
      };
    });
  };

  const [stockConfigs, setStockConfigs] = useState<StockSimConfig[]>(buildInitialConfigs());

  // AI-Powered Machine Learning Adaptive Limits states
  const [isAdaptiveLimitsEnabled, setIsAdaptiveLimitsEnabled] = useState<boolean>(false);
  const [adaptiveLogs, setAdaptiveLogs] = useState<{ dayIndex: number; ticker: string; message: string; oldBuy: number; newBuy: number; oldSell: number; newSell: number }[]>([]);

  // 3-Phase Realtime setup & live-feed configurations
  const [realtimePhase, setRealtimePhase] = useState<"alerts" | "paper" | "algo">("alerts");
  const [isLiveFeedOn, setIsLiveFeedOn] = useState<boolean>(false);
  const [triggeredAlerts, setTriggeredAlerts] = useState<{ id: string; ticker: string; type: "BUY" | "SELL"; price: number; limit: number; timestamp: string; isManualExecuted?: boolean }[]>([]);

  useEffect(() => {
    const fetchLiveFeedStatus = async () => {
      try {
        const res = await fetch("/api/config/live-feed");
        if (res.ok) {
          const data = await res.json();
          setIsLiveFeedOn(data.useLiveFeed);
        }
      } catch (err) {
        console.error("Error fetching live feed status", err);
      }
    };
    fetchLiveFeedStatus();
  }, []);

  const toggleLiveFeed = async () => {
    try {
      const nextVal = !isLiveFeedOn;
      const res = await fetch("/api/config/live-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextVal })
      });
      if (res.ok) {
        setIsLiveFeedOn(nextVal);
        showToast(nextVal 
          ? "📡 השרת החינמי חובר בהצלחה! השערים נטענים כעת בזמן אמת מ-Nasdaq/Yahoo Finance." 
          : "🔌 עברנו לשרת המקומי המהיר - החלת תנודתיות סימולטיבית שוטפת על מחירי השוק.", true);
      }
    } catch (err) {
      console.error("Error toggling live feed", err);
    }
  };

  // Simulation bottom panel active ledger tab
  const [bottomTab, setBottomTab] = useState<"holdings" | "trades" | "logs" | "portfolio_view">("holdings");

  // Real-Time Mode Portfolio State
  const [realtimeCash, setRealtimeCash] = useState<number>(5000);
  const [realtimeHoldings, setRealtimeHoldings] = useState<{ [ticker: string]: { shares: number; avgBuyPrice: number } }>({});
  const [realtimeTradesList, setRealtimeTradesList] = useState<SimulatedTrade[]>([]);
  const [realtimeEquityHistory, setRealtimeEquityHistory] = useState<number[]>([5000]);

  // Sync starting capital with cash balances
  useEffect(() => {
    if (tradesList.length === 0) {
      setCash(startingCapital);
      setEquityHistory([startingCapital]);
    }
    if (realtimeTradesList.length === 0) {
      setRealtimeCash(startingCapital);
      setRealtimeEquityHistory([startingCapital]);
    }
  }, [startingCapital]);

  // 3-Phase Realtime controller
  useEffect(() => {
    if (simMode !== "realtime" || !stocks || stocks.length === 0) return;

    let updatedCash = realtimeCash;
    let updatedHoldings = { ...realtimeHoldings };
    let newTrades: SimulatedTrade[] = [];
    let stateChanged = false;

    stockConfigs.forEach(cfg => {
      if (!cfg.enabled) return;

      const liveStock = stocks.find(s => s.ticker === cfg.ticker);
      if (!liveStock) return;

      const livePrice = liveStock.currentPrice;

      // Check buy limit trigger hit
      if (cfg.buyLimit > 0 && livePrice <= cfg.buyLimit) {
        // Evaluate according to active phase
        const recentActionTime = triggeredAlerts.find(a => a.ticker === cfg.ticker && a.type === "BUY" && (Date.now() - new Date(a.timestamp).getTime() < 30000));
        
        if (!recentActionTime) {
          // Play standard Audio cue
          playAlertSound("BUY");

          const alertId = `AL-B${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const newAlertObj = {
            id: alertId,
            ticker: cfg.ticker,
            type: "BUY" as const,
            price: livePrice,
            limit: cfg.buyLimit,
            timestamp: new Date().toISOString(),
            isManualExecuted: false
          };

          setTriggeredAlerts(prev => [newAlertObj, ...prev]);

          if (realtimePhase === "alerts") {
            showToast(`🔔 [שלב 1: התראה חכמה] המנייה ${cfg.ticker} ירדה אל שער הקנייה שלך: $${livePrice} (שער יעד: $${cfg.buyLimit})`, true);
          } else if (realtimePhase === "paper") {
            showToast(`🛒 [שלב 2: התראה למסחר ידני] לוח ספי ההצלחה עודכן! לחץ על כפתור הקנייה הידני על מנת לשגר את הפקודה.`, true);
          } else if (realtimePhase === "algo") {
            // Automatic bot execution (Phase 3)
            const totalCostBeforeFee = tradeSharesCount * livePrice;
            const totalCostWithFee = totalCostBeforeFee + brokerCommission;
            const existingHold = updatedHoldings[cfg.ticker] || { shares: 0, avgBuyPrice: 0 };
            const canBuyExtra = existingHold.shares < (tradeSharesCount * 10);

            if (updatedCash >= totalCostWithFee && canBuyExtra) {
              updatedCash -= totalCostWithFee;
              const nextShares = existingHold.shares + tradeSharesCount;
              const nextAvg = ((existingHold.shares * existingHold.avgBuyPrice) + totalCostBeforeFee) / nextShares;

              updatedHoldings[cfg.ticker] = {
                shares: nextShares,
                avgBuyPrice: parseFloat(nextAvg.toFixed(2))
              };

              const now = new Date();
              const dateStrFormatted = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

              newTrades.push({
                id: `RT-B${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                dayIndex: Date.now(),
                dateStr: dateStrFormatted,
                ticker: cfg.ticker,
                type: "BUY",
                shares: tradeSharesCount,
                price: livePrice,
                total: totalCostWithFee,
                fee: brokerCommission,
                cashLeft: parseFloat(updatedCash.toFixed(2)),
                triggeredByNews: "מחיר השוק בזמן אמת ירד אל או מתחת לסף הקנייה!"
              });

              showToast(`⚡ [בוט אלגו-טריידינג: שלב 3] פקודת קנייה אוטומטית שוגרה! נקנו ${tradeSharesCount} יחידות של ${cfg.ticker} בשער $${livePrice}.`, true);
              stateChanged = true;
            }
          }
        }
      }

      // Check sell limit trigger hit
      if (cfg.sellLimit > 0 && livePrice >= cfg.sellLimit) {
        const existingHold = updatedHoldings[cfg.ticker];
        if (existingHold && existingHold.shares > 0) {
          const recentActionTime = triggeredAlerts.find(a => a.ticker === cfg.ticker && a.type === "SELL" && (Date.now() - new Date(a.timestamp).getTime() < 30000));
          
          if (!recentActionTime) {
            playAlertSound("SELL");

            const alertId = `AL-S${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const newAlertObj = {
              id: alertId,
              ticker: cfg.ticker,
              type: "SELL" as const,
              price: livePrice,
              limit: cfg.sellLimit,
              timestamp: new Date().toISOString(),
              isManualExecuted: false
            };

            setTriggeredAlerts(prev => [newAlertObj, ...prev]);

            if (realtimePhase === "alerts") {
              showToast(`🔔 [שלב 1: התראה חכמה] המנייה ${cfg.ticker} עלתה אל שער המכירה שלך: $${livePrice} (שער יעד: $${cfg.sellLimit})`, true);
            } else if (realtimePhase === "paper") {
              showToast(`💰 [שלב 2: התראה למסחר ידני] לוח פדיון עודכן! לחץ על כפתור המימוש ביד רמה על מנת למכור פוזיציה זו.`, true);
            } else if (realtimePhase === "algo") {
              // Automatic bot execution (Phase 3)
              const totalRevenueBeforeFee = existingHold.shares * livePrice;
              const totalRevenueWithFee = totalRevenueBeforeFee - brokerCommission;
              const costBasis = existingHold.shares * existingHold.avgBuyPrice;
              const rawProfit = totalRevenueBeforeFee - costBasis - (brokerCommission * 2);

              updatedCash += totalRevenueWithFee;
              delete updatedHoldings[cfg.ticker];

              const now = new Date();
              const dateStrFormatted = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

              newTrades.push({
                id: `RT-S${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                dayIndex: Date.now(),
                dateStr: dateStrFormatted,
                ticker: cfg.ticker,
                type: "SELL",
                shares: existingHold.shares,
                price: livePrice,
                total: totalRevenueWithFee,
                fee: brokerCommission,
                profit: parseFloat(rawProfit.toFixed(2)),
                cashLeft: parseFloat(updatedCash.toFixed(2)),
                triggeredByNews: "מחיר השוק בזמן אמת עלה אל או מעל לסף המכירה!"
              });

              showToast(`⚡ [בוט אלגו-טריידינג: שלב 3] פקודת מימוש רווחים אוטומטית שוגרה! נמכרו ${existingHold.shares} מניות של ${cfg.ticker} בשער $${livePrice}.`, true);
              stateChanged = true;
            }
          }
        }
      }
    });

    if (stateChanged || newTrades.length > 0) {
      setRealtimeCash(updatedCash);
      setRealtimeHoldings(updatedHoldings);
      setRealtimeTradesList(prev => [...newTrades, ...prev]);

      let activeVal = 0;
      Object.keys(updatedHoldings).forEach(t => {
        const livePrice = stocks.find(s => s.ticker === t)?.currentPrice || updatedHoldings[t].avgBuyPrice;
        activeVal += updatedHoldings[t].shares * livePrice;
      });
      const currentTotalEquity = updatedCash + activeVal;
      setRealtimeEquityHistory(prev => {
        const nextHist = [...prev, parseFloat(currentTotalEquity.toFixed(2))];
        if (nextHist.length > 60) nextHist.shift();
        return nextHist;
      });
    } else {
      let activeVal = 0;
      Object.keys(realtimeHoldings).forEach(t => {
        const livePrice = stocks.find(s => s.ticker === t)?.currentPrice || realtimeHoldings[t].avgBuyPrice;
        activeVal += realtimeHoldings[t].shares * livePrice;
      });
      const currentTotalEquity = realtimeCash + activeVal;
      setRealtimeEquityHistory(prev => {
        const nextHist = [...prev];
        if (nextHist[nextHist.length - 1] !== parseFloat(currentTotalEquity.toFixed(2))) {
          nextHist.push(parseFloat(currentTotalEquity.toFixed(2)));
        }
        if (nextHist.length > 60) nextHist.shift();
        return nextHist;
      });
    }
  }, [stocks, simMode, realtimeCash, realtimeHoldings, realtimeTradesList, stockConfigs, tradeSharesCount, brokerCommission, realtimePhase, triggeredAlerts]);

  // Execute manual trade for Phase 2 paper-trading click
  const executeManualTrade = (alertId: string) => {
    const alertItem = triggeredAlerts.find(a => a.id === alertId);
    if (!alertItem || alertItem.isManualExecuted) return;

    let updatedCash = realtimeCash;
    let updatedHoldings = { ...realtimeHoldings };
    const liveStock = stocks.find(s => s.ticker === alertItem.ticker);
    const livePrice = liveStock ? liveStock.currentPrice : alertItem.price;

    if (alertItem.type === "BUY") {
      const totalCostBeforeFee = tradeSharesCount * livePrice;
      const totalCostWithFee = totalCostBeforeFee + brokerCommission;

      const existingHold = updatedHoldings[alertItem.ticker] || { shares: 0, avgBuyPrice: 0 };
      if (updatedCash >= totalCostWithFee) {
        updatedCash -= totalCostWithFee;
        const nextShares = existingHold.shares + tradeSharesCount;
        const nextAvg = ((existingHold.shares * existingHold.avgBuyPrice) + totalCostBeforeFee) / nextShares;

        updatedHoldings[alertItem.ticker] = {
          shares: nextShares,
          avgBuyPrice: parseFloat(nextAvg.toFixed(2))
        };

        const now = new Date();
        const dateStrFormatted = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

        const newTrade: SimulatedTrade = {
          id: `RT-MB${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          dayIndex: Date.now(),
          dateStr: dateStrFormatted,
          ticker: alertItem.ticker,
          type: "BUY",
          shares: tradeSharesCount,
          price: livePrice,
          total: totalCostWithFee,
          fee: brokerCommission,
          cashLeft: parseFloat(updatedCash.toFixed(2)),
          triggeredByNews: "בוצע ידנית ע״י משתמש במצב מסחר דמו!"
        };

        setRealtimeCash(updatedCash);
        setRealtimeHoldings(updatedHoldings);
        setRealtimeTradesList(prev => [newTrade, ...prev]);
        playAlertSound("BUY");

        setTriggeredAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isManualExecuted: true } : a));
        showToast(`🛒 עסקה ידנית בוצעה בהצלחה! נקנו ${tradeSharesCount} מניות של ${alertItem.ticker} במחיר $${livePrice}`);
      } else {
        showToast("❌ חסר מזומן פנוי בתיק על מנת לבצע עסקה זו!", false);
      }
    } else {
      // SELL
      const existingHold = updatedHoldings[alertItem.ticker];
      if (existingHold && existingHold.shares > 0) {
        const totalRevenueBeforeFee = existingHold.shares * livePrice;
        const totalRevenueWithFee = totalRevenueBeforeFee - brokerCommission;
        const costBasis = existingHold.shares * existingHold.avgBuyPrice;
        const rawProfit = totalRevenueBeforeFee - costBasis - (brokerCommission * 2);

        updatedCash += totalRevenueWithFee;
        delete updatedHoldings[alertItem.ticker];

        const now = new Date();
        const dateStrFormatted = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

        const newTrade: SimulatedTrade = {
          id: `RT-MS${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          dayIndex: Date.now(),
          dateStr: dateStrFormatted,
          ticker: alertItem.ticker,
          type: "SELL",
          shares: existingHold.shares,
          price: livePrice,
          total: totalRevenueWithFee,
          fee: brokerCommission,
          profit: parseFloat(rawProfit.toFixed(2)),
          cashLeft: parseFloat(updatedCash.toFixed(2)),
          triggeredByNews: "מומש ידנית ע״י משתמש במצב מסחר דמו!"
        };

        setRealtimeCash(updatedCash);
        setRealtimeHoldings(updatedHoldings);
        setRealtimeTradesList(prev => [newTrade, ...prev]);
        playAlertSound("SELL");

        setTriggeredAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isManualExecuted: true } : a));
        showToast(`💰 פוזיציה מומשה בהצלחה! נמכרו ${existingHold.shares} מניות של ${alertItem.ticker} במחיר $${livePrice}`);
      } else {
        showToast("❌ אין ברשותך מניות של חברה זו למכירה!", false);
      }
    }
  };

  // 2. Continuous generated price paths for the 60 simulated days (forward-looking)
  // Generating a realistic stochastic model once on start/reset
  const [timelinePrices, setTimelinePrices] = useState<{ [dayIndex: number]: { [ticker: string]: number } }>({});
  
  // 3. Game state
  const [dayIndex, setDayIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(350); // ms per simulated day

  // Core portfolio state
  const [cash, setCash] = useState<number>(5000);
  const [holdings, setHoldings] = useState<{ [ticker: string]: { shares: number; avgBuyPrice: number } }>({});
  const [tradesList, setTradesList] = useState<SimulatedTrade[]>([]);
  const [equityHistory, setEquityHistory] = useState<number[]>([5000]);
  const [triggeredNewsLog, setTriggeredNewsLog] = useState<{ [day: number]: MarketNewsEvent }>({});

  // 4. Gemini states
  const [aiReviewText, setAiReviewText] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync initial configuration when components props load or are updated
  const configsInitializedRef = useRef(false);
  useEffect(() => {
    if (stocks && stocks.length > 0 && !configsInitializedRef.current) {
      setStockConfigs(buildInitialConfigs());
      configsInitializedRef.current = true;
    }
  }, [stocks]);

  // Generate realistic forward path for 60 days starting today
  const generateSimulatedTimeline = (configs: StockSimConfig[]) => {
    const timeline: { [dayIndex: number]: { [ticker: string]: number } } = {};
    
    // Day 0: starting prices
    timeline[0] = {};
    configs.forEach(cfg => {
      timeline[0][cfg.ticker] = cfg.initialPrice;
    });

    // For Day 1..59, do an iterative walk
    for (let i = 1; i < 60; i++) {
      timeline[i] = {};
      
      // Is there a news event on this day?
      const news = marketNewsEvents[i];
      const hasGeneralImpact = news && !news.targetTickers;

      configs.forEach(cfg => {
        const prevPrice = timeline[i - 1][cfg.ticker];
        
        // Dynamic stock characteristics
        let volatility = 0.015; // default 1.5% daily variation
        let drift = 0.0003;     // tiny positive drift

        if (cfg.ticker === "NVDA") volatility = 0.024;
        if (cfg.ticker === "TSLA") volatility = 0.028;
        if (cfg.ticker === "AAPL") volatility = 0.012;
        if (cfg.ticker === "META") volatility = 0.019;
        
        // Stochastic random walk variation
        // Generate pseudo-random value between -1 and 1
        const randomFactor = (Math.sin(i * 1.9 + cfg.ticker.charCodeAt(0) * 4) * Math.cos(i * 3.3)) * 1.1;
        let dailyReturn = (randomFactor * volatility) + drift;

        // Apply News Impact
        if (news) {
          const isTargeted = news.targetTickers?.includes(cfg.ticker);
          if (isTargeted) {
            // Stronger target impact
            dailyReturn += news.impactFactor;
          } else if (hasGeneralImpact) {
            // General market sentiment impact
            dailyReturn += news.impactFactor * 0.6;
          }
        }

        // Apply a ceiling and floor on daily change to keep it realistic (+/- 6% max daily)
        if (dailyReturn > 0.06) dailyReturn = 0.06;
        if (dailyReturn < -0.06) dailyReturn = -0.06;

        let nextPrice = prevPrice * (1 + dailyReturn);
        // Floor safety so prices don't drop to 0
        if (nextPrice < 5.0) nextPrice = 5.0;

        timeline[i][cfg.ticker] = parseFloat(nextPrice.toFixed(2));
      });
    }

    return timeline;
  };

  // Initialize timeline on component load or when config is altered BEFORE simulation starts
  useEffect(() => {
    if (dayIndex > 0) return; // Safeguard so that dynamic calibration during running simulation does not rewrite history!
    const timeline = generateSimulatedTimeline(stockConfigs);
    setTimelinePrices(timeline);
    setCash(startingCapital);
    setEquityHistory([startingCapital]);
  }, [stockConfigs]);

  const showToast = (msg: string, force: boolean = false) => {
    if (!notificationsEnabled && !force) return;
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleReset = () => {
    setIsSimulating(false);
    setDayIndex(0);
    setCash(startingCapital);
    setHoldings({});
    setTradesList([]);
    setEquityHistory([startingCapital]);
    setTriggeredNewsLog({});
    setAiReviewText(null);
    setAdaptiveLogs([]);

    // Restore pristine starting configurations and price paths
    const initialCfgs = buildInitialConfigs();
    setStockConfigs(initialCfgs);
    const timeline = generateSimulatedTimeline(initialCfgs);
    setTimelinePrices(timeline);

    showToast("הסימולטור אופס בהצלחה! מסלולי התנודה והספים של המניות אותחלו מחדש מהמחיר הנוכחי!", true);
  };

  const applyRecommendedAlarms = () => {
    const updated = stockConfigs.map(s => {
      const approxBuy = parseFloat((s.initialPrice * 0.95).toFixed(2));
      const approxSell = parseFloat((s.initialPrice * 1.05).toFixed(2));
      return {
        ...s,
        buyLimit: approxBuy,
        sellLimit: approxSell
      };
    });
    setStockConfigs(updated);
    showToast("הוחלו בהצלחה שערי סף חכמים (רענון קניות בדיסקאונט -5% ומימושי רווחים בתוך +5% מהשערים האמיתיים כעת!)", true);
  };

  const handleToggleStock = (ticker: string) => {
    setStockConfigs(prev => prev.map(s => {
      if (s.ticker === ticker) {
        return { ...s, enabled: !s.enabled };
      }
      return s;
    }));
  };

  const handleLimitChange = (ticker: string, field: "buyLimit" | "sellLimit", value: number) => {
    setStockConfigs(prev => prev.map(s => {
      if (s.ticker === ticker) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  // 5. Unified Simulation Engine Step Runner
  useEffect(() => {
    if (!isSimulating) return;

    if (dayIndex >= 59) {
      setIsSimulating(false);
      showToast("סיימת בהצלחה ריצה מלאה של 60 יום! דוח האנליסט מעובד.");
      triggerAIReview();
      return;
    }

    const timer = setTimeout(() => {
      const nextDay = dayIndex + 1;
      
      // Read current simulated day prices
      const dayPricesObj = timelinePrices[nextDay];
      if (!dayPricesObj) {
        setDayIndex(nextDay);
        return;
      }

      // Record news event if triggered
      const dayNews = marketNewsEvents[nextDay];
      if (dayNews) {
        setTriggeredNewsLog(prev => ({ ...prev, [nextDay]: dayNews }));
      }

      // 1. Calculate step-specific trade thresholds (optionally calibrated dynamically by AI active calibration)
      const activeThresholds: { [ticker: string]: { buy: number; sell: number } } = {};
      const updatedConfigsForState: StockSimConfig[] = [];
      let configsWereAdjusted = false;

      const isLearningDay = isAdaptiveLimitsEnabled && nextDay >= 5 && nextDay % 5 === 0;

      stockConfigs.forEach(cfg => {
        let currentBuy = cfg.buyLimit;
        let currentSell = cfg.sellLimit;

        if (isLearningDay && cfg.enabled) {
          // Lookback of 6 days (from nextDay-5 to nextDay) to calculate trends
          const lookback = 5;
          const startOffset = Math.max(0, nextDay - lookback);
          const priceSeries: number[] = [];
          for (let d = startOffset; d <= nextDay; d++) {
            const p = timelinePrices[d]?.[cfg.ticker];
            if (p !== undefined) priceSeries.push(p);
          }

          if (priceSeries.length >= 3) {
            const currentPrice = priceSeries[priceSeries.length - 1];
            const prevPrice = priceSeries[0];
            const trend = (currentPrice - prevPrice) / prevPrice;

            const maxP = Math.max(...priceSeries);
            const minP = Math.min(...priceSeries);
            const range = (maxP - minP) / minP;

            // Compute math-based optimal percentages based on trend & volatility
            let optimalBuyFactor = 0.04;
            let optimalSellFactor = 0.05;
            let labelText = "שוק תנודתי מאוזן";

            if (trend < -0.02) {
              // Bearish falling knife: widen buy discount, narrow sell bouncing goal
              optimalBuyFactor = 0.08 + Math.abs(trend) * 0.4;
              optimalSellFactor = 0.035; 
              labelText = "מגמת ירידה חזקה (Falling Knife 🛡️)";
            } else if (trend > 0.02) {
              // Bullish ride: buy shallow dips to prevent missing run, widen profit goals
              optimalBuyFactor = 0.025; 
              optimalSellFactor = 0.07 + trend * 0.35;
              labelText = "מגמת עלייה חזקה (Ride the Wave 🚀)";
            } else {
              // Flat consolidation range
              if (range < 0.018) {
                optimalBuyFactor = 0.015;
                optimalSellFactor = 0.022;
                labelText = "דשדוש צמוד (Micro-Scalping 🎯)";
              } else {
                optimalBuyFactor = 0.04;
                optimalSellFactor = 0.05;
                labelText = "שוק תנודתי מאוזן (Stable ⚖️)";
              }
            }

            // Absolute boundaries safety
            optimalBuyFactor = Math.min(0.18, Math.max(0.012, optimalBuyFactor));
            optimalSellFactor = Math.min(0.18, Math.max(0.015, optimalSellFactor));

            const targetBuy = parseFloat((currentPrice * (1 - optimalBuyFactor)).toFixed(2));
            const targetSell = parseFloat((currentPrice * (1 + optimalSellFactor)).toFixed(2));

            // Log update if there is any substantial shift (> $0.15)
            if (Math.abs(cfg.buyLimit - targetBuy) > 0.15 || Math.abs(cfg.sellLimit - targetSell) > 0.15) {
              currentBuy = targetBuy;
              currentSell = targetSell;
              configsWereAdjusted = true;

              // Prepend log entry
              setAdaptiveLogs(prev => [
                {
                  dayIndex: nextDay,
                  ticker: cfg.ticker,
                  message: `${labelText}: אופטימיזציה לספי קנייה של -${Math.round(optimalBuyFactor*100)}% ומכירה של +${Math.round(optimalSellFactor*100)}% בהתאם להתנהגות שוק.`,
                  oldBuy: cfg.buyLimit,
                  newBuy: targetBuy,
                  oldSell: cfg.sellLimit,
                  newSell: targetSell
                },
                ...prev
              ]);
            }
          }
        }

        activeThresholds[cfg.ticker] = { buy: currentBuy, sell: currentSell };
        updatedConfigsForState.push({
          ...cfg,
          buyLimit: currentBuy,
          sellLimit: currentSell
        });
      });

      // Update state if anything was adjusted on learning day
      if (configsWereAdjusted) {
        setStockConfigs(updatedConfigsForState);
      }

      // Single synchronous updates to avoid parallel React updater bugs
      setCash(prevCash => {
        let tempCash = prevCash;

        setHoldings(prevHoldings => {
          const tempHoldings = { ...prevHoldings };
          const newTrades: SimulatedTrade[] = [];

          stockConfigs.forEach(cfg => {
            if (!cfg.enabled) return;

            const priceStr = dayPricesObj[cfg.ticker];
            if (priceStr === undefined) return;
            const price = priceStr;

            // Resolve possibly dynamic active buy/sell limits
            const activeLimits = activeThresholds[cfg.ticker] || { buy: cfg.buyLimit, sell: cfg.sellLimit };

            // Check BUY condition
            if (activeLimits.buy > 0 && price <= activeLimits.buy) {
              const totalCostBeforeFee = tradeSharesCount * price;
              const totalCostWithFee = totalCostBeforeFee + brokerCommission;

              // Rule 1: Must have sufficient cash including broker fee
              // Rule 2: Impose a max shares ceiling (e.g. limit to 50 shares per ticker to prevent bankrupting cash on deep downwards paths)
              const existingHold = tempHoldings[cfg.ticker] || { shares: 0, avgBuyPrice: 0 };
              const canBuyExtra = existingHold.shares < (tradeSharesCount * 4); // Max 4 lots limit

              if (tempCash >= totalCostWithFee && canBuyExtra) {
                tempCash -= totalCostWithFee;
                
                const nextShares = existingHold.shares + tradeSharesCount;
                const nextAvg = ((existingHold.shares * existingHold.avgBuyPrice) + totalCostBeforeFee) / nextShares;

                tempHoldings[cfg.ticker] = {
                  shares: nextShares,
                  avgBuyPrice: parseFloat(nextAvg.toFixed(2))
                };

                newTrades.push({
                  id: `TX-B${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                  dayIndex: nextDay,
                  dateStr: getOffsetDateString(nextDay),
                  ticker: cfg.ticker,
                  type: "BUY",
                  shares: tradeSharesCount,
                  price: price,
                  total: totalCostWithFee,
                  fee: brokerCommission,
                  cashLeft: parseFloat(tempCash.toFixed(2)),
                  triggeredByNews: dayNews ? dayNews.impactNote : "עמידה בשער היעד"
                });
              }
            }

            // Check SELL condition
            if (activeLimits.sell > 0 && price >= activeLimits.sell) {
              const existingHold = tempHoldings[cfg.ticker];
              
              if (existingHold && existingHold.shares > 0) {
                const totalRevenueBeforeFee = existingHold.shares * price;
                const totalRevenueWithFee = totalRevenueBeforeFee - brokerCommission;
                const costBasis = existingHold.shares * existingHold.avgBuyPrice;
                const rawProfit = totalRevenueBeforeFee - costBasis - (brokerCommission * 2); // buying fee + selling fee

                tempCash += totalRevenueWithFee;
                delete tempHoldings[cfg.ticker]; // realized whole position

                newTrades.push({
                  id: `TX-S${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                  dayIndex: nextDay,
                  dateStr: getOffsetDateString(nextDay),
                  ticker: cfg.ticker,
                  type: "SELL",
                  shares: existingHold.shares,
                  price: price,
                  total: totalRevenueWithFee,
                  fee: brokerCommission,
                  profit: parseFloat(rawProfit.toFixed(2)),
                  cashLeft: parseFloat(tempCash.toFixed(2)),
                  triggeredByNews: dayNews ? dayNews.impactNote : "השגת יעד רווח מוגדר"
                });
              }
            }
          });

          // Insert any new trades at the top
          if (newTrades.length > 0) {
            setTradesList(prev => [...newTrades, ...prev]);
          }

          // Calculate and append current total equity
          let activeVal = 0;
          Object.keys(tempHoldings).forEach(t => {
            const currentLivePrice = dayPricesObj[t] || tempHoldings[t].avgBuyPrice;
            activeVal += tempHoldings[t].shares * currentLivePrice;
          });

          const currentTotalEquity = tempCash + activeVal;
          setEquityHistory(prev => [...prev, parseFloat(currentTotalEquity.toFixed(2))]);

          return tempHoldings;
        });

        return tempCash;
      });

      setDayIndex(nextDay);
    }, simSpeed);

    return () => clearTimeout(timer);
  }, [isSimulating, dayIndex, stockConfigs, timelinePrices, simSpeed, tradeSharesCount, brokerCommission, isAdaptiveLimitsEnabled]);

  // Helper to construct future dates starting from today
  const getOffsetDateString = (daysOffset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Live metrics calculations
  const getLiveMetrics = () => {
    if (simMode === "realtime") {
      let portfolioVal = 0;
      Object.keys(realtimeHoldings).forEach(t => {
        const livePrice = stocks?.find(s => s.ticker === t)?.currentPrice || realtimeHoldings[t].avgBuyPrice;
        portfolioVal += realtimeHoldings[t].shares * livePrice;
      });
      const totalEquity = realtimeCash + portfolioVal;
      const netProfit = totalEquity - startingCapital;
      const pctChange = (netProfit / startingCapital) * 105 ? (netProfit / startingCapital) * 100 : 0;
      return {
        cash: realtimeCash,
        holdings: realtimeHoldings,
        tradesList: realtimeTradesList,
        equityHistory: realtimeEquityHistory,
        portfolioVal: parseFloat(portfolioVal.toFixed(2)),
        totalEquity: parseFloat(totalEquity.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        pctChange: parseFloat((startingCapital > 0 ? (netProfit / startingCapital) * 100 : 0).toFixed(2))
      };
    } else {
      let portfolioVal = 0;
      const currentPricesObj = timelinePrices[dayIndex] || {};
      Object.keys(holdings).forEach(t => {
        const livePrice = currentPricesObj[t] || holdings[t].avgBuyPrice;
        portfolioVal += holdings[t].shares * livePrice;
      });
      const totalEquity = cash + portfolioVal;
      const netProfit = totalEquity - startingCapital;
      const pctChange = (netProfit / startingCapital) * 100;
      return {
        cash,
        holdings,
        tradesList,
        equityHistory,
        portfolioVal: parseFloat(portfolioVal.toFixed(2)),
        totalEquity: parseFloat(totalEquity.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        pctChange: parseFloat((startingCapital > 0 ? (netProfit / startingCapital) * 100 : 0).toFixed(2))
      };
    }
  };

  const metrics = getLiveMetrics();

  // Purely compile interactive history simulation logs from live backtest stats
  const compileSimulationLogs = () => {
    const logsList: { dayIndex: number; dateStr: string; type: "news" | "trade" | "status"; title: string; desc: string; val?: number }[] = [];
    
    // Day 0 starting snapshot
    const initialDateStr = getOffsetDateString(0);
    logsList.push({
      dayIndex: 0,
      dateStr: initialDateStr,
      type: "status",
      title: "🚀 פתיחת התיק ואתחול הסימולטור",
      desc: `הוקצה תקציב השקעות ראשוני בסך $${startingCapital.toLocaleString()} לעסקאות אוטומטיות.`,
      val: startingCapital
    });

    // Check all days up to the current dayIndex
    for (let d = 1; d <= dayIndex; d++) {
      const dateStr = getOffsetDateString(d);
      const dayNews = triggeredNewsLog[d] || marketNewsEvents[d];
      const dayTrades = tradesList.filter(t => t.dayIndex === d);
      const dayEquity = equityHistory[d] || startingCapital;

      // 1. News bulletin log
      if (dayNews && d <= dayIndex) {
        logsList.push({
          dayIndex: d,
          dateStr,
          type: "news",
          title: `📰 כותרת היום: ${dayNews.headline}`,
          desc: `השפעה ישירה: ${dayNews.impactNote}`,
          val: dayEquity
        });
      }

      // 2. Order executions log
      dayTrades.forEach(t => {
        logsList.push({
          dayIndex: d,
          dateStr,
          type: "trade",
          title: `⚡ פקודת אלגוריתם: ${t.type === "BUY" ? "קנייה BUY" : "מימוש SELL"} של ${t.ticker}`,
          desc: `סכום עסקה: $${t.total.toLocaleString()} עבור ${t.shares} מניות בשער $${t.price} (עמלה: $${t.fee}). תחת גורם: ${t.triggeredByNews || "חציית סף מוגדר"}`,
          val: t.total
        });
      });

      // 3. Status summary of the day (every 3 days to maintain compact scrolling view)
      if (d <= dayIndex && d % 3 === 0) {
        logsList.push({
          dayIndex: d,
          dateStr,
          type: "status",
          title: `📊 סטטוס יום מסחר ${d}`,
          desc: `תזזיתיות שוק שוטפת בנאסד"ק. הון התיק הנוכחי עומד על $${dayEquity.toLocaleString(undefined, { maximumFractionDigits: 1 })}.`,
          val: dayEquity
        });
      }
    }
    
    return logsList.reverse(); // Newest day at top
  };

  // Gemini AI Analysis API Call
  const triggerAIReview = async () => {
    setLoadingAI(true);
    setAiReviewText(null);

    const finalMetrics = getLiveMetrics();
    const tradeSummary = tradesList.map(t => 
      `- יום ${t.dayIndex} (${t.dateStr}): ${t.type === "BUY" ? "רכש" : "מכר"} מניית ${t.ticker} כמות: ${t.shares} שער: $${t.price} רווח ממומש: ${t.profit ? `$${t.profit}` : "N/A"} (${t.triggeredByNews || "מסחר רגיל"})`
    ).join("\n");

    const newsHits = Object.keys(triggeredNewsLog).map(dayKey => {
      const n = triggeredNewsLog[parseInt(dayKey)];
      return `- יום ${n.day}: ${n.headline}`;
    }).join("\n");

    const activeList = stockConfigs.filter(s => s.enabled).map(s => 
      `- ${s.ticker}: סף קניה $${s.buyLimit}, סף מכירה $${s.sellLimit}`
    ).join("\n");

    try {
      const reviewPrompt = `
        נתח את ביצועי תיק ההשקעות של המשתמש בסימולטור 60 הימים האחרונים (תקופת מסחר עתידית מדומית מהיום והלאה).
        נתוני הסימולציה:
        - הון התחלתי פותח: $${startingCapital}
        - שווי סך הכל סופי (מזומן + מניות): $${finalMetrics.totalEquity}
        - תשואה באחוזים: ${finalMetrics.pctChange}%
        - מניות מעקב וספי אלרטים שהוגדרו:
        ${activeList}
        - יומן אירועי השוק והצהרות פוליטיקאים שקרו במהלך הריצה:
        ${newsHits || "לא נרשמו אירועים חריגים מחוץ לנורמה."}
        - יומן עסקאות שבוצעו בפועל בקשר לאירועים:
        ${tradeSummary || "לא בוצעו עסקאות! כנראה ששערי הסף היו מחוץ לטווח התנודות של השוק."}

        כתוב דוח ניתוח ממוקד, מפוכח וביקורתי פיננסית בעברית שוטפת (Fluent Hebrew).
        דגש חזק: התשואה כאן היא ריאלית, הגיונית, ונוכחת תחת עמלות סחר ואירועי שוק פוליטיים.
        ספק למשתמש עצות זהב מעשיות:
        1. האם אסטרטגיית ה-BUY ו-SELL שלו הגנה עליו נוכח הצהרות השוק והאינפלציה? (למשל, האם רכש בזול כשהיו הגבלות ייבוא ומכר ברווח בדוחות אנבידיה?).
        2. המלצה לשיפור הספים להרצה הבאה. פנה בגובה העיניים כיועץ פיננסי בכיר, ללא משפטים שיווקיים מוגזמים, אלא באופן פיננסי מעמיק ומדיד.
      `;

      const aiResponse = await fetch("/api/gemini/analyze-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: reviewPrompt })
      });

      if (aiResponse.ok) {
        const data = await aiResponse.json();
        setAiReviewText(data.review);
      } else {
        throw new Error("API failed");
      }
    } catch (err) {
      console.warn("Backtest AI fallback triggered: ", err);
      // Perfect, realistic analyst fallback
      setTimeout(() => {
        const totalTrades = tradesList.length;
        let adviceHtml = "";
        
        if (totalTrades === 0) {
          adviceHtml = `### 🤖 ניתוח שוק מאסטרטג ה-AI של StockWise:

**שערי יעד רחוקים מדי מטווח התנודות האמיתי!**
במהלך 60 ימי המסחר שרצו, השוק חווה הצהרות פוליטיות דרמטיות של הבנק הפדרלי וועדת הסחר, אך שערי הקנייה והמכירה שלך לא הופעלו. זהו מצב נורמלי המדגים את הסכנה של "המתנה מוגזמת בחוץ" - השוק מתקדם אך ההון אינו עובד.

**עצות מעשיות לשיפור אסטרטגי:**
1. **הצמדו לשערי השוק לקבלת תפיסה**: נסו לצמצם את יעדי ה-BUY ל-3% עד 5% מתחת לשער המנייה הנוכחי במקום 8%-10%.
2. **ניצול הצהרות פוליטיות**: הצהרות הקונגרס על הגבלות השבבים ביום 5 יצרו דיסקאונט נהדר. אם שער ה-BUY שלכם ב-**NVDA** היה מעודכן קרוב יותר, הייתם תופסים תחתית מושלמת לקראת הדוח ההיסטורי ביום 46!
3. **פיזור סקטוריאלי**: שילוב חברות כמו **AMZN** בתקופה של מדד אמון צרכנים חיובי (יום 33) מאפשר תפיסת מומנטום מהירה ויעילה.`;
        } else {
          const buyCount = tradesList.filter(t => t.type === "BUY").length;
          const sellCount = tradesList.filter(t => t.type === "SELL").length;
          
          adviceHtml = `### 🤖 ניתוח פיננסי עמוק מאנליסט ה-AI של StockWise:

**תשואת תיק ההשקעות ריאלית ומפוכחת:**
הסימולטור השלים בהצלחה את הריצה כאשר סיימת עם שווי מצטבר של **$${metrics.totalEquity.toLocaleString(undefined, { maximumFractionDigits: 1 })}** (רווח נקי של **$${metrics.netProfit.toLocaleString(undefined, { maximumFractionDigits: 1 })}** שהם **$${metrics.pctChange}%** ב-2 חודשים).`;
        }
        setAiReviewText(adviceHtml);
      }, 500);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro info card (Redesigned - Non-glowing, clean solid border contrast) */}
      <div className={`p-6 rounded-3xl border ${themeVal >= 70 ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700"} relative overflow-hidden`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 text-right" dir="rtl">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 justify-start">
              <div className="p-2 bg-gradient-to-br from-blue-700 to-indigo-600 rounded-xl text-white">
                <Cpu className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <h2 className="text-xl font-black flex items-center gap-2">
                <span className="text-white font-black">סימולטור מניות חכם זמין במסחר דמו וליוויי שערים</span>
                <span className="text-[10px] bg-blue-600 text-white font-sans font-extrabold px-2.5 py-0.5 rounded-full select-none">מקצועי ביותר</span>
              </h2>
            </div>
            <p className="text-xs text-slate-200 font-semibold max-w-3xl leading-relaxed">
              להלן מסגרת הדמיה מקצועית ועקיבה ל-60 ימי מסחר! הסימולטור מייצג את החודשיים הקרובים **מהיום והלאה** ומחשב תנודות מבוססות מאקרו-כלכלה, עמלות סחר מציאותיות, והצהרות חריגות של פוליטיקאים ומשפיעי דעת קהל. הגדירו ספי קנייה ומכירה חכמים לקבלת הערכה ריאלית של ההון שלכם ובחנו כיצד אסטרטגיית הגידור תעמוד מול הדוחות!
            </p>
          </div>
          <button
            onClick={applyRecommendedAlarms}
            className="px-4 py-2.5 rounded-xl bg-blue-600 font-extrabold text-xs text-white flex items-center gap-2 hover:bg-blue-500 transition-all self-start lg:self-center shadow-lg active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white" />
            החל ספים חכמים מבוססי שוק
          </button>
        </div>
      </div>

      {/* Mode Switch Selector (Redesigned - Flat high contrast, no glowing box shadows) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
        <button
          onClick={() => {
            setSimMode("realtime");
            setIsSimulating(false);
            showToast("עברנו למצב מסחר בזמן אמת! המערכת עוקבת ברגע זה אחר שערי השוק הנוכחיים ומבצעת פקודות בהתאם.", true);
          }}
          className={`p-5 rounded-3xl border text-right transition-all flex items-start gap-4 active:scale-[0.99] group cursor-pointer ${
            simMode === "realtime" 
              ? "bg-slate-900 border-2 border-blue-500 text-white font-black shadow-none" 
              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          <div className={`p-3 rounded-2xl ${simMode === "realtime" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 group-hover:text-slate-200"}`}>
            <Activity className={`w-5 h-5 ${simMode === "realtime" ? "animate-pulse" : ""}`} />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-black block text-white">
              📈 שלב 2+3: מעקב ומסחר בזמן אמת (חי מעכשיו ואילך)
            </span>
            <span className="text-[10.5px] text-slate-350 block leading-relaxed font-bold">
              המערכת דוגמת את שערי השוק מהיום והלאה, מפעילה התראות חכמות, ומאפשרת ביצוע פקודות ידני או אוטומטי (אלגו-טריידינג).
            </span>
          </div>
        </button>

        <button
          onClick={() => {
            setSimMode("accelerated");
            setIsSimulating(false);
            showToast("עברנו למצב סימולציה מואצת ל-60 יום! לחצו 'הרץ סימולציה' כדי לראות בדיקה תוך שניות.", true);
          }}
          className={`p-5 rounded-3xl border text-right transition-all flex items-start gap-4 active:scale-[0.99] group cursor-pointer ${
            simMode === "accelerated" 
              ? "bg-slate-900 border-2 border-blue-500 text-white font-black shadow-none" 
              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          <div className={`p-3 rounded-2xl ${simMode === "accelerated" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 group-hover:text-slate-200"}`}>
            <Cpu className={`w-5 h-5 ${isSimulating ? "animate-spin" : ""}`} />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-black block text-white">
              ⚡ בקטסט מואץ ל-60 ימים (בניית היסטוריית למידה אדפטיבית)
            </span>
            <span className="text-[10.5px] text-slate-350 block leading-relaxed font-bold">
              מריצה את 60 ימי המסחר הבאים במהירות תוך שניות כדי לבחון הערכות מאקרו, תשואת תיק, והתאמת רווח אופטימלית להון המושקע.
            </span>
          </div>
        </button>
      </div>

      {/* 3-Phase Sandbox & Free Server Connector HUD for Real-time Mode */}
      {simMode === "realtime" && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 text-right" dir="rtl" id="three_phase_realtime_hud">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-white">🎛️ לוח בקרה שלבי ומחבר לשרת חינמי (נתוני אמת ארה״ב)</h3>
              <p className="text-[11px] text-slate-300 font-bold mt-1">
                תוכל לבחור בלחיצת כפתור בין שלושת שלבי הפעילות: התראות חכמות, מסחר דמו ידני, או אלגו-טריידינג אוטומטי מלא.
              </p>
            </div>
            
            {/* Live Feed Toggle Hook */}
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${isLiveFeedOn ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              <div className="text-right">
                <span className="text-xs font-black text-white block">📡 חיבור לשרת אמת חינמי:</span>
                <span className="text-[10px] text-slate-400 block font-bold">
                  {isLiveFeedOn ? "מחובר לשערי Nasdaq/Yahoo Finance חיים" : "מקומי (פועל על סימולציית תיק מותאמת)"}
                </span>
              </div>
              <button
                onClick={toggleLiveFeed}
                className={`mr-4 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer ${
                  isLiveFeedOn 
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" 
                    : "bg-slate-800 hover:bg-slate-750 text-white border border-slate-700"
                }`}
              >
                {isLiveFeedOn ? "מחובר (שחרר)" : "חבר לשרת חינמי 🛜"}
              </button>
            </div>
          </div>

          {/* Three Phases Interactive Tab Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phase 1 */}
            <button
              onClick={() => {
                setRealtimePhase("alerts");
                showToast("עברנו לשלב 1: התראות חכמות בלבד! המערכת תספק צליל וחיווי על מסכים אך ללא פעילות תיק.", true);
              }}
              className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                realtimePhase === "alerts"
                  ? "bg-blue-950/60 border-2 border-blue-500 text-white font-extrabold"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${realtimePhase === "alerts" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}>שלב 1</span>
                <span className="text-xs font-black text-white">התראות חכמות בזמן אמת 🔔</span>
              </div>
              <span className="text-[10.5px] text-slate-300 font-medium leading-relaxed">
                המערכת מדווחת אקוסטית וויזואלית על הגעה לספים בלבד. נהדר עבור סוחרים עצמאיים!
              </span>
            </button>

            {/* Phase 2 */}
            <button
              onClick={() => {
                setRealtimePhase("paper");
                showToast("עברנו לשלב 2: מסחר קליק ידני דמו! יופיעו כפתורי קנייה ומכירה ליד כל התראה שהופעלה.", true);
              }}
              className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                realtimePhase === "paper"
                  ? "bg-blue-950/60 border-2 border-blue-500 text-white font-extrabold"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${realtimePhase === "paper" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}>שלב 2</span>
                <span className="text-xs font-black text-white">מסחר דמו ידני בקליק 🛒</span>
              </div>
              <span className="text-[10.5px] text-slate-300 font-medium leading-relaxed">
                קבלו התראות מיידיות, ובצעו החלטה ידנית בקליק מהיר של קנייה או מכירה של מניות המעקב שלכם.
              </span>
            </button>

            {/* Phase 3 */}
            <button
              onClick={() => {
                setRealtimePhase("algo");
                showToast("עברנו לשלב 3: אלגו-טריידינג בוט אוטומטי! הרובוט יבצע פקודות בשבריר שנייה על חשבון הדמו שלכם.", true);
              }}
              className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                realtimePhase === "algo"
                  ? "bg-blue-950/60 border-2 border-blue-500 text-white font-extrabold"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${realtimePhase === "algo" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}>שלב 3</span>
                <span className="text-xs font-black text-white">בוט אלגו-טריידינג אוטומטי ⚡</span>
              </div>
              <span className="text-[10.5px] text-slate-300 font-medium leading-relaxed">
                מצב אוטונומי לחלוטין! הבוט מנתח את השערים וקונה/מוכר עצמאית לחלוטין ברגע שהתנאים מתקיימים.
              </span>
            </button>
          </div>

          {/* List of active alerts with manual action buttons for Phase 2 */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              לוח פקודות והתראות חכמות שהופעלו (זמן אמת):
            </h4>
            
            {triggeredAlerts.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-medium italic">לא נרשמו התראות עד כה במחזור המעקב החי הנוכחי. הפעל/שנה ספים מטה כדי לצפות בביצועים...</p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2.5 pr-2 divide-y divide-slate-900">
                {triggeredAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between pt-2.5 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${alert.type === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                          {alert.type === "BUY" ? "התראת קנייה BUY" : "התראת מכירה SELL"}
                        </span>
                        <strong className="text-white font-extrabold text-xs">{alert.ticker}</strong>
                        <span className="text-slate-400 text-[10px] font-mono font-bold">{new Date(alert.timestamp).toLocaleTimeString("he-IL")}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-300 font-bold">
                        מחיר נוכחי: <strong className="text-white font-mono font-extrabold">${alert.price}</strong> | סף מוגדר: <span className="text-slate-400 font-mono font-bold">${alert.limit}</span>
                      </p>
                    </div>

                    {/* Action buttons or status */}
                    <div className="mr-4">
                      {realtimePhase === "alerts" && (
                        <span className="text-[10.5px] text-slate-200 font-bold bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">🔔 התראה חכמה שוגרה בהצלחה</span>
                      )}
                      
                      {realtimePhase === "paper" && (
                        alert.isManualExecuted ? (
                          <span className="px-3 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-900 text-[10.5px] font-extrabold flex items-center gap-1.5 animate-fade-in">
                            <Check className="w-3.5 h-3.5" /> עסקה הושלמה
                          </span>
                        ) : (
                          <button
                            onClick={() => executeManualTrade(alert.id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10.5px] px-3.5 py-1.5 rounded-xl cursor-pointer shadow-md active:scale-95 transition-all text-center"
                          >
                            {alert.type === "BUY" ? "🛒 שגר קנייה ידני דמו" : "💰 שגר מכירה ידני דמו"}
                          </button>
                        )
                      )}

                      {realtimePhase === "algo" && (
                        <span className="px-3 py-1.5 rounded bg-blue-950/60 text-blue-300 border border-blue-900 text-[10.5px] font-extrabold flex items-center gap-1">
                          ⚡ בוצע אוטומטית ע״י הבוט (שלב 3)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}



      {/* Setup configuration & Simulation State panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" dir="rtl">
        
        {/* Left side: Setup configurations forms (7 cols, swaps to bottom full-width in accelerated mode) */}
        <div className={`lg:col-span-12 space-y-6 ${
          simMode === "accelerated" ? "xl:col-span-12 order-last" : "xl:col-span-7"
        }`}>
          
          {/* Quick interactive guide for starting out */}
          <div className="p-5 rounded-3xl bg-[#06b6d4]/5 border border-[#06b6d4]/15 text-right space-y-3" id="sim_quick_onboard_guide">
            <div className="flex items-center gap-2 text-[#06b6d4] font-bold text-xs">
              <span className="p-1 rounded-lg bg-[#06b6d4]/10 text-cyan-400">💡</span>
              מדריך קצר למערכת: כיצד לעדכן תקציב ולבחור מניות למעקב?
            </div>
            
            <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
              <p>
                במיוחד עבורך, עיצבנו מחדש את לוח השליטה והמעקב של הסימולטור. כעת תוכל לבצע התאמות בשני שלבים פשוטים:
              </p>
              <ul className="list-disc pr-4 space-y-1.5 text-slate-300">
                <li>
                  <strong className="text-cyan-400">מאיפה מגדירים את הון הפתיחה במערכת?</strong> בסעיף 1 הבא (🏦 <strong className="text-white">לוח תקציב והגדרות אלגוריתם</strong>), באפשרותך לרשום כל סכום מזומן שתרצה, או פשוט ללחוץ על אחד מכפתורי הקידוד המהירים (כמו <span className="font-mono text-cyan-400 font-bold">$15,000</span> או <span className="font-mono text-cyan-400 font-bold">$50,050</span>) כדי להגדירו מיידית כהון ההתחלתי.
                </li>
                <li>
                  <strong className="text-cyan-400">איך בונים רשימת מעקב ייעודית (Watchlist)?</strong> בסעיף 2 הבא, תוכל להפעיל/לנטרל מניות באמצעות תיבת הסימון המעוצבת. השתמש בלחצנים המהירים למעלה: <strong className="text-white">"בחר הכל"</strong>, <strong className="text-white">"נקה הכל"</strong> או סינון לפי <strong className="text-white">"ענקיות טכנולוגיה"</strong> על מנת לייצר רשימת מעקב תוך שנייה אחת!
                </li>
              </ul>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border ${theme.card} space-y-6 text-right`}>
            
            {/* 1. Global Budget & Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800/50 pb-3">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold leading-none ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
                    1. סביבת תקציב והגדרות יסוד של האלגוריתם
                  </h3>
                  <span className="text-[9.5px] text-slate-500 block mt-1">קבע את הון ההשקעה ההתחלתי לתיק ועמלות המסחר</span>
                </div>
              </div>

              {/* Enhanced Interactive Capital Presets */}
              <div className="p-4 rounded-2xl bg-black/20 border border-slate-800/30 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-300 block">🏦 הון התחלתי פותח לעסקאות ($) - איפה מגדירים את הכסף:</label>
                    <span className="text-[10px] text-slate-500 block">סכום המזומן הזמין לביצוע פקודות Paper-Trading בהפעלה</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input 
                        type="number" 
                        value={startingCapital} 
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 1000;
                          setStartingCapital(v);
                          if (dayIndex === 0) setCash(v);
                        }}
                        disabled={dayIndex > 0}
                        className={`w-36 text-sm font-mono font-black p-2.5 rounded-xl border ${theme.input} disabled:opacity-40 text-left`} 
                      />
                      <span className="absolute top-3 left-2 text-xs text-slate-500 font-mono">$</span>
                    </div>
                  </div>
                </div>

                {/* Capital preset chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-850/35" dir="rtl">
                  <span className="text-[9.5px] font-medium text-slate-400 ml-1">בחר סכום התחלתי בקליק:</span>
                  {[2500, 5000, 15000, 50000, 100000].map((capValue) => (
                    <button
                      key={capValue}
                      disabled={dayIndex > 0}
                      type="button"
                      onClick={() => {
                        setStartingCapital(capValue);
                        if (dayIndex === 0) setCash(capValue);
                        showToast(`הון הפתיחה הועמד על $${capValue.toLocaleString()} בהצלחה!`, true);
                      }}
                      className={`px-3 py-1 rounded-lg text-[10.5px] font-mono font-bold transition-all cursor-pointer disabled:opacity-20 ${
                        startingCapital === capValue 
                          ? "bg-cyan-500 text-slate-950 shadow-[0_2px_8px_rgba(6,182,212,0.3)] scale-[1.03]" 
                          : "bg-slate-800 hover:bg-slate-750 text-slate-300"
                      }`}
                    >
                      ${capValue.toLocaleString()}
                    </button>
                  ))}
                  {dayIndex > 0 && (
                    <span className="text-[9px] text-rose-500 font-bold block mr-auto">
                      ⚠️ הסימולציה כבר התחילה! לא ניתן לשנות תקציב פתיחה כרגע.
                    </span>
                  )}
                </div>
              </div>

              {/* Other core config fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">📦 גודל מגרש קנייה/מכירה</label>
                  <input 
                    type="number" 
                    value={tradeSharesCount} 
                    onChange={(e) => setTradeSharesCount(parseInt(e.target.value) || 1)}
                    min="1"
                    className={`w-full text-xs font-mono font-bold p-2.5 rounded-xl border ${theme.input} text-left`} 
                  />
                  <span className="text-[9px] text-slate-500 block mt-1">כמות המניות לרכישה בכל איתות</span>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">💸 עמלת ברוקר לעסקה ($)</label>
                  <input 
                    type="number" 
                    value={brokerCommission} 
                    onChange={(e) => setBrokerCommission(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.5"
                    className={`w-full text-xs font-mono font-bold p-2.5 rounded-xl border ${theme.input} text-left`} 
                  />
                  <span className="text-[9px] text-slate-500 block mt-1">עלות קבועה לכל פעולת קנייה/מימוש</span>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">⏱️ מהירות צעד סימולטור</label>
                  <select 
                    value={simSpeed} 
                    onChange={(e) => setSimSpeed(parseInt(e.target.value))}
                    className={`w-full text-xs font-sans font-bold p-2.5 rounded-xl border ${theme.input}`}
                  >
                    <option value={1000}>רגוע (שנייה ליום)</option>
                    <option value={350}>קצבי (0.35 שניות ליום)</option>
                    <option value={80}>טורבו מואץ (0.08 שניות ליום)</option>
                  </select>
                  <span className="text-[9px] text-slate-500 block mt-1">זמן ההרצה בין ימי מסחר עוקבים</span>
                </div>
              </div>

              {/* AI Self-Learning Thresholds Optimization */}
              <div className={`p-4 rounded-2xl border transition-all ${isAdaptiveLimitsEnabled ? "bg-[#06b6d4]/10 border-[#06b6d4]/35" : "bg-black/20 border-slate-800/40"} space-y-4`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 lg:max-w-[70%] text-right">
                    <span className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                      מצב התאמת ספים אדפטיבית מבוסס בינה מלאכותית (AI Active Calibration Mode)
                    </span>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed">
                      במקום סף שרירותי קבוע (כמו 5%), האלגוריתם מנתח מדי 5 ימי מסחר את המגמה (Trend) ותנודתיות השעירים (Volatility) של כל מנייה בסימולציה, ומרווח/מצמצם את יעדי הקנייה והמכירה כדי שיתאימו בצורה ריאלית ורווחית לתנאי השוק המשתנים!
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 mr-auto self-start lg:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdaptiveLimitsEnabled(!isAdaptiveLimitsEnabled);
                        showToast(isAdaptiveLimitsEnabled ? "מצב התאמת ספים אדפטיבית בוטל. חזרנו לסוגי ספים קבועים." : "מצב התאמת ספים אדפטיבית הופעל! המערכת תסרוק את תנועת השוק ותעדכן ספים אופטימליים באופן אוטומטי.", true);
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
                        isAdaptiveLimitsEnabled 
                          ? "bg-cyan-500 text-slate-950 shadow-[0_4px_12px_rgba(6,182,212,0.3)] hover:bg-cyan-400" 
                          : "bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60"
                      }`}
                    >
                      <span>{isAdaptiveLimitsEnabled ? "🟢 למידה עצמית: פעיל" : "⚪ למידה עצמית: כבוי"}</span>
                    </button>
                  </div>
                </div>

                {/* Micro log representation if active and has entries */}
                {isAdaptiveLimitsEnabled && (
                  <div className="mt-2 pt-3 border-t border-slate-800/35 text-right space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] text-slate-400 font-extrabold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                        עדכוני ספים אחרונים ממערכת הלמידה האדפטיבית בפעולה:
                      </span>
                      {adaptiveLogs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAdaptiveLogs([])}
                          className="text-[9px] text-rose-400 hover:underline"
                        >
                          נקה יומן למידה
                        </button>
                      )}
                    </div>
                    
                    {adaptiveLogs.length === 0 ? (
                      <p className="text-[9.5px] text-slate-500 italic">המתינו להרצת הסימולציה. כל 5 ימי מסחר המערכת תבצע למידה עצמית ותעדכן ספים ריאליים.</p>
                    ) : (
                      <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: "thin" }}>
                        {adaptiveLogs.slice(0, 4).map((log, idx) => (
                          <div key={idx} className="bg-slate-900/50 p-2 rounded-lg border border-slate-850/45 text-[9.5px] flex flex-col md:flex-row md:items-center justify-between gap-2 leading-tight">
                            <div className="space-y-0.5">
                              <span className="text-cyan-400 font-bold ml-1.5 font-mono">[{log.ticker}]</span>
                              <span className="text-slate-300">{log.message}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[9px] text-slate-400 mr-auto">
                              <span>יום {log.dayIndex}</span>
                              <span className="text-slate-700">|</span>
                              <span>קניה: <span className="text-slate-500 line-through">${log.oldBuy}</span> ← <span className="text-emerald-400 font-bold">${log.newBuy}</span></span>
                              <span className="text-slate-700">|</span>
                              <span>מכירה: <span className="text-slate-500 line-through">${log.oldSell}</span> ← <span className="text-rose-400 font-bold">${log.newSell}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Custom Watchlist Selection */}
            <div className="space-y-4 border-t border-slate-800/40 pt-5">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 border-b border-slate-800/50 pb-3" id="watchlist_selection_control_header">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold leading-none ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
                      2. הגדרת רשימת המעקב הייעודית (Watchlist Designer)
                    </h3>
                    <span className="text-[9.5px] text-slate-500 block mt-1">בחר אילו מניות האלגוריתם יסרוק ויבצע בהן עסקאות</span>
                  </div>
                </div>

                {/* Watchlist presets controller */}
                <div className="flex items-center gap-1.5 self-start flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setStockConfigs(prev => prev.map(s => {
                        const approxBuy = parseFloat((s.initialPrice * 0.95).toFixed(2));
                        const approxSell = parseFloat((s.initialPrice * 1.05).toFixed(2));
                        return {
                          ...s,
                          enabled: true,
                          buyLimit: approxBuy,
                          sellLimit: approxSell
                        };
                      }));
                      showToast("כל מניות הרשת סומנו והוגדרו להן ספי קנייה ומכירה חכמים של 5%!", true);
                    }}
                    className="px-2.5 py-1 text-[9.5px] font-sans font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    בחר הכל והגדר ספי קנייה ומכירה חכמים 👍
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockConfigs(prev => prev.map(s => ({ ...s, enabled: false, buyLimit: 0, sellLimit: 0 })));
                      showToast("רשימת המעקב והספים נוקו לחלוטין!", true);
                    }}
                    className="px-2 py-1 text-[9.5px] font-sans font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    נקה הכל ❌
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockConfigs(prev => prev.map(s => {
                        const isTech = ["AAPL", "NVDA", "MSFT", "GOOGL"].includes(s.ticker);
                        const approxBuy = parseFloat((s.initialPrice * 0.95).toFixed(2));
                        const approxSell = parseFloat((s.initialPrice * 1.05).toFixed(2));
                        return {
                          ...s,
                          enabled: isTech,
                          buyLimit: isTech ? approxBuy : s.buyLimit,
                          sellLimit: isTech ? approxSell : s.sellLimit
                        };
                      }));
                      showToast("מניות טכנולוגיה סומנו והוגדרו להן ספי קנייה ומכירה של 5%!", true);
                    }}
                    className="px-2 py-1 text-[9.5px] font-sans font-bold bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/40 text-cyan-400 rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    טכנולוגיה בלבד 💻
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockConfigs(prev => prev.map(s => {
                        const isRetail = ["AMZN", "META"].includes(s.ticker);
                        const approxBuy = parseFloat((s.initialPrice * 0.95).toFixed(2));
                        const approxSell = parseFloat((s.initialPrice * 1.05).toFixed(2));
                        return {
                          ...s,
                          enabled: isRetail,
                          buyLimit: isRetail ? approxBuy : s.buyLimit,
                          sellLimit: isRetail ? approxSell : s.sellLimit
                        };
                      }));
                      showToast("מדיה וצריכה סומנו והוגדרו להן ספי קנייה ומכירה של 5%!", true);
                    }}
                    className="px-2 py-1 text-[9.5px] font-sans font-bold bg-purple-950 hover:bg-purple-900 border border-purple-800/45 text-purple-400 rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    צריכה ומדיה 📱
                  </button>
                </div>
              </div>

              {/* Stocks list with inputs */}
              <div className="space-y-2.5">
                {stockConfigs.map(cfg => {
                  const liveStockPrice = stocks?.find(s => s.ticker === cfg.ticker)?.currentPrice || cfg.initialPrice;
                  const todayPrice = simMode === "realtime" ? liveStockPrice : (timelinePrices[dayIndex]?.[cfg.ticker] || cfg.initialPrice);
                  const isPricesMatching = (cfg.buyLimit && todayPrice <= cfg.buyLimit) || (cfg.sellLimit && todayPrice >= cfg.sellLimit);

                  return (
                    <div 
                      key={cfg.ticker}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4
                        ${cfg.enabled 
                          ? `${theme.subCard} border-cyan-500/30 ring-1 ring-cyan-500/5 shadow-[0_2px_8px_rgba(6,182,212,0.03)]` 
                          : "opacity-45 bg-slate-900/40 border-transparent hover:opacity-75"
                        }
                      `}
                    >
                      {/* Name / Checkbox / Status */}
                      <div className="flex items-center gap-3.5 justify-start min-w-[210px]">
                        <div 
                          onClick={() => {
                            handleToggleStock(cfg.ticker);
                            showToast(`${cfg.ticker} ${!cfg.enabled ? "נוספה לרשימת" : "הוסרה מרשימת"} המעקב`, true);
                          }}
                          className="cursor-pointer select-none shrink-0"
                        >
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            cfg.enabled ? "bg-cyan-500 border-cyan-500 text-slate-950" : "border-slate-700 hover:border-slate-600 bg-slate-900"
                          }`}>
                            {cfg.enabled && <Check className="w-3.5 h-3.5 stroke-[4]" />}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded ${theme.badgeBg}`}>
                              {cfg.ticker}
                            </span>
                            <span className={`text-xs font-bold leading-none ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
                              {cfg.name}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-slate-500">מחיר פתיחה: ${cfg.initialPrice}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.enabled ? "bg-emerald-400" : "bg-slate-700"}`} />
                            <span className="text-[9.5px] font-sans text-slate-400">
                              {cfg.enabled ? "במעקב פעיל" : "לא מופעל בסימולטור"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Simulator live gauge */}
                      <div className="flex items-center gap-4 bg-black/25 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
                        <div className="text-right">
                          <span className="text-[9px] text-slate-500 block leading-tight">שער נוכחי בהדמיה</span>
                          <span className={`text-xs font-mono font-bold ${
                            isPricesMatching ? "text-cyan-400 animate-pulse font-black" : `${themeVal >= 70 ? "text-slate-800" : "text-slate-205"}`
                          }`}>
                            ${todayPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Custom pricing threshold alarm controllers */}
                      <div className="flex items-center gap-3 bg-black/15 p-2 rounded-xl border border-slate-800/10">
                        <div className="w-28 relative">
                          <span className="text-[9.5px] text-emerald-400 font-bold block mb-0.5">קנה ב- (BUY) ≤</span>
                          <div className="relative">
                            <input 
                              type="number"
                              value={cfg.buyLimit || ""}
                              onChange={(e) => handleLimitChange(cfg.ticker, "buyLimit", parseFloat(e.target.value) || 0)}
                              disabled={!cfg.enabled}
                              step="0.1"
                              className={`w-full text-xs font-mono font-bold p-1.5 pl-4 rounded-lg border ${theme.input} text-center`}
                              placeholder="סף קנייה"
                            />
                            <span className="absolute top-2 left-2 text-[10px] text-slate-500">$</span>
                          </div>
                        </div>

                        <div className="w-28 relative">
                          <span className="text-[9.5px] text-rose-400 font-bold block mb-0.5">מכור ב- (SELL) ≥</span>
                          <div className="relative">
                            <input 
                              type="number"
                              value={cfg.sellLimit || ""}
                              onChange={(e) => handleLimitChange(cfg.ticker, "sellLimit", parseFloat(e.target.value) || 0)}
                              disabled={!cfg.enabled}
                              step="0.1"
                              className={`w-full text-xs font-mono font-bold p-1.5 pl-4 rounded-lg border ${theme.input} text-center`}
                              placeholder="סף רווח"
                            />
                            <span className="absolute top-2 left-2 text-[10px] text-slate-500">$</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
        <div className={`lg:col-span-12 text-right space-y-6 ${
          simMode === "accelerated" ? "xl:col-span-12 order-first" : "xl:col-span-5"
        }`}>
          {simMode === "accelerated" ? (
            <div className={`p-6 rounded-3xl border ${theme.card} space-y-6 flex flex-col justify-between h-full`}>
              
              {/* Top Banner: Wide Header with Title & Simulation Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800/80 pb-4 gap-4">
                <div>
                  <span className="text-xs text-cyan-400 font-extrabold block tracking-wide font-sans">
                    ⚡ מסך סימולציה מואצת - בקטסט ל-60 ימי מסחר
                  </span>
                  <h2 className="text-xl font-black text-white flex items-center gap-2 mt-1">
                    <Calendar className="w-5.5 h-5.5 text-cyan-500 animate-pulse" />
                    יום בהדמיה: <span className="text-cyan-400 font-black text-2xl">{dayIndex + 1}</span> מתוך 60
                  </h2>
                  <span className="text-xs text-slate-205 mt-1 block">
                    שערים מעודכנים לתאריך יעד: <strong className="text-cyan-300 font-mono text-sm">{getOffsetDateString(dayIndex)}</strong>
                  </span>
                </div>

                {/* Simulation controls buttons inline at top right */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-900 select-none">
                  {isSimulating ? (
                    <button
                      type="button"
                      onClick={() => setIsSimulating(false)}
                      className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-450 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      השהה הרצה
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSimulating(true)}
                      disabled={dayIndex >= 59}
                      className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {dayIndex === 0 ? "הרץ סימולציה" : "המשך הרצה"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleReset}
                    className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-755 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    אפס סימולציה
                  </button>

                  <div className="bg-slate-905 rounded-lg px-2 py-1 text-center font-mono text-[9px] border border-slate-800">
                    <span className="text-slate-400 block leading-none">קצב:</span>
                    <strong className="text-slate-200">{simSpeed}ms</strong>
                  </div>
                </div>
              </div>

              {/* 4 Large Stats Cards: Large, bold, bright white texts. Highly legible! */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Card 1: סה"כ שווי הון התיק (מזומן + נכסים) */}
                <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-950/45 relative overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 right-0 w-1 bg-gradient-to-b from-cyan-500 to-emerald-500 h-full" />
                  <div>
                    <span className="text-xs text-slate-200 block font-black leading-none mb-1">🏦 סה"כ שווי תיק ההשקעות (הון)</span>
                    <p className="text-[10px] text-slate-300 mb-2 leading-tight">יתרת מזומן פנויה וסך שווי מניות מוחזקות יחד.</p>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2.5xl font-black font-mono text-white tracking-tight">${metrics.totalEquity.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                    <span className={`text-xs font-black font-sans px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${
                      metrics.netProfit >= 0 ? "bg-emerald-950/60 border border-emerald-500/20 text-emerald-400" : "bg-rose-950/60 border border-rose-500/20 text-rose-400"
                    }`}>
                      {metrics.netProfit >= 0 ? "+" : ""}{metrics.pctChange.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Card 2: רווח או הפסד נקי מצטבר */}
                <div className={`p-4 rounded-2xl border relative overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg ${
                  metrics.netProfit >= 0 ? "border-emerald-500/30 bg-emerald-950/20" : "border-rose-500/30 bg-rose-950/20"
                }`}>
                  <div className={`absolute top-0 right-0 w-1 h-full ${metrics.netProfit >= 0 ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <div>
                    <span className="text-xs text-slate-200 block font-black leading-none mb-1">⇅ רווח והפסד נקי מצטבר</span>
                    <p className="text-[10px] text-slate-300 mb-2 leading-tight">הרווח או ההפסד ההוני שנצבר לרשותך מתחילת המסחר.</p>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-2.5xl font-black font-mono tracking-tight ${metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {metrics.netProfit >= 0 ? "+" : ""}${metrics.netProfit.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-black ${
                      metrics.netProfit >= 0 ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                    }`}>
                      {metrics.netProfit >= 0 ? "ברווח נקי" : "בהפסד הון"}
                    </span>
                  </div>
                </div>

                {/* Card 3: יתרת מזומן פנויה (עו"ש) */}
                <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-950/45 relative overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 right-0 w-1 bg-amber-500 h-full" />
                  <div>
                    <span className="text-xs text-slate-200 block font-black leading-none mb-1">💵 יתרת מזומן פנויה בקופה (עו"ש)</span>
                    <p className="text-[10px] text-slate-300 mb-2 leading-tight">נזילות זמינה לפקודות קנייה אוטומטיות.</p>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2.5xl font-black font-mono text-white tracking-tight">${metrics.cash.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                    <span className="text-[10.5px] text-[#06b6d4] font-black italic">הון לפעולות</span>
                  </div>
                </div>

                {/* Card 4: שווי מניות מוחזקות בסל */}
                <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-950/45 relative overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg">
                  <div className="absolute top-0 right-0 w-1 bg-cyan-500 h-full" />
                  <div>
                    <span className="text-xs text-slate-200 block font-black leading-none mb-1">📦 שווי מניות מוחזקות</span>
                    <p className="text-[10px] text-slate-300 mb-2 leading-tight">סך שווי הנכסים המוגזמים והמחזיקים כעת בתיק.</p>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2.5xl font-black font-mono text-cyan-400 tracking-tight">${metrics.portfolioVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                    <span className="text-[10.5px] text-slate-400 font-bold">לפי שער נוכחי</span>
                  </div>
                </div>

              </div>

              {/* Lower Section: Chart occupies left 8cols, details and holdings occupies right 4cols */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full pt-2">
                
                {/* 1. Performance Live Area Chart (8 cols) */}
                <div className="lg:col-span-8 h-64 bg-slate-950/70 rounded-3xl border border-slate-900/90 p-4 relative flex flex-col justify-between shadow-inner">
                  <span className="absolute top-3 right-4 text-xs text-slate-200 font-extrabold uppercase tracking-wide">
                    📈 גרף ביצועים מואץ - אקוויטי מצטבר לאורך ימי המסחר (60 יום)
                  </span>
                  {metrics.equityHistory.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                      אין עדיין מספיק נתונים להציג בגרף
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="90%" className="mt-4">
                      <AreaChart
                        data={metrics.equityHistory.map((val, index) => ({ day: index + 1, value: val }))}
                        margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorEquityAcc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="day" 
                          stroke="#94a3b8" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #1e293b',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#f8fafc',
                            direction: 'rtl'
                          }}
                          labelFormatter={(label) => `יום ${label}`}
                          formatter={(value: any) => [`$${parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}`, 'הון עצמי']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#06b6d4" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#colorEquityAcc)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* 2. Detail Holdings Log Cards (4 cols) */}
                <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                  
                  {/* Holdings badged list */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex-1 space-y-3 shadow-inner">
                    <span className="text-xs text-cyan-400 font-extrabold block">📦 מניות שנרכשו ונמצאות כרגע בתיק:</span>
                    {Object.keys(metrics.holdings).length === 0 ? (
                      <span className="text-xs text-slate-400 block italic">התיק נקי ממניות כעת. כל המשאב נמצא בעו"ש.</span>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                        {Object.keys(metrics.holdings).map(ticker => {
                          const hold = metrics.holdings[ticker];
                          return (
                            <div key={ticker} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              <span className="text-xs text-white font-mono font-black">{ticker}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-300">מוחזק:</span>
                                <span className="text-xs font-black text-white bg-cyan-950 border border-cyan-850 px-2 py-0.5 rounded-md">{hold.shares} יח׳</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Daily profit delta */}
                  {(() => {
                    const hist = metrics.equityHistory || [];
                    let dailyChangeUSD = 0;
                    let dailyChangePercent = 0;
                    if (hist.length > 1) {
                      const lastVal = hist[hist.length - 1];
                      const prevVal = hist[hist.length - 2];
                      dailyChangeUSD = lastVal - prevVal;
                      dailyChangePercent = prevVal > 0 ? (dailyChangeUSD / prevVal) * 100 : 0;
                    }
                    return (
                      <div className={`p-4 rounded-2xl border transition-all duration-300 shadow-md ${
                        dailyChangeUSD >= 0 
                          ? "bg-slate-950/80 border-emerald-500/30" 
                          : "bg-slate-950/80 border-rose-500/30"
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-300 block font-bold leading-none">⇅ תנועה יומית אחרונה:</span>
                          <span className={`text-xs font-black font-sans px-2 py-0.5 rounded-md inline-flex items-center ${
                            dailyChangeUSD >= 0 ? "bg-emerald-950/60 text-emerald-400" : "bg-rose-950/60 text-rose-400"
                          }`}>
                            {dailyChangeUSD >= 0 ? "+" : ""}{dailyChangePercent.toFixed(2)}%
                          </span>
                        </div>
                        <p className={`text-xl font-black font-mono tracking-tight mt-1.5 text-right ${
                          dailyChangeUSD >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`} dir="ltr">
                          {dailyChangeUSD >= 0 ? "+" : ""}${dailyChangeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })()}

                </div>

              </div>

            </div>
          ) : (
            // REALTIME PAPER TRADING SENSITIVE HUD (Original layout style)
            <div className={`p-6 rounded-3xl border ${theme.card} space-y-4 flex flex-col justify-between h-full`}>
              
              {/* Timeline Progress row Header */}
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    מעקב רציף (בזמן אמת מאקו-סיסטם)
                  </span>
                  <span className="text-sm font-extrabold text-[#06b6d4] flex items-center gap-1.5 mt-1">
                    <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                    מצב: <strong className="text-emerald-400 animate-pulse font-sans">מעקב חי ופעיל</strong>
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-bold block mt-0.5">
                    תאריך ושעה נוכחיים: {new Date().toLocaleDateString("he-IL")} {new Date().toLocaleTimeString("he-IL")}
                  </span>
                </div>

                {/* Glowing Indicator */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-900 select-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-bold">מעקב שוטף ורגיש</span>
                </div>
              </div>

              {/* General progress bar */}
              <div className="w-full bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80 space-y-3 relative overflow-hidden" dir="rtl">
                <div className="absolute -top-12 -left-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    התקדמות סימולציה מתוכננת
                  </span>
                  <span className="font-mono text-cyan-400 font-black text-xs leading-none">בזמן-אמת (100%)</span>
                </div>

                <div className="w-full bg-slate-950 p-1 rounded-xl border border-slate-800/60 shadow-inner">
                  <div className="w-full bg-slate-900 h-4 rounded-lg overflow-hidden relative flex items-center">
                    <div className="bg-gradient-to-l from-emerald-500 to-teal-400 h-full w-full animate-pulse rounded-md" />
                  </div>
                </div>

                <div className="pt-1 text-[9px] text-slate-500 border-t border-slate-800/40 leading-relaxed font-sans select-none">
                  💡 <strong>מצב זמן אמת:</strong> המערכת קולטת שערי פעימה חיים ורציפים. מצב זה אינו מותנה בטווח 60 הימים המואצים ומאפשר בדיקת אלארמים בזמן-אמת.
                </div>
              </div>

              {/* Core financial logs */}
              <div className="grid grid-cols-2 gap-3" dir="rtl">
                <div className="p-3 rounded-xl bg-black/20 border border-slate-800/20 text-right">
                  <span className="text-[9px] text-slate-300 block font-sans">💵 יתרת מזומן פנויה (עו"ש)</span>
                  <span className="text-sm font-mono font-black text-slate-100">${metrics.cash.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 border border-slate-800/20 text-right">
                  <span className="text-[9px] text-slate-300 block font-sans">📦 שווי מניות מוחזקות</span>
                  <span className="text-sm font-mono font-black text-slate-100">${metrics.portfolioVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </div>
              </div>

              {/* Detail assets list inside active HUD */}
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-900/85 text-right space-y-1.5" dir="rtl">
                <span className="text-[8.5px] text-slate-350 font-bold block">📦 פירוט המניות שנרכשו כעת בתיק:</span>
                {Object.keys(metrics.holdings).length === 0 ? (
                  <span className="text-[10px] text-slate-500 block italic font-sans pr-1">רק מזומן עו"ש פנוי. אין עדיין מניות מוחזקות.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.keys(metrics.holdings).map(ticker => {
                      const hold = metrics.holdings[ticker];
                      return (
                        <span key={ticker} className="inline-flex items-center gap-1 bg-cyan-950/60 border border-cyan-800/30 px-2 py-0.5 rounded-lg text-[10px] text-cyan-400 font-extrabold font-mono transition-all hover:border-cyan-500/25">
                          <span>{ticker}</span>
                          <span className="text-slate-605 font-[8.5px]">•</span>
                          <span className="text-white bg-slate-900 border border-slate-850 px-1 rounded-sm text-[9.5px] font-sans">{hold.shares} יח׳</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Main Total Equity widget */}
              <div className={`p-4 rounded-xl transition-all duration-300 flex justify-between items-center border ${
                metrics.netProfit >= 0 
                  ? "bg-gradient-to-tr from-cyan-950/20 via-slate-950/40 to-emerald-950/20 border-emerald-500/20 shadow-sm shadow-emerald-500/5" 
                  : "bg-gradient-to-tr from-cyan-950/20 via-slate-950/40 to-rose-950/25 border-rose-500/20 shadow-sm shadow-rose-500/5"
              }`} dir="rtl">
                <div>
                  <span className="text-[9px] text-slate-350 block font-sans">סה"כ שווי הון התיק (מזומן + נכסים)</span>
                  <span className="text-2xl font-black font-mono text-cyan-400">${metrics.totalEquity.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                </div>
                <div className="text-left font-sans flex flex-col items-end">
                  <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5 justify-center transition-all ${
                    metrics.netProfit >= 0 
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                  }`}>
                    {metrics.netProfit >= 0 ? "+" : ""}{metrics.pctChange.toFixed(2)}%
                    {metrics.netProfit >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    )}
                  </span>
                  <span className="text-[10px] text-slate-300 block mt-1.5 font-sans">
                    רווח נקי: <strong className={`font-mono text-xs ${metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {metrics.netProfit >= 0 ? "+" : ""}${metrics.netProfit.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Simulation controllers buttons */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 bg-[#06b6d4]/10 border border-[#06b6d4]/20 rounded-xl flex items-center justify-center p-2 text-center text-[10px] text-[#06b6d4] font-bold">
                  ⚡ סורק אוטומטית ועסקה תבוצע מעצמה ברגע חציית הסף!
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRealtimeCash(startingCapital);
                    setRealtimeHoldings({});
                    setRealtimeTradesList([]);
                    setRealtimeEquityHistory([startingCapital]);
                    showToast("תיק הפייפר-טריידינג בזמן אמת אופס בהצלחה!", true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-755 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  אפס תיק
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Grid: Events Feed & Headline Banner Indicator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" dir="rtl">
        
        {/* News Bulletins Card Log */}
        <div className="lg:col-span-12 xl:col-span-5 text-right">
          <div className={`p-6 rounded-3xl border ${theme.card} space-y-4 h-full flex flex-col justify-between`}>
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Newspaper className="w-4.5 h-4.5 text-cyan-400" />
              <h3 className={`text-sm font-bold ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>📰 כותרת היום והשפעתה על השוק</h3>
            </div>

            {(() => {
              const currentNews = marketNewsEvents[dayIndex + 1];
              const activeDate = getOffsetDateString(dayIndex);
              return (
                <div className="flex-1 flex flex-col justify-center min-h-[120px] bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                  {currentNews ? (
                    <div className="space-y-2 animate-fade-in">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-mono">יום {dayIndex + 1} ({activeDate})</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider
                          ${currentNews.impactType === "BULLISH" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" : 
                            currentNews.impactType === "BEARISH" ? "bg-rose-950 text-rose-400 border border-rose-500/20" : "bg-slate-900 text-slate-400"}
                        `}>
                          {currentNews.impactType === "BULLISH" ? "שור שוק (חיובי)" : 
                           currentNews.impactType === "BEARISH" ? "דוב שוק (שלילי)" : "תנודתיות מאוזנת"}
                        </span>
                      </div>
                      <h4 className="text-xs font-extrabold text-[#06b6d4] leading-relaxed">{currentNews.headline}</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">השפעות מדודה: {currentNews.impactNote}</p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 space-y-2">
                      <Activity className="w-8 h-8 text-slate-800 mx-auto animate-pulse" />
                      <p className="text-[10px] font-sans">מסחר יומי שוק חופשי ללא הצהרות מהותיות</p>
                      <p className="text-[9px] text-slate-500 leading-relaxed">שערי המניות משתנים בהתאם לתזזיתיות סטוכסטית קלה ב-Nasdaq.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="border-t border-slate-900 pt-3">
              <span className="text-[9.5px] text-slate-500 font-bold block">סך הכל נחשפו: {Object.keys(triggeredNewsLog).length} אירועי רשת והצהרות חוץ</span>
            </div>
          </div>
        </div>

        {/* Dynamic news and events ledger list (7 cols) */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-4 text-right">
          <div className={`p-6 rounded-3xl border ${theme.card} space-y-4`}>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-start mb-2">
                <button
                  type="button"
                  onClick={() => setBottomTab("holdings")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === "holdings"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  💼 תיק מניות מוחזק כעת ({Object.keys(metrics.holdings).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab("trades")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === "trades"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  📜 יומן עסקאות ({metrics.tradesList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab("logs")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === "logs"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  📋 יומן אירועי סימולציה
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab("portfolio_view")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bottomTab === "portfolio_view"
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/15"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" />
                  🔍 פאנל סקירת תיק
                </button>
              </div>

              {/* Title indicator label */}
              <div className="text-right pb-3 border-b border-slate-800/80 mb-4">
                <h3 className={`text-xs text-cyan-400 font-bold uppercase tracking-wide`}>
                  {bottomTab === "holdings" ? "הרכב הנכסים הפעיל" : 
                   bottomTab === "trades" ? "יומן קניות ומכירות" : 
                   bottomTab === "logs" ? "ציר זמן של יומן הסימולציה" : "ניתוח והקצאת תיק נכסים"}
                </h3>
              </div>

            {/* Render selected ledger content dynamically */}
            {(() => {
              if (bottomTab === "holdings") {
                return Object.keys(metrics.holdings).length === 0 ? (
                  <div className="py-12 text-center text-slate-650 font-sans text-xs border border-dashed border-slate-800 rounded-2xl">
                    💼 אין מניות מוחזקות כרגע בתיק הסימולציה.
                    <p className="text-[10px] text-slate-650 mt-1">ברגע שאחת ממניות המעקב תרד אל או מתחת לסף הקנייה שהגדרתם, המערכת תרכוש בצורה אוטומטית {tradeSharesCount} מניות ותציג אותן כאן לשם מעקב רווחים פתוחים.</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[220px] space-y-2 pr-1" style={{ scrollbarWidth: "thin" }}>
                    {Object.keys(metrics.holdings).map(ticker => {
                      const hold = metrics.holdings[ticker];
                      const currentPrice = simMode === "realtime"
                        ? (stocks?.find(s => s.ticker === ticker)?.currentPrice || hold.avgBuyPrice)
                        : (timelinePrices[dayIndex]?.[ticker] || hold.avgBuyPrice);
                      
                      const totalCost = hold.shares * hold.avgBuyPrice;
                      const currentValue = hold.shares * currentPrice;
                      const profitVal = currentValue - totalCost;
                      const profitPct = hold.avgBuyPrice > 0 ? (profitVal / totalCost) * 100 : 0;
                      
                      return (
                        <div 
                          key={ticker} 
                          className="p-3.5 rounded-xl border border-slate-800/50 bg-slate-900/40 flex justify-between items-center text-xs text-slate-300"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center font-black font-mono text-cyan-400 text-xs">
                              {ticker.substring(0, 2)}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1.5 justify-start">
                                <span className="font-extrabold text-white font-mono bg-slate-950 border border-slate-850 px-1.5 py-0.2 rounded">
                                  {ticker}
                                </span>
                                <span className="text-[10px] text-slate-500 font-sans">
                                  {hold.shares} מניות בתיק
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-450 mt-1 font-sans">
                                מחיר קנייה: <strong className="text-slate-200 font-mono">${hold.avgBuyPrice.toFixed(2)}</strong>
                                <span className="text-slate-500 mx-1.5">|</span>
                                שער נוכחי: <strong className="text-cyan-400 font-mono">${currentPrice.toFixed(2)}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="text-left font-sans">
                            <div className="font-mono text-[11px] text-slate-300">
                              שווי פוזיציה: <strong className="text-white font-bold font-mono">${currentValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              סך השקעה: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </div>
                            <div className={`mt-1 text-[11px] font-black px-1.5 py-0.5 rounded-lg inline-flex items-center gap-1
                              ${profitVal >= 0 ? "bg-emerald-950/80 text-emerald-400" : "bg-rose-950/80 text-rose-455"}
                            `}>
                              {profitVal >= 0 ? "רווח פתוח: +" : "רווח פתוח: "}${profitVal.toFixed(1)} ({profitVal >= 0 ? "+" : ""}{profitPct.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              if (bottomTab === "trades") {
                return metrics.tradesList.length === 0 ? (
                  <div className="py-12 text-center text-slate-655 font-sans text-xs border border-dashed border-slate-800 rounded-xl">
                    אין עסקאות שתועדו כרגע ברצועה זו.
                    <p className="text-[10px] text-slate-655 mt-1">ברגע שאחת ממניות המעקב תעבור דרך אלארם הסף שלכם, המערכת תבצע פקודת רכישה או מימוש דמו ותתעד את הפרמטרים ועמלת הסחר בהתאם.</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[220px] space-y-2 pr-1" style={{ scrollbarWidth: "thin" }}>
                    {metrics.tradesList.map(t => (
                      <div 
                        key={t.id} 
                        className={`p-3 rounded-xl border flex justify-between items-center text-xs font-bold
                          ${t.type === "BUY" ? "bg-emerald-950/10 border-emerald-500/15 text-emerald-400" : "bg-rose-950/10 border-rose-500/15 text-rose-455"}
                        `}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 justify-start">
                            <span className={`text-[9px] uppercase font-black px-1 rounded-sm
                              ${t.type === "BUY" ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-slate-950"}
                            `}>
                              {t.type === "BUY" ? "קנייה BUY" : "מימוש SELL"}
                            </span>
                            <span className="font-mono text-white text-xs bg-slate-900 border border-slate-850 px-1.5 py-0.2 rounded">
                              {t.ticker}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {simMode === "realtime" ? "בזמן אמת" : `יום ${t.dayIndex}`} ({t.dateStr})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5 leading-normal font-sans">
                            ביצע עסקה על {t.shares} מניות בשער של <strong className="text-slate-200 font-mono">${t.price}</strong>.
                            <span className="text-slate-500 block text-[10px] mt-0.5 font-sans">גורם מפעיל: {t.triggeredByNews}</span>
                          </p>
                        </div>

                        <div className="text-left font-mono">
                          <span className="text-slate-200 font-sans text-xs block">${t.total.toLocaleString()}</span>
                          <span className="text-[9px] text-slate-555 block mt-0.5">עמלה: ${t.fee}</span>
                          {t.profit !== undefined && (
                            <span className="text-[11px] font-black text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded block mt-1">
                              רווח נקי: +${t.profit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              if (bottomTab === "logs") {
                const logs = compileSimulationLogs();
                return (
                  <div className="space-y-2 text-right">
                    <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans">
                      יומן סימולציה מפורט (Simulation Log) העוקב אחר כל האירועים היומיים, החדשות, ושינויי שער התיק מתחילת הריצה:
                    </p>
                    <div className="overflow-y-auto max-h-[220px] space-y-1.5 pr-1" style={{ scrollbarWidth: "thin" }}>
                      {logs.map((log, index) => (
                        <div 
                          key={index}
                          className={`p-2.5 rounded-xl border text-[11px] flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center transition-all ${
                            log.type === "trade" 
                              ? "bg-cyan-950/20 border-cyan-500/15 text-cyan-300" 
                              : log.type === "news" 
                                ? "bg-amber-950/15 border-amber-500/10 text-amber-300" 
                                : "bg-slate-900/40 border-slate-800/30 text-slate-300"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap font-sans">
                              <span className="text-[9.5px] font-black font-mono text-slate-400 shrink-0">
                                {simMode === "realtime" ? "בזמן אמת" : `יום ${log.dayIndex}`} ({log.dateStr})
                              </span>
                              <strong className="text-white text-xs">{log.title}</strong>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal font-sans pr-1">
                              {log.desc}
                            </p>
                          </div>
                          {log.val !== undefined && (
                            <div className="text-left font-mono text-[10.5px] shrink-0 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                              <span className="text-slate-500 text-[9px] ml-1">שווי:</span>
                              <strong className="text-slate-200">${log.val.toLocaleString()}</strong>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </div>

      </div>

      {/* Gemini AI Analyst strategy review */}
      <div className="grid grid-cols-1 gap-6" dir="rtl">
        <div className={`p-6 rounded-3xl border ${theme.card} space-y-4`}>
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 justify-start">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className={`text-sm font-bold ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>הערכת ביצועים ועצות זהב מאנליסט AI 🤖</h3>
          </div>

          <div className="min-h-[140px] flex flex-col justify-center">
            {dayIndex === 0 && !isSimulating && !aiReviewText ? (
              <div className="py-14 text-center text-slate-500 text-xs">
                <Cpu className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-bounce" />
                מערכת הניתוחים מבוססת Gemini מוכנה להערכת אסטרטגיה נוכח אירועי מאקרו.
                <p className="text-xs text-slate-600 mt-1">השלם את הריצה המלאה של ה-60 יום כדי לקבל סקירה מעמיקה ומדידה המבוססת על שערי הסף וההצהרות הפוליטיות שעברת.</p>
              </div>
            ) : loadingAI ? (
              <div className="py-14 text-center text-slate-400 text-xs space-y-3">
                <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-bold text-cyan-400 animate-pulse">האלגוריתם הפיננסי מעבד ומנתח כעת את כל העסקאות שרשמת מול מפת הדרכים הכלכלית...</p>
              </div>
            ) : aiReviewText ? (
              <div className="p-5 rounded-2xl bg-slate-950 text-right text-xs leading-relaxed space-y-3.5 border border-slate-900">
                <div className="text-slate-300 font-sans whitespace-pre-wrap md:text-sm">
                  {aiReviewText}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs text-right">
                <Activity className="w-10 h-10 text-cyan-500/50 mx-auto mb-3 animate-pulse" />
                מפלס הימים מתקדם בהרצה...
                <p className="text-xs text-slate-650 mt-1">כאשר ההדמיה תסתיים או תיעצר, דוח האסטרטג הבכיר יתקבל בהתאם לתשואת התיק הריאלית והצהרותיהם של הפוליטיקאים שחוויתם.</p>
              </div>
            )}
          </div>

          {dayIndex > 0 && !isSimulating && (
            <button
              type="button"
              onClick={triggerAIReview}
              className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700/80 hover:bg-slate-750 transition-all font-bold text-xs text-slate-200 flex items-center justify-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              בקש הערכת אסטרטג מורחבת על בסיס נתונים נוכחיים
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

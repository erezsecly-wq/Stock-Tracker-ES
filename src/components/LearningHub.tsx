import { useState, useEffect } from "react";
import { 
  Sparkles, Bell, TrendingUp, TrendingDown, Target, ShieldCheck, 
  AlertCircle, Brain, Check, Layers, Play, DollarSign, ArrowRightLeft, 
  RotateCcw, Info
} from "lucide-react";
import { StockInfo, AlertConfig } from "../types";

interface LearningHubProps {
  theme: any;
  themeVal: number;
  stocks: StockInfo[];
  alerts: AlertConfig[];
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  onApplyStrategy: (ticker: string, buyVal: number | null, sellVal: number | null) => Promise<boolean>;
  onTriggerDemoNotification: (ticker: string, type: 'BUY' | 'SELL', price: number, threshold: number) => void;
}

interface SandboxTrade {
  id: string;
  ticker: string;
  type: "BUY" | "SELL";
  shares: number;
  buyPrice: number;
  sellPrice?: number;
  profitLoss?: number; // realized profit
  timestamp: string;
}

interface SandboxHolding {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
}

export default function LearningHub({
  theme,
  themeVal,
  stocks,
  alerts,
  selectedTicker,
  setSelectedTicker,
  onApplyStrategy,
  onTriggerDemoNotification
}: LearningHubProps) {
  // 1. Selector states
  const [currentSelectedTicker, setCurrentSelectedTicker] = useState<string>(selectedTicker || stocks[0]?.ticker || "AAPL");
  
  // Update when parent shifts stock
  useEffect(() => {
    if (selectedTicker && selectedTicker !== currentSelectedTicker) {
      setCurrentSelectedTicker(selectedTicker);
    }
  }, [selectedTicker]);

  const activeStock = stocks.find(s => s.ticker === currentSelectedTicker) || stocks[0] || { 
    ticker: "AAPL", 
    name: "Apple Inc.", 
    currentPrice: 175.0, 
    high24h: 178.0, 
    low24h: 172.0,
    history: [] 
  };

  // 2. AI Suggestions & Realism Input States
  const prices = activeStock.history ? activeStock.history.map(h => h.price) : [];
  const histMin = prices.length ? Math.min(...prices) : activeStock.currentPrice * 0.92;
  const histMax = prices.length ? Math.max(...prices) : activeStock.currentPrice * 1.08;

  // Initial inputs matching dynamic AI suggestions
  const initialSuggestedBuy = parseFloat((activeStock.currentPrice * 0.95).toFixed(2));
  const initialSuggestedSell = parseFloat((activeStock.currentPrice * 1.06).toFixed(2));

  const [customBuyThreshold, setCustomBuyThreshold] = useState<string>(String(initialSuggestedBuy));
  const [customSellThreshold, setCustomSellThreshold] = useState<string>(String(initialSuggestedSell));
  const [aiApplyStatus, setAiApplyStatus] = useState<string | null>(null);

  // Sync inputs with selected stock default AI建議
  useEffect(() => {
    setCustomBuyThreshold(String(parseFloat((activeStock.currentPrice * 0.95).toFixed(2))));
    setCustomSellThreshold(String(parseFloat((activeStock.currentPrice * 1.06).toFixed(2))));
    setAiApplyStatus(null);
  }, [currentSelectedTicker]);

  // Mega trend generator based on stocks
  const getMegaTrend = (ticker: string) => {
    const trends: Record<string, { label: string; text: string; isBullish: boolean }> = {
      AAPL: { 
        label: "עמדת עלייה מתונה (Bullish Mega-Trend)", 
        text: "ביקוש יציב למקבוק ואייפון בשווקים, יחד עם השקת מערכות Apple Intelligence שמגבשות אקו-סיסטם חזק ומוגן פטנטים.", 
        isBullish: true 
      },
      TSLA: { 
        label: "תנודתיות רוחבית (Sideways Trend)", 
        text: "תחרות מחירים אינטנסיבית מול יצרניות רכב סיניות, עם תקווה לפריצה טכנולוגית ברישיון FSD (נהיגה אוטונומית).", 
        isBullish: false 
      },
      NVDA: { 
        label: "זינוק שורי עוצמתי (Strong Bullish Trend)", 
        text: "דומיננטיות של קרוב ל-90% באספקת מעבדים גרפיים (GPUs) למרכזי נתונים של דגמי ה-AI הגדולים בעולם.", 
        isBullish: true 
      },
      GOOGL: { 
        label: "מגמת משקל בריא (Bullish Support Trend)", 
        text: "מונופול פרסום בחיפוש דיגיטלי, תוך האצת שירותי ה-Cloud Enterprise וטכנולוגיית Google Gemini API.", 
        isBullish: true 
      },
      MSFT: {
        label: "מגמת תמיכה סולידית (Bullish Trend)",
        text: "אינטגרציה מושלמת של Open AI ושותפויות ענן ריבוניות (Azure) במגזר הארגוני המוביל רווחים רציפים.",
        isBullish: true
      }
    };
    return trends[ticker] || { 
      label: "מגמת שוק מאוזנת (Neutral / Stable Trend)", 
      text: "החברה נסחרת בהתאם לפעילות הריבית הסטנדרטית וצמיחת התוצר הכללי בארץ ובאירופה.", 
      isBullish: true 
    };
  };

  const trendData = getMegaTrend(activeStock.ticker);

  // Realism meter calculation logic
  const getBuyRealismAndProb = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return { score: "N/A", color: "text-slate-500", label: "אנא הקלד סף קנייה בשדה משמאל כדי לנתח" };
    
    const pctDrop = (activeStock.currentPrice - val) / activeStock.currentPrice;
    
    if (pctDrop < 0) {
      return { 
        score: "לא פונקציונלי (0%)", 
        color: "text-rose-500 bg-rose-950/30 border-rose-500/20", 
        label: "⚠️ סף הקנייה שלך גבוה ממחיר השוק! הוא יפעל מיד. יעד קנייה חכם צריך להיות מחיר נמוך וזול יותר." 
      };
    }
    if (pctDrop <= 0.04) {
      return { 
        score: "הסתברות גבוהה מאוד (~90%)", 
        color: "text-emerald-400 bg-emerald-950/30 border-emerald-500/20", 
        label: "🟢 מעולה וקרוב מאוד לשער הנוכחי! סף קנייה ריאלי ביותר שעשוי להיתפס בימי המסחר הקרובים עקב תנודות קלות." 
      };
    }
    if (pctDrop <= 0.09) {
      return { 
        score: "הסתברות גבוהה שקולה (~70%)", 
        color: "text-teal-400 bg-teal-950/30 border-teal-500/20", 
        label: "🟢 מושלם! סף זה ממוקם בתיקון שוק בריא. מחיר מעולה שיעניק לך הנחה ממוצעת נאה בלי לחכות חודשים." 
      };
    }
    if (pctDrop <= 0.16) {
      return { 
        score: "הסתברות בינונית-נמוכה (~30%)", 
        color: "text-amber-400 bg-amber-950/30 border-amber-500/20", 
        label: "🟡 דורש סבלנות רבה: המניה תצטרך לתקן למטה בכ-10% עד 15%. יעד טוב לתקופות דוחות או מימוש רווחים כללי." 
      };
    }
    return { 
      score: "הסתברות אפסית - לא ריאלי (<3%)", 
      color: "text-rose-400 bg-rose-950/40 border-rose-500/30", 
      label: "🔴 סף לא ריאלי! המניה נופלת לכותרת זו רק במשבר קיצוני או קריסה כללית. ייתכן שתחכה לנצח בלי שום התראה פעילה." 
    };
  };

  const getSellRealismAndProb = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) return { score: "N/A", color: "text-slate-500", label: "אנא הקלד מחיר מכירה לניתוח שסתום רווח" };
    
    const pctGain = (val - activeStock.currentPrice) / activeStock.currentPrice;
    
    if (pctGain < 0) {
      return { 
        score: "לא פונקציונלי (0%)", 
        color: "text-rose-500 bg-rose-950/30 border-rose-500/20", 
        label: "⚠️ סף המכירה נמוך ממחיר השוק! הוא יפעל מיד. למכירת רווח עליך להגדיר שער גבוה ויקר יותר." 
      };
    }
    if (pctGain <= 0.04) {
      return { 
        score: "הסתברות גבוהה מאוד (~90%)", 
        color: "text-emerald-400 bg-emerald-950/30 border-emerald-500/20", 
        label: "🟢 קרוב מאוד! המניה תגיע לשם בקלות בתוך ימים בודדים. סולידי ומהיר, אך קוטף רווחים קטנים במיוחד." 
      };
    }
    if (pctGain <= 0.10) {
      return { 
        score: "הסתברות מצויינת (~75%)", 
        color: "text-teal-400 bg-teal-950/30 border-teal-500/20", 
        label: "🟢 מומלץ ביותר! ממוקם בנקודת ההתנגדות הטבעית הבאה של המניה. רווח מרשים של 5% עד 10% משער היום." 
      };
    }
    if (pctGain <= 0.18) {
      return { 
        score: "הסתברות בינונית (~35%)", 
        color: "text-amber-400 bg-amber-950/30 border-amber-500/20", 
        label: "🟡 דורש תנופה שורית חזקה: המניה זקוקה לראלי של מעל 12% או לדוח רווחים פנומנלי כדי לפגוש את השער." 
      };
    }
    return { 
      score: "הסתברות קלושה - לא ריאלי (<5%)", 
      color: "text-rose-400 bg-rose-950/40 border-rose-500/30", 
      label: "🔴 לא הוגן למניה! מטרת רווח מוגזמת מדי לזמן הקרוב. כנראה שתמתין שנים לפריצת מגה-שיא היסטורית." 
    };
  };

  const buyRealism = getBuyRealismAndProb(customBuyThreshold);
  const sellRealism = getSellRealismAndProb(customSellThreshold);

  // Apply custom thresholds generated by learning suggester
  const handleApplyCustomAiThresholds = async () => {
    setAiApplyStatus("שומר הגדרות במערכת...");
    const buyVal = customBuyThreshold !== "" ? parseFloat(customBuyThreshold) : null;
    const sellVal = customSellThreshold !== "" ? parseFloat(customSellThreshold) : null;
    
    if (isNaN(buyVal || 0) && isNaN(sellVal || 0)) {
      setAiApplyStatus("נא להזין מספרים תקינים לפחות לאחד מהיעדים");
      return;
    }

    const success = await onApplyStrategy(activeStock.ticker, buyVal, sellVal);
    if (success) {
      setAiApplyStatus(`התראת ה-AI הוגדרה בהצלחה עבור ${activeStock.ticker}! ספי המחסום נרשמו בשרת הזחילה ויצפצפו ברגע המגע.`);
      setTimeout(() => setAiApplyStatus(null), 8000);
    } else {
      setAiApplyStatus("שגיאה! אנא התחבר לחשבון על מנת לאחסן התראות מותאמות אישית בבסיס הנתונים.");
    }
  };


  // 3. Simulated Sandbox Paper Trading States & Persistent Logic
  // Starting sandbox ledger in localStorage so they can see all transaction profits!
  const [sandboxCash, setSandboxCash] = useState<number>(10000);
  const [sandboxHoldings, setSandboxHoldings] = useState<Record<string, SandboxHolding>>({});
  const [sandboxLedger, setSandboxLedger] = useState<SandboxTrade[]>([]);
  const [sandboxSharesInput, setSandboxSharesInput] = useState<string>("10");
  const [sandboxTradeSuccess, setSandboxTradeSuccess] = useState<string | null>(null);
  const [sandboxTradeError, setSandboxTradeError] = useState<string | null>(null);

  // Load sandbox data
  useEffect(() => {
    const savedCash = localStorage.getItem("edu_sandbox_cash");
    const savedHoldings = localStorage.getItem("edu_sandbox_holdings");
    const savedLedger = localStorage.getItem("edu_sandbox_ledger");

    if (savedCash) setSandboxCash(parseFloat(savedCash));
    if (savedHoldings) setSandboxHoldings(JSON.parse(savedHoldings));
    if (savedLedger) setSandboxLedger(JSON.parse(savedLedger));
  }, []);

  const saveSandboxState = (newCash: number, newHoldings: any, newLedger: any) => {
    setSandboxCash(newCash);
    setSandboxHoldings(newHoldings);
    setSandboxLedger(newLedger);

    localStorage.setItem("edu_sandbox_cash", String(newCash));
    localStorage.setItem("edu_sandbox_holdings", JSON.stringify(newHoldings));
    localStorage.setItem("edu_sandbox_ledger", JSON.stringify(newLedger));
  };

  const handleResetSandbox = () => {
    if (window.confirm("האם אתה בטוח שברצונך לאפס את כל תיק הדמו והרווחים הצבורים?")) {
      saveSandboxState(10000, {}, []);
      setSandboxTradeSuccess("המשאבים הכלכליים אותחלו בהצלחה ל- $10,000 מזומן דמו!");
      setTimeout(() => setSandboxTradeSuccess(null), 4000);
    }
  };

  // Perform a sandbox trade inside our learning simulator
  const executeSandboxTrade = (type: "BUY" | "SELL") => {
    setSandboxTradeSuccess(null);
    setSandboxTradeError(null);

    const sharesCount = parseInt(sandboxSharesInput);
    if (isNaN(sharesCount) || sharesCount <= 0) {
      setSandboxTradeError("נא להזין כמות מניות חיובית שלמה.");
      return;
    }

    const price = activeStock.currentPrice;
    const totalCost = parseFloat((sharesCount * price).toFixed(2));

    if (type === "BUY") {
      if (totalCost > sandboxCash) {
        setSandboxTradeError(`אינך יכול לרכוש באשראי המדומה! העלות היא $${totalCost.toLocaleString()} וברשותך רק $${sandboxCash.toLocaleString()} פנויים.`);
        return;
      }

      const currentHolding = sandboxHoldings[activeStock.ticker] || { ticker: activeStock.ticker, shares: 0, avgBuyPrice: 0 };
      const nextShares = currentHolding.shares + sharesCount;
      const nextAvgBuyPrice = parseFloat(((currentHolding.shares * currentHolding.avgBuyPrice + totalCost) / nextShares).toFixed(2));

      const updatedHoldings = {
        ...sandboxHoldings,
        [activeStock.ticker]: {
          ticker: activeStock.ticker,
          shares: nextShares,
          avgBuyPrice: nextAvgBuyPrice
        }
      };

      const newCash = parseFloat((sandboxCash - totalCost).toFixed(2));

      // Append trade to local ledger
      const newHistoryLog: SandboxTrade = {
        id: `TX-${Math.floor(Math.random() * 90000 + 10000)}`,
        ticker: activeStock.ticker,
        type: "BUY",
        shares: sharesCount,
        buyPrice: price,
        timestamp: new Date().toLocaleTimeString("he-IL")
      };

      saveSandboxState(newCash, updatedHoldings, [newHistoryLog, ...sandboxLedger]);
      setSandboxTradeSuccess(`יישר כוח! רכשת בהצלחה ${sharesCount} מניות של ${activeStock.ticker} במחיר $${price} למניה.`);
    } else {
      // SELL trade
      const currentHolding = sandboxHoldings[activeStock.ticker];
      if (!currentHolding || currentHolding.shares < sharesCount) {
        setSandboxTradeError(`חסר מניות ברזרבה: אין ברשותך ${sharesCount} מניות של ${activeStock.ticker} למכירה (ברשותך רק ${currentHolding?.shares || 0}).`);
        return;
      }

      const nextShares = currentHolding.shares - sharesCount;
      const originalCostBasis = parseFloat((sharesCount * currentHolding.avgBuyPrice).toFixed(2));
      const transactionProfitLoss = parseFloat((totalCost - originalCostBasis).toFixed(2));

      const updatedHoldings = { ...sandboxHoldings };
      if (nextShares === 0) {
        delete updatedHoldings[activeStock.ticker];
      } else {
        updatedHoldings[activeStock.ticker] = {
          ...currentHolding,
          shares: nextShares
        };
      }

      const newCash = parseFloat((sandboxCash + totalCost).toFixed(2));

      const newHistoryLog: SandboxTrade = {
        id: `TX-${Math.floor(Math.random() * 90000 + 10000)}`,
        ticker: activeStock.ticker,
        type: "SELL",
        shares: sharesCount,
        buyPrice: currentHolding.avgBuyPrice,
        sellPrice: price,
        profitLoss: transactionProfitLoss,
        timestamp: new Date().toLocaleTimeString("he-IL")
      };

      saveSandboxState(newCash, updatedHoldings, [newHistoryLog, ...sandboxLedger]);
      setSandboxTradeSuccess(
        `מזל טוב! מכרת בהצלחה ${sharesCount} מניות של ${activeStock.ticker} במחיר $${price}. ` +
        (transactionProfitLoss >= 0 
          ? `גזרת רווח של וינר של +$${transactionProfitLoss}! 🎉` 
          : `נרשם הפסד מדומה של -$${Math.abs(transactionProfitLoss)}. משמעת היא מפתח לניצחון!`)
      );
    }
    setSandboxSharesInput("10");

    // Timeout messages
    setTimeout(() => {
      setSandboxTradeSuccess(null);
      setSandboxTradeError(null);
    }, 6000);
  };

  // 4. Cumulative Realized Profit/Loss calculations for trades
  const totalRealizedProfit = sandboxLedger.reduce((sum, trade) => {
    if (trade.type === "SELL" && trade.profitLoss !== undefined) {
      return sum + trade.profitLoss;
    }
    return sum;
  }, 0);

  // Completed trades counts
  const sellTradesCount = sandboxLedger.filter(t => t.type === "SELL").length;
  const buyTradesCount = sandboxLedger.filter(t => t.type === "BUY").length;

  // Live Unrealized Portfolio profits to display compounding total
  const liveUnrealizedProfit = (Object.values(sandboxHoldings) as SandboxHolding[]).reduce((sum: number, item: SandboxHolding) => {
    const s = stocks.find(stock => stock.ticker === item.ticker);
    const livePrice = s ? s.currentPrice : item.avgBuyPrice;
    const diff = (livePrice - item.avgBuyPrice) * item.shares;
    return sum + diff;
  }, 0);

  const totalGrowthPercent = ((sandboxCash + (Object.values(sandboxHoldings) as SandboxHolding[]).reduce((sum: number, item: SandboxHolding) => {
    const s = stocks.find(stock => stock.ticker === item.ticker);
    const livePrice = s ? s.currentPrice : item.avgBuyPrice;
    return sum + (item.shares * livePrice);
  }, 0) - 10000) / 10000) * 100;

  // Local glossary state
  const [activeGlossaryTab, setActiveGlossaryTab] = useState<string>("what-is-stock");

  // Risk profiling questionnaire state
  const [quizStep, setQuizStep] = useState<number>(1);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<string | null>(null);

  // Questionnaire scoring
  const handleAnswerSelect = (score: number) => {
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);
    if (quizStep < 3) {
      setQuizStep(quizStep + 1);
    } else {
      const total = newAnswers.reduce((a, b) => a + b, 0);
      if (total <= 4) {
        setQuizResult("CONSERVATIVE");
      } else if (total <= 7) {
        setQuizResult("BALANCED");
      } else {
        setQuizResult("GROWTH");
      }
    }
  };

  const resetQuiz = () => {
    setQuizStep(1);
    setAnswers([]);
    setQuizResult(null);
  };

  // Set preset directly
  const handleApplyPresetAlerts = async (presetType: string) => {
    setAiApplyStatus("מחשב אסטרטגיה נומרית...");
    try {
      let buyPct = 0.03;
      let sellPct = 0.07;

      if (presetType === "CONSERVATIVE") {
        buyPct = 0.025;
        sellPct = 0.052;
      } else if (presetType === "BALANCED") {
        buyPct = 0.05;
        sellPct = 0.10;
      } else if (presetType === "GROWTH") {
        buyPct = 0.095;
        sellPct = 0.19;
      }

      const calculatedBuy = parseFloat((activeStock.currentPrice * (1 - buyPct)).toFixed(2));
      const calculatedSell = parseFloat((activeStock.currentPrice * (1 + sellPct)).toFixed(2));

      setCustomBuyThreshold(String(calculatedBuy));
      setCustomSellThreshold(String(calculatedSell));
      
      const ok = await onApplyStrategy(activeStock.ticker, calculatedBuy, calculatedSell);
      if (ok) {
        setAiApplyStatus(`האסטרטגיה הוחלה בהצלחה עבור ${activeStock.ticker}! יעד קנייה: $${calculatedBuy}, יעד מכירה: $${calculatedSell}`);
      } else {
        setAiApplyStatus("שגיאה סנכרון בשרת. התחבר בשנית.");
      }
    } catch (e) {
      setAiApplyStatus("סנכרון רשת נכשל.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-200" dir="rtl" id="edu_container">
      
      {/* 🚀 Header */}
      <div className={`p-6 rounded-3xl border ${theme.card} relative overflow-hidden shadow-2xl`}>
        <div className="absolute top-0 left-0 bg-gradient-to-r from-cyan-500/15 via-purple-500/10 to-transparent w-full h-full pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
              מילון, סימולטור וכלים חכמים למתחילים
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              הימנע מהמתנת נצח ליעדים לא הגיוניים! השתמש בסורק ה-AI הפיננסי כדי למצוא חסמים ריאליים, תרגל מסחר מדומה מוגן בחינם ועקוב אחר שורת הרווח המצטברת.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <span className="text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-cyan-400 px-3 py-2 rounded-xl flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              מצב למידה פעיל
            </span>
          </div>
        </div>
      </div>

      {/* 🌟 Block 1: Smart AI Bounds Checker & Probability Predictor */}
      <div className={`p-6 rounded-3xl border ${theme.card} space-y-6 relative`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-4 gap-4">
          <div className="flex items-center gap-3 justify-start">
            <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <Brain className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-md font-extrabold text-slate-100">מחשבון ריאליות ומנוע גבולות AI</h3>
              <p className="text-xs text-slate-400 mt-0.5">סורק את ההיסטוריה הכלכלית בשוק כדי להציע מחסומים הגיוניים שיקבעו רשת בטחון שפויה.</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-xs font-semibold text-slate-400">בחר מניה לניתוח:</span>
            <select 
              value={currentSelectedTicker} 
              onChange={(e) => {
                setCurrentSelectedTicker(e.target.value);
                setSelectedTicker(e.target.value);
              }}
              className={`p-2 px-3 text-xs rounded-xl font-mono font-bold border focus:outline-none focus:border-cyan-500 ${theme.input}`}
            >
              {stocks.map(s => (
                <option key={s.ticker} value={s.ticker}>{s.ticker} - {s.name} (${s.currentPrice})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic bounds comparison table and Mega trend grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Trend & Price Limits Display Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500">סטטיסטיקה מורחבת</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 bg-slate-900 border border-slate-850 rounded text-cyan-400">{activeStock.ticker}</span>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">מחיר שוק עדכני:</span>
                  <span className="font-mono font-bold text-slate-100">${activeStock.currentPrice}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">מחיר מינימום ממוצע (חודש):</span>
                  <span className="font-mono text-emerald-400">${histMin.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900">
                  <span className="text-slate-400">מחיר מקסימום ממוצע (חודש):</span>
                  <span className="font-mono text-rose-450">${histMax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">טווח תנודה היסטורי הגיוני:</span>
                  <span className="font-mono text-slate-350">
                    {((histMax - histMin) / activeStock.currentPrice * 100).toFixed(1)}% תנודות
                  </span>
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-xl border-t border-slate-900 bg-slate-910`}>
              <div className="flex items-center gap-1.5 justify-start mb-1">
                <ShieldCheck className={`w-3.5 h-3.5 ${trendData.isBullish ? "text-emerald-400" : "text-amber-400"}`} />
                <span className="text-xs font-bold text-slate-200">{trendData.label}</span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-normal">{trendData.text}</p>
            </div>
          </div>

          {/* Interactive AI Price Suggestion Form & live trigger meter */}
          <div className="lg:col-span-2 space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-300">הגדרת מחסומים חכמה – קבלת סברות ריאליות ומוגנות:</span>
              <button 
                type="button" 
                onClick={() => {
                  setCustomBuyThreshold(String(initialSuggestedBuy));
                  setCustomSellThreshold(String(initialSuggestedSell));
                }}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                title="אפס ליעדי ה-AI המאוזנים המומלצים"
              >
                <RotateCcw className="w-3 h-3" />
                שחזר יעדי AI מומלצים
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Buy input column */}
              <div className="space-y-2">
                <label className="text-xs block text-slate-400 font-semibold">1. אם המניה תרד ברכישה אטרקטיבית ל-:</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs text-slate-500">$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={customBuyThreshold} 
                    onChange={(e) => setCustomBuyThreshold(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-cyan-500 py-2.5 pl-8 pr-3 text-xs rounded-xl text-slate-100 font-mono"
                  />
                </div>
                
                {/* Buy realism feedback */}
                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${buyRealism.color}`}>
                  <div className="font-extrabold flex justify-between">
                    <span>קביעת סף קנייה:</span>
                    <span>{buyRealism.score}</span>
                  </div>
                  <p className="text-slate-300 leading-normal">{buyRealism.label}</p>
                </div>
              </div>

              {/* Sell input column */}
              <div className="space-y-2">
                <label className="text-xs block text-slate-400 font-semibold">2. אם המניה תנסוק לקצירת רווחים עד-:</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs text-slate-500">$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={customSellThreshold} 
                    onChange={(e) => setCustomSellThreshold(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-cyan-500 py-2.5 pl-8 pr-3 text-xs rounded-xl text-slate-100 font-mono"
                  />
                </div>

                {/* Sell realism feedback */}
                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${sellRealism.color}`}>
                  <div className="font-extrabold flex justify-between">
                    <span>קביעת סף מכירה:</span>
                    <span>{sellRealism.score}</span>
                  </div>
                  <p className="text-slate-300 leading-normal">{sellRealism.label}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-850 flex flex-col sm:flex-row items-center gap-3 justify-between">
              <span className="text-[10.5px] text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                מנוע הרישומת יבטיח בדיקה רציפה מעגלית של שערי וול-סטריט!
              </span>
              <button
                type="button"
                onClick={handleApplyCustomAiThresholds}
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-[0_3px_12px_rgba(6,182,212,0.25)]"
              >
                💾 החל במערכת ושמור התראת AI זו
              </button>
            </div>

            {aiApplyStatus && (
              <div className="text-center p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-cyan-400 animate-pulse">
                {aiApplyStatus}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 🎮 Block 2: Interactive Sandbox Paper Trading Game */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sandbox order book & actions (7 cols) */}
        <div className="lg:col-span-12 xl:col-span-8 space-y-6">
          <div className={`p-6 rounded-3xl border ${theme.card} space-y-6`}>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3 justify-start">
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20 text-purple-400">
                  <ArrowRightLeft className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-slate-100">מסחר מדומה – סימולטור עסקאות ורווח פנימי</h3>
                  <p className="text-xs text-slate-400">תרגל קנייה ומכירה זיהויי רווחים במחירי אמת ללא סיכון כספי בכלל!</p>
                </div>
              </div>

              {/* Stats highlights */}
              <div className="flex gap-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-900 select-none">
                <div className="text-center px-3 py-1 bg-slate-900 border border-slate-850 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">עסקאות שבוצעו</span>
                  <span className="text-xs font-extrabold font-mono text-slate-200">{buyTradesCount + sellTradesCount}</span>
                </div>
                <div className="text-center px-3 py-1 bg-slate-900 border border-slate-850 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">רווח ממומש מצטבר</span>
                  <span className={`text-xs font-extrabold font-mono ${totalRealizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {totalRealizedProfit >= 0 ? "+" : ""}${totalRealizedProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Simulated Balance Header Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col justify-between">
                <span className="text-xs text-slate-500">💵 יתרת מזומן מדומה להשקעה</span>
                <span className="text-lg font-black font-mono text-slate-100 mt-1">${sandboxCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col justify-between">
                <span className="text-xs text-slate-500">📊 רווח פתוח צבור (Unrealized)</span>
                <span className={`text-lg font-bold font-mono mt-1 ${liveUnrealizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {liveUnrealizedProfit >= 0 ? "+" : ""}${liveUnrealizedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 flex flex-col justify-between">
                <span className="text-xs text-slate-500">📈 תשואת תיק כוללת משלב פתיחה</span>
                <span className={`text-lg font-black font-mono mt-1 ${totalGrowthPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {totalGrowthPercent >= 0 ? "+" : ""}{totalGrowthPercent.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Simulating Trade Section Form */}
            <div className={`p-4 rounded-2xl border ${theme.subCard} grid grid-cols-1 md:grid-cols-2 gap-6 items-center`}>
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">טופס הדמיית פקודת רכש מהיר:</span>
                
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold bg-slate-950 p-1 rounded-xl border border-slate-900">
                    <span className="p-2 bg-slate-900 rounded-lg text-slate-400 text-center flex items-center justify-center gap-1">
                      <span>שער המניה הנוכחי:</span>
                      <strong className="text-slate-100">${activeStock.currentPrice}</strong>
                    </span>
                    <span className="p-2 bg-slate-900 rounded-lg text-slate-400 text-center flex items-center justify-center gap-1">
                      <span>סך עלות הדמיה:</span>
                      <strong className="text-cyan-400">${(activeStock.currentPrice * (parseInt(sandboxSharesInput) || 0)).toLocaleString()}</strong>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-slate-400 font-semibold">כמות מניות עסקה:</label>
                      <span className="text-[10px] text-slate-500">
                        מחזיק כעת: <strong className="text-slate-200">{sandboxHoldings[activeStock.ticker]?.shares || 0}</strong> יחידות של {activeStock.ticker}
                      </span>
                    </div>
                    <input 
                      type="number"
                      min="1"
                      value={sandboxSharesInput}
                      onChange={(e) => setSandboxSharesInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-cyan-500 py-2.5 px-3 text-sm rounded-xl text-slate-100 font-mono"
                    />
                  </div>

                  {/* Submit trade action buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => executeSandboxTrade("BUY")}
                      className="py-3 px-4 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all active:scale-95 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                    >
                      <TrendingDown className="w-4 h-4" />
                      בצע קניית דמו
                    </button>
                    <button
                      type="button"
                      onClick={() => executeSandboxTrade("SELL")}
                      className="py-3 px-4 rounded-xl bg-rose-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 hover:bg-rose-400 transition-all active:scale-95 shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
                    >
                      <TrendingUp className="w-4 h-4" />
                      בצע מכירת דמו
                    </button>
                  </div>
                </div>

                {sandboxTradeSuccess && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-start gap-1.5 animate-pulse">
                    <Check className="w-4 h-4 shrink-0" />
                    <p className="font-bold">{sandboxTradeSuccess}</p>
                  </div>
                )}

                {sandboxTradeError && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{sandboxTradeError}</p>
                  </div>
                )}
              </div>

              {/* Sandbox holding summary panel */}
              <div className="h-full bg-slate-950 rounded-2xl p-4 border border-slate-900 flex flex-col justify-between space-y-3.5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-500 font-mono">הפוזיציות הפתוחות שלך בדמו</span>
                    <button 
                      type="button"
                      onClick={handleResetSandbox}
                      className="text-[10px] text-slate-500 hover:text-slate-300 font-bold"
                    >
                      ⚙️ איפוס כספים
                    </button>
                  </div>

                  {Object.keys(sandboxHoldings).length === 0 ? (
                    <div className="py-10 text-center text-slate-600 text-xs text-slate-500">
                      אין מניות מוחזקות בניסוי שלך כרגע. קנה מניות לקבלת רווח פתוח וצמיחה.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {(Object.values(sandboxHoldings) as SandboxHolding[]).map((p) => {
                        const s = stocks.find(stock => stock.ticker === p.ticker);
                        const lp = s ? s.currentPrice : p.avgBuyPrice;
                        const profit = (lp - p.avgBuyPrice) * p.shares;
                        
                        return (
                          <div key={p.ticker} className="flex justify-between items-center bg-slate-900 p-2 rounded-xl text-xs font-mono border border-slate-850/60">
                            <div>
                              <span className="font-bold text-slate-100">{p.ticker}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-950 px-1 inline-block mr-1.5 rounded">{p.shares} מניות</span>
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] text-slate-400 block">${p.avgBuyPrice.toFixed(2)} → ${lp.toFixed(2)}</span>
                              <span className={`font-bold ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 bg-slate-900/60 p-2.5 rounded-lg border border-slate-850/50">
                  💡 <strong>חוק זהב:</strong> רכוש מניות בשלבי ירידה מתונים בעקבות התרעת ה-AI (BUY) ומכור אותן בעת צפצוף יעד המכירה (SELL). לולאה זו מניבה את הרווחים הממוצעים הגבוהים ביותר!
                </div>
              </div>
            </div>

            {/* Simulated Live profit realized ledger list table */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-105 flex items-center gap-1.5">
                <span>📑 ספר פקודות ורווחים ממומשים (P&L Ledger):</span>
                {sandboxLedger.length > 0 && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded font-mono font-bold">
                    שורת רווח: +${totalRealizedProfit.toFixed(2)}
                  </span>
                )}
              </h4>

              {sandboxLedger.length === 0 ? (
                <div className="p-8 text-center text-slate-600 border border-dashed border-slate-800 rounded-2xl text-xs">
                  ביצוע קניות ומכירות יוצג ויהפוך לשורת רווח ממומש כאן בספר החשבונות ההיסטורי.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-900 rounded-xl max-h-60 overflow-y-auto">
                  <table className="w-full text-right border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-850 text-[10px]">
                        <th className="p-2.5">קוד עסקה</th>
                        <th className="p-2.5 text-center">מניה</th>
                        <th className="p-2.5 text-center">פעולה</th>
                        <th className="p-2.5 text-center">כמות</th>
                        <th className="p-2.5 text-center">שער קנייה (ממוצע)</th>
                        <th className="p-2.5 text-center">שער מכירה בפועל</th>
                        <th className="p-2.5 text-left">רווח/הפסד ישיר</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40">
                      {sandboxLedger.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-900/20 text-[11px]">
                          <td className="p-2.5 text-slate-500">{tx.id}</td>
                          <td className="p-2.5 text-center text-slate-200 font-bold">{tx.ticker}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-black
                              ${tx.type === "BUY" ? "bg-emerald-950/80 text-emerald-400" : "bg-rose-950/80 text-rose-400"}
                            `}>
                              {tx.type === "BUY" ? "רכישה (BUY)" : "מימוש (SELL)"}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">{tx.shares}</td>
                          <td className="p-2.5 text-center text-slate-400">${tx.buyPrice.toFixed(2)}</td>
                          <td className="p-2.5 text-center">
                            {tx.sellPrice !== undefined ? `$${tx.sellPrice.toFixed(2)}` : "-"}
                          </td>
                          <td className={`p-2.5 text-left font-bold ${
                            tx.type === "BUY" 
                              ? "text-slate-500" 
                              : (tx.profitLoss !== undefined && tx.profitLoss >= 0 ? "text-emerald-400" : "text-rose-450")
                          }`}>
                            {tx.type === "BUY" 
                              ? "פתוח / בהחזקה" 
                              : (tx.profitLoss !== undefined ? `${tx.profitLoss >= 0 ? "+" : ""}$${tx.profitLoss}` : "")
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* 📖 Block 3: Interactive Stock Guide & Beginner Dictionary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Glossary (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className={`p-6 rounded-3xl border ${theme.card} space-y-6`}>
            <div className="flex items-center gap-3">
              <span className="text-xl">📖</span>
              <div>
                <h3 className="text-md font-bold text-slate-100">מילון שוק ההון המעשי למתחילים</h3>
                <p className="text-xs text-slate-405">הפוך למומחה פיננסי עצמאי בחלוקה פשוטה של עשר שניות לנושא.</p>
              </div>
            </div>

            {/* Term Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setActiveGlossaryTab("what-is-stock")}
                className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border text-center
                  ${activeGlossaryTab === "what-is-stock" ? "bg-slate-800 border-cyan-500 text-slate-100 font-extrabold" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"}
                `}
              >
                מה זה מניה? 📈
              </button>
              <button
                type="button"
                onClick={() => setActiveGlossaryTab("what-are-limits")}
                className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border text-center
                  ${activeGlossaryTab === "what-are-limits" ? "bg-slate-800 border-cyan-500 text-slate-100 font-extrabold" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"}
                `}
              >
                למה צריך התראות? 🛡️
              </button>
              <button
                type="button"
                onClick={() => setActiveGlossaryTab("ticker-explain")}
                className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border text-center
                  ${activeGlossaryTab === "ticker-explain" ? "bg-slate-800 border-cyan-500 text-slate-100 font-extrabold" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"}
                `}
              >
                מהו סמל טיקר? 🏷️
              </button>
              <button
                type="button"
                onClick={() => setActiveGlossaryTab("why-price-moves")}
                className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border text-center
                  ${activeGlossaryTab === "why-price-moves" ? "bg-slate-800 border-cyan-500 text-slate-100 font-extrabold" : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"}
                `}
              >
                למה מחירים זזים? ⚡
              </button>
            </div>

            {/* Glossary definitions */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 text-xs text-slate-300 leading-relaxed min-h-[140px]">
              {activeGlossaryTab === "what-is-stock" && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-100 text-sm block">חלק קטן מחברה אמיתית</span>
                  <p>
                    מניה היא פלח קטנטן מהחברה. כשאתה קונה למשל מניה של <strong>Apple (AAPL)</strong> או <strong>Microsoft (MSFT)</strong>, אתה הופך לבעלים רשמי של חתיכה זעירה מהחברה! 
                  </p>
                  <p className="text-[11px] text-slate-400">
                    אם החברה מצליחה וגדלה, הדרישה למניות שלה עולה, והמחיר של הפלח שלך קופץ למעלה. אם המצב קשה - הרכוש שלך הופך ליותר זול זמנית.
                  </p>
                </div>
              )}

              {activeGlossaryTab === "what-are-limits" && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-100 text-sm block">מיגון החלטה מבוססת רגש</span>
                  <p>
                    משקיעים חובבנים קונים בשיא מתוך התרגשות (Hyped FOMO) ומוכרים בהפסד מתוך פחד. 
                  </p>
                  <p className="font-bold text-cyan-400">
                    התראות המחסום שומרות עליכם מזה:
                  </p>
                  <p className="text-[11px] text-slate-400">
                    המערכת תשמיע צליל ותתריע מיד כשמניה מגיעה למחיר זול מעולה (סף קנייה), או כשהיא קפצה ותגיע לרווח שרציתם לקבע (סף מכירה), בלי שתצטרכו לבהות במסך 24/7.
                  </p>
                </div>
              )}

              {activeGlossaryTab === "ticker-explain" && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-100 text-sm block">קיצורי שמות המנייה בוול סטריט</span>
                  <p>
                    כדי להקל על המחשבים והנתונים, לכל חברה בבורסה יש קיצור קצר בין 3-4 אותיות הנקרא "טיקר".
                  </p>
                  <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-1">
                    <li><strong>AAPL</strong> - חברת אפל</li>
                    <li><strong>TSLA</strong> - חברת טסלה של אילון מאסק</li>
                    <li><strong>NVDA</strong> - חברת שבבי ה-AI אנבידיה</li>
                    <li><strong>GOOGL</strong> - חברת גוגל</li>
                  </ul>
                </div>
              )}

              {activeGlossaryTab === "why-price-moves" && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-100 text-sm block">היצע וביקוש ברחבי העולם</span>
                  <p>
                    שוק ההון עובד כמו מכירה פומבית בלתי פוסקת. בכל שנייה יש מיליוני קונים ומוכרים בעולם שמתחרים זה בזה.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    אם יש חדשות חיוביות על טכנולוגיה חדשה, קונים רבים רוצים להשיג את המניה בכל מחיר (המחיר עולה). אם נרשם דוח חלש או חשש, מוגשות פקודות מכירה רבות להחזר הכסף (המחיר יורד).
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Questionnaire/Profile card (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`p-6 rounded-3xl border ${theme.card} space-y-4`}>
            <div className="flex items-center gap-2">
              <span className="text-sm bg-orange-950 text-orange-400 p-1.5 rounded-lg">🎯</span>
              <h3 className="text-sm font-extrabold text-slate-100">מבחן אסטרטגיה ופרופיל אישי</h3>
            </div>

            {!quizResult ? (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>שאלה {quizStep} מתוך 3</span>
                  <div className="flex gap-1">
                    <div className={`w-4 h-1 rounded ${quizStep >= 1 ? "bg-cyan-500" : "bg-slate-800"}`} />
                    <div className={`w-4 h-1 rounded ${quizStep >= 2 ? "bg-cyan-500" : "bg-slate-800"}`} />
                    <div className={`w-4 h-1 rounded ${quizStep >= 3 ? "bg-cyan-500" : "bg-slate-800"}`} />
                  </div>
                </div>

                {quizStep === 1 && (
                  <div className="space-y-3">
                    <p className="font-bold text-slate-200">איך תשלים את המשפט הבא באופן הכי קרוב אליך?</p>
                    <div className="space-y-2 text-[11px]">
                      <button 
                        onClick={() => handleAnswerSelect(1)}
                        className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-950/40 text-slate-350 block"
                      >
                        ⚠️ "רווחים קטנים ויציבים עדיפים על סיכון גבוה"
                      </button>
                      <button 
                        onClick={() => handleAnswerSelect(2)}
                        className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-950/40 text-slate-350 block"
                      >
                        📊 "אני מוכן לצפות בירידה למען תשואה נאה"
                      </button>
                    </div>
                  </div>
                )}

                {quizStep === 2 && (
                  <div className="space-y-3">
                    <p className="font-bold text-slate-200">מה תעשה אם מניה מצליחה שלך ירדה זמנית ב-8%?</p>
                    <div className="space-y-2 text-[11px]">
                      <button 
                        onClick={() => handleAnswerSelect(2)}
                        className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-950/40 text-slate-350 block"
                      >
                        🕒 אמתין. בעוד כמה חודשים השער יחזור לעלות.
                      </button>
                      <button 
                        onClick={() => handleAnswerSelect(3)}
                        className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-950/40 text-slate-350 block"
                      >
                        🚀 אנצל זאת כהזדמנות לקנות עוד בהנחה דרך יעד AI.
                      </button>
                    </div>
                  </div>
                )}

                {quizStep === 3 && (
                  <div className="space-y-3">
                    <p className="font-bold text-slate-200">מהו טווח ההשקעה האידיאלי עבורך?</p>
                    <div className="space-y-2 text-[11px]">
                      <button 
                        onClick={() => handleAnswerSelect(1)}
                        className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-950/40 text-slate-350 block"
                      >
                        🔒 עד שנה. עדיף לממש מהר.
                      </button>
                      <button 
                        onClick={() => handleAnswerSelect(2)}
                        className="w-full text-right p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-950/40 text-slate-350 block"
                      >
                        🌟 שנתיים עד 5 שנים לקבלת צמיחה מלאה.
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3.5 text-xs animate-scale-in">
                <div className="p-2.5 rounded-xl bg-slate-950 font-bold border border-slate-900 text-center">
                  🧠 אובחנת כמשקיע: <span className="text-cyan-400 font-extrabold">{quizResult === "CONSERVATIVE" ? "סולידי / שומר קרן" : quizResult === "BALANCED" ? "משקיע שקול מאוזן" : "סוחר צמיחה נועז"}</span>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  <p>האסטרטגיה ממליצה לשמור על סיכון שקול ולקצר חסמים מעגליים בהתאמה ממוצעת.</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyPresetAlerts(quizResult)}
                  className="w-full bg-slate-100 text-slate-950 font-black py-2 rounded-xl text-xs hover:bg-slate-200 active:scale-95"
                >
                  🚀 החל אסטרטגיה דיגיטלית זו על {activeStock.ticker}
                </button>

                <button
                  type="button"
                  onClick={resetQuiz}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-slate-500 text-[10px] py-1 rounded"
                >
                  התחל אבחון מחדש
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

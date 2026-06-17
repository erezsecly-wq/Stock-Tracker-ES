import { useState, useEffect, FormEvent } from "react";
import { 
  Sparkles, Bell, Fingerprint, LogOut, TrendingUp, TrendingDown, 
  Target, ShieldCheck, AlertCircle, ArrowUpRight, LineChart, 
  Settings, Layers, Brain, Check, ShieldAlert
} from "lucide-react";
import { StockInfo, AlertConfig, PortfolioItem, AlertTriggerLog } from "./types";
import AuthScreen from "./components/AuthScreen";
import StockAnalysisModal from "./components/StockAnalysisModal";
import PortfolioSummary from "./components/PortfolioSummary";
import FingerprintSensor from "./components/FingerprintSensor";
import SettingsScreen from "./components/SettingsScreen";
import StockComparison from "./components/StockComparison";
import NewsMarquee from "./components/NewsMarquee";
import { Scale, Cpu } from "lucide-react";
import { playAlertSound } from "./utils/audio";
import LearningHub from "./components/LearningHub";
import AutoSimulator from "./components/AutoSimulator";
import { registerBiometric } from "./utils/webauthn";
import ServerBot from "./components/ServerBot";

// Helper to compute timeframe-based history for stock chart.
// When selecting 1W or 1M, we generate a high-quality deterministic walk based on ticker and current prices
// so that the chart scales dynamically and displays dates, ending with the exact live ticking price.
function getHistoryForTimeframe(stock: StockInfo, timeframe: "1D" | "1W" | "1M"): { time: string; price: number }[] {
  if (timeframe === "1D" || !stock.history || stock.history.length === 0) {
    return stock.history || [];
  }

  const count = timeframe === "1W" ? 7 : 30;
  const historyList: { time: string; price: number }[] = [];
  const seed = stock.ticker.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (i === 0) {
      // The final point is exactly the current ticking market price to maintain consistency
      historyList.push({ time: dateStr, price: stock.currentPrice });
    } else {
      // Create a deterministic walk starting from the current price factor
      // This fluctuates but keeps the same curve for the same ticker
      const angle = (count - i) * 0.35 + (seed % 10);
      const factor = 1 + (Math.sin(angle) * 0.05) + (Math.cos(angle * 1.5) * 0.02) + ((seed % 5) * 0.005);
      const price = parseFloat((stock.currentPrice * factor).toFixed(2));
      historyList.push({ time: dateStr, price });
    }
  }

  return historyList;
}

export default function App() {
  // Theme intensity setting: 0 (deep dark) to 100 (luminous light)
  const [themeVal, setThemeVal] = useState<number>(() => {
    const saved = localStorage.getItem("theme_val");
    return saved ? parseInt(saved) : 10; // Default to dark 10%
  });

  // Base typography font size scaling: 13 to 22px
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("font_size_v2");
    return saved ? parseInt(saved) : 20; // Significantly larger, crisp default
  });

  // Sound enabled mute value
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("sound_enabled");
    return saved !== "false"; // Default to true (unmuted)
  });

  // Notifications enabled globally (toggles popup boxes / toasts)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("notifications_enabled");
    return saved !== "false"; // Default to true
  });

  // Simulation Mode globally synced (realtime paper trading vs accelerated backtest)
  const [simMode, setSimMode] = useState<"realtime" | "accelerated">(() => {
    const saved = localStorage.getItem("sim_mode");
    return (saved as "realtime" | "accelerated") || "realtime";
  });

  // Auth & Session
  const [session, setSession] = useState<{
    username: string;
    token: string;
    biometricRegistered: boolean;
  } | null>(null);

  // Tabs / Active View
  const [activeTab, setActiveTab] = useState<"market" | "portfolio" | "logs" | "settings" | "compare" | "education" | "autosim" | "serverbot">("market");

  // Core Data
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertTriggerLog[]>([]);

  // Selected Stock for Details & Chart & AI Analysis
  const [selectedTicker, setSelectedTicker] = useState<string>("AAPL");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [timeframe, setTimeframe] = useState<"1D" | "1W" | "1M">("1D");

  useEffect(() => {
    setTimeframe("1D");
  }, [selectedTicker]);

  // Setup custom alert inputs
  const [buyInput, setBuyInput] = useState<string>("");
  const [sellInput, setSellInput] = useState<string>("");
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertSaveMsg, setAlertSaveMsg] = useState<string | null>(null);

  // Biometrics setup state
  const [showRegisterBioModel, setShowRegisterBioModel] = useState(false);

  // Notifications Popups/Toasts (Alerts active trigger toast)
  const [activeToast, setActiveToast] = useState<AlertTriggerLog | null>(null);

  // Load initial session on startup
  useEffect(() => {
    const savedUser = localStorage.getItem("last_logged_username");
    const savedToken = localStorage.getItem(`auth_token_${savedUser}`);
    if (savedUser && savedToken) {
      const bioReg = localStorage.getItem(`bio_reg_${savedUser}`) === "true";
      setSession({
        username: savedUser,
        token: savedToken,
        biometricRegistered: bioReg
      });
    }
  }, []);

  // Sync session authentication to localstorage helper
  const handleLoginSuccess = (username: string, token: string, biometricRegistered: boolean) => {
    localStorage.setItem("last_logged_username", username);
    localStorage.setItem(`auth_token_${username}`, token);
    localStorage.setItem(`bio_reg_${username}`, String(biometricRegistered));
    setSession({ username, token, biometricRegistered });
  };

  const handleLogout = () => {
    if (session) {
      localStorage.removeItem(`auth_token_${session.username}`);
    }
    setSession(null);
  };

  // Fetch Stocks data periodically (simulating active websocket or live API)
  const fetchStocks = async () => {
    try {
      const res = await fetch("/api/stocks");
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks);
      }
    } catch (err) {
      console.error("Error fetching stocks", err);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Alerts, Logs & Portfolio items for authenticated user
  const fetchUserData = async () => {
    if (!session) return;
    try {
      // Get Alert configs
      const alertsRes = await fetch("/api/alerts/config", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.configs);
      }

      // Get Portfolio items
      const portfolioRes = await fetch("/api/portfolio", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (portfolioRes.ok) {
        const data = await portfolioRes.json();
        setPortfolio(data.portfolio);
      }

      // Get Alert triggered logs
      const logsRes = await fetch("/api/alerts/logs", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (logsRes.ok) {
        const data = await logsRes.json();
        const logs: AlertTriggerLog[] = data.logs;
        setAlertLogs(logs);

        // Check for any new unread logs to display as a real-time toast notification!
        const unread = logs.find(log => !log.read);
        if (unread) {
          // Check if this alert hasn't already been toasted
          const toastedKey = `toast_${unread.id}`;
          if (sessionStorage.getItem(toastedKey) !== "true") {
            if (notificationsEnabled) {
              setActiveToast(unread);
              if (soundEnabled) {
                playAlertSound(unread.type);
              }
            }
            sessionStorage.setItem(toastedKey, "true");
            // Auto hide after 6 seconds
            setTimeout(() => {
              setActiveToast((curr) => curr?.id === unread.id ? null : curr);
            }, 6000);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching user configs", err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchUserData();
      const interval = setInterval(fetchUserData, 4000);
      return () => clearInterval(interval);
    }
  }, [session, soundEnabled, notificationsEnabled]);

  // Set default buy/sell thresholds inputs when selected stock changes
  useEffect(() => {
    const config = alerts.find(a => a.ticker === selectedTicker);
    if (config) {
      setBuyInput(config.buyThreshold !== null ? String(config.buyThreshold) : "");
      setSellInput(config.sellThreshold !== null ? String(config.sellThreshold) : "");
    } else {
      setBuyInput("");
      setSellInput("");
    }
    setAlertSaveMsg(null);
  }, [selectedTicker, alerts]);

  // Configure custom alerts
  const handleSaveAlerts = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSavingAlert(true);
    setAlertSaveMsg(null);

    try {
      const res = await fetch("/api/alerts/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          ticker: selectedTicker,
          buyThreshold: buyInput !== "" ? parseFloat(buyInput) : undefined,
          sellThreshold: sellInput !== "" ? parseFloat(sellInput) : undefined
        })
      });

      if (res.ok) {
        setAlertSaveMsg("הגדרות ההתראה נשמרו בהצלחה!");
        fetchUserData(); // Reload list
      } else {
        setAlertSaveMsg("שגיאה בשמירת הערכים בשרת");
      }
    } catch (err) {
      setAlertSaveMsg("תקלת תקשורת בשמירה");
    } finally {
      setSavingAlert(false);
      setTimeout(() => setAlertSaveMsg(null), 3000);
    }
  };

  // Save automated preset thresholds for Learning Hub
  const handleApplyStrategyPreset = async (ticker: string, buyVal: number | null, sellVal: number | null) => {
    if (!session) return false;
    try {
      const res = await fetch("/api/alerts/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          ticker,
          buyThreshold: buyVal !== null ? buyVal : undefined,
          sellThreshold: sellVal !== null ? sellVal : undefined
        })
      });
      if (res.ok) {
        if (ticker === selectedTicker) {
          setBuyInput(buyVal !== null ? String(buyVal) : "");
          setSellInput(sellVal !== null ? String(sellVal) : "");
        }
        fetchUserData(); // Reload configurations
        return true;
      }
    } catch (err) {
      console.error("Error applying strategy preset:", err);
    }
    return false;
  };

  // Trigger simulated demo notification
  const handleTriggerDemoNotification = (ticker: string, type: 'BUY' | 'SELL', price: number, threshold: number) => {
    const newLog: AlertTriggerLog = {
      id: `DEMO-${Math.floor(Math.random() * 9000 + 1000)}`,
      ticker,
      type,
      price,
      threshold,
      timestamp: new Date().toISOString(),
      read: false
    };

    if (notificationsEnabled) {
      if (soundEnabled) {
        playAlertSound(type);
      }
      setActiveToast(newLog);
    }
    setAlertLogs(prev => [newLog, ...prev]);
    sessionStorage.setItem(`toast_${newLog.id}`, "true");

    // Clear after 10 seconds
    setTimeout(() => {
      setActiveToast(curr => curr?.id === newLog.id ? null : curr);
    }, 10000);
  };

  // Callback to register biometrics — performs a REAL WebAuthn registration
  // ceremony (native fingerprint/face prompt + server-side public-key storage).
  const [bioError, setBioError] = useState<string | null>(null);
  const handleRegisterBiometrics = async () => {
    if (!session) return;
    setBioError(null);
    try {
      await registerBiometric(session.token);
      localStorage.setItem(`bio_reg_${session.username}`, "true");
      setSession(prev => prev ? { ...prev, biometricRegistered: true } : null);
      setShowRegisterBioModel(false);
    } catch (err: any) {
      console.error("Biometric registration failed", err);
      setBioError(err?.message || "רישום ביומטרי נכשל. ודא שהמכשיר תומך בטביעת אצבע/פנים.");
    }
  };

  // Perform trade on simulated backend
  const handleTrade = async (ticker: string, shares: number, type: "BUY" | "SELL", price: number): Promise<boolean> => {
    if (!session) return false;
    try {
      const res = await fetch("/api/portfolio/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ ticker, shares, type, price })
      });
      if (res.ok) {
        fetchUserData();
        return true;
      }
    } catch (err) {
      console.error("Trade failed", err);
    }
    return false;
  };

  // Mark all logs as read
  const handleMarkLogsRead = async () => {
    if (!session) return;
    try {
      await fetch("/api/alerts/logs/read", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` }
      });
      fetchUserData();
    } catch (err) {
      console.error(err);
    }
  };

  // Instant fill thresholds computed by Gemini AI Stock report
  const handleApplyAILimits = async (buyPrice: number, sellPrice: number, ticker?: string) => {
    if (!session) return;
    const targetTicker = ticker || selectedTicker;
    try {
      const res = await fetch("/api/alerts/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          ticker: targetTicker,
          buyThreshold: buyPrice,
          sellThreshold: sellPrice
        })
      });
      if (res.ok) {
        if (targetTicker === selectedTicker) {
          setBuyInput(String(buyPrice));
          setSellInput(String(sellPrice));
        }
        fetchUserData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const f = Math.max(0, Math.min(1, factor));
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);

    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    const r = Math.round(r1 + f * (r2 - r1));
    const g = Math.round(g1 + f * (g2 - g1));
    const b = Math.round(b1 + f * (b2 - b1));

    const hex = (x: number) => x.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  };

  const getThemeClasses = (val: number) => {
    const isDark = val < 50;
    
    let wrapperBg = "";
    let cardBg = "";
    let subCardBg = "";
    let borderColor = "";
    let navBgColor = "";
    let badgeBgColor = "";
    let inputBg = "";
    let textPrimary = "";
    let textMutedColor = "";
    let chartRef = "";

    if (isDark) {
      const ratio = val / 50; // 0 to 1
      wrapperBg = interpolateColor("#000000", "#181a20", ratio);
      cardBg = interpolateColor("#0a0a0d", "#22252f", ratio);
      subCardBg = interpolateColor("#111216", "#292c39", ratio);
      borderColor = interpolateColor("#17181c", "#353a4b", ratio);
      navBgColor = interpolateColor("#020204", "#1b1d24", ratio);
      badgeBgColor = interpolateColor("#131418", "#2b2e3d", ratio);
      inputBg = interpolateColor("#000000", "#1c1e26", ratio);
      // Hard bright white (לבן בוהק) for premium, clean legibility as requested!
      textPrimary = "#ffffff"; 
      textMutedColor = "#ffffff"; // pure white in dark mode (no faded grey)
      chartRef = interpolateColor("#17181c", "#343847", ratio);
    } else {
      const ratio = (val - 50) / 50; // 0 to 1
      wrapperBg = interpolateColor("#f5f4ed", "#ffffff", ratio);
      cardBg = interpolateColor("#ffffff", "#fbfbfa", ratio);
      subCardBg = interpolateColor("#f4f1e7", "#fdfdfb", ratio);
      borderColor = interpolateColor("#ddd9cd", "#eae6dc", ratio);
      navBgColor = interpolateColor("#ffffff", "#faf9f6", ratio);
      badgeBgColor = interpolateColor("#ece8dc", "#f6f4ed", ratio);
      inputBg = interpolateColor("#ffffff", "#fbfbfa", ratio);
      textPrimary = interpolateColor("#0a0f1c", "#1e293b", ratio);
      textMutedColor = interpolateColor("#2d3748", "#475569", ratio);
      chartRef = interpolateColor("#ddd9cd", "#eae6dc", ratio);
    }

    return {
      name: isDark ? `כהה הדרגתי מותאם (${val}%)` : `בהיר הדרגתי מותאם (${val}%)`,
      wrapperBg,
      cardBg,
      subCardBg,
      borderColor,
      navBgColor,
      badgeBgColor,
      inputBg,
      textPrimary,
      textMutedColor,
      chartRefLine: chartRef,
      wrapper: `bg-[var(--gradual-wrapper-bg)] text-[var(--gradual-text-primary)]`,
      card: `bg-[var(--gradual-card-bg)] border-[var(--gradual-border-color)] text-[var(--gradual-text-primary)] shadow-md`,
      subCard: `bg-[var(--gradual-sub-card-bg)] border-[var(--gradual-border-color)] text-[var(--gradual-text-primary)]`,
      textMuted: `text-[var(--gradual-text-muted)]`,
      textTitle: `text-[var(--gradual-text-primary)] font-extrabold`,
      input: `bg-[var(--gradual-input-bg)] text-[var(--gradual-text-primary)] border-[var(--gradual-border-color)] focus:border-cyan-500`,
      border: `border-[var(--gradual-border-color)]`,
      tabActive: isDark ? "border-cyan-400 text-cyan-400 font-extrabold" : "border-cyan-600 text-cyan-700 font-bold",
      navBg: `bg-[var(--gradual-nav-bg)] border-[var(--gradual-border-color)]`,
      badgeBg: `bg-[var(--gradual-badge-bg)] text-[var(--gradual-text-muted)]`,
    };
  };

  const theme = getThemeClasses(themeVal);

  if (!session) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const selectedStock = stocks.find(s => s.ticker === selectedTicker);
  const activeAlertConfig = alerts.find(a => a.ticker === selectedTicker);
  const unreadLogsCount = alertLogs.filter(l => !l.read).length;

  const tabInactive = themeVal >= 70 
    ? "border-transparent text-slate-500 hover:text-slate-900" 
    : "border-transparent text-slate-400 hover:text-slate-200";

  return (
    <div 
      style={{
        "--gradual-wrapper-bg": theme.wrapperBg,
        "--gradual-card-bg": theme.cardBg,
        "--gradual-sub-card-bg": theme.subCardBg,
        "--gradual-border-color": theme.borderColor,
        "--gradual-nav-bg": theme.navBgColor,
        "--gradual-badge-bg": theme.badgeBgColor,
        "--gradual-input-bg": theme.inputBg,
        "--gradual-text-primary": theme.textPrimary,
        "--gradual-text-muted": theme.textMutedColor,
        "fontSize": `${fontSize}px`,
      } as any}
      className={`min-h-screen ${theme.wrapper} flex flex-col pb-12 selection:bg-cyan-500 selection:text-slate-950 text-right leading-relaxed transition-colors duration-300`} 
      dir="rtl" 
      id="dashboard_core"
    >
      {/* Dynamic Inject Style Tag to scale any explicit/arbitrary fine-grain font-size classes seamlessly! */}
      <style>{`
        #dashboard_core {
          font-size: ${fontSize}px !important;
        }
        #dashboard_core .text-xs, 
        #dashboard_core .text-\\[10px\\], 
        #dashboard_core .text-\\[10.5px\\], 
        #dashboard_core .text-\\[9.5px\\], 
        #dashboard_core .text-\\[9px\\], 
        #dashboard_core .text-\\[8.5px\\], 
        #dashboard_core .text-\\[11px\\], 
        #dashboard_core .text-\\[11.5px\\], 
        #dashboard_core .text-\\[12px\\], 
        #dashboard_core .text-\\[12.5px\\], 
        #dashboard_core .text-\\[13px\\], 
        #dashboard_core .text-\\[8px\\] {
          font-size: ${Math.max(15, fontSize - 2)}px !important;
          color: var(--gradual-text-primary) !important;
        }
        #dashboard_core .text-sm {
          font-size: ${fontSize + 1}px !important;
        }
        #dashboard_core .text-md {
          font-size: ${fontSize + 3}px !important;
        }
        #dashboard_core .text-base {
          font-size: ${fontSize + 3}px !important;
        }
        #dashboard_core .text-lg {
          font-size: ${fontSize + 5}px !important;
        }
        #dashboard_core .text-xl {
          font-size: ${fontSize + 7}px !important;
        }
        #dashboard_core .text-2xl {
          font-size: ${fontSize + 11}px !important;
        }
        #dashboard_core .text-3xl {
          font-size: ${fontSize + 15}px !important;
        }
        /* Bright white override for dark mode text items to remove annoying slate transparency */
        ${themeVal < 50 ? `
          #dashboard_core .text-slate-200,
          #dashboard_core .text-slate-300,
          #dashboard_core .text-slate-350,
          #dashboard_core .text-slate-400,
          #dashboard_core .text-slate-450,
          #dashboard_core .text-slate-500,
          #dashboard_core .text-slate-550,
          #dashboard_core .text-slate-600,
          #dashboard_core .text-gray-300,
          #dashboard_core .text-gray-400,
          #dashboard_core .text-gray-500 {
            color: #ffffff !important;
            opacity: 1 !important;
          }
        ` : ""}
      `}</style>
      
      {/* Real-time alert warning toast popup */}
      {activeToast && (
        <div className="fixed top-20 left-4 z-50 max-w-sm w-full bg-slate-900 border-2 border-amber-500 rounded-2xl p-4 shadow-[0_0_25px_rgba(245,158,11,0.2)] animate-slide-in flex items-start gap-3 text-slate-200">
          <button 
            onClick={() => setActiveToast(null)}
            className="text-xs text-slate-500 hover:text-slate-300 absolute top-2 right-2"
          >
            ✕
          </button>
          
          <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 animate-bounce">
            <Bell className="w-5 h-5" />
          </div>

          <div className="flex-1 pr-1">
            <div className="flex items-center gap-1.5 justify-start mb-0.5">
              <span className="text-xs text-slate-400 font-mono">#{activeToast.id}</span>
              <span className={`text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                activeToast.type === "BUY" ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"
              }`}>
                התראת {activeToast.type === "BUY" ? "קנייה" : "מכירה"}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-100 font-sans">הופעלה התראת השקעה מבוקשת!</h4>
            <p className="text-xs text-slate-350 mt-1">
              שער המניה <span className="font-mono bg-slate-800 text-slate-200 px-1 rounded">{activeToast.ticker}</span> הגיע ל-<span className="font-bold font-mono">${activeToast.price}</span>.
              {activeToast.type === "BUY" 
                ? " המחיר ירד מתחת לסף האטרקטיבי שהגדרת לקנייה חכמה. הזדמנות מעולה לרכוש מניות!" 
                : " המחיר עלה מעל יעד גזירת הרווח שלך. זמן טוב למכור ולממש רווחים!"
              }
            </p>
          </div>
        </div>
      )}

      {/* Main header navbar */}
      <header className={`border-b ${theme.border} ${theme.navBg} backdrop-blur-md sticky top-0 z-40 select-none transition-all duration-300`}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Right brand logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-slate-950 shadow-md">
              <Sparkles className="w-5 h-5 font-bold" />
            </div>
            <div>
              <span className={`text-md font-black tracking-tight font-sans ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>StockWise <span className="text-cyan-500 text-xs font-semibold">אלרט פלוס</span></span>
              <span className="text-[10px] text-slate-500 block">עוזר השקעות ורשם אלארם מבוסס AI</span>
            </div>
          </div>

          {/* Tactile Gradual Continuous Sliders: Eye-Comfort Shading & Typography Font Scale */}
          <div className="hidden lg:flex items-center gap-4 bg-slate-900/10 dark:bg-black/20 border border-slate-700/15 px-4 py-2 rounded-2xl select-none">
            {/* 1. Shading Slider (0-100% smooth background color) */}
            <div className="flex items-center gap-2 border-l border-slate-705/15 pl-4">
              <span className={`text-xs font-extrabold flex items-center gap-1 shrink-0 ${themeVal >= 70 ? "text-slate-850" : "text-slate-100"}`}>
                <span>👁️</span>
                <span>רקע הדרגתי:</span>
              </span>
              <div className="flex flex-col w-28">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={themeVal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setThemeVal(val);
                    localStorage.setItem("theme_val", String(val));
                  }}
                  className="w-full h-1 bg-slate-400/30 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                  style={{ direction: 'ltr' }}
                  title="גרור כדי לשנות בהדרגה את גוון ובהירות הרקע מהכהה הטהור ועד הבהיר הנעים"
                />
                <div className="flex justify-between text-[8px] font-black text-slate-400 mt-1 leading-none">
                  <span>כפתור שחור</span>
                  <span className="text-cyan-405 font-bold">{themeVal}%</span>
                  <span>כפתור לבן</span>
                </div>
              </div>
            </div>

            {/* 2. Font Size Slider (13px to 22px) */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-extrabold flex items-center gap-1 shrink-0 ${themeVal >= 70 ? "text-slate-850" : "text-slate-100"}`}>
                <span>🔍</span>
                <span>גודל גופן:</span>
              </span>
              <div className="flex flex-col w-28">
                <input
                  type="range"
                  min="13"
                  max="26"
                  value={fontSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFontSize(val);
                    localStorage.setItem("font_size_v2", String(val));
                  }}
                  className="w-full h-1 bg-slate-400/30 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                  style={{ direction: 'ltr' }}
                  title="גרור כדי להגדיל או להקטין את כל הכיתובים וגופני המסך לנוחות קריאה מלאה"
                />
                <div className="flex justify-between text-[8px] font-black text-slate-400 mt-1 leading-none">
                  <span>קטן</span>
                  <span className="text-cyan-405 font-bold">{fontSize}px</span>
                  <span>ענק</span>
                </div>
              </div>
            </div>
          </div>

          {/* Left Controls & Profile */}
          <div className="flex items-center gap-4">
            
            {/* Quick Fingerprint secure status indicator */}
            <div className="hidden sm:flex items-center gap-1.5">
              {session.biometricRegistered ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>אבטחה ביומטרית פעילה</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowRegisterBioModel(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/35 border border-amber-500/20 px-3 py-1.5 rounded-full transition-all text-right"
                >
                  <Fingerprint className="w-3.5 h-3.5 animate-pulse" />
                  <span>אבטח חשבון בטביעת אצבע</span>
                </button>
              )}
            </div>

            {/* Notification triggers summary badge */}
            <div className="relative">
              <button 
                onClick={() => setActiveTab("logs")}
                className={`p-2 rounded-xl border transition-all text-slate-400 hover:text-slate-200
                  ${unreadLogsCount > 0 
                    ? "bg-slate-800 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]" 
                    : `${themeVal >= 70 ? "bg-white border-slate-350 text-slate-600 hover:text-slate-900 animate-none" : "bg-slate-900 border-slate-800 hover:text-slate-100"}`
                  }
                `}
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadLogsCount > 0 && (
                  <span className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-950 font-mono animate-pulse">
                    {unreadLogsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Profile and Logout button */}
            <div className={`flex items-center gap-2 border-r ${theme.border} pr-4`}>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">משתמש מחובר:</span>
                <span className={`text-xs font-bold font-sans ${themeVal >= 70 ? "text-slate-800" : "text-slate-300"}`}>{session.username}</span>
              </div>
              <button 
                onClick={handleLogout}
                className={`p-2 border rounded-xl text-slate-400 hover:text-rose-400 transition-colors ${
                  themeVal >= 70 ? "bg-white border-slate-200 hover:bg-slate-50" : "bg-slate-900 border-slate-800 hover:bg-slate-850"
                }`}
                title="התנתק מהחשבון"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main dashboard content container */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Navigation Selector Tabs */}
        <div className={`flex border-b ${theme.border} mb-8 select-none`}>
          <nav className="flex gap-6 -mb-px">
            <button
              onClick={() => setActiveTab("market")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "market" ? theme.tabActive : tabInactive}
              `}
            >
              <LineChart className="w-4.5 h-4.5" />
              מעקב מניות והתראות קנייה/מכירה
            </button>
            <button
              onClick={() => setActiveTab("portfolio")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "portfolio" ? theme.tabActive : tabInactive}
              `}
            >
              <Layers className="w-4.5 h-4.5" />
              סימולטור תיק השקעות מנוהל
            </button>
            <button
              onClick={() => {
                setActiveTab("logs");
                handleMarkLogsRead();
              }}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "logs" ? theme.tabActive : tabInactive}
              `}
            >
              <Bell className="w-4.5 h-4.5" />
              יומן התראות שהופעלו
              {unreadLogsCount > 0 && (
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono animate-pulse">
                  חדש
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "settings" ? theme.tabActive : tabInactive}
              `}
            >
              <Settings className="w-4.5 h-4.5" />
              הגדרות וניתוח קבוצות
            </button>
            <button
              onClick={() => setActiveTab("compare")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "compare" ? theme.tabActive : tabInactive}
              `}
            >
              <Scale className="w-4.5 h-4.5" />
              השוואת מניות חכמה
            </button>
            <button
              onClick={() => setActiveTab("education")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "education" ? theme.tabActive : tabInactive}
              `}
            >
              <Sparkles className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
              📚 מרכז למידה וסימולטור למתחילים
            </button>
            <button
              onClick={() => setActiveTab("autosim")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "autosim" ? theme.tabActive : tabInactive}
              `}
            >
              <Cpu className="w-4.5 h-4.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              🤖 סימולטור 60 יום מואץ
            </button>
            <button
              onClick={() => setActiveTab("serverbot")}
              className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === "serverbot" ? theme.tabActive : tabInactive}
              `}
            >
              <Cpu className="w-4.5 h-4.5 text-emerald-400" />
              🟢 בוט מסחר 24/7 (שרת)
            </button>
          </nav>
        </div>

        {/* Tab content panel display switcher */}
        {activeTab === "market" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Split layout: Stocks list on right / details & alert form on left */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left & Middle Area: Stock detail preview & alerts setting form */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Active stock presentation box */}
                {selectedStock ? (
                  <div className={`p-6 rounded-3xl border ${theme.card} space-y-6 relative overflow-hidden transition-all duration-300`}>
                    
                    {/* Floating watermarked ticker background */}
                    <span className="absolute -bottom-10 -left-6 text-[120px] font-black text-slate-800/5 leading-none select-none font-mono">
                      {selectedStock.ticker}
                    </span>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 justify-start">
                          <span className={`text-xs border font-semibold px-2.5 py-1 rounded-lg font-mono ${theme.badgeBg} ${theme.border}`}>
                            {selectedStock.ticker}
                          </span>
                          <h2 className={`text-xl font-bold font-sans ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>{selectedStock.name}</h2>
                        </div>
                        <p className={`text-xs mt-1 ${theme.textMuted}`}>מנייה מובילה בשוק האמריקאי. מתעדכן בשרת בזמן אמת.</p>
                      </div>

                      {/* Live Price display */}
                      <div className="flex items-baseline gap-2 justify-start sm:justify-end">
                        <span className={`text-3xl font-black font-mono tracking-tight animate-pulse ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
                          ${selectedStock.currentPrice}
                        </span>
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${
                          selectedStock.dailyChangePercent >= 0 ? "bg-emerald-950/40 text-emerald-400" : "bg-rose-950/40 text-rose-400"
                        }`}>
                          {selectedStock.dailyChangePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          <span className="font-mono">{selectedStock.dailyChangePercent >= 0 ? "+" : ""}{selectedStock.dailyChangePercent}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Highly-styled SVG Line Chart Visualizer */}
                    <div className={`relative z-10 border p-4 rounded-2xl transition-all duration-300 ${theme.subCard}`}>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-dashed pb-3 border-slate-700/20">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-xs font-bold ${themeVal >= 70 ? "text-slate-800" : "text-slate-300"}`}>טווח תצוגה:</span>
                          {/* Segmented Timeframe Selector (legend area) */}
                          <div className={`flex items-center p-0.5 rounded-lg border ${theme.border} ${themeVal >= 70 ? "bg-slate-100" : "bg-slate-900/40"}`}>
                            {(["1D", "1W", "1M"] as const).map((tf) => (
                              <button
                                key={tf}
                                type="button"
                                onClick={() => setTimeframe(tf)}
                                className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                                  timeframe === tf
                                    ? "bg-cyan-500 text-slate-950 shadow-md scale-102"
                                    : "text-slate-400 hover:text-cyan-400"
                                }`}
                              >
                                {tf === "1D" ? "1D (תוך-יומי)" : tf === "1W" ? "1W (שבועי)" : "1M (חודשי)"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive dynamic legend and high/low stats based on computed active timeframe subset */}
                        {(() => {
                          const activeHistory = getHistoryForTimeframe(selectedStock, timeframe);
                          const prices = activeHistory.map(pt => pt.price);
                          const highVal = prices.length > 0 ? Math.max(...prices) : selectedStock.high24h;
                          const lowVal = prices.length > 0 ? Math.min(...prices) : selectedStock.low24h;
                          return (
                            <div className="flex gap-4 text-[10px] text-slate-500 font-mono">
                              <span>גבוה בתקופה: <span className="text-emerald-400 font-bold">${highVal.toFixed(2)}</span></span>
                              <span>נמוך בתקופה: <span className="text-rose-400 font-bold">${lowVal.toFixed(2)}</span></span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* SVG Vector Path Chart Generator */}
                      <div className="h-44 w-full">
                        {(() => {
                          const activeHistory = getHistoryForTimeframe(selectedStock, timeframe);
                          const prices = activeHistory.map(pt => pt.price);
                          const limits = [...prices];
                          const hasBuyThreshold = activeAlertConfig && activeAlertConfig.buyThreshold !== null && activeAlertConfig.buyThreshold !== undefined;
                          const hasSellThreshold = activeAlertConfig && activeAlertConfig.sellThreshold !== null && activeAlertConfig.sellThreshold !== undefined;

                          if (hasBuyThreshold) {
                            limits.push(activeAlertConfig.buyThreshold);
                          }
                          if (hasSellThreshold) {
                            limits.push(activeAlertConfig.sellThreshold);
                          }

                          const min = Math.min(...limits) * 0.999;
                          const max = Math.max(...limits) * 1.001;
                          const range = max - min || 1;

                          const height = 150;
                          const width = 600;

                          // Compute coordinates
                          const points = activeHistory.map((pt, idx) => {
                            const x = (idx / (activeHistory.length - 1)) * width;
                            const y = height - ((pt.price - min) / range) * height;
                            return `${x},${y}`;
                          }).join(" ");

                          return (
                            <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                              {/* Horizontal Reference Grid lines */}
                              <line x1="0" y1="0" x2={width} y2="0" stroke={theme.chartRefLine} strokeWidth="1" strokeDasharray="3,3" />
                              <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={theme.chartRefLine} strokeWidth="1" strokeDasharray="3,3" />
                              <line x1="0" y1={height} x2={width} y2={height} stroke={theme.chartRefLine} strokeWidth="1" strokeDasharray="3,3" />

                              {/* Buy threshold dashed helper line */}
                              {hasBuyThreshold && (() => {
                                const buyY = height - ((activeAlertConfig.buyThreshold - min) / range) * height;
                                return (
                                  <g className="opacity-90">
                                    <line
                                      x1="0"
                                      y1={buyY}
                                      x2={width}
                                      y2={buyY}
                                      stroke="#10b981"
                                      strokeWidth="1.5"
                                      strokeDasharray="4,4"
                                    />
                                    <rect
                                      x={width - 120}
                                      y={buyY - 14}
                                      width="115"
                                      height="13"
                                      rx="3"
                                      fill={themeVal >= 70 ? "#ffffff" : "#0f172a"}
                                      stroke="#10b981"
                                      strokeWidth="0.5"
                                      className="opacity-95"
                                    />
                                    <text
                                      x={width - 8}
                                      y={buyY - 4}
                                      fill="#10b981"
                                      fontSize="8"
                                      fontWeight="bold"
                                      fontFamily="sans-serif"
                                      textAnchor="end"
                                    >
                                      סף קנייה פעיל: ${activeAlertConfig.buyThreshold}
                                    </text>
                                  </g>
                                );
                              })()}

                              {/* Sell threshold dashed helper line */}
                              {hasSellThreshold && (() => {
                                const sellY = height - ((activeAlertConfig.sellThreshold - min) / range) * height;
                                return (
                                  <g className="opacity-90">
                                    <line
                                      x1="0"
                                      y1={sellY}
                                      x2={width}
                                      y2={sellY}
                                      stroke="#ef4444"
                                      strokeWidth="1.5"
                                      strokeDasharray="4,4"
                                    />
                                    <rect
                                      x={width - 120}
                                      y={sellY - 14}
                                      width="115"
                                      height="13"
                                      rx="3"
                                      fill={themeVal >= 70 ? "#ffffff" : "#0f172a"}
                                      stroke="#ef4444"
                                      strokeWidth="0.5"
                                      className="opacity-95"
                                    />
                                    <text
                                      x={width - 8}
                                      y={sellY - 4}
                                      fill="#ef4444"
                                      fontSize="8"
                                      fontWeight="bold"
                                      fontFamily="sans-serif"
                                      textAnchor="end"
                                    >
                                      סף מכירה פעיל: ${activeAlertConfig.sellThreshold}
                                    </text>
                                  </g>
                                );
                              })()}

                              {/* Gradient overlay under the line */}
                              <defs>
                                <linearGradient id="chart-glowing-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
                                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              {activeHistory.length > 1 && (
                                <polygon
                                  points={`0,${height} ${points} ${width},${height}`}
                                  fill="url(#chart-glowing-grad)"
                                />
                              )}

                              {/* Core Stock Vector path line */}
                              <polyline
                                fill="none"
                                stroke="#06b6d4"
                                strokeWidth="2.5"
                                points={points}
                                className="transition-all duration-500"
                              />

                              {/* Laser dynamic dots at current point */}
                              {activeHistory.length > 0 && (
                                <circle
                                  cx={width}
                                  cy={height - ((selectedStock.currentPrice - min) / range) * height}
                                  r="5"
                                  fill="#22d3ee"
                                  className="animate-ping"
                                />
                              )}
                            </svg>
                          );
                        })()}
                      </div>

                      {/* Chart times indicators */}
                      {(() => {
                        const activeHistory = getHistoryForTimeframe(selectedStock, timeframe);
                        return (
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2" dir="ltr">
                            <span>{activeHistory[0]?.time || "09:30"}</span>
                            <span>{activeHistory[Math.floor(activeHistory.length / 2)]?.time || "11:30"}</span>
                            <span>{activeHistory[activeHistory.length - 1]?.time || "14:30"}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Custom alerts creation/management block */}
                    <div className="pt-2">
                      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t ${theme.border} pt-6`}>
                        
                        <div>
                          <h4 className={`text-sm font-bold ${themeVal >= 70 ? "text-slate-900" : "text-slate-200"}`}>הגדרת מחיר סף אטרקטיבי (Alert Thresholds)</h4>
                          <p className={`text-xs mt-1 ${theme.textMuted}`}>קבל התרעה אוטומטית ברגע שהמניה משנה שערי דיסקאונט או יעד רווח</p>
                        </div>

                        {/* GEMINI AI AGENT TRIGGER BUTTON */}
                        <button
                          type="button"
                          onClick={() => setShowAnalysis(true)}
                          className="flex items-center gap-2 text-xs font-bold bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 py-2.5 px-4 rounded-xl hover:bg-cyan-900/40 transition-colors shadow-lg active:scale-95"
                        >
                          <Brain className="w-4 h-4 text-cyan-400 animate-pulse" />
                          ניתוח חכם ויעדי AI מ-Gemini
                        </button>
                      </div>

                      {/* Setup Form */}
                      <form onSubmit={handleSaveAlerts} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mt-4">
                        
                        {/* BUY target threshold input */}
                        <div className="flex flex-col gap-1.5 font-sans">
                          <label className={`text-xs font-semibold ${themeVal >= 70 ? "text-slate-600" : "text-slate-400"}`}>קנייה מוגנת (התרע אם יורד חזרה מתחת ל-):</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs text-slate-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={buyInput}
                              onChange={(e) => setBuyInput(e.target.value)}
                              placeholder="כגון: 178"
                              className={`w-full border rounded-xl py-2 px-3 pl-8 text-sm focus:outline-none focus:border-cyan-500 transition-all font-mono ${theme.input}`}
                            />
                          </div>
                        </div>

                        {/* SELL target threshold input */}
                        <div className="flex flex-col gap-1.5 font-sans">
                          <label className={`text-xs font-semibold ${themeVal >= 70 ? "text-slate-600" : "text-slate-400"}`}>מכירת רווח (התרע אם עולה מעל):</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs text-slate-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={sellInput}
                              onChange={(e) => setSellInput(e.target.value)}
                              placeholder="כגון: 185"
                              className={`w-full border rounded-xl py-2 px-3 pl-8 text-sm focus:outline-none focus:border-cyan-500 transition-all font-mono ${theme.input}`}
                            />
                          </div>
                        </div>

                        {/* Submit Save */}
                        <button
                          type="submit"
                          disabled={savingAlert}
                          className="py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                        >
                          {savingAlert ? "שומר..." : "שמור יעדי התראה"}
                        </button>

                      </form>

                      {/* Display Alert status details if saved */}
                      <div className="mt-4 flex items-center justify-between">
                        {alertSaveMsg ? (
                          <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-lg">
                            {alertSaveMsg}
                          </span>
                        ) : activeAlertConfig ? (
                          <div className={`flex gap-4 text-xs p-2.5 rounded-xl border w-full justify-between items-center font-mono ${theme.subCard}`}>
                            <div className="flex gap-4">
                              <span>סיווג מעקב: <span className="text-slate-200 font-bold">{selectedTicker}</span></span>
                              {activeAlertConfig.buyThreshold !== null && (
                                <span>יעד קנייה אטרקטיבי: <span className="text-emerald-400 font-bold">${activeAlertConfig.buyThreshold}</span></span>
                              )}
                              {activeAlertConfig.sellThreshold !== null && (
                                <span>סף מימוש רווח: <span className="text-rose-400 font-bold">${activeAlertConfig.sellThreshold}</span></span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-sans">פעיל ומאובטח במנוע הרישום</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">טרם הוגדרו מחסומי מחיר מותאמים אישית למטרות מעקב</span>
                        )}
                      </div>

                    </div>

                  </div>
                ) : null}

              </div>

              {/* Right Area: Sidebar of Stock Lists with change indices */}
              <div className="space-y-4">
                <div className={`p-5 rounded-3xl ${theme.card} border select-none`}>
                  <h3 className={`text-md font-bold mb-1 flex items-center gap-2 ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
                    <Layers className="w-5 h-5 text-cyan-400" />
                    מניות מובילות במעקב המלצה
                  </h3>
                  <p className={`text-xs ${theme.textMuted} mb-4`}>בחר מניה לעדכון, סקירה כללית או הגדרת יעדי קנייה ומכירה</p>

                  <div className="space-y-2.5">
                    {stocks.map((s) => {
                      const isSelected = s.ticker === selectedTicker;
                      const hasAlertConfig = alerts.find(a => a.ticker === s.ticker && (a.buyThreshold !== null || a.sellThreshold !== null));

                      return (
                        <div
                          key={s.ticker}
                          onClick={() => setSelectedTicker(s.ticker)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between
                            ${isSelected 
                              ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-cyan-400 font-bold" 
                              : `${theme.subCard} ${theme.border} hover:opacity-90`
                            }
                          `}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`font-mono text-xs font-black ${theme.badgeBg} border ${theme.border} px-2 py-0.5 rounded text-cyan-400`}>
                              {s.ticker}
                            </span>
                            <div>
                              <span className="text-xs font-bold block leading-snug">{s.name}</span>
                              {hasAlertConfig && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 mt-0.5">
                                  <Bell className="w-2.5 h-2.5" />
                                  התרעה פעילה
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-left font-mono">
                            <span className="text-sm font-bold block">${s.currentPrice}</span>
                            <span className={`text-[11px] font-semibold flex items-center gap-0.5 justify-end mt-0.5 ${
                              s.dailyChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}>
                              {s.dailyChangePercent >= 0 ? "+" : ""}{s.dailyChangePercent}%
                            </span>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated Stock alerts summary widgets status */}
                <div className={`p-5 rounded-3xl ${theme.card} border space-y-3`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wide ${themeVal >= 70 ? "text-slate-600" : "text-slate-400"}`}>זמני פעילות הבורסה</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className={`${themeVal >= 70 ? "text-slate-600" : "text-slate-400"}`}>שוק ה-NASDAQ:</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        פעיל (סימולציה)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${themeVal >= 70 ? "text-slate-600" : "text-slate-400"}`}>מתעדכן מחדש:</span>
                      <span className={`font-mono ${themeVal >= 70 ? "text-slate-700 font-bold" : "text-slate-300"}`}>כל 4 שניות</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {activeTab === "portfolio" && (
          <div className="animate-fade-in">
            <PortfolioSummary 
              portfolio={portfolio}
              stocks={stocks}
              onTrade={handleTrade}
            />
          </div>
        )}

        {activeTab === "logs" && (
          <div className="animate-fade-in space-y-6">
            <div className={`p-6 rounded-3xl ${theme.card} border`}>
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className={`text-lg font-bold ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>היסטוריית התראות שהופעלו בזמן אמת</h3>
                  <p className={`text-xs ${theme.textMuted} mt-1`}>רשימת התרעות ששוגרו אליך עקב חציית שערי סף אטרקטיביים של מניות</p>
                </div>
                <button
                  onClick={handleMarkLogsRead}
                  className={`text-xs ${theme.subCard} ${theme.border} border hover:opacity-80 py-1.5 px-3 rounded-xl transition-all font-bold`}
                >
                  סמן הכל כנקרא
                </button>
              </div>

              {alertLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  <Bell className="w-12 h-12 text-slate-705 text-slate-500 mx-auto mb-4" />
                  טרם שוגרו אליך התראות השקעה.
                  <p className="text-xs text-slate-600 mt-1">ברגע שאחת מהמניות שבמעקב תרד מתחת לסף הקנייה או תעלה מעל לרווח שהגדרת, תוצג כאן התרעה.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertLogs.map((log) => (
                    <div 
                      key={log.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all
                        ${log.read 
                          ? `${theme.subCard} opacity-85` 
                          : `${theme.card} border-amber-500/40 shadow-sm text-slate-100`
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs
                          ${log.type === "BUY" ? "bg-emerald-950/40 text-emerald-400" : "bg-rose-950/40 text-rose-400"}
                        `}>
                          {log.type === "BUY" ? <TrendingDown className="w-4.5 h-4.5" /> : <TrendingUp className="w-4.5 h-4.5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 justify-start">
                            <span className={`font-mono text-xs font-black ${theme.badgeBg} border ${theme.border} text-slate-400 px-1.5 py-0.5 rounded`}>
                              {log.ticker}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              log.type === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}>
                              התראת {log.type === "BUY" ? "שער הנחה לקנייה" : "שער מימוש לרווח"}
                            </span>
                            {!log.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            )}
                          </div>
                          
                          <p className={`text-xs ${themeVal >= 70 ? "text-slate-700 font-medium" : "text-slate-300"} mt-1`}>
                            המניה הגיעה לשער של <span className="font-mono font-bold">${log.price}</span>.
                            {log.type === "BUY" 
                              ? ` סף הקנייה האטרקטיבית שהגדרת היה $${log.threshold}. מחיר מצויין לכניסה לפוזיציה!` 
                              : ` שער היעד שהגדרת למכירה ברווח היה $${log.threshold}. המלצת רווח הוגנת.`
                            }
                          </p>
                        </div>
                      </div>

                      <div className="text-left text-[11px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

         {activeTab === "settings" && (
          <div className="animate-fade-in">
            <SettingsScreen
              themeVal={themeVal}
              setThemeVal={setThemeVal}
              token={session.token}
              theme={theme}
              onApplyAlerts={async (ticker, buyPrice, sellPrice) => {
                await handleApplyAILimits(buyPrice, sellPrice, ticker);
              }}
              stocks={stocks}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              simMode={simMode}
              setSimMode={setSimMode}
            />
          </div>
        )}

        {activeTab === "compare" && (
          <div className="animate-fade-in">
            <StockComparison
              stocks={stocks}
              themeVal={themeVal}
              theme={theme}
              token={session.token}
            />
          </div>
        )}

        {activeTab === "education" && (
          <div className="animate-fade-in">
            <LearningHub
              theme={theme}
              themeVal={themeVal}
              stocks={stocks}
              alerts={alerts}
              selectedTicker={selectedTicker}
              setSelectedTicker={setSelectedTicker}
              onApplyStrategy={handleApplyStrategyPreset}
              onTriggerDemoNotification={handleTriggerDemoNotification}
            />
          </div>
        )}

        {activeTab === "autosim" && (
          <div className="animate-fade-in">
            <AutoSimulator
              theme={theme}
              themeVal={themeVal}
              token={session.token}
              stocks={stocks}
              simMode={simMode}
              setSimMode={setSimMode}
              notificationsEnabled={notificationsEnabled}
            />
          </div>
        )}

        {activeTab === "serverbot" && (
          <ServerBot
            theme={theme}
            themeVal={themeVal}
            token={session.token}
          />
        )}

      </main>

      {/* Gemini AI analysis slide modal drawer */}
      {showAnalysis && selectedStock && (
        <StockAnalysisModal 
          ticker={selectedTicker}
          currentPrice={selectedStock.currentPrice}
          token={session.token}
          onApplyThresholds={handleApplyAILimits}
          onClose={() => setShowAnalysis(false)}
        />
      )}

      {/* Biometric registration prompt modal */}
      {showRegisterBioModel && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-slate-200">
            <button 
              onClick={() => setShowRegisterBioModel(false)}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
            <div className="p-2">
              <FingerprintSensor
                onSuccess={handleRegisterBiometrics}
                onCancel={() => setShowRegisterBioModel(false)}
                title="סריקת טביעת אצבע לרישום"
                subtitle="אבטח את החשבון לחיבור מהיר בלחיצה אחת בפעם הבאה"
              />
              {bioError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs text-center">
                  {bioError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-time scrolling finance news marquee feed */}
      <NewsMarquee themeVal={themeVal} theme={theme} />

    </div>
  );
}

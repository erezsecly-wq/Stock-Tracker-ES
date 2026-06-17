import { useState, useEffect } from "react";
import { 
  Check, Sparkles, Brain, Sliders, Info, Server,
  AlertTriangle, TrendingUp, TrendingDown, Target, ShieldCheck, Play,
  Volume2, VolumeX, AlertOctagon, Music, Bell, BellOff, Activity, Cpu,
  Clock, Copy
} from "lucide-react";
import { playAlertSound } from "../utils/audio";

interface SettingsScreenProps {
  themeVal: number;
  setThemeVal: (val: number) => void;
  token: string | null;
  theme: {
    name: string;
    wrapper: string;
    card: string;
    subCard: string;
    textMuted: string;
    textTitle: string;
    input: string;
    border: string;
    badgeBg: string;
  };
  onApplyAlerts: (ticker: string, buyPrice: number, sellPrice: number) => Promise<void>;
  stocks: { ticker: string; name: string; currentPrice: number }[];
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (val: boolean) => void;
  simMode: "realtime" | "accelerated";
  setSimMode: (val: "realtime" | "accelerated") => void;
}

interface IndexAnalysisResult {
  groupName: string;
  recommendedTicker: string;
  recommendedName: string;
  whyRecommended: string;
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  marketSummary: string;
  stocksRatings: { ticker: string; rating: "BUY" | "HOLD" | "SELL" | string; reason: string }[];
}

const analysisLoadingStatements = [
  "מתחבר למנועי מחקר גלובליים...",
  "מנתח משקלים וקשרים סטטיסטיים במדד...",
  "מעבד סנטימנט משקיעים באמצעות רשתות נוירונים...",
  "מצרף נתוני תמיכה היסטוריים להמלצה מדוייקת..."
];

export default function SettingsScreen({
  themeVal,
  setThemeVal,
  token,
  theme,
  onApplyAlerts,
  stocks,
  soundEnabled,
  setSoundEnabled,
  notificationsEnabled,
  setNotificationsEnabled,
  simMode,
  setSimMode
}: SettingsScreenProps) {
  const [selectedGroup, setSelectedGroup] = useState<"SNP" | "TECH" | "ALL">("SNP");
  const [loading, setLoading] = useState(false);
  const [statementIdx, setStatementIdx] = useState(0);
  const [analysis, setAnalysis] = useState<IndexAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedTicker, setAppliedTicker] = useState<string | null>(null);

  // Real-time server info telemetry state
  const [serverInfo, setServerInfo] = useState<{
    uptimeSeconds: number;
    tickCount: number;
    lastTickTime: string;
    serverStartTime: string;
    pingUrl: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const res = await fetch("/api/server-info");
        if (res.ok) {
          const data = await res.json();
          setServerInfo(data);
        }
      } catch (err) {
        console.warn("Failed to fetch server info", err);
      }
    };
    fetchServerInfo();
    const subInterval = setInterval(fetchServerInfo, 4000);
    return () => clearInterval(subInterval);
  }, []);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyUrl = () => {
    const url = serverInfo?.pingUrl || `${window.location.origin}/api/stocks`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  // Rotate loading statements
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setStatementIdx((prev) => (prev + 1) % analysisLoadingStatements.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleGroupAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setAppliedTicker(null);

    try {
      const res = await fetch("/api/gemini/analyze-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ group: selectedGroup })
      });

      if (!res.ok) {
        throw new Error("נכשל באחזור ניתוח קבוצות המניות משרת Gemini");
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "שגיאה בחיבור למחלקת הניתוח הטכני");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommendedAlerts = async () => {
    if (!analysis) return;
    try {
      await onApplyAlerts(
        analysis.recommendedTicker,
        analysis.suggestedBuyPrice,
        analysis.suggestedSellPrice
      );
      setAppliedTicker(analysis.recommendedTicker);
    } catch (err) {
      console.error("Failed to apply alerts", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-right" id="settings_screen_root">
      
      {/* Decorative intro banner */}
      <div className={`p-6 rounded-3xl ${theme.card} relative overflow-hidden transition-all duration-300`}>
        <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className={`text-xl font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
              <Sliders className="w-5 h-5 text-cyan-400" />
              ניהול הגדרות ומחקר קבוצות מניות
            </h2>
            <p className={`text-xs ${theme.textMuted} mt-1`}>
              התאם את נושא העיצוב המועדף עליך ונתח מדדים וקבוצות מניות מובילות S&P באחד ממנועי ה-AI המתקדמים.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-xl font-mono">
            <Server className="w-3.5 h-3.5" />
            <span>מצב: לוקאלי ומאובטח</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RIGHT COLUMN: Theme settings (4 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`p-6 rounded-3xl ${theme.card} border transition-all duration-300 flex flex-col justify-between h-full`}>
            
            <div className="space-y-4">
              <h3 className={`text-md font-bold ${theme.textTitle} border-b border-dashed pb-3 flex items-center gap-2 justify-start`}>
                <Sliders className="w-4.5 h-4.5 text-emerald-400" />
                הגדרות עיצוב וחדות תצוגה
              </h3>

              <p className={`text-xs ${theme.textMuted}`}>
                הזז את הבר הבא כדי לשנות בהדרגה ובאופן רציף ולינארי את בהירות המסך והצהרת הצבעים מרמת כהות ושחור מוחלט לרמת בהירות משי למקסימום נוחות לעיניים.
              </p>

              {/* SLIDER/BAR (The un-missable drag bar requested by the user!) */}
              <div className={`p-4 rounded-2xl ${theme.subCard} border transition-all duration-300 space-y-4`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">בהיר משי חם</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${theme.badgeBg}`}>
                    ערך בר: {themeVal}%
                  </span>
                  <span className="font-bold text-slate-500">שחור פיח (OLED)</span>
                </div>

                <div className="relative pt-1">
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
                    className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500 text-cyan-500"
                  />
                </div>

                {/* Theme indicator description with high sharp response */}
                <div className="text-center">
                  <span className="text-xs font-bold text-cyan-500 font-sans">
                    תצוגה נוכחית: {theme.name}
                  </span>
                </div>
              </div>

              {/* Presets and shortcut buttons */}
              <div className="space-y-2">
                <span className={`text-[11px] font-bold block ${theme.textMuted}`}>קיצורי דרך מהירים לרמות בהירות:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setThemeVal(5);
                      localStorage.setItem("theme_val", "5");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      themeVal < 25 ? "bg-cyan-500 text-slate-950 border-cyan-500" : `bg-slate-900 text-slate-350 border-slate-800`
                    }`}
                  >
                    שחור פיח (OLED)
                  </button>
                  <button
                    onClick={() => {
                      setThemeVal(45);
                      localStorage.setItem("theme_val", "45");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      themeVal >= 25 && themeVal < 70 ? "bg-cyan-500 text-slate-950 border-cyan-500" : `${theme.subCard} text-slate-350 ${theme.border}`
                    }`}
                  >
                    כהה פחם רך
                  </button>
                  <button
                    onClick={() => {
                      setThemeVal(85);
                      localStorage.setItem("theme_val", "85");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      themeVal >= 70 ? "bg-cyan-500 text-slate-950 border-cyan-500" : `${theme.subCard} text-slate-350 ${theme.border}`
                    }`}
                  >
                    בהיר משי חם
                  </button>
                </div>
              </div>

              {/* Audio Alert Notification Controls */}
              <div className="space-y-4 border-t border-dashed pt-4">
                <h3 className={`text-xs font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
                  <Music className="w-4 h-4 text-purple-400 animate-bounce" />
                  הגדרות שמע והתראות קוליות
                </h3>

                <p className={`text-[11px] leading-normal ${theme.textMuted}`}>
                  קבל התראות קוליות מבוססות סינתיסייזר משובב (צליל עולה לקנייה וצליל מונחת אזהרתי למכירה) ברגע שמנייה חוצה את ספי ההתראה.
                </p>

                <div className={`p-4 rounded-2xl ${theme.subCard} border transition-all duration-300 flex items-center justify-between`}>
                  <div className="flex items-center gap-2.5">
                    {soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-rose-400" />
                    )}
                    <div className="text-right">
                      <span className={`text-xs font-bold block ${themeVal >= 70 ? "text-slate-800" : "text-white"}`}>התראות קוליות אקטיביות</span>
                      <span className="text-[10px] text-slate-500 block">אפשר השמעת צלילי אלארם</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const updated = !soundEnabled;
                      setSoundEnabled(updated);
                      localStorage.setItem("sound_enabled", String(updated));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer ${
                      soundEnabled 
                        ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950" 
                        : "bg-rose-500 hover:bg-rose-400 text-slate-950"
                    }`}
                  >
                    {soundEnabled ? "פעיל" : "מושתק"}
                  </button>
                </div>

                {/* Test triggers */}
                <div className="space-y-2">
                  <span className={`text-[11px] font-bold block ${theme.textMuted}`}>בדוק תקינות והשמע צליל לדוגמה:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => playAlertSound("BUY")}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${theme.subCard} ${theme.border} hover:bg-emerald-950/20 hover:text-emerald-400`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      צליל קנייה (BUY)
                    </button>
                    <button
                      onClick={() => playAlertSound("SELL")}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${theme.subCard} ${theme.border} hover:bg-rose-950/20 hover:text-rose-400`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      צליל מכירה (SELL)
                    </button>
                  </div>
                </div>
              </div>

              {/* General Notifications Toggler */}
              <div className="space-y-4 border-t border-dashed pt-4">
                <h3 className={`text-xs font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
                  <Bell className="w-4 h-4 text-amber-400 animate-bounce" style={{ animationDuration: '4s' }} />
                  הגדרות התראות קופצות (Toasts)
                </h3>

                <p className={`text-[11px] leading-normal ${theme.textMuted}`}>
                  בטל או הפעל את תיבות ההתראה הצצות במסך בזמן אמת בעת חציית ספי שערים, על מנת למנוע הסחות דעת ומטרדים קופצים.
                </p>

                <div className={`p-4 rounded-2xl ${theme.subCard} border transition-all duration-300 flex items-center justify-between`}>
                  <div className="flex items-center gap-2.5 text-right">
                    {notificationsEnabled ? (
                      <Bell className="w-5 h-5 text-amber-400 shrink-0" />
                    ) : (
                      <BellOff className="w-5 h-5 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <span className={`text-xs font-bold block ${themeVal >= 70 ? "text-slate-800" : "text-white"}`}>התראות קופצות במסך</span>
                      <span className="text-[10px] text-slate-500 block">
                        {notificationsEnabled ? "התראות פעילות ויופיעו במסך" : "התראות מושתקות ומצומצמות"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const updated = !notificationsEnabled;
                      setNotificationsEnabled(updated);
                      localStorage.setItem("notifications_enabled", String(updated));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer ${
                      notificationsEnabled 
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950" 
                        : "bg-slate-700 hover:bg-slate-650 text-slate-300"
                    }`}
                  >
                    {notificationsEnabled ? "פעיל (מציג)" : "מושתק (שקט)"}
                  </button>
                </div>
              </div>

              {/* GLOBAL MODE SWITCHER - VERY PROMINENT */}
              <div className="space-y-4 border-t border-dashed pt-4" id="mode_switcher_panel_settings">
                <h3 className={`text-xs font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  בורר מצב פעולת מערכת (Mode Switcher)
                </h3>

                <p className={`text-[11px] leading-normal ${theme.textMuted}`}>
                  קבעו את מצב הפעולה הראשי למערכת הסריקה. באפשרותכם לשנות אותו כאן והשינוי יחול מיידית על רכיב הסימולטור ודפי המעקב.
                </p>

                <div className="grid grid-cols-2 gap-3" dir="rtl">
                  <button
                    onClick={() => {
                      setSimMode("realtime");
                      localStorage.setItem("sim_mode", "realtime");
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 items-start cursor-pointer active:scale-95 ${
                      simMode === "realtime"
                        ? "bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_4px_15px_rgba(6,182,212,0.1)]"
                        : `${theme.subCard} ${theme.border} hover:border-slate-600 text-slate-400`
                    }`}
                  >
                    <span className="text-xs font-black flex items-center gap-1.5 justify-start">
                      <Activity className={`w-3.5 h-3.5 ${simMode === "realtime" ? "animate-pulse text-emerald-400" : ""}`} />
                      זמן אמת (Real-time)
                    </span>
                    <span className="text-[10px] leading-tight text-slate-500">
                      סורק ומסמלץ עסקאות בלייב לפי נתוני השוק האמיתיים.
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setSimMode("accelerated");
                      localStorage.setItem("sim_mode", "accelerated");
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 items-start cursor-pointer active:scale-95 ${
                      simMode === "accelerated"
                        ? "bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_4px_15px_rgba(6,182,212,0.1)]"
                        : `${theme.subCard} ${theme.border} hover:border-slate-600 text-slate-400`
                    }`}
                  >
                    <span className="text-xs font-black flex items-center gap-1.5 justify-start">
                      <Cpu className="w-3.5 h-3.5" />
                      מואץ (Backtest)
                    </span>
                    <span className="text-[10px] leading-tight text-slate-500">
                      מסמלץ 60 יום קדימה במהירות גבוהה לבדיקת הגידור.
                    </span>
                  </button>
                </div>
              </div>

            </div>

            <div className={`mt-6 p-3 rounded-xl border ${theme.subCard} text-[10px] text-slate-500 leading-normal flex items-start gap-1.5`}>
              <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <p>המערכת מתאימה דינמית את הניגודיות והחדדות של הגרפים וסימני המתח בהתאם לבהירות שנבחרה למקסימום קריאות בשמש ישירה או בלילה.</p>
            </div>

          </div>
        </div>

        {/* LEFT COLUMN: Group Stock analysis (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`p-6 rounded-3xl ${theme.card} border transition-all duration-300 space-y-6`}>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dashed pb-4">
              <div>
                <h3 className={`text-md font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
                  <Brain className="w-5 h-5 text-cyan-400" />
                  ניתוח קבוצות מניות ואינדקסים
                </h3>
                <p className={`text-xs ${theme.textMuted} mt-1`}>
                  בחר קבוצת מניות ספציפית וקבל המלצה חכמה מיידית מבוססת Gemini AI עבור המנייה המשתלמת ביותר למעקב
                </p>
              </div>
            </div>

            {/* Selection inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              
              <div className="space-y-1.5">
                <label className={`text-xs font-bold block ${theme.textMuted}`}>בחר מדד / קבוצת מניות:</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value as any)}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:border-cyan-500 transition-all font-bold ${theme.subCard} ${theme.border}`}
                >
                  <option value="SNP">קבוצת מובילות S&P 500 (AAPL, MSFT, AMZN, GOOGL)</option>
                  <option value="TECH">צמיחה טכנולוגית ותנודתית (TSLA, NVDA, META)</option>
                  <option value="ALL">כל מניות המערכת מובילות שוק מורחב</option>
                </select>
              </div>

              <div className="pt-5 sm:pt-0">
                <button
                  onClick={handleGroupAnalysis}
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  <Brain className="w-4 h-4 text-slate-950 animate-pulse" />
                  נתח קבוצה באמצעות Gemini AI
                </button>
              </div>

            </div>

            {/* Analysis Loading Screen */}
            {loading && (
              <div className={`p-8 rounded-2xl ${theme.subCard} border flex flex-col items-center text-center animate-pulse`}>
                <div className="relative w-12 h-12 mb-4">
                  <span className="absolute inset-0 rounded-full border-4 border-slate-705/30 border-t-cyan-500 animate-spin" />
                  <Brain className="absolute inset-0 m-auto w-5 h-5 text-cyan-400" />
                </div>
                <h4 className={`text-sm font-bold ${theme.textTitle}`}>{analysisLoadingStatements[statementIdx]}</h4>
                <p className="text-[10px] text-slate-500 mt-2 font-mono">Generative Model: gemini-3.5-flash</p>
              </div>
            )}

            {/* Error handling */}
            {error && (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 flex items-start gap-2 text-right">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-red-400 block">תקלה באנליזת הקבוצה:</span>
                  <span className="text-xs text-slate-400">{error}</span>
                </div>
              </div>
            )}

            {/* Analysis Results Display */}
            {analysis && (
              <div className="space-y-6 animate-slide-in">
                
                {/* Master Highlight Stock Recommendation Box */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-emerald-950/40 border border-cyan-500/30 space-y-4">
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-900/40 text-cyan-400 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wide">בחירת מומנטום המנייה האטרקטיבית</span>
                        <h4 className="text-md font-black text-slate-100 flex items-center gap-2 justify-start font-sans">
                          <span className="bg-slate-900/90 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded font-mono text-sm leading-none shrink-0">{analysis.recommendedTicker}</span>
                          - {analysis.recommendedName}
                        </h4>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-emerald-400 block">טווח הגדרת אלארם מומלץ:</span>
                      <span className="text-xs font-mono font-bold text-slate-100">
                        קנייה: ${analysis.suggestedBuyPrice} | מכירה: ${analysis.suggestedSellPrice}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-semibold bg-slate-905/40 p-3 rounded-xl border border-slate-800/60 whitespace-pre-wrap">
                    {analysis.whyRecommended}
                  </p>

                  <button
                    onClick={handleApplyRecommendedAlerts}
                    disabled={appliedTicker === analysis.recommendedTicker}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all
                      ${appliedTicker === analysis.recommendedTicker
                        ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-default"
                        : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 hover:shadow-cyan-500/25 active:scale-95"
                      }
                    `}
                  >
                    {appliedTicker === analysis.recommendedTicker ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        יעדי ההתראה של ה-AI הוגדרו עבור {analysis.recommendedTicker}!
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-slate-950" />
                        החל והגדר יעדי התראה אוטומטית למנייה המומלצת ({analysis.recommendedTicker})
                      </>
                    )}
                  </button>

                </div>

                {/* Index General Market Summary status */}
                <div className={`p-4 rounded-xl border ${theme.subCard} ${theme.border} space-y-2`}>
                  <span className={`text-[11px] font-bold block ${theme.textMuted}`}>סקירה וניתוח טרנד כללי למדד / קבוצה:</span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {analysis.marketSummary}
                  </p>
                </div>

                {/* Sub-shares Ratings grid */}
                <div className="space-y-3">
                  <span className={`text-xs font-bold block ${theme.textMuted}`}>סיווג ודירוג מלא של כל מניות הקבוצה:</span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {analysis.stocksRatings.map((rating) => {
                      const clientMatch = stocks.find(st => st.ticker === rating.ticker);
                      return (
                        <div key={rating.ticker} className={`p-3 rounded-xl border flex items-start gap-3 ${theme.subCard} ${theme.border}`}>
                          <div className="flex flex-col items-center justify-center shrink-0">
                            <span className="font-mono text-xs font-black bg-slate-900 text-slate-350 border px-1.5 py-0.5 rounded tracking-tight">{rating.ticker}</span>
                            {clientMatch && <span className="text-[10px] font-mono text-slate-400 mt-1">${clientMatch.currentPrice}</span>}
                          </div>

                          <div className="flex-1 min-w-0 text-right pr-1">
                            <div className="flex items-center gap-2 justify-start">
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                rating.rating === "BUY" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/10" :
                                rating.rating === "SELL" ? "bg-rose-950 text-rose-400 border border-rose-500/10" :
                                "bg-amber-950 text-amber-400 border border-amber-500/10"
                              }`}>
                                {rating.rating === "BUY" ? "קנייה" : rating.rating === "SELL" ? "מכירה" : "המתנה / HOLD"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {rating.reason}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Default advisory state card if not analyzed yet */}
            {!analysis && !loading && (
              <div className={`p-8 rounded-2xl ${theme.subCard} border flex flex-col items-center text-center space-y-2`}>
                <Info className="w-8 h-8 text-cyan-400/60" />
                <h4 className={`text-xs font-bold ${theme.textTitle}`}>טרם בוצע ניתוח קבוצתי</h4>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  בחר את קבוצת המניות המבוקשת לעיל ולחץ על כפתור המחקר לקבלת סקירה מקיפה וגילוי המניה הכי אטרקטיבית בשוק כרגע.
                </p>
              </div>
            )}

          </div>

          {/* KEEP-ALIVE & 24/7 OPERATIONS CONTROL CENTER */}
          <div className={`p-6 rounded-3xl ${theme.card} border transition-all duration-300 space-y-6`}>
            <div>
              <h3 className={`text-md font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
                <Activity className="w-5 h-5 text-cyan-400" />
                בקרה לפעילות רציפה 24/7 ומניעת שינה
              </h3>
              <p className={`text-xs ${theme.textMuted} mt-1`}>
                לפי חוקי הענן, האפליקציה נכנסת לשינה (Scale to Zero) במצב סרק כדי לחסוך משאבים. להלן מצב השרת העדכני וכלי ניטור למניעת השינה.
              </p>
            </div>

            {/* Live Monitoring Dashboard Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className={`p-3.5 rounded-2xl ${theme.subCard} border ${theme.border} flex flex-col justify-between`}>
                <span className="text-[10px] text-slate-500 block">סטטוס שרת נוכחי</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <strong className={`text-xs ${themeVal >= 70 ? "text-slate-800" : "text-slate-100"}`}>פעיל ומסמלץ</strong>
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl ${theme.subCard} border ${theme.border} flex flex-col justify-between`}>
                <span className="text-[10px] text-slate-500 block">זמן ריצה רציף (Uptime)</span>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-mono font-bold text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{serverInfo ? formatUptime(serverInfo.uptimeSeconds) : "טוען..."}</span>
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl ${theme.subCard} border ${theme.border} flex flex-col justify-between`}>
                <span className="text-[10px] text-slate-500 block">פעימות שערוך שוק (Ticks)</span>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-mono font-bold text-slate-200">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>{serverInfo ? serverInfo.tickCount : "טוען..."} פעימות</span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${theme.subCard} ${theme.border} text-xs space-y-1.5 text-slate-300`}>
              <strong className="text-amber-500 flex items-center gap-1.5 justify-start">
                <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" />
                מהי בעיית השינה של האפליקציה?
              </strong>
              <p className="leading-relaxed">
                מכיוון שהאפליקציה פועלת במחסן קונטיינרים אוטומטי (Google Cloud Run), ה-CPU של השרת מוקפא (Throttle / Sleep) כ-15 דקות לאחר שהמשתמש האחרון סוגר את הדפדפן. במצב כזה, סורק האלארמים והמסחר האוטומטי <strong>נעצר</strong>.
              </p>
            </div>

            {/* Steps & Solution Guide */}
            <div className="space-y-4">
              <strong className="text-xs text-cyan-400 block border-b border-dashed border-slate-800 pb-2">כיצד להפוך את האפליקציה לפעילה 24/7 ללא הפסקות?</strong>
              
              <div className="space-y-3.5">
                {/* Method 1: Eternal Webhook Pinger */}
                <div className={`p-4 rounded-2xl border ${theme.subCard} ${theme.border} space-y-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/20 text-xs font-black flex items-center justify-center shrink-0">1</span>
                      <div className="text-right">
                        <strong className="text-xs text-slate-100 block font-sans">שליחת Ping אוטומטי חיצוני (חינם וקל!)</strong>
                        <span className="text-[10px] text-slate-500 block">מונע מהשרת להיכנס למצב שינה על ידי קריאת רקע קבועה</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed pr-7">
                    תוכל להירשם לשירות חינמי לבדיקת דופק שרתים כגון <strong>Cron-Job.org</strong> או <strong>UptimeRobot.com</strong>, ולהגדיר קריאת HTTP GET פשוטה כל <strong>5 דקות</strong> לכתובת הבאה למטה. ה-Ping החיצוני יעיר וימשיך להחזיק את סריקת האלארמים פתוחה לצמיתות!
                  </p>

                  <div className="mr-7 p-2 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-cyan-400 truncate dir-ltr select-all flex-1 text-left">
                      {serverInfo?.pingUrl || `${window.location.origin}/api/stocks`}
                    </span>
                    <button
                      onClick={handleCopyUrl}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer"
                    >
                      {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedUrl ? "הועתק!" : "העתק כתובת"}
                    </button>
                  </div>
                </div>

                {/* Method 2: Cloud Run flag deployment description */}
                <div className={`p-4 rounded-2xl border ${theme.subCard} ${theme.border} space-y-2`}>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/20 text-xs font-black flex items-center justify-center shrink-0">2</span>
                    <div className="text-right">
                      <strong className="text-xs text-slate-100 block font-sans">הקצאת קונטיינר חם ב-Google Cloud Run (מינימום 1)</strong>
                      <span className="text-[10px] text-slate-500 block">ביטול מוחלט של ה-Scale to Zero ברמת התשתית</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed pr-7">
                    במידה ואתה מעדיף פתרון תשתיתי עצמאי לחלוטין, בצע את הפריסה בענן עם קביעת דגל מינימום מופעים של <code className="text-emerald-400 font-mono bg-slate-950 px-1 py-0.5 rounded text-[10px]">--min-instances 1</code>. 
                    הדבר מונע מ-GCP להוריד את כמות המכונות ל-0, ובכך השרת מוקצה 24/7 ברמת ה-Hypervisor.
                  </p>

                  <div className="mr-7 p-2 rounded-xl bg-slate-950 border border-slate-900 overflow-x-auto">
                    <code className="text-[9.5px] font-mono text-emerald-400 block whitespace-nowrap text-left" dir="ltr">
                      gcloud run deploy --min-instances 1 --no-cpu-throttling
                    </code>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

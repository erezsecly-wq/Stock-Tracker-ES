import { useState, useEffect, useCallback } from "react";
import {
  Cpu, Play, Square, RefreshCw, TrendingUp, TrendingDown, ShieldAlert,
  Activity, DollarSign, Save, Wifi
} from "lucide-react";

// ---------------------------------------------------------------------------
// ServerBot — UI for the REAL server-side autonomous trading engine.
// Unlike the in-browser AutoSimulator, this bot runs 24/7 on the server, makes
// real buy/sell decisions on every market tick, and persists everything — so
// you can leave it for 60 days and come back to genuine results.
// ---------------------------------------------------------------------------

interface ServerBotProps {
  theme: any;
  themeVal: number;
  token: string;
  stocks: { ticker: string; currentPrice: number }[];
}

interface TickerCfg {
  ticker: string;
  enabled: boolean;
  buyLimit: number;
  sellLimit: number;
}

interface BotData {
  config: {
    enabled: boolean;
    startingCapital: number;
    brokerCommission: number;
    positionSizePct: number;
    stopLossPct: number;
    takeProfitPct: number;
    maxLotsPerTicker: number;
    adaptive: boolean;
    trailingStopPct: number;
    tradeCooldownSec: number;
    startedAt: string | null;
    tickers: TickerCfg[];
  };
  cash: number;
  holdings: { ticker: string; shares: number; avgBuyPrice: number }[];
  equity: number;
  trades: any[];
  equityCurve: { t: string; equity: number }[];
}

interface Metrics {
  startingCapital: number;
  equity: number;
  cash: number;
  totalReturnPct: number;
  realizedPnL: number;
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  maxDrawdownPct: number;
  sharpe: number;
  benchmarkReturnPct: number | null;
  startedAt: string | null;
  enabled: boolean;
}

export default function ServerBot({ theme, themeVal, token, stocks }: ServerBotProps) {
  const [data, setData] = useState<BotData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Editable config (local copy)
  const [startingCapital, setStartingCapital] = useState(5000);
  const [positionSizePct, setPositionSizePct] = useState(15);
  const [stopLossPct, setStopLossPct] = useState(8);
  const [takeProfitPct, setTakeProfitPct] = useState(0);
  const [brokerCommission, setBrokerCommission] = useState(1.0);
  const [adaptive, setAdaptive] = useState(true);
  const [trailingStopPct, setTrailingStopPct] = useState(4);
  const [cooldownMin, setCooldownMin] = useState(15);
  const [tickers, setTickers] = useState<TickerCfg[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [liveFeed, setLiveFeed] = useState(false);
  const [now, setNow] = useState(Date.now());

  const auth = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const [bRes, mRes] = await Promise.all([
        fetch("/api/bot", { headers: auth }),
        fetch("/api/bot/metrics", { headers: auth })
      ]);
      if (bRes.ok) {
        const b: BotData = await bRes.json();
        setData(b);
        if (!loadedOnce) {
          setStartingCapital(b.config.startingCapital);
          setPositionSizePct(b.config.positionSizePct);
          setStopLossPct(b.config.stopLossPct);
          setTakeProfitPct(b.config.takeProfitPct);
          setBrokerCommission(b.config.brokerCommission);
          setAdaptive(!!b.config.adaptive);
          setTrailingStopPct(b.config.trailingStopPct ?? 4);
          setCooldownMin(Math.round((b.config.tradeCooldownSec ?? 900) / 60));
          setTickers(b.config.tickers);
          setLoadedOnce(true);
        }
      }
      if (mRes.ok) {
        const m = await mRes.json();
        setMetrics(m.metrics);
      }
      const lf = await fetch("/api/config/live-feed");
      if (lf.ok) setLiveFeed(!!(await lf.json()).useLiveFeed);
    } catch (e) {
      console.error("bot load error", e);
    }
  }, [token, loadedOnce]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  // Live ticking clock for the "time since start" display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Format elapsed time since the bot test started
  const elapsedSince = (startISO: string | null) => {
    if (!startISO) return "";
    const ms = now - new Date(startISO).getTime();
    if (ms < 0) return "";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${days} ימים, ${hours} שעות, ${mins} דקות`;
  };
  const daysElapsed = (startISO: string | null) =>
    startISO ? Math.floor((now - new Date(startISO).getTime()) / 86400000) : 0;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          startingCapital, positionSizePct, stopLossPct,
          takeProfitPct, brokerCommission, adaptive, tickers,
          trailingStopPct, tradeCooldownSec: cooldownMin * 60
        })
      });
      if (res.ok) flash("ההגדרות נשמרו בהצלחה");
    } finally {
      setSaving(false);
      load();
    }
  };

  const startBot = async () => {
    await saveConfig();
    const res = await fetch("/api/bot/start", { method: "POST", headers: auth });
    if (res.ok) flash("🟢 הבוט הופעל — מבצע מסחר אוטומטי 24/7 מעכשיו");
    load();
  };

  const stopBot = async () => {
    const res = await fetch("/api/bot/stop", { method: "POST", headers: auth });
    if (res.ok) flash("⏹️ הבוט נעצר (ההיסטוריה נשמרה)");
    load();
  };

  // Live Feed: connect the engine to REAL market prices (Yahoo Finance).
  // Trades remain simulated (paper) but now react to the real market.
  const toggleLiveFeed = async () => {
    const next = !liveFeed;
    const res = await fetch("/api/config/live-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next })
    });
    if (res.ok) {
      setLiveFeed(next);
      flash(next
        ? "📡 מחוברים למחירי שוק אמיתיים (Yahoo Finance) — מסחר מדומה לפי השוק האמיתי"
        : "🔌 חזרה למצב סימולציה (מחירים מדומים)");
    }
  };

  const setTickerField = (ticker: string, field: keyof TickerCfg, value: any) => {
    setTickers(prev => prev.map(t => t.ticker === ticker ? { ...t, [field]: value } : t));
  };

  const selectAll = (on: boolean) => setTickers(prev => prev.map(t => ({ ...t, enabled: on })));

  // "Smart thresholds": set buy/sell limits from the current live price (-3% / +6%)
  const smartThresholds = () => {
    setTickers(prev => prev.map(t => {
      const p = stocks.find(s => s.ticker === t.ticker)?.currentPrice;
      if (!p) return t;
      return { ...t, buyLimit: parseFloat((p * 0.97).toFixed(2)), sellLimit: parseFloat((p * 1.06).toFixed(2)) };
    }));
    flash("הוגדרו ספים חכמים לפי המחיר הנוכחי (קנייה -3%, מכירה +6%)");
  };

  const running = data?.config.enabled;
  const card = `p-5 rounded-3xl ${theme.card} border`;
  const lbl = `text-xs font-semibold ${themeVal >= 70 ? "text-slate-600" : "text-slate-400"}`;
  const input = `w-full border rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 font-mono ${theme.input}`;

  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header + controls */}
      <div className={`${card} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${running ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
            <Cpu className={`w-6 h-6 ${running ? "animate-spin" : ""}`} style={{ animationDuration: "5s" }} />
          </div>
          <div>
            <h3 className={`text-md font-black ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
              בוט מסחר אוטונומי 24/7 (צד שרת)
            </h3>
            <p className={`text-xs ${theme.textMuted}`}>
              {running
                ? `פעיל מאז ${data?.config.startedAt ? new Date(data.config.startedAt).toLocaleDateString("he-IL") : ""} · עברו ${elapsedSince(data?.config.startedAt || null)}`
                : "כבוי — הגדר אסטרטגיה ולחץ הפעלה"}
            </p>
            {running && (
              <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                יום {daysElapsed(data?.config.startedAt || null) + 1} מתוך 60
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleLiveFeed}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-bold transition-all ${liveFeed ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : `${theme.border} ${theme.subCard}`}`}
            title="חבר/נתק מחירי שוק אמיתיים (Yahoo Finance)">
            <Wifi className={`w-4 h-4 ${liveFeed ? "text-emerald-400" : ""}`} />
            {liveFeed ? "מחירים אמיתיים (LIVE)" : "מצב סימולציה"}
          </button>
          <button onClick={load} className={`p-2.5 rounded-xl border ${theme.border} ${theme.subCard} hover:opacity-80`} title="רענן">
            <RefreshCw className="w-4 h-4" />
          </button>
          {running ? (
            <button onClick={stopBot} className="flex items-center gap-2 py-2.5 px-5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-sm transition-all active:scale-95">
              <Square className="w-4 h-4" /> עצור בוט
            </button>
          ) : (
            <button onClick={startBot} className="flex items-center gap-2 py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all active:scale-95">
              <Play className="w-4 h-4" /> הפעל בוט (ואפס הון)
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-sm text-center">{msg}</div>
      )}

      {/* Metrics row */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Metric theme={theme} themeVal={themeVal} label="שווי תיק" value={`$${fmt(metrics.equity)}`} icon={<DollarSign className="w-4 h-4" />} />
          <Metric theme={theme} themeVal={themeVal} label="תשואה כוללת" value={`${metrics.totalReturnPct >= 0 ? "+" : ""}${metrics.totalReturnPct}%`} positive={metrics.totalReturnPct >= 0} />
          <Metric theme={theme} themeVal={themeVal} label="מול קנה-החזק" value={metrics.benchmarkReturnPct === null ? "—" : `${metrics.benchmarkReturnPct >= 0 ? "+" : ""}${metrics.benchmarkReturnPct}%`} positive={(metrics.benchmarkReturnPct ?? 0) >= 0} />
          <Metric theme={theme} themeVal={themeVal} label="אחוז הצלחה" value={`${metrics.winRate}%`} />
          <Metric theme={theme} themeVal={themeVal} label="ירידה מקס'" value={`-${metrics.maxDrawdownPct}%`} positive={false} />
          <Metric theme={theme} themeVal={themeVal} label="Sharpe" value={`${metrics.sharpe}`} />
          <Metric theme={theme} themeVal={themeVal} label="עסקאות" value={`${metrics.totalTrades}`} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        {/* Strategy config */}
        <div className={`${card} lg:col-span-1 space-y-4`}>
          <h4 className={`text-sm font-bold ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>הגדרות אסטרטגיה וסיכון</h4>
          <div className="space-y-3">
            <div>
              <label className={lbl}>הון התחלתי ($)</label>
              <input type="number" className={input} value={startingCapital} disabled={running}
                onChange={e => setStartingCapital(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>גודל פוזיציה (% מההון לכל קנייה)</label>
              <input type="number" className={input} value={positionSizePct}
                onChange={e => setPositionSizePct(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>Stop-Loss (% מתחת לעלות, 0=כבוי)</label>
              <input type="number" className={input} value={stopLossPct}
                onChange={e => setStopLossPct(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>Take-Profit (% מעל עלות, 0=לפי סף מכירה)</label>
              <input type="number" className={input} value={takeProfitPct}
                onChange={e => setTakeProfitPct(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>Trailing-Stop (% נעילת רווח מהשיא, 0=כבוי)</label>
              <input type="number" className={input} value={trailingStopPct}
                onChange={e => setTrailingStopPct(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>זמן המתנה בין עסקאות (דקות) — מונע over-trading</label>
              <input type="number" className={input} value={cooldownMin}
                onChange={e => setCooldownMin(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>עמלת ברוקר לעסקה ($)</label>
              <input type="number" step="0.1" className={input} value={brokerCommission}
                onChange={e => setBrokerCommission(parseFloat(e.target.value) || 0)} />
            </div>
            <label className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${theme.border} ${theme.subCard} cursor-pointer`}>
              <span className="text-xs font-bold">🧠 ספים אדפטיביים (לומד ומסתגל לשוק)</span>
              <input type="checkbox" checked={adaptive} onChange={e => setAdaptive(e.target.checked)} className="accent-cyan-500 w-5 h-5" />
            </label>
            {adaptive && (
              <p className={`text-[11px] ${theme.textMuted} leading-relaxed`}>
                כשמופעל, הבוט מנתח מגמה ותנודתיות אחת לדקה ומעדכן אוטומטית את ספי הקנייה/מכירה לכל מניה מופעלת.
              </p>
            )}
          </div>
          <button onClick={saveConfig} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-sm transition-all active:scale-95">
            <Save className="w-4 h-4" /> {saving ? "שומר..." : "שמור הגדרות"}
          </button>
          <p className={`text-[11px] ${theme.textMuted} leading-relaxed`}>
            <ShieldAlert className="w-3.5 h-3.5 inline ml-1 text-amber-400" />
            הפעלת הבוט מאפסת את ההון, האחזקות וההיסטוריה ומתחילה ריצה חדשה מעכשיו.
          </p>
        </div>

        {/* Tickers config */}
        <div className={`${card} lg:col-span-2 space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className={`text-sm font-bold ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>מניות במעקב הבוט וספי קנייה/מכירה</h4>
            <div className="flex items-center gap-2">
              <button onClick={() => selectAll(true)} className={`text-[11px] font-bold py-1.5 px-2.5 rounded-lg border ${theme.border} ${theme.subCard} hover:opacity-80`}>בחר הכל</button>
              <button onClick={() => selectAll(false)} className={`text-[11px] font-bold py-1.5 px-2.5 rounded-lg border ${theme.border} ${theme.subCard} hover:opacity-80`}>נקה הכל</button>
              <button onClick={smartThresholds} className="text-[11px] font-bold py-1.5 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950">⚡ ספים חכמים</button>
            </div>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {tickers.map(t => (
              <div key={t.ticker} className={`p-3 rounded-2xl border ${theme.border} ${theme.subCard} flex flex-wrap items-center gap-3`}>
                <label className="flex items-center gap-2 cursor-pointer min-w-[90px]">
                  <input type="checkbox" checked={t.enabled} onChange={e => setTickerField(t.ticker, "enabled", e.target.checked)} className="accent-cyan-500 w-4 h-4" />
                  <span className="font-mono font-black text-cyan-400 text-sm">{t.ticker}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 font-bold">קנייה ≤</span>
                  <input type="number" step="0.01" className={`${input} w-24 py-1`} value={t.buyLimit}
                    onChange={e => setTickerField(t.ticker, "buyLimit", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-rose-400 font-bold">מכירה ≥</span>
                  <input type="number" step="0.01" className={`${input} w-24 py-1`} value={t.sellLimit}
                    onChange={e => setTickerField(t.ticker, "sellLimit", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            ))}
            {tickers.length === 0 && <p className={`text-xs ${theme.textMuted}`}>טוען...</p>}
          </div>
        </div>
      </div>

      {/* Holdings + trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={card}>
          <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>
            <Activity className="w-4 h-4 text-cyan-400" /> אחזקות נוכחיות · מזומן ${fmt(data?.cash)}
          </h4>
          <div className="space-y-2">
            {data?.holdings.map(h => (
              <div key={h.ticker} className={`p-3 rounded-xl border ${theme.border} ${theme.subCard} flex justify-between items-center text-sm`}>
                <span className="font-mono font-bold text-cyan-400">{h.ticker}</span>
                <span className={theme.textMuted}>{h.shares} מניות @ ${fmt(h.avgBuyPrice)}</span>
              </div>
            ))}
            {(!data || data.holdings.length === 0) && <p className={`text-xs ${theme.textMuted}`}>אין אחזקות פתוחות.</p>}
          </div>
        </div>

        <div className={card}>
          <h4 className={`text-sm font-bold mb-3 ${themeVal >= 70 ? "text-slate-900" : "text-slate-100"}`}>עסקאות אחרונות של הבוט</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {data?.trades.slice(0, 40).map(tr => (
              <div key={tr.id} className={`p-2.5 rounded-xl border ${theme.border} ${theme.subCard} flex items-center justify-between gap-2 text-xs`}>
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${tr.type === "BUY" ? "bg-emerald-950/40 text-emerald-400" : "bg-rose-950/40 text-rose-400"}`}>
                    {tr.type === "BUY" ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  </span>
                  <span className="font-mono font-bold">{tr.ticker}</span>
                  <span className={theme.textMuted}>{tr.shares}@${fmt(tr.price)}</span>
                </div>
                <div className="text-left">
                  {tr.type === "SELL" && typeof tr.profit === "number" && (
                    <span className={`font-bold font-mono ${tr.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {tr.profit >= 0 ? "+" : ""}{fmt(tr.profit)}$
                    </span>
                  )}
                  <span className={`block text-[9px] ${theme.textMuted}`}>{new Date(tr.timestamp).toLocaleTimeString("he-IL")}</span>
                </div>
              </div>
            ))}
            {(!data || data.trades.length === 0) && <p className={`text-xs ${theme.textMuted}`}>טרם בוצעו עסקאות.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ theme, themeVal, label, value, positive, icon }: { theme: any; themeVal: number; label: string; value: string; positive?: boolean; icon?: any }) {
  const color = positive === undefined
    ? (themeVal >= 70 ? "text-slate-900" : "text-slate-100")
    : positive ? "text-emerald-400" : "text-rose-400";
  return (
    <div className={`p-3 rounded-2xl border ${theme.border} ${theme.subCard} text-center`}>
      <div className={`text-xs ${theme.textMuted} mb-1 flex items-center justify-center gap-1`}>{icon}{label}</div>
      <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
    </div>
  );
}

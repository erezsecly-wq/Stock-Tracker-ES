import { useState, useEffect, useRef, MouseEvent } from "react";
import { 
  Sparkles, Brain, Scale, ArrowLeftRight, Percent, 
  DollarSign, LineChart, Activity, Info, TrendingUp, TrendingDown, Check
} from "lucide-react";

interface StockInfo {
  ticker: string;
  name: string;
  currentPrice: number;
  dailyChangePercent: number;
  high24h: number;
  low24h: number;
  history: { time: string; price: number }[];
}

interface StockComparisonProps {
  stocks: StockInfo[];
  themeVal: number;
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
    chartRefLine: string;
  };
  token: string | null;
}

interface GeminiCompareResponse {
  comparisonSummary: string;
  winnerOption: string;
  winnerReason: string;
  keyDiffs: { title: string; description: string }[];
  suggestedStrategy: string;
}

const loadingStatements = [
  "מעבד שערי פתיחה וסגירה...",
  "מחשב סטיות תקן וזיהוי קורלציה...",
  "מנתח מגמות היסטוריות באמצעות Gemini...",
  "מגבש אסטרטגיית תיק מותאמת אישית..."
];

export default function StockComparison({
  stocks,
  themeVal,
  theme,
  token
}: StockComparisonProps) {
  // Select initial stocks
  const [tickerA, setTickerA] = useState<string>(stocks[0]?.ticker || "AAPL");
  const [tickerB, setTickerB] = useState<string>(stocks[1]?.ticker || "TSLA");

  // Chart view mode: 'price' (actual dual Y axis prices) or 'percent' (normalized benchmark % change)
  const [chartMode, setChartMode] = useState<"price" | "percent">("percent");

  // Interactive Hover Coordinate values
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Gemini comparison states
  const [loadingAI, setLoadingAI] = useState(false);
  const [statementIdx, setStatementIdx] = useState(0);
  const [aiReport, setAiReport] = useState<GeminiCompareResponse | null>(null);
  const [errorAI, setErrorAI] = useState<string | null>(null);

  const stockA = stocks.find(s => s.ticker === tickerA);
  const stockB = stocks.find(s => s.ticker === tickerB);

  // Rotate loading statements
  useEffect(() => {
    if (!loadingAI) return;
    const interval = setInterval(() => {
      setStatementIdx((prev) => (prev + 1) % loadingStatements.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [loadingAI]);

  // Clean comparative AI results when tickers change
  useEffect(() => {
    setAiReport(null);
    setErrorAI(null);
  }, [tickerA, tickerB]);

  const handleCompareAI = async () => {
    if (!tickerA || !tickerB) return;
    setLoadingAI(true);
    setErrorAI(null);
    setAiReport(null);

    try {
      const res = await fetch("/api/gemini/compare-stocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ tickerA, tickerB })
      });

      if (!res.ok) {
        throw new Error("שגיאה באחזור ניתוח ההשוואה העמוק מהשרת");
      }

      const data = await res.json();
      setAiReport(data);
    } catch (err: any) {
      setErrorAI(err.message || "נכשל בחיבור לרכיב החכם");
    } finally {
      setLoadingAI(false);
    }
  };

  // Safe tracking overlay logic
  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!chartContainerRef.current || !stockA || !stockA.history.length) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const totalPoints = stockA.history.length;
    
    // Find closest index
    const idx = Math.min(
      Math.max(Math.round(xRatio * (totalPoints - 1)), 0),
      totalPoints - 1
    );
    setHoverIndex(idx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Avoid selecting same stock
  const availableB = stocks.filter(s => s.ticker !== tickerA);
  const availableA = stocks.filter(s => s.ticker !== tickerB);

  return (
    <div className="space-y-8 animate-fade-in text-right" id="stock_comparison_root">
      
      {/* Dynamic Introduction Header */}
      <div className={`p-6 rounded-3xl ${theme.card} relative overflow-hidden transition-all duration-300`}>
        <div className="absolute top-0 left-0 w-36 h-36 bg-fuchsia-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className={`text-xl font-extrabold ${theme.textTitle} flex items-center gap-2 justify-start`}>
              <Scale className="w-5 h-5 text-fuchsia-400" />
              השוואת מניות חצי-רציפנית ואינטראקטיבית
            </h2>
            <p className={`text-xs ${theme.textMuted} mt-1`}>
              השווה שערים וביצועים של שתי מניות בו-זמנית על פני גרף משולב יחיד. בחר בין השוואת שער נומינלי לביצועי תשואה יחסיים מהפתיחה.
            </p>
          </div>
          <div className="flex bg-slate-900/15 p-1 rounded-2xl border border-dashed border-slate-700/30 gap-1.5 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setChartMode("percent")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                chartMode === "percent"
                  ? "bg-fuchsia-500 text-slate-950 shadow"
                  : `${theme.textMuted} hover:text-slate-200`
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              שינוי באחוזים
            </button>
            <button
              onClick={() => setChartMode("price")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                chartMode === "price"
                  ? "bg-cyan-500 text-slate-950 shadow"
                  : `${theme.textMuted} hover:text-slate-200`
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              שערים (ציר כפול)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* RIGHT COLUMN: Selection & Metadata (5 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`p-6 rounded-3xl ${theme.card} border transition-all duration-300 space-y-6`}>
            
            <h3 className={`text-sm font-bold ${theme.textTitle} border-b border-dashed pb-3 flex items-center gap-2 justify-start`}>
              <ArrowLeftRight className="w-4.5 h-4.5 text-cyan-400" />
              בחירת צמד המניות להשוואה
            </h3>

            {/* Select Stock A */}
            <div className={`p-4 rounded-2xl ${theme.subCard} border space-y-3`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-cyan-400">מנייה א' (ציר כחול)</span>
                {stockA && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    stockA.dailyChangePercent >= 0 ? "bg-emerald-950/40 text-emerald-400" : "bg-rose-950/40 text-rose-400"
                  }`}>
                    {stockA.dailyChangePercent >= 0 ? "+" : ""}{stockA.dailyChangePercent}%
                  </span>
                )}
              </div>
              
              <select
                value={tickerA}
                onChange={(e) => setTickerA(e.target.value)}
                className={`w-full p-2 rounded-xl text-xs border focus:outline-none focus:border-cyan-500 transition-all font-bold ${theme.input}`}
              >
                {availableA.map(st => (
                  <option key={st.ticker} value={st.ticker}>
                    {st.ticker} - {st.name}
                  </option>
                ))}
              </select>

              {stockA && (
                <div className="flex justify-between items-center text-[11px] font-mono pt-1 text-slate-400">
                  <span>שער נוכחי: <b>${stockA.currentPrice}</b></span>
                  <span>טווח: ${stockA.low24h} - ${stockA.high24h}</span>
                </div>
              )}
            </div>

            {/* Select Stock B */}
            <div className={`p-4 rounded-2xl ${theme.subCard} border space-y-3`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-fuchsia-400">מנייה ב' (ציר סגול)</span>
                {stockB && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    stockB.dailyChangePercent >= 0 ? "bg-emerald-950/40 text-emerald-400" : "bg-rose-950/40 text-rose-400"
                  }`}>
                    {stockB.dailyChangePercent >= 0 ? "+" : ""}{stockB.dailyChangePercent}%
                  </span>
                )}
              </div>
              
              <select
                value={tickerB}
                onChange={(e) => setTickerB(e.target.value)}
                className={`w-full p-2 rounded-xl text-xs border focus:outline-none focus:border-fuchsia-500 transition-all font-bold ${theme.input}`}
              >
                {availableB.map(st => (
                  <option key={st.ticker} value={st.ticker}>
                    {st.ticker} - {st.name}
                  </option>
                ))}
              </select>

              {stockB && (
                <div className="flex justify-between items-center text-[11px] font-mono pt-1 text-slate-400">
                  <span>שער נוכחי: <b>${stockB.currentPrice}</b></span>
                  <span>טווח: ${stockB.low24h} - ${stockB.high24h}</span>
                </div>
              )}
            </div>

            {/* AI Callout */}
            <div className="pt-2">
              <button
                onClick={handleCompareAI}
                disabled={loadingAI}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <Brain className="w-4.5 h-4.5 text-slate-950 animate-pulse" />
                בצע השוואה פיננסית חכמה ב-AI
              </button>
            </div>

            {/* Advisory Information */}
            <div className={`p-3.5 rounded-2xl border ${theme.subCard} text-[10px] text-slate-500 leading-normal flex items-start gap-1.5`}>
              <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <b className="text-slate-400 block mb-0.5">כיצד לקרוא את הגרף?</b>
                <span>
                  במצב <b>שינוי באחוזים</b>, שתיהן מקבלות נקודה מאוזנת של 0% בנקודת תכולת המסחר ומייצגות מי מהמניות רשמה את הביצועים הטובים ביותר בפועל. מצב <b>שערים</b> מציג את השער האמיתי, כאשר מנייה אחת משתמשת בסולם השמאלי והשנייה בימני.
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* LEFT COLUMN: Combined Interactive Graph View (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className={`p-6 rounded-3xl ${theme.card} border transition-all duration-300 space-y-6`}>
            
            {/* Legend & Hover details panel header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/30 p-4 rounded-2xl border border-dashed border-slate-705/30">
              
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-cyan-500 border border-cyan-350" />
                  <span className={`${themeVal >= 70 ? "text-slate-800" : "text-white"}`}>{tickerA}</span>
                  {chartMode === "price" && stockA && (
                    <span className="text-[10px] text-cyan-400 font-mono">(${stockA.currentPrice})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-fuchsia-500 border border-fuchsia-350" />
                  <span className={`${themeVal >= 70 ? "text-slate-800" : "text-white"}`}>{tickerB}</span>
                  {chartMode === "price" && stockB && (
                    <span className="text-[10px] text-fuchsia-400 font-mono">(${stockB.currentPrice})</span>
                  )}
                </div>
              </div>

              {/* Real time hover popup widget */}
              <div className="text-left font-mono">
                {hoverIndex !== null && stockA && stockB ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] justify-end">
                    <span className="text-slate-500">שעה: {stockA.history[hoverIndex]?.time}</span>
                    <span className="text-cyan-400 font-bold">
                      {tickerA}: {chartMode === "price" 
                        ? `$${stockA.history[hoverIndex]?.price}` 
                        : `${(((stockA.history[hoverIndex]?.price - stockA.history[0]?.price) / stockA.history[0]?.price) * 100).toFixed(2)}%`
                      }
                    </span>
                    <span className="text-fuchsia-400 font-bold">
                      {tickerB}: {chartMode === "price" 
                        ? `$${stockB.history[hoverIndex]?.price}` 
                        : `${(((stockB.history[hoverIndex]?.price - stockB.history[0]?.price) / stockB.history[0]?.price) * 100).toFixed(2)}%`
                      }
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500">העבר עכבר על הגרף לתוצאות נקודתיות</span>
                )}
              </div>

            </div>

            {/* Combined Chart Stage */}
            <div className={`p-4 rounded-2xl ${theme.subCard} border transition-all duration-300 relative`}>
              
              <div 
                ref={chartContainerRef}
                className="relative h-56 w-full"
              >
                {(() => {
                  if (!stockA || !stockB || !stockA.history.length || !stockB.history.length) {
                    return (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                        אין נתוני היסטוריית מחירים עבור צמד זה.
                      </div>
                    );
                  }

                  const height = 224; // Matches h-56 in pixels
                  const width = 800;  // Standard ratio viewBox width

                  // We need to coordinate mapping based on mode
                  let pointsA = "";
                  let pointsB = "";

                  let leftYMinLabel = "";
                  let leftYMaxLabel = "";
                  let rightYMinLabel = "";
                  let rightYMaxLabel = "";

                  if (chartMode === "price") {
                    // LEFT AXIS mapping (Stock A)
                    const pricesA = stockA.history.map(pt => pt.price);
                    const minA = Math.min(...pricesA) * 0.999;
                    const maxA = Math.max(...pricesA) * 1.001;
                    const rangeA = maxA - minA || 1;

                    // RIGHT AXIS mapping (Stock B)
                    const pricesB = stockB.history.map(pt => pt.price);
                    const minB = Math.min(...pricesB) * 0.999;
                    const maxB = Math.max(...pricesB) * 1.001;
                    const rangeB = maxB - minB || 1;

                    leftYMinLabel = `$${minA.toFixed(1)}`;
                    leftYMaxLabel = `$${maxA.toFixed(1)}`;
                    rightYMinLabel = `$${minB.toFixed(1)}`;
                    rightYMaxLabel = `$${maxB.toFixed(1)}`;

                    pointsA = stockA.history.map((pt, idx) => {
                      const x = (idx / (stockA.history.length - 1)) * width;
                      const y = height - ((pt.price - minA) / rangeA) * height;
                      return `${x},${y}`;
                    }).join(" ");

                    pointsB = stockB.history.map((pt, idx) => {
                      const x = (idx / (stockB.history.length - 1)) * width;
                      const y = height - ((pt.price - minB) / rangeB) * height;
                      return `${x},${y}`;
                    }).join(" ");

                  } else {
                    // PERCENT MODE: Performance relative to point 0
                    const firstPriceA = stockA.history[0]?.price || 1;
                    const perfA = stockA.history.map(pt => ((pt.price - firstPriceA) / firstPriceA) * 100);

                    const firstPriceB = stockB.history[0]?.price || 1;
                    const perfB = stockB.history.map(pt => ((pt.price - firstPriceB) / firstPriceB) * 100);

                    const allPerfs = [...perfA, ...perfB];
                    const minPerf = Math.min(...allPerfs) - 0.2;
                    const maxPerf = Math.max(...allPerfs) + 0.2;
                    const rangePerf = maxPerf - minPerf || 1;

                    leftYMinLabel = `${minPerf.toFixed(2)}%`;
                    leftYMaxLabel = `${maxPerf.toFixed(2)}%`;
                    rightYMinLabel = leftYMinLabel; // Unified scales
                    rightYMaxLabel = leftYMaxLabel;

                    pointsA = perfA.map((val, idx) => {
                      const x = (idx / (perfA.length - 1)) * width;
                      const y = height - ((val - minPerf) / rangePerf) * height;
                      return `${x},${y}`;
                    }).join(" ");

                    pointsB = perfB.map((val, idx) => {
                      const x = (idx / (perfB.length - 1)) * width;
                      const y = height - ((val - minPerf) / rangePerf) * height;
                      return `${x},${y}`;
                    }).join(" ");
                  }

                  // Coordinate circles for hovered item if active
                  let hoverCircleAX = 0, hoverCircleAY = 0;
                  let hoverCircleBX = 0, hoverCircleBY = 0;

                  if (hoverIndex !== null) {
                    const coordsA = pointsA.split(" ")[hoverIndex];
                    if (coordsA) {
                      const [x, y] = coordsA.split(",");
                      hoverCircleAX = parseFloat(x);
                      hoverCircleAY = parseFloat(y);
                    }
                    const coordsB = pointsB.split(" ")[hoverIndex];
                    if (coordsB) {
                      const [x, y] = coordsB.split(",");
                      hoverCircleBX = parseFloat(x);
                      hoverCircleBY = parseFloat(y);
                    }
                  }

                  return (
                    <div className="relative w-full h-full">
                      {/* Left Axis Scale Indicator */}
                      <span className="absolute right-0 top-0 font-mono text-[9px] text-cyan-500 bg-slate-950/20 px-1 rounded transform translate-x-1 translate-y-2 z-10 select-none">
                        {leftYMaxLabel}
                      </span>
                      <span className="absolute right-0 bottom-0 font-mono text-[9px] text-cyan-500 bg-slate-950/20 px-1 rounded transform translate-x-1 -translate-y-2 z-10 select-none">
                        {leftYMinLabel}
                      </span>

                      {/* Right Axis Scale Indicator */}
                      <span className="absolute left-0 top-0 font-mono text-[9px] text-fuchsia-500 bg-slate-950/20 px-1 rounded transform -translate-x-1 translate-y-2 z-10 select-none">
                        {rightYMaxLabel}
                      </span>
                      <span className="absolute left-0 bottom-0 font-mono text-[9px] text-fuchsia-500 bg-slate-950/20 px-1 rounded transform -translate-x-1 -translate-y-2 z-10 select-none">
                        {rightYMinLabel}
                      </span>

                      <svg 
                        className="w-full h-full overflow-visible select-none cursor-crosshair" 
                        viewBox={`0 0 ${width} ${height}`} 
                        preserveAspectRatio="none"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Horizontal Grid lines */}
                        <line x1="0" y1="0" x2={width} y2="0" stroke={theme.chartRefLine} strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={theme.chartRefLine} strokeWidth="1" strokeDasharray="3,3" />
                        <line x1="0" y1={height} x2={width} y2={height} stroke={theme.chartRefLine} strokeWidth="1" strokeDasharray="3,3" />

                        {/* Chart dual lines */}
                        <polyline
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="3"
                          points={pointsA}
                          className="transition-all duration-300 pointer-events-none"
                        />
                        <polyline
                          fill="none"
                          stroke="#d946ef"
                          strokeWidth="3"
                          points={pointsB}
                          className="transition-all duration-300 pointer-events-none"
                        />

                        {/* Interactive vertical hover target guide line */}
                        {hoverIndex !== null && (
                          <>
                            <line
                              x1={hoverCircleAX}
                              y1="0"
                              x2={hoverCircleAX}
                              y2={height}
                              stroke={themeVal >= 70 ? "#64748b" : "#475569"}
                              strokeWidth="1"
                              strokeDasharray="2,2"
                              className="pointer-events-none"
                            />

                            {/* Anchor indicators */}
                            <circle
                              cx={hoverCircleAX}
                              cy={hoverCircleAY}
                              r="6"
                              fill="#06bab4"
                              stroke={themeVal >= 70 ? "#ffffff" : "#0f172a"}
                              strokeWidth="1.5"
                              className="pointer-events-none animate-pulse"
                            />
                            <circle
                              cx={hoverCircleBX}
                              cy={hoverCircleBY}
                              r="6"
                              fill="#d946ef"
                              stroke={themeVal >= 70 ? "#ffffff" : "#0f172a"}
                              strokeWidth="1.5"
                              className="pointer-events-none animate-pulse"
                            />
                          </>
                        )}
                      </svg>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom timeline alignment axis */}
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-3" dir="ltr">
                <span>{stockA?.history[0]?.time || "09:30"}</span>
                <span>{stockA?.history[2]?.time || "11:30"}</span>
                <span>{stockA?.history[4]?.time || "13:30"}</span>
                <span>{stockA?.history[stockA?.history.length - 1]?.time || "14:30"}</span>
              </div>

            </div>

            {/* Performance analysis metric tags (Relative Gap) */}
            {stockA && stockB && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                <div className={`p-4 rounded-2xl border ${theme.subCard} ${theme.border} text-right`}>
                  <span className={`text-[10px] block font-bold ${theme.textMuted}`}>פער ביצוע תוך-יומי יחסי:</span>
                  <div className="flex items-center gap-1.5 justify-start mt-1">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-mono font-bold">
                      {Math.abs(stockA.dailyChangePercent - stockB.dailyChangePercent).toFixed(2)} אחוזים
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    מפתח מומנטום יחסי
                  </span>
                </div>

                <div className={`p-4 rounded-2xl border ${theme.subCard} ${theme.border} text-right`}>
                  <span className={`text-[10px] block font-bold ${theme.textMuted}`}>המנייה התזזיתית ביותר:</span>
                  <div className="flex items-center gap-1.5 justify-start mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
                    <span className="text-sm font-bold font-mono">
                      {Math.abs(stockA.high24h - stockA.low24h) / stockA.currentPrice > Math.abs(stockB.high24h - stockB.low24h) / stockB.currentPrice 
                        ? `${tickerA} (${((Math.abs(stockA.high24h - stockA.low24h) / stockA.currentPrice) * 100).toFixed(2)}%)`
                        : `${tickerB} (${((Math.abs(stockB.high24h - stockB.low24h) / stockB.currentPrice) * 100).toFixed(2)}%)`
                      }
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    רמת סטיית תקן שיווקית
                  </span>
                </div>

                <div className={`p-4 rounded-2xl border ${theme.subCard} ${theme.border} text-right`}>
                  <span className={`text-[10px] block font-bold ${theme.textMuted}`}>המובילה היומית כרגע:</span>
                  <div className="flex items-center gap-1.5 justify-start mt-1">
                    {stockA.dailyChangePercent > stockB.dailyChangePercent ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold font-mono text-emerald-400">{tickerA} ({stockA.dailyChangePercent}%)</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold font-mono text-emerald-400">{tickerB} ({stockB.dailyChangePercent}%)</span>
                      </>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    מיינדסט ביצוע יומי יחס
                  </span>
                </div>

              </div>
            )}

            {/* AI loading box */}
            {loadingAI && (
              <div className={`p-8 rounded-2xl ${theme.subCard} border flex flex-col items-center text-center animate-pulse`}>
                <div className="relative w-12 h-12 mb-4">
                  <span className="absolute inset-0 rounded-full border-4 border-slate-705/30 border-t-fuchsia-500 animate-spin" />
                  <Brain className="absolute inset-0 m-auto w-5 h-5 text-fuchsia-400" />
                </div>
                <h4 className={`text-sm font-bold ${theme.textTitle}`}>{loadingStatements[statementIdx]}</h4>
                <p className="text-[10px] text-slate-500 mt-2 font-mono">Generative Model: gemini-3.5-flash</p>
              </div>
            )}

            {/* Error AI display */}
            {errorAI && (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 flex items-start gap-2">
                <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-red-400 block">תקלה באחזור הדלפה השוואתית:</span>
                  <span className="text-xs text-slate-400">{errorAI}</span>
                </div>
              </div>
            )}

            {/* AI report detailed UI */}
            {aiReport && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-fuchsia-950/40 via-purple-950/40 to-slate-900 border border-fuchsia-500/20 space-y-6 animate-slide-in">
                
                <div className="border-b border-fuchsia-500/10 pb-4">
                  <div className="flex items-center gap-2 mb-1 justify-start">
                    <Sparkles className="w-5 h-5 text-fuchsia-400" />
                    <span className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wide">סיכום השוואה פיננסית מבוסס Gemini</span>
                  </div>
                  <h4 className="text-md font-bold text-slate-100">סקירת הצמד {tickerA} לעומת {tickerB}</h4>
                  <p className="text-xs text-slate-350 mt-2 leading-relaxed whitespace-pre-wrap">{aiReport.comparisonSummary}</p>
                </div>

                {/* Preferred winner block */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
                  <span className="text-xs text-emerald-400 font-bold block flex items-center gap-1.5 justify-start">
                    <Check className="w-4 h-4 shrink-0" />
                    הבחירה המועדפת להשקעה או מעקב צמוד מבין השתיים:
                  </span>
                  <h5 className="text-sm font-black text-slate-100 flex items-center gap-2 justify-start font-sans">
                    <span className="bg-slate-900 text-cyan-350 border border-cyan-500/20 px-2 py-0.5 rounded font-mono text-xs leading-none shrink-0">
                      {aiReport.winnerOption}
                    </span>
                    - מניית {stocks.find(s => s.ticker === aiReport.winnerOption)?.name || aiReport.winnerOption}
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">{aiReport.winnerReason}</p>
                </div>

                {/* Key divergences */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">ערוצי התפצלות ונקודות מפתח:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiReport.keyDiffs.map((diff, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs font-bold text-cyan-400 block">{diff.title}</span>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{diff.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strategy card */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="text-xs font-bold text-amber-400 block">המלצה אופרטיבית ופרוטוקול כניסה:</span>
                  <p className="text-[11px] text-slate-350 mt-1 leading-relaxed">{aiReport.suggestedStrategy}</p>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}

import { useState, useEffect } from "react";
import { X, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Target, Brain, ArrowLeftRight, Check } from "lucide-react";
import { GeminiAnalysis } from "../types";

interface StockAnalysisModalProps {
  ticker: string;
  currentPrice: number;
  token: string | null;
  onApplyThresholds: (buyPrice: number, sellPrice: number) => void;
  onClose: () => void;
}

const loadingStatements = [
  "מנתח נתוני תמיכה והתנגדות היסטוריים...",
  "מחשב טווח דיסקאונט מדורג לקנייה אטרקטיבית...",
  "מעבד סנטימנט שוק גלובלי באמצעות מודל ה-AI...",
  "מגבש המלצת השקעה חכמה ומחושבת..."
];

export default function StockAnalysisModal({
  ticker,
  currentPrice,
  token,
  onApplyThresholds,
  onClose
}: StockAnalysisModalProps) {
  const [loading, setLoading] = useState(true);
  const [statementIdx, setStatementIdx] = useState(0);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  // Rotate loading statements
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setStatementIdx((prev) => (prev + 1) % loadingStatements.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  // Fetch analysis from server
  useEffect(() => {
    let active = true;
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        setError(null);
        setApplied(false);
        const res = await fetch("/api/gemini/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ ticker })
        });
        if (!res.ok) {
          throw new Error("נכשל בטעינת ניתוח המניה");
        }
        const data = await res.json();
        if (active) {
          setAnalysis(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "שגיאה בחיבור לשרת הניתוח");
          setLoading(false);
        }
      }
    };
    fetchAnalysis();
    return () => {
      active = false;
    };
  }, [ticker, token]);

  const handleApply = () => {
    if (!analysis) return;
    
    // Parse recommended ranges to attempt to extract numeric value automatically
    // Format is usually "$165 - $172" or similar. We fall back to standard margins of current price.
    let buyPrice = currentPrice * 0.95;
    let sellPrice = currentPrice * 1.05;

    const extractNumbers = (str: string): number[] => {
      const matches = str.match(/\d+(\.\d+)?/g);
      return matches ? matches.map(Number) : [];
    };

    const buyNums = extractNumbers(analysis.recommendedBuyRange);
    const sellNums = extractNumbers(analysis.recommendedSellRange);

    if (buyNums.length > 0) {
      // Use average of range or the high bound (worst case buy)
      buyPrice = buyNums[buyNums.length - 1];
    }
    if (sellNums.length > 0) {
      // Use the lower bound of sell (conservative target)
      sellPrice = sellNums[0];
    }

    onApplyThresholds(parseFloat(buyPrice.toFixed(2)), parseFloat(sellPrice.toFixed(2)));
    setApplied(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="analysis_modal_sec">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden text-right leading-relaxed text-slate-200">
        
        {/* Decorative background blur */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 relative z-10 select-none">
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-100 font-sans tracking-tight">אנליסט השקעות חכם - Gemini AI</h2>
              <p className="text-xs text-slate-400">ניתוח טכני ופונדמנטלי חזוי עבור {ticker}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 relative z-10" dir="rtl">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative w-16 h-16 mb-6">
                <span className="absolute inset-0 rounded-full border-4 border-slate-800" />
                <span className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-r-transparent animate-spin" />
                <Brain className="absolute inset-0 m-auto w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
              <h4 className="text-lg font-semibold text-slate-200 animate-pulse">{loadingStatements[statementIdx]}</h4>
              <p className="text-xs text-slate-500 mt-2 font-mono">מודל בינה מלאכותית פעיל: gemini-3.5-flash</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-semibold text-slate-100">שגיאה באחזור ניתוח</h4>
              <p className="text-xs text-slate-400 mt-2">{error}</p>
              <button 
                onClick={onClose}
                className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all"
              >
                סגור דוח
              </button>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              
              {/* Primary KPIs block */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Sentiment card */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">סנטימנט השוק</span>
                    <TrendingUp className={`w-4 h-4 ${analysis.sentiment === "Bullish" ? "text-emerald-400" : analysis.sentiment === "Bearish" ? "text-rose-400" : "text-amber-400"}`} />
                  </div>
                  <div>
                    <span className={`text-lg font-bold ${
                      analysis.sentiment === "Bullish" ? "text-emerald-400" : analysis.sentiment === "Bearish" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {analysis.sentiment === "Bullish" ? "חיובי (Bullish)" : analysis.sentiment === "Bearish" ? "שלילי (Bearish)" : "נייטרלי (Neutral)"}
                    </span>
                  </div>
                </div>

                {/* Recommendation card */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">המלצת קנייה/מכירה</span>
                    <Brain className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <span className={`text-xl font-extrabold ${
                      analysis.recommendation === "BUY" ? "text-emerald-400 shadow-emerald-500/10" : analysis.recommendation === "SELL" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {analysis.recommendation === "BUY" ? "קנייה אטרקטיבית (BUY)" : analysis.recommendation === "SELL" ? "לקחת רווחים (SELL)" : "להמתין מחוץ לשוק (HOLD)"}
                    </span>
                  </div>
                </div>

                {/* Target Price Projections */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">מחיר מטרה (3 חודשים)</span>
                    <Target className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-slate-100 font-mono">${analysis.targetPriceDraft}</span>
                    <span className="text-xs text-emerald-400">
                      (+{(((analysis.targetPriceDraft - currentPrice) / currentPrice) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>

              </div>

              {/* Alert threshold mapping cards */}
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  מדדי מחיר אסטרטגיים מוצעים
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Recommended Low Entry buy */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">מחיר דיסקאונט לקנייה:</span>
                      <span className="text-md font-bold text-emerald-400 font-mono">{analysis.recommendedBuyRange}</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/40 text-emerald-400 flex items-center justify-center text-xs">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Recommended Profitable exit sell */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block font-sans">מחיר גזירת רווח (מכירה):</span>
                      <span className="text-md font-bold text-rose-400 font-mono">{analysis.recommendedSellRange}</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-rose-950/40 text-rose-400 flex items-center justify-center text-xs">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Apply recommendation button */}
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applied}
                  className={`mt-4 w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-md
                    ${applied 
                      ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-default" 
                      : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 hover:shadow-cyan-500/20 active:scale-[0.98]"
                    }
                  `}
                >
                  {applied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      הודגרו בהצלחה כהתראות המעקב שלך!
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4" />
                      עדכן התראות מעקב לטווח המומלץ של AI
                    </>
                  )}
                </button>
              </div>

              {/* Comprehensive explanation written in Hebrew */}
              <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-850 space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">ניתוח מעמיק וחוות דעת פונדמנטלית</h4>
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {analysis.analysisText}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-[10px] text-slate-500 leading-normal flex items-start gap-1 p-2 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                <span className="text-amber-500 font-bold block shrink-0">הבהרה:</span>
                <p>הניתוח המוצג מבוסס על מודל בינה מלאכותית (Gemini LLM) המיועד לצורך מידע כללי והמחשה בלבד. אין לראות בדוח זה ייעוץ השקעות מקצועי, המלצה רשמית או תחליף לקבלת החלטת השקעות עצמאית המלווה בייעוץ מורשה על פי חוק.</p>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 text-[11px] text-slate-500 flex justify-between items-center px-6">
          <span>AI Engine: Gemini-3.5-flash</span>
          <span>עודכן לאחרונה: {analysis ? new Date(analysis.timestamp).toLocaleTimeString() : "--:--"}</span>
        </div>

      </div>
    </div>
  );
}

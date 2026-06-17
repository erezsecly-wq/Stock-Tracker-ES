import { useState, FormEvent } from "react";
import { PortfolioItem, StockInfo } from "../types";
import { DollarSign, Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Check, AlertCircle } from "lucide-react";

interface PortfolioSummaryProps {
  portfolio: PortfolioItem[];
  stocks: StockInfo[];
  onTrade: (ticker: string, shares: number, type: "BUY" | "SELL", price: number) => Promise<boolean>;
}

export default function PortfolioSummary({
  portfolio,
  stocks,
  onTrade
}: PortfolioSummaryProps) {
  const [selectedTicker, setSelectedTicker] = useState(stocks[0]?.ticker || "AAPL");
  const [sharesInput, setSharesInput] = useState("5");
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hardcoded simulated cash balance starting at $50,000 for realistic simulation
  const [cashBalance, setCashBalance] = useState(48500); // 50000 - starting Apple allocation

  const selectedStock = stocks.find(s => s.ticker === selectedTicker);
  const currentPrice = selectedStock ? selectedStock.currentPrice : 0;

  // Calculate current value of assets
  const totalAssetsValue = portfolio.reduce((total, item) => {
    const s = stocks.find(stock => stock.ticker === item.ticker);
    const livePrice = s ? s.currentPrice : item.avgBuyPrice;
    return total + (item.shares * livePrice);
  }, 0);

  const totalCostBasis = portfolio.reduce((total, item) => {
    return total + (item.shares * item.avgBuyPrice);
  }, 0);

  const totalPortfolioValue = totalAssetsValue + cashBalance;
  const totalProfitLossPrice = totalAssetsValue - totalCostBasis;
  const totalProfitLossPercent = totalCostBasis > 0 ? (totalProfitLossPrice / totalCostBasis) * 100 : 0;

  const handleExecuteTrade = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    setLoading(true);

    const sharesToTrade = parseInt(sharesInput);
    if (!selectedTicker || isNaN(sharesToTrade) || sharesToTrade <= 0) {
      setErrorMsg("נא להזין כמות מניות תקינה");
      setLoading(false);
      return;
    }

    const tradeCost = sharesToTrade * currentPrice;

    if (tradeType === "BUY") {
      if (tradeCost > cashBalance) {
        setErrorMsg(`אין מספיק מזומן זמין לביצוע הרכישה (עלות כוללת: $${tradeCost.toLocaleString()})`);
        setLoading(false);
        return;
      }
    } else {
      const ownedItem = portfolio.find(item => item.ticker === selectedTicker);
      if (!ownedItem || ownedItem.shares < sharesToTrade) {
        setErrorMsg("אין ברשותך מספיק מניות לביצוע המכירה");
        setLoading(false);
        return;
      }
    }

    const success = await onTrade(selectedTicker, sharesToTrade, tradeType, currentPrice);
    if (success) {
      if (tradeType === "BUY") {
        setCashBalance((prev) => parseFloat((prev - tradeCost).toFixed(2)));
        setSuccessMsg(`הרכישה בוצעה בהצלחה! קנית ${sharesToTrade} מניות של ${selectedTicker}`);
      } else {
        setCashBalance((prev) => parseFloat((prev + tradeCost).toFixed(2)));
        setSuccessMsg(`המכירה בוצעה בהצלחה! מכרת ${sharesToTrade} מניות של ${selectedTicker}`);
      }
      setSharesInput("5");
    } else {
      setErrorMsg("ביצוע העסקא נכשל בצד השרת");
    }
    setLoading(false);

    // Timeout messages
    setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 4000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-200 text-right leading-relaxed" dir="rtl" id="portfolio_sec">
      
      {/* Portfolio financials block */}
      <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              תיק ההשקעות המדומה שלי
            </h3>
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-sans font-medium">הדמיית מסחר חיה</span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <span className="text-xs text-slate-450 block mb-1">שווי תיק כולל (Asset + Cash)</span>
              <span className="text-xl font-black text-slate-100 font-mono">${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
              <span className="text-xs text-slate-450 block mb-1">יתרת מזומן זמינה</span>
              <span className="text-xl font-bold text-slate-100 font-mono">${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-805">
              <span className="text-xs text-slate-450 block mb-1">רווח/הפסד כולל (P&L)</span>
              <div className="flex items-center gap-1.5 justify-end">
                {totalProfitLossPrice >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className={`text-xl font-semibold font-mono ${totalProfitLossPrice >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {totalProfitLossPrice >= 0 ? "+" : ""}${totalProfitLossPrice.toFixed(2)} ({totalProfitLossPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Holdings List Table */}
          <div className="overflow-x-auto">
            <h4 className="text-xs font-semibold text-slate-400 mb-2 font-sans tracking-wide">ריכוז פוזיציות פתוחות</h4>
            {portfolio.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-950/20 border border-slate-850 rounded-2xl text-xs">
                אין לך מניות בתיק ההשקעות כרגע. תוכל לרכוש מניות באמצעות טופס העסקאות המהיר.
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-2.5 font-semibold text-slate-400">מניה</th>
                    <th className="py-2.5 font-semibold text-slate-405 text-center">כמות</th>
                    <th className="py-2.5 font-semibold text-slate-405 text-center">שער רכישה ממוצע</th>
                    <th className="py-2.5 font-semibold text-slate-405 text-center">מחיר נוכחי</th>
                    <th className="py-2.5 font-semibold text-slate-405 text-left">רווח/הפסד מניה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm">
                  {portfolio.map((item) => {
                    const stock = stocks.find(s => s.ticker === item.ticker);
                    const livePrice = stock ? stock.currentPrice : item.avgBuyPrice;
                    const stockPL = (livePrice - item.avgBuyPrice) * item.shares;
                    const stockPLPercent = ((livePrice - item.avgBuyPrice) / item.avgBuyPrice) * 100;

                    return (
                      <tr key={item.ticker} className="hover:bg-slate-850/20 transition-all">
                        <td className="py-3 font-semibold text-slate-150">
                          <span className="font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-xs ml-2">{item.ticker}</span>
                          <span className="text-xs text-slate-400 hidden sm:inline">{stock?.name}</span>
                        </td>
                        <td className="py-3 text-center font-mono font-medium">{item.shares}</td>
                        <td className="py-3 text-center font-mono text-slate-400">${item.avgBuyPrice.toFixed(2)}</td>
                        <td className="py-3 text-center font-mono">${livePrice.toFixed(2)}</td>
                        <td className={`py-3 text-left font-mono font-medium ${stockPL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {stockPL >= 0 ? "+" : ""}${stockPL.toFixed(2)} ({stockPLPercent.toFixed(1)}%)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Informative advice */}
        <div className="mt-6 border-t border-slate-850 pt-4 flex gap-2 items-start text-[11px] text-slate-400 bg-slate-950/25 p-3 rounded-2xl">
          <AlertCircle className="w-4 h-4 text-emerald-400 block shrink-0 mt-0.5" />
          <p>
            הדמיית השקעות אטרקטיביות מאפשרת לך לבצע רכישה ומכירה של המניות המובילות בשוק ולבחון בדיעבד את ביצועי התיק. מומלץ להמתין להתרעת קנייה מהמערכת לפני קנייה אקטיבית על מנת להיכנס במחירי הנחה מומלצים.
          </p>
        </div>
      </div>

      {/* Trade panel quick entry */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
            פקודת מסחר מיידית
          </h3>
          <p className="text-xs text-slate-400 mb-6">רכוש או מכור ידנית מניות בשער השוק העדכני</p>

          <form onSubmit={handleExecuteTrade} className="space-y-4">
            
            {/* BUY or SELL Toggle Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setTradeType("BUY")}
                className={`py-2 text-xs font-bold rounded-lg transition-all
                  ${tradeType === "BUY" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"}
                `}
              >
                קנייה (Buy)
              </button>
              <button
                type="button"
                onClick={() => setTradeType("SELL")}
                className={`py-2 text-xs font-bold rounded-lg transition-all
                  ${tradeType === "SELL" ? "bg-rose-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200"}
                `}
              >
                מכירה (Sell)
              </button>
            </div>

            {/* Select Stock */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">בחר מניה למסחר:</label>
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="bg-slate-950 text-slate-100 border border-slate-800 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-cyan-500 transition-all font-mono"
              >
                {stocks.map(s => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} - {s.name} (${s.currentPrice})
                  </option>
                ))}
              </select>
            </div>

            {/* Shares amount inputs */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">כמות מניות:</label>
              <input
                id="shares_inp"
                type="number"
                min="1"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                className="bg-slate-950 text-slate-100 border border-slate-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 transition-all font-mono"
              />
            </div>

            {/* Total projection cost display */}
            <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between font-mono">
                <span>${currentPrice.toFixed(2)}</span>
                <span className="text-slate-400 font-sans">שער השוק הנוכחי:</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="font-bold text-slate-100">
                  ${(currentPrice * (parseInt(sharesInput) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-slate-400 font-sans">שווי עסקה כולל:</span>
              </div>
            </div>

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-start gap-1.5 animate-pulse">
                <Check className="w-4 h-4 shrink-0" />
                <p>{successMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Trade Action Submit Button */}
            <button
              id="trade_action_btn"
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98]
                ${tradeType === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 focus:ring-emerald-500/20 text-slate-950"
                  : "bg-rose-500 hover:bg-rose-400 focus:ring-rose-500/20 text-slate-950"
                }
              `}
            >
              {loading ? "מבצע..." : tradeType === "BUY" ? "בצע קניית מניות" : "בצע מכירת מניות"}
            </button>

          </form>
        </div>

        {/* Quick portfolio holdings display */}
        <div className="p-3 border border-slate-850 bg-slate-950/15 rounded-2xl text-[11px] text-slate-450 mt-4">
          מחזיק כעת: <span className="font-mono text-slate-100">
            {portfolio.find(p => p.ticker === selectedTicker)?.shares || 0}
          </span> מניות של {selectedTicker} בתיק
        </div>

      </div>

    </div>
  );
}

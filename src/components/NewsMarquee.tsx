import { useState, useEffect } from "react";
import { Newspaper, Flame, RefreshCw, Radio } from "lucide-react";

interface NewsItem {
  title: string;
  source: string;
}

interface NewsMarqueeProps {
  themeVal: number;
  theme: any;
}

export default function NewsMarquee({ themeVal, theme }: NewsMarqueeProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchNews() {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch("/api/news");
        if (res.ok) {
          const data = await res.json();
          if (active && data.news && Array.isArray(data.news)) {
            setNews(data.news);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load marquee news", err);
        setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchNews();
    // Refresh news headlines every 2 minutes
    const interval = setInterval(fetchNews, 120000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  // Determine marquee bar theme styling based on themeVal
  const isLight = themeVal >= 70;
  const barClass = isLight
    ? "bg-slate-50/95 border-slate-200/80 text-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
    : "bg-slate-950/90 border-slate-900/65 text-slate-200 shadow-[0_-4px_30px_rgba(0,0,0,0.4)]";

  const badgeClass = isLight
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/35";

  // Duplicate items to ensure a seamless continuous loop
  const displayItems = [...news, ...news, ...news];

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 h-11 border-t backdrop-blur-lg flex items-center z-40 transition-all duration-300 ${barClass}`}
      id="market_news_marquee_container"
      dir="rtl"
    >
      <style>{`
        @keyframes marquee-scroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(50%);
          }
        }
        .anim-marquee-wrap {
          display: flex;
          width: max-content;
          animation: marquee-scroll 320s linear infinite;
        }
        .anim-marquee-wrap:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Real-time indicator badge */}
      <div className={`h-full px-4 flex items-center gap-2 font-bold text-[11px] border-l shrink-0 z-15 select-none ${badgeClass} border-slate-200/10`}>
        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="tracking-tight whitespace-nowrap">איתותי שוק נע</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
      </div>

      {/* Marquee scroll viewport */}
      <div className="flex-1 overflow-hidden h-full flex items-center relative">
        {loading && news.length === 0 ? (
          <div className="px-6 text-xs text-slate-400 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
            טוען כותרות חדשות ומגמות מסחר בזמן אמת...
          </div>
        ) : error && news.length === 0 ? (
          <div className="px-6 text-xs text-rose-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            לא הצלחנו לטעון את זרם הכותרות. נסה שוב.
            <button 
              onClick={() => setRefreshKey(prev => prev + 1)} 
              className="text-[10px] underline font-bold text-slate-400 hover:text-cyan-400 mr-2"
            >
              רענן
            </button>
          </div>
        ) : (
          <div className="anim-marquee-wrap">
            {displayItems.map((item, index) => (
              <div 
                key={`${item.title}-${index}`}
                className="inline-flex items-center gap-2 px-8 py-1.5 group select-none cursor-pointer"
                title={`${item.title} (מקור: ${item.source})`}
              >
                {/* Visual marker */}
                <span className="text-[10px] uppercase font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm shrink-0">
                  {item.source}
                </span>

                {/* Title */}
                <span className={`text-xs font-medium tracking-tight transition-colors duration-200 group-hover:text-cyan-400 whitespace-nowrap ${
                  isLight ? "text-slate-800" : "text-slate-200"
                }`}>
                  {item.title}
                </span>

                {/* Separator icon */}
                <span className="text-slate-600/65 font-bold mx-2 text-xs select-none">✦</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh indicator */}
      <button 
        onClick={() => setRefreshKey(prev => prev + 1)}
        className="h-full px-3.5 flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-colors border-r border-slate-200/5 cursor-pointer hover:bg-slate-500/5"
        title="עדכן כותרות עכשיו"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
      </button>
    </div>
  );
}

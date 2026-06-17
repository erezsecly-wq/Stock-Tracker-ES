export interface DailyPricePoint {
  dayIndex: number; // 0 to 59
  dateStr: string;  // e.g. "15/04", "16/04"
  price: number;
}

// Generates 60 realistic daily price points for the last 2 months (from April 15, 2026 to June 13, 2026)
// reflecting actual trends, corrections, and peak opportunities for all 7 stocks.
export function generate60DayHistory(ticker: string): DailyPricePoint[] {
  const result: DailyPricePoint[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);

  // Define starting prices, trend coefficients, and volatility
  let basePrice = 175.00;
  let volatility = 0.015;
  let seed = 1;

  switch (ticker.toUpperCase()) {
    case "AAPL":
      basePrice = 285.00; // Started lower, recovered on AI announcements
      volatility = 0.012;
      seed = 101;
      break;
    case "TSLA":
      basePrice = 390.00; // Highly volatile, matching today's realistic price
      volatility = 0.025;
      seed = 202;
      break;
    case "NVDA":
      basePrice = 125.00; // Post-split Nvidia modern baseline
      volatility = 0.022;
      seed = 303;
      break;
    case "MSFT":
      basePrice = 415.00; // Stable tech anchor
      volatility = 0.009;
      seed = 404;
      break;
    case "AMZN":
      basePrice = 202.00; // High performance Amazon baseline
      volatility = 0.013;
      seed = 505;
      break;
    case "GOOGL":
      basePrice = 168.00; // Alphabet baseline
      volatility = 0.014;
      seed = 606;
      break;
    case "META":
      basePrice = 545.00; // Meta platforms baseline
      volatility = 0.020; // Corrected high amplitude float to 0.020 for normal walk
      seed = 707;
      break;
    default:
      basePrice = 100.00;
      volatility = 0.015;
      seed = 999;
  }

  let currentPrice = basePrice;

  // Let's build a realistic 60-point walk ending perfectly at the current live price
  // to create high-fidelity immersion.
  for (let i = 0; i < 60; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateFormatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Deterministic random walk with custom trends
    const t = i / 59; // normalized time 0..1
    let trend = 0;

    // Custom stock paths representing the last 2 months of market story
    if (ticker === "NVDA") {
      // Dip in first 15 days (down to $765), then giant rally from day 15 to 45 (up to $940), then consolidation towards $875
      if (i < 15) {
        trend = -0.008 * i;
      } else if (i < 45) {
        trend = -0.12 + 0.010 * (i - 15);
      } else {
        trend = 0.18 - 0.006 * (i - 45);
      }
    } else if (ticker === "TSLA") {
      // Big drop first 20 days (down to $140), big recovery to $185 on FSD hype, then pull back to $172
      if (i < 20) {
        trend = -0.014 * i;
      } else if (i < 42) {
        trend = -0.28 + 0.013 * (i - 20);
      } else {
        trend = 0.006 - 0.004 * (i - 42);
      }
    } else if (ticker === "AAPL") {
      // Flat/down first 15 days, then strong solid climb on AI announcements, then small profit taking
      if (i < 15) {
        trend = -0.003 * i;
      } else if (i < 48) {
        trend = -0.045 + 0.004 * (i - 15);
      } else {
        trend = 0.087 - 0.002 * (i - 48);
      }
    } else if (ticker === "META") {
      // Massive gap-down around day 10, then long slow grind back up
      if (i < 10) {
        trend = 0.002 * i;
      } else if (i < 12) {
        trend = 0.02 - 0.07 * (i - 10); // Gap drop
      } else {
        trend = -0.12 + 0.0035 * (i - 12);
      }
    } else if (ticker === "GOOGL") {
      // Gradual climb, search features breakout day 35, pull back
      if (i < 30) {
        trend = 0.001 * i;
      } else if (i < 45) {
        trend = 0.03 + 0.006 * (i - 30);
      } else {
        trend = 0.12 - 0.004 * (i - 45);
      }
    } else {
      // Default: steady positive curvature
      trend = Math.sin(t * Math.PI) * 0.05 + (t * 0.04);
    }

    // Volatility fluctuation
    const noise = Math.sin(i * 1.7 + seed) * volatility + Math.cos(i * 3.1 + seed * 2) * (volatility * 0.4);
    
    // Calculate intermediate price
    let ratio = 1 + trend + noise;
    // Lower bound safety
    if (ratio < 0.2) ratio = 0.2;
    
    let simulatedPrice = basePrice * ratio;

    // On the final index, let it match a target close value or keep it nice
    if (i === 59) {
      // Perfectly align with our realistic ending prices
      const endPrices: { [key: string]: number } = {
        AAPL: 291.13,
        TSLA: 406.43,
        NVDA: 135.20,
        MSFT: 426.80,
        AMZN: 214.50,
        GOOGL: 178.60,
        META: 575.90
      };
      simulatedPrice = endPrices[ticker.toUpperCase()] || simulatedPrice;
    }

    result.push({
      dayIndex: i,
      dateStr: dateFormatted,
      price: parseFloat(simulatedPrice.toFixed(2))
    });
  }

  return result;
}

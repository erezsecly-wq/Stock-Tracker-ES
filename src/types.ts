export interface User {
  username: string;
  passwordHash: string; // Simplistic secure storage
  biometricRegistered?: boolean;
  biometricCredentialId?: string;
  biometricPublicKey?: string;
}

export interface StockInfo {
  ticker: string;
  name: string;
  currentPrice: number;
  dailyChangePercent: number;
  high24h: number;
  low24h: number;
  history: { time: string; price: number }[];
}

export interface AlertConfig {
  ticker: string;
  buyThreshold: number | null; // Trigger alert if price drops BELOW this
  sellThreshold: number | null; // Trigger alert if price rises ABOVE this
  createdAt: string;
}

export interface PortfolioItem {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
}

export interface AlertTriggerLog {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  price: number;
  threshold: number;
  timestamp: string;
  read: boolean;
}

export interface GeminiAnalysis {
  ticker: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  recommendedBuyRange: string;
  recommendedSellRange: string;
  targetPriceDraft: number;
  analysisText: string;
  timestamp: string;
}

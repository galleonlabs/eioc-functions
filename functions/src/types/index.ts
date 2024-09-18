import { Timestamp } from "firebase-admin/firestore";

export interface TreasuryAsset {
  href: string;
  imgSrc: string;
  id: string;
  symbol: string;
  quantity: number;
}

export interface Harvest {
  assetSymbol: string;
  id: string;
  quantity: number;
  date: Timestamp;
}

export interface YieldData {
  date: string;
  totalUSD: number;
}

export interface Prices {
  [key: string]: {
    usd: number;
  };
}

export interface PortfolioSummary {
  treasuryAssets: Omit<TreasuryAsset, "quantity">[];
  rollingAPR: number;
}

export interface DetailedPortfolioData {
  yieldConsistencyScore: number;
  yieldFrequency: {
    averageDays: number;
    minDays: number;
    maxDays: number;
  };
  latestRelativePerformance: number;
  yieldToTreasuryRatio: number;
  yieldChartData: {
    labels: string[];
    data: number[];
  };
  cumulativeYieldChartData: {
    labels: string[];
    data: number[];
  };
}

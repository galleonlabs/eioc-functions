import * as functions from "firebase-functions";
import { db } from "./config/firebase";
import { fetchPrices } from "./utils/priceUtils";
import { TreasuryAsset, Harvest, YieldData, PortfolioSummary, DetailedPortfolioData } from "./types";
import { format } from "date-fns";

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
let cachedSummaryData: PortfolioSummary | null = null;
let cachedDetailedData: DetailedPortfolioData | null = null;
let lastFetchTime = 0;

export const getPortfolioSummary = functions.https.onCall(async (data, context): Promise<PortfolioSummary> => {
  const currentTime = Date.now();

  if (cachedSummaryData && currentTime - lastFetchTime < CACHE_DURATION) {
    return cachedSummaryData;
  }

  try {
    const [treasuryAssetsSnapshot, harvestsSnapshot] = await Promise.all([
      db.collection("treasuryAssets").get(),
      db.collection("harvests").get(),
    ]);

    const treasuryAssets = treasuryAssetsSnapshot.docs.map((doc) => doc.data() as TreasuryAsset);
    const harvests = harvestsSnapshot.docs.map(
      (doc) =>
        ({
          ...doc.data(),
          date: doc.data().date.toDate(),
        } as Harvest & { date: Date })
    );

    const assetIds = [...new Set([...treasuryAssets.map((asset) => asset.id), ...harvests.map((h) => h.id)])];
    const prices = await fetchPrices(assetIds);

    const totalTreasuryValue = calculateTotalTreasuryValue(treasuryAssets, prices);
    const yieldData = processYieldData(harvests, prices);
    const rollingAPR = calculateRollingAPR(yieldData, totalTreasuryValue);

    const summaryData: PortfolioSummary = {
      treasuryAssets: treasuryAssets.map(({ href, imgSrc, id, symbol }) => ({ href, imgSrc, id, symbol })),
      rollingAPR,
    };

    cachedSummaryData = summaryData;
    lastFetchTime = currentTime;

    return summaryData;
  } catch (error) {
    console.error("Error in getPortfolioSummary:", error);
    throw new functions.https.HttpsError("internal", "Failed to process portfolio summary data");
  }
});

export const getDetailedPortfolioData = functions.https.onCall(
  async (data, context): Promise<DetailedPortfolioData> => {
    const currentTime = Date.now();

    if (cachedDetailedData && currentTime - lastFetchTime < CACHE_DURATION) {
      return cachedDetailedData;
    }

    try {
      const [treasuryAssetsSnapshot, harvestsSnapshot] = await Promise.all([
        db.collection("treasuryAssets").get(),
        db.collection("harvests").get(),
      ]);

      const treasuryAssets = treasuryAssetsSnapshot.docs.map((doc) => doc.data() as TreasuryAsset);
      const harvests = harvestsSnapshot.docs.map(
        (doc) =>
          ({
            ...doc.data(),
            date: doc.data().date.toDate(),
          } as Harvest & { date: Date })
      );

      const assetIds = [...new Set([...treasuryAssets.map((asset) => asset.id), ...harvests.map((h) => h.id)])];
      const prices = await fetchPrices(assetIds);

      const yieldData = processYieldData(harvests, prices);
      yieldData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalTreasuryValue = calculateTotalTreasuryValue(treasuryAssets, prices);

      const detailedData: DetailedPortfolioData = {
        yieldConsistencyScore: calculateYieldConsistencyScore(yieldData),
        yieldFrequency: calculateYieldFrequency(yieldData),
        latestRelativePerformance: calculateLatestRelativePerformance(yieldData),
        yieldToTreasuryRatio: calculateYieldToTreasuryRatio(yieldData, totalTreasuryValue),
        yieldChartData: prepareYieldChartData(yieldData, totalTreasuryValue),
        cumulativeYieldChartData: prepareCumulativeYieldChartData(yieldData, totalTreasuryValue),
      };

      cachedDetailedData = detailedData;
      lastFetchTime = currentTime;

      return detailedData;
    } catch (error) {
      console.error("Error in getDetailedPortfolioData:", error);
      throw new functions.https.HttpsError("internal", "Failed to process detailed portfolio data");
    }
  }
);

function calculateTotalTreasuryValue(treasuryAssets: TreasuryAsset[], prices: Record<string, { usd: number }>): number {
  return treasuryAssets.reduce((sum, asset) => sum + prices[asset.id].usd * asset.quantity, 0);
}

function processYieldData(
  harvests: (Harvest & { date: Date })[],
  prices: Record<string, { usd: number }>
): YieldData[] {
  const groupedHarvests = groupByDate(harvests);
  const yieldData = Object.entries(groupedHarvests).map(([date, harvests]) => ({
    date,
    totalUSD: harvests.reduce((sum, h) => sum + prices[h.id].usd * h.quantity, 0),
  }));

  return yieldData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function groupByDate(harvests: (Harvest & { date: Date })[]): Record<string, (Harvest & { date: Date })[]> {
  return harvests.reduce((acc, harvest) => {
    const date = harvest.date.toISOString().split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(harvest);
    return acc;
  }, {} as Record<string, (Harvest & { date: Date })[]>);
}

function calculateRollingAPR(yieldData: YieldData[], totalTreasuryValue: number) {
  if (yieldData.length < 4 || totalTreasuryValue <= 0) {
    return 0;
  }

  const lastFourDataPoints = yieldData.slice(-4);
  const totalYield = lastFourDataPoints.reduce((sum, entry) => sum + entry.totalUSD, 0);
  const startDate = new Date(lastFourDataPoints[0].date);
  const endDate = new Date(lastFourDataPoints[3].date);
  const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
  const averageDailyYield = totalYield / daysDifference;
  const annualizedYield = averageDailyYield * 365;
  const APR = (annualizedYield / totalTreasuryValue) * 100;

  return APR;
}

function calculateYieldConsistencyScore(yieldData: YieldData[]): number {
  if (yieldData.length < 2) return 100;

  const yields = yieldData.map((d) => d.totalUSD);
  const mean = yields.reduce((a, b) => a + b, 0) / yields.length;
  const variance = yields.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0) / yields.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / mean) * 100;

  return Math.max(0, 100 - coefficientOfVariation);
}

function calculateYieldFrequency(yieldData: YieldData[]): { averageDays: number; minDays: number; maxDays: number } {
  if (yieldData.length < 2) return { averageDays: 0, minDays: 0, maxDays: 0 };

  const sortedDates = yieldData.map((d) => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime());
  const differences = sortedDates
    .slice(1)
    .map((date, i) => (date.getTime() - sortedDates[i].getTime()) / (1000 * 3600 * 24));

  return {
    averageDays: differences.reduce((a, b) => a + b, 0) / differences.length,
    minDays: Math.min(...differences),
    maxDays: Math.max(...differences),
  };
}

function calculateLatestRelativePerformance(yieldData: YieldData[]): number {
  if (yieldData.length < 2) return 0;

  const average = yieldData.reduce((sum, d) => sum + d.totalUSD, 0) / yieldData.length;
  const latest = yieldData[yieldData.length - 1].totalUSD;
  return (latest / average) * 100 - 100;
}

function calculateYieldToTreasuryRatio(yieldData: YieldData[], totalTreasuryValue: number): number {
  if (totalTreasuryValue <= 0) return 0;

  const totalYield = yieldData.reduce((sum, d) => sum + d.totalUSD, 0);
  return (totalYield / totalTreasuryValue) * 100;
}

function prepareYieldChartData(
  yieldData: YieldData[],
  totalTreasuryValue: number
): { labels: string[]; data: number[] } {
  return {
    labels: yieldData.map((d) => format(new Date(d.date), "dd/MM/yyyy")),
    data: yieldData.map((d) => (d.totalUSD / totalTreasuryValue) * 100),
  };
}

function prepareCumulativeYieldChartData(
  yieldData: YieldData[],
  totalTreasuryValue: number
): { labels: string[]; data: number[] } {
  let cumulative = 0;
  return {
    labels: yieldData.map((d) => format(new Date(d.date), "dd/MM/yyyy")),
    data: yieldData.map((d) => {
      cumulative += (d.totalUSD / totalTreasuryValue) * 100;
      return cumulative;
    }),
  };
}
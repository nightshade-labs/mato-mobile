import type { TCandle } from 'react-native-wagmi-charts';
import type { MarketUpdateEvent } from '../integrations/supabase/types';

export function aggregateCandles(
  events: MarketUpdateEvent[],
  intervalMs: number = 60_000,
  baseDecimals: number = 0,
  quoteDecimals: number = 0,
): TCandle[] {
  const baseScale = 10 ** baseDecimals;
  const quoteScale = 10 ** quoteDecimals;

  const priced = events
    .filter((e) => e.base_flow !== 0n)
    .map((e) => ({
      time: new Date(e.created_at).getTime(),
      price: Math.abs(Number(e.quote_flow) / quoteScale) / Math.abs(Number(e.base_flow) / baseScale),
    }))
    .filter((entry) => Number.isFinite(entry.price) && entry.price > 0)
    .sort((a, b) => a.time - b.time);

  if (priced.length === 0) return [];

  const buckets = new Map<number, number[]>();

  for (const { time, price } of priced) {
    const bucket = Math.floor(time / intervalMs) * intervalMs;
    const existing = buckets.get(bucket);
    if (existing) {
      existing.push(price);
    } else {
      buckets.set(bucket, [price]);
    }
  }

  const candles: TCandle[] = [];

  for (const [bucket, prices] of buckets) {
    candles.push({
      timestamp: bucket,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    });
  }

  return candles.sort((a, b) => a.timestamp - b.timestamp);
}

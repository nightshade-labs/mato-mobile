import type { TCandle } from 'react-native-wagmi-charts';
import type { MarketUpdateEvent } from '../integrations/tigercloud/types';

const DEFAULT_SLOT_DURATION_MS = 400;

interface SlotPricePoint {
  slot: number;
  createdAtMs: number;
  price: number;
  quoteVolume: number;
}

interface SlotBucketCandle {
  bucketStartSlot: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NormalizedCandle {
  timestampMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingViewAggregatedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toFinitePositivePrice(
  event: MarketUpdateEvent,
  baseScale: number,
  quoteScale: number,
): { price: number; quoteVolume: number } | null {
  if (event.base_flow === 0n) return null;

  const base = Number(event.base_flow) / baseScale;
  const quote = Number(event.quote_flow) / quoteScale;
  if (!Number.isFinite(base) || !Number.isFinite(quote) || base === 0) return null;

  const price = Math.abs(quote) / Math.abs(base);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    price,
    quoteVolume: Math.abs(quote),
  };
}

function normalizePoints(events: MarketUpdateEvent[], baseScale: number, quoteScale: number): SlotPricePoint[] {
  const latestPerSlot = new Map<number, SlotPricePoint>();

  for (const event of events) {
    const priced = toFinitePositivePrice(event, baseScale, quoteScale);
    if (!priced) continue;

    const createdAtMs = new Date(event.created_at).getTime();
    if (!Number.isFinite(createdAtMs)) continue;

    const previous = latestPerSlot.get(event.slot);
    if (!previous || createdAtMs >= previous.createdAtMs) {
      latestPerSlot.set(event.slot, {
        slot: event.slot,
        createdAtMs,
        price: priced.price,
        quoteVolume: priced.quoteVolume,
      });
    }
  }

  return Array.from(latestPerSlot.values()).sort((a, b) => a.slot - b.slot);
}

function aggregateSparseSlotCandles(
  events: MarketUpdateEvent[],
  intervalMs: number,
  baseDecimals: number,
  quoteDecimals: number,
  slotDurationMs: number = DEFAULT_SLOT_DURATION_MS,
): NormalizedCandle[] {
  if (intervalMs <= 0 || slotDurationMs <= 0) return [];

  const baseScale = 10 ** baseDecimals;
  const quoteScale = 10 ** quoteDecimals;
  const points = normalizePoints(events, baseScale, quoteScale);
  if (points.length === 0) return [];

  const bucketSizeSlots = Math.max(1, Math.round(intervalMs / slotDurationMs));
  const latestPoint = points[points.length - 1];
  const anchorMs = latestPoint.createdAtMs - latestPoint.slot * slotDurationMs;
  const buckets = new Map<number, SlotBucketCandle>();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const nextPoint = points[index + 1];
    const segmentStart = point.slot;
    const segmentEnd = Math.max(point.slot + 1, nextPoint ? nextPoint.slot : point.slot + 1);
    let bucketStart = Math.floor(segmentStart / bucketSizeSlots) * bucketSizeSlots;

    while (bucketStart < segmentEnd) {
      const bucketEnd = bucketStart + bucketSizeSlots;
      const overlapStart = Math.max(segmentStart, bucketStart);
      const overlapEnd = Math.min(segmentEnd, bucketEnd);

      if (overlapStart < overlapEnd) {
        const current = buckets.get(bucketStart);
        if (current) {
          current.high = Math.max(current.high, point.price);
          current.low = Math.min(current.low, point.price);
          current.close = point.price;
        } else {
          buckets.set(bucketStart, {
            bucketStartSlot: bucketStart,
            open: point.price,
            high: point.price,
            low: point.price,
            close: point.price,
            volume: 0,
          });
        }
      }

      bucketStart += bucketSizeSlots;
    }

    const volumeBucketStart = Math.floor(point.slot / bucketSizeSlots) * bucketSizeSlots;
    const volumeBucket = buckets.get(volumeBucketStart);
    if (volumeBucket) {
      volumeBucket.volume += point.quoteVolume;
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.bucketStartSlot - b.bucketStartSlot)
    .map((bucket) => ({
      timestampMs: Math.max(0, Math.round(anchorMs + bucket.bucketStartSlot * slotDurationMs)),
      open: bucket.open,
      high: bucket.high,
      low: bucket.low,
      close: bucket.close,
      volume: bucket.volume,
    }));
}

export function aggregateCandles(
  events: MarketUpdateEvent[],
  intervalMs: number = 60_000,
  baseDecimals: number = 0,
  quoteDecimals: number = 0,
): TCandle[] {
  const candles = aggregateSparseSlotCandles(events, intervalMs, baseDecimals, quoteDecimals);
  return candles.map((candle) => ({
    timestamp: candle.timestampMs,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function aggregateTradingViewCandles(
  events: MarketUpdateEvent[],
  intervalMs: number,
  baseDecimals: number = 0,
  quoteDecimals: number = 0,
): TradingViewAggregatedCandle[] {
  const candles = aggregateSparseSlotCandles(events, intervalMs, baseDecimals, quoteDecimals);
  return candles.map((candle) => ({
    time: Math.floor(candle.timestampMs / 1000),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  }));
}

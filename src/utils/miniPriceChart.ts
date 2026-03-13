import type { MarketUpdateEvent } from '../integrations/supabase/types';

export interface MarketPricePoint {
  slot: number;
  price: number;
}

export interface MiniPriceChartPoint {
  slot: number;
  price: number;
}

const MIN_SAMPLES = 16;
const MAX_SAMPLES = 48;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toFinitePositivePrice(
  event: MarketUpdateEvent,
  baseScale: number,
  quoteScale: number,
): number | null {
  if (event.base_flow === 0n) return null;

  const base = Number(event.base_flow) / baseScale;
  const quote = Number(event.quote_flow) / quoteScale;
  if (!Number.isFinite(base) || !Number.isFinite(quote) || base === 0) return null;

  const price = Math.abs(quote) / Math.abs(base);
  if (!Number.isFinite(price) || price <= 0) return null;

  return price;
}

export function normalizeMarketPricePoints(
  events: MarketUpdateEvent[],
  baseDecimals: number,
  quoteDecimals: number,
): MarketPricePoint[] {
  const baseScale = 10 ** baseDecimals;
  const quoteScale = 10 ** quoteDecimals;
  const latestPerSlot = new Map<number, { slot: number; price: number; createdAtMs: number }>();

  for (const event of events) {
    const price = toFinitePositivePrice(event, baseScale, quoteScale);
    if (price === null) continue;

    const createdAtMs = new Date(event.created_at).getTime();
    if (!Number.isFinite(createdAtMs)) continue;

    const previous = latestPerSlot.get(event.slot);
    if (!previous || createdAtMs >= previous.createdAtMs) {
      latestPerSlot.set(event.slot, { slot: event.slot, price, createdAtMs });
    }
  }

  return Array.from(latestPerSlot.values())
    .sort((left, right) => left.slot - right.slot)
    .map(({ slot, price }) => ({ slot, price }));
}

function findLastPointAtOrBefore(points: MarketPricePoint[], slot: number): number {
  let low = 0;
  let high = points.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].slot <= slot) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

function findFirstPointAfter(points: MarketPricePoint[], slot: number): number {
  let low = 0;
  let high = points.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].slot <= slot) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findFirstPointAtOrAfter(points: MarketPricePoint[], slot: number): number {
  let low = 0;
  let high = points.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].slot < slot) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function getPriceAtSlot(points: MarketPricePoint[], slot: number): number | null {
  if (points.length === 0) return null;

  const index = findLastPointAtOrBefore(points, slot);
  if (index >= 0) {
    return points[index].price;
  }

  return points[0].price;
}

function getAveragePriceBetween(points: MarketPricePoint[], startSlot: number, endSlot: number): number | null {
  const initialPrice = getPriceAtSlot(points, startSlot);
  if (initialPrice === null) return null;
  if (endSlot <= startSlot) return initialPrice;

  let cursor = startSlot;
  let currentPrice = initialPrice;
  let weightedPrice = 0;
  let nextIndex = findFirstPointAfter(points, startSlot);

  while (cursor < endSlot) {
    const nextSlot = nextIndex < points.length ? Math.min(endSlot, points[nextIndex].slot) : endSlot;

    if (nextSlot > cursor) {
      weightedPrice += (nextSlot - cursor) * currentPrice;
      cursor = nextSlot;
    }

    if (cursor >= endSlot || nextIndex >= points.length) {
      break;
    }

    currentPrice = points[nextIndex].price;
    nextIndex += 1;
  }

  const slotSpan = endSlot - startSlot;
  return slotSpan > 0 ? weightedPrice / slotSpan : currentPrice;
}

function countPointsInRange(points: MarketPricePoint[], startSlot: number, endSlot: number): number {
  if (points.length === 0) return 0;

  const startIndex = findFirstPointAtOrAfter(points, startSlot);
  if (startIndex >= points.length) return 0;

  const endIndex = findLastPointAtOrBefore(points, endSlot);
  if (endIndex < startIndex) return 0;

  return endIndex - startIndex + 1;
}

function createSampleSlots(startSlot: number, endSlot: number, sampleCount: number): number[] {
  if (sampleCount <= 1) return [startSlot];

  const slotSpan = Math.max(0, endSlot - startSlot);
  return Array.from({ length: sampleCount }, (_, index) =>
    index === sampleCount - 1 ? endSlot : startSlot + Math.floor((index * slotSpan) / (sampleCount - 1)),
  );
}

export function buildClosedPositionMiniChart(
  points: MarketPricePoint[],
  startSlot: number | null,
  endSlot: number | null,
): MiniPriceChartPoint[] | null {
  if (points.length === 0 || startSlot === null || endSlot === null || startSlot > endSlot) {
    return null;
  }

  const observedPricePoints = countPointsInRange(points, startSlot, endSlot);
  const desiredSamples = clamp(observedPricePoints + 4, MIN_SAMPLES, MAX_SAMPLES);
  const maxSamplesForSlotSpan = startSlot === endSlot ? 2 : Math.min(desiredSamples, endSlot - startSlot + 1);
  const sampleSlots = createSampleSlots(startSlot, endSlot, Math.max(2, maxSamplesForSlotSpan));

  const chartPoints: MiniPriceChartPoint[] = [];
  for (let index = 0; index < sampleSlots.length; index += 1) {
    const slot = sampleSlots[index];
    const price =
      index === 0 || index === sampleSlots.length - 1
        ? getPriceAtSlot(points, slot)
        : getAveragePriceBetween(points, sampleSlots[index - 1], slot);

    if (price === null) {
      return null;
    }

    chartPoints.push({ slot, price });
  }

  return chartPoints;
}

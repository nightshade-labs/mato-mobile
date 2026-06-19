import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TCandle } from 'react-native-wagmi-charts';
import { readApiUrl } from '../api/readApi';
import { queryKeys } from '../query/keys';
import type { TradingViewAggregatedCandle } from '../utils/candles';

type CandleInterval = '1m' | '5m' | '1h';
export type MarketChartTimeframe = '1m' | '5m' | '1h';

interface ReadApiCandleItem {
  time: number;
  start_slot: number;
  end_slot: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ReadApiCandlesResponse {
  market_id: number;
  interval: string;
  from: string;
  to: string;
  points: number;
  items: ReadApiCandleItem[];
}

const MAX_POINTS = 5000;
const MAX_POINTS_HEADROOM = 200;
const MAX_RANGE_POINTS = MAX_POINTS - MAX_POINTS_HEADROOM;
const INITIAL_BARS_BY_TIMEFRAME: Record<MarketChartTimeframe, number> = {
  '1m': 180,
  '5m': 220,
  '1h': 140,
};
const LOAD_MORE_BARS_BY_TIMEFRAME: Record<MarketChartTimeframe, number> = {
  '1m': 360,
  '5m': 300,
  '1h': 240,
};

function timeframeToInterval(timeframe: MarketChartTimeframe): CandleInterval {
  if (timeframe === '5m') return '5m';
  if (timeframe === '1h') return '1h';
  return '1m';
}

function timeframeToIntervalMs(timeframe: MarketChartTimeframe): number {
  if (timeframe === '5m') return 5 * 60 * 1000;
  if (timeframe === '1h') return 60 * 60 * 1000;
  return 60 * 1000;
}

function estimateRangePoints(rangeStartMs: number, intervalMs: number, nowMs: number): number {
  if (rangeStartMs <= 0 || intervalMs <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil((nowMs + intervalMs - rangeStartMs) / intervalMs));
}

async function fetchMarketCandlesWindow({
  fromMs,
  interval,
  marketId,
  toMs,
}: {
  fromMs: number;
  interval: CandleInterval;
  marketId: number;
  toMs: number;
}) {
  const params = new URLSearchParams({
    from: new Date(fromMs).toISOString(),
    interval,
    max_points: String(MAX_POINTS),
    to: new Date(toMs).toISOString(),
  });

  const response = await fetch(readApiUrl(`/v1/markets/${marketId}/candles?${params.toString()}`), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch market candles (${response.status}): ${body || response.statusText}`);
  }

  const payload = (await response.json()) as ReadApiCandlesResponse;
  return payload.items;
}

function toChartCandles(items: ReadApiCandleItem[]): TCandle[] {
  return items.map((item) => ({
    close: item.close,
    high: item.high,
    low: item.low,
    open: item.open,
    timestamp: item.time * 1000,
  }));
}

function toTradingViewCandles(items: ReadApiCandleItem[]): TradingViewAggregatedCandle[] {
  return items.map((item) => ({
    close: item.close,
    endSlot: item.end_slot,
    high: item.high,
    low: item.low,
    open: item.open,
    startSlot: item.start_slot,
    time: item.time,
    volume: item.volume,
  }));
}

export function useMarketCandles({ marketId, timeframe }: { marketId: number; timeframe: MarketChartTimeframe }) {
  const interval = useMemo(() => timeframeToInterval(timeframe), [timeframe]);
  const intervalMs = useMemo(() => timeframeToIntervalMs(timeframe), [timeframe]);
  const [rangeStartMs, setRangeStartMs] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [expectedOldestTime, setExpectedOldestTime] = useState<number | null>(null);

  useEffect(() => {
    const initialBars = INITIAL_BARS_BY_TIMEFRAME[timeframe];
    const now = Date.now();
    setRangeStartMs(now - initialBars * intervalMs);
    setHasMoreHistory(true);
    setLoadingMoreHistory(false);
    setExpectedOldestTime(null);
  }, [intervalMs, marketId, timeframe]);

  const query = useQuery({
    queryKey: [...queryKeys.marketUpdates.all, 'candles', marketId, timeframe, rangeStartMs] as const,
    enabled: rangeStartMs > 0,
    placeholderData: (previous) => previous,
    queryFn: async () =>
      fetchMarketCandlesWindow({
        fromMs: rangeStartMs,
        interval,
        marketId,
        toMs: Date.now() + intervalMs,
      }),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!query.data) return;

    if (expectedOldestTime === null) {
      setHasMoreHistory(query.data.length > 0);
      if (loadingMoreHistory) {
        setLoadingMoreHistory(false);
      }
      return;
    }

    const nextOldest = query.data[0]?.time ?? null;
    setHasMoreHistory(nextOldest !== null && nextOldest < expectedOldestTime);
    setExpectedOldestTime(null);
    setLoadingMoreHistory(false);
  }, [expectedOldestTime, loadingMoreHistory, query.data]);

  const loadMoreHistory = useCallback(async () => {
    if (loadingMoreHistory || !hasMoreHistory || !query.data || query.data.length === 0) {
      return;
    }

    const currentOldest = query.data[0]?.time ?? null;
    if (currentOldest === null) {
      setHasMoreHistory(false);
      return;
    }

    const nowMs = Date.now();
    const estimatedPoints = estimateRangePoints(rangeStartMs, intervalMs, nowMs);
    if (estimatedPoints >= MAX_RANGE_POINTS) {
      setHasMoreHistory(false);
      return;
    }

    const remainingBarsBudget = MAX_RANGE_POINTS - estimatedPoints;
    if (remainingBarsBudget <= 0) {
      setHasMoreHistory(false);
      return;
    }

    const extendByBars = Math.min(LOAD_MORE_BARS_BY_TIMEFRAME[timeframe], remainingBarsBudget);
    if (extendByBars <= 0) {
      setHasMoreHistory(false);
      return;
    }

    const nextRangeStart = Math.max(0, rangeStartMs - extendByBars * intervalMs);
    if (nextRangeStart === rangeStartMs) {
      setHasMoreHistory(false);
      return;
    }

    setExpectedOldestTime(currentOldest);
    setLoadingMoreHistory(true);
    setRangeStartMs(nextRangeStart);
  }, [hasMoreHistory, intervalMs, loadingMoreHistory, query.data, rangeStartMs, timeframe]);

  const chartCandles = useMemo(() => toChartCandles(query.data ?? []), [query.data]);
  const tradingViewCandles = useMemo(() => toTradingViewCandles(query.data ?? []), [query.data]);

  return {
    chartCandles,
    tradingViewCandles,
    hasMoreHistory,
    loading: query.isPending || query.isFetching,
    loadingMoreHistory,
    error: query.error instanceof Error ? query.error.message : null,
    loadMoreHistory,
  };
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readApiUrl } from '../api/readApi';
import type { MarketUpdateEvent } from '../integrations/supabase/types';
import { parseMarketUpdateEvent } from '../integrations/supabase/types';
import { queryKeys } from '../query/keys';

interface UseMarketUpdateRangeOptions {
  marketId: number;
  startSlot: number | null;
  endSlot: number | null;
  enabled?: boolean;
}

const DEFAULT_MARKET_HISTORY_MAX_ROWS = 100_000;
export const MARKET_UPDATE_RANGE_STALE_TIME = 5 * 60_000;
const DEFAULT_CLOSED_POSITION_MINI_CHART_POINTS = 240;
export const CLOSED_POSITION_MINI_CHART_STALE_TIME = 5 * 60_000;
const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const FNV64_MASK = 0xffffffffffffffffn;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function sortBySlotAsc(events: MarketUpdateEvent[]): MarketUpdateEvent[] {
  return [...events].sort((left, right) => {
    if (left.slot === right.slot) return left.id - right.id;
    return left.slot - right.slot;
  });
}

interface FetchMarketUpdateRangeOptions {
  marketId: number;
  startSlot: number;
  endSlot: number;
}

interface ReadApiMarketHistoryItem {
  event_uid: string;
  signature: string;
  event_index: number;
  slot: number;
  market_id: number;
  base_flow: string;
  quote_flow: string;
  created_at: string;
}

interface ReadApiMarketHistoryResponse {
  market_id: number;
  start_slot: number;
  end_slot: number;
  points: number;
  items: Array<ReadApiMarketHistoryItem>;
}

interface ReadApiClosedPositionMiniChartItem {
  slot: number;
  price: number;
}

interface ReadApiClosedPositionMiniChartResponse {
  market_id: number;
  start_slot: number;
  end_slot: number;
  points: number;
  items: Array<ReadApiClosedPositionMiniChartItem>;
}

export interface ClosedPositionMiniChartPoint {
  slot: number;
  price: number;
}

function stableEventIdFromUid(eventUid: string) {
  let hash = FNV64_OFFSET_BASIS;

  for (let index = 0; index < eventUid.length; index += 1) {
    hash ^= BigInt(eventUid.charCodeAt(index));
    hash = (hash * FNV64_PRIME) & FNV64_MASK;
  }

  const normalized = hash % MAX_SAFE_INTEGER_BIGINT;
  return Number(normalized === 0n ? 1n : normalized);
}

function dedupeMiniChartPoints(points: Array<ClosedPositionMiniChartPoint>) {
  const deduped: Array<ClosedPositionMiniChartPoint> = [];
  for (const point of points) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.slot === point.slot) {
      deduped[deduped.length - 1] = point;
      continue;
    }

    deduped.push(point);
  }

  return deduped;
}

export async function fetchMarketUpdateRange({
  marketId,
  startSlot,
  endSlot,
}: FetchMarketUpdateRangeOptions): Promise<MarketUpdateEvent[]> {
  if (startSlot > endSlot) {
    return [];
  }

  const params = new URLSearchParams({
    start_slot: String(startSlot),
    end_slot: String(endSlot),
    max_rows: String(DEFAULT_MARKET_HISTORY_MAX_ROWS),
  });
  const response = await fetch(readApiUrl(`/v1/markets/${marketId}/history?${params.toString()}`), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch market history (${response.status}): ${body || response.statusText}`);
  }

  const payload = (await response.json()) as ReadApiMarketHistoryResponse;
  return sortBySlotAsc(
    payload.items.map((item) =>
      parseMarketUpdateEvent({
        id: stableEventIdFromUid(item.event_uid),
        signature: item.signature,
        slot: item.slot,
        market_id: item.market_id,
        base_flow: item.base_flow,
        quote_flow: item.quote_flow,
        created_at: item.created_at,
      }),
    ),
  );
}

export async function fetchClosedPositionMiniChart({
  endSlot,
  marketId,
  maxPoints = DEFAULT_CLOSED_POSITION_MINI_CHART_POINTS,
  startSlot,
}: {
  endSlot: number;
  marketId: number;
  maxPoints?: number;
  startSlot: number;
}): Promise<Array<ClosedPositionMiniChartPoint>> {
  if (startSlot > endSlot) {
    return [];
  }

  const params = new URLSearchParams({
    start_slot: String(startSlot),
    end_slot: String(endSlot),
    max_points: String(maxPoints),
  });

  const response = await fetch(
    readApiUrl(`/v1/markets/${marketId}/closed-position-mini-chart?${params.toString()}`),
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to fetch closed-position mini chart (${response.status}): ${body || response.statusText}`,
    );
  }

  const payload = (await response.json()) as ReadApiClosedPositionMiniChartResponse;
  return dedupeMiniChartPoints(
    payload.items
      .filter(
        (item) =>
          Number.isFinite(item.slot) &&
          Number.isFinite(item.price) &&
          item.price > 0,
      )
      .map((item) => ({
        slot: item.slot,
        price: item.price,
      }))
      .sort((left, right) => left.slot - right.slot),
  );
}

export function useMarketUpdateRange({ marketId, startSlot, endSlot, enabled = true }: UseMarketUpdateRangeOptions) {
  const queryKey = useMemo(
    () => queryKeys.marketUpdates.range(marketId, startSlot, endSlot),
    [marketId, startSlot, endSlot],
  );
  const isEnabled = enabled && startSlot !== null && endSlot !== null && startSlot <= endSlot;

  const query = useQuery<MarketUpdateEvent[]>({
    queryKey,
    enabled: isEnabled,
    staleTime: MARKET_UPDATE_RANGE_STALE_TIME,
    queryFn: async () => {
      if (startSlot === null || endSlot === null || startSlot > endSlot) {
        return [];
      }

      return fetchMarketUpdateRange({ marketId, startSlot, endSlot });
    },
  });

  return {
    events: query.data ?? [],
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

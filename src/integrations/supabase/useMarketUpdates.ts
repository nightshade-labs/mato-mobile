import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readApiUrl } from '../../api/readApi';
import type { MarketUpdateEvent } from './types';
import { parseMarketUpdateEvent } from './types';
import { queryKeys } from '../../query/keys';

interface UseMarketUpdatesOptions {
  marketId: number;
  limit?: number;
}

const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const FNV64_MASK = 0xffffffffffffffffn;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

interface ReadApiMarketUpdateItem {
  event_uid: string;
  signature: string;
  event_index: number;
  slot: number;
  market_id: number;
  base_flow: string;
  quote_flow: string;
  created_at: string;
}

interface ReadApiMarketUpdatesResponse {
  market_id: number;
  before_slot: number | null;
  has_more: boolean;
  limit: number;
  points: number;
  items: Array<ReadApiMarketUpdateItem>;
}

function sortBySlotDesc(events: MarketUpdateEvent[]): MarketUpdateEvent[] {
  return [...events].sort((a, b) => b.slot - a.slot);
}

function dedupeById(events: MarketUpdateEvent[]): MarketUpdateEvent[] {
  const ids = new Set<number>();
  const deduped: MarketUpdateEvent[] = [];
  for (const event of events) {
    if (ids.has(event.id)) continue;
    ids.add(event.id);
    deduped.push(event);
  }
  return deduped;
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

function parseReadApiMarketUpdates(items: Array<ReadApiMarketUpdateItem>) {
  return items.map((item) =>
    parseMarketUpdateEvent({
      id: stableEventIdFromUid(item.event_uid),
      signature: item.signature,
      slot: item.slot,
      market_id: item.market_id,
      base_flow: item.base_flow,
      quote_flow: item.quote_flow,
      created_at: item.created_at,
    }),
  );
}

async function fetchMarketUpdatesPage({
  beforeSlot,
  limit,
  marketId,
}: {
  beforeSlot?: number;
  limit: number;
  marketId: number;
}) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (beforeSlot !== undefined) {
    params.set('before_slot', String(beforeSlot));
  }

  const response = await fetch(readApiUrl(`/v1/markets/${marketId}/updates?${params.toString()}`), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch market updates (${response.status}): ${body || response.statusText}`);
  }

  const payload = (await response.json()) as ReadApiMarketUpdatesResponse;
  return {
    hasMore: payload.has_more,
    items: parseReadApiMarketUpdates(payload.items),
  };
}

export function useMarketUpdates({ marketId, limit = 50 }: UseMarketUpdatesOptions) {
  const queryKey = useMemo(
    () => queryKeys.marketUpdates.list(marketId, limit),
    [marketId, limit],
  );
  const [historicalEvents, setHistoricalEvents] = useState<MarketUpdateEvent[]>([]);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const loadingMoreHistoryRef = useRef(false);

  const query = useQuery<MarketUpdateEvent[]>({
    queryKey,
    queryFn: async () => {
      const result = await fetchMarketUpdatesPage({
        limit,
        marketId,
      });
      return result.items;
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    setHistoricalEvents([]);
    setLoadingMoreHistory(false);
    setHasMoreHistory(true);
    setHistoryError(null);
    loadingMoreHistoryRef.current = false;
  }, [marketId, limit]);

  useEffect(() => {
    const latestEvents = query.data ?? [];
    if (latestEvents.length === 0) {
      return;
    }

    if (latestEvents.length < limit) {
      setHasMoreHistory(false);
    } else {
      setHasMoreHistory(true);
    }
  }, [limit, query.data]);

  const events = useMemo(() => {
    const latest = query.data ?? [];
    const merged = dedupeById([...latest, ...historicalEvents]);
    return sortBySlotDesc(merged);
  }, [query.data, historicalEvents]);

  const loadMoreHistory = useCallback(async () => {
    if (loadingMoreHistoryRef.current || !hasMoreHistory) return;
    const oldestEvent = events[events.length - 1];
    if (!oldestEvent) return;

    loadingMoreHistoryRef.current = true;
    setLoadingMoreHistory(true);
    setHistoryError(null);

    try {
      const result = await fetchMarketUpdatesPage({
        beforeSlot: oldestEvent.slot,
        limit,
        marketId,
      });

      setHistoricalEvents((previous) =>
        sortBySlotDesc(dedupeById([...previous, ...result.items])),
      );
      if (!result.hasMore) {
        setHasMoreHistory(false);
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Failed to load more market history');
    } finally {
      setLoadingMoreHistory(false);
      loadingMoreHistoryRef.current = false;
    }
  }, [events, hasMoreHistory, limit, marketId]);

  return {
    events,
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : historyError,
    refetch: query.refetch,
    loadMoreHistory,
    loadingMoreHistory,
    hasMoreHistory,
  };
}

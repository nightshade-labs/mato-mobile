import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './client';
import type { MarketUpdateEvent, MarketUpdateEventRow } from './types';
import { parseMarketUpdateEvent } from './types';
import { queryKeys } from '../../query/keys';

interface UseMarketUpdatesOptions {
  marketId: number;
  limit?: number;
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

export function useMarketUpdates({ marketId, limit = 50 }: UseMarketUpdatesOptions) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.marketUpdates.list(marketId, limit), [marketId, limit]);
  const [historicalEvents, setHistoricalEvents] = useState<MarketUpdateEvent[]>([]);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const loadingMoreHistoryRef = useRef(false);

  const query = useQuery<MarketUpdateEvent[]>({
    queryKey,
    queryFn: async () => {
      const { data, error: fetchError } = await supabase
        .from('market_update_events')
        .select('*')
        .eq('market_id', marketId)
        .order('slot', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return (data ?? []).map(parseMarketUpdateEvent);
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
      const { data, error: fetchError } = await supabase
        .from('market_update_events')
        .select('*')
        .eq('market_id', marketId)
        .lt('slot', oldestEvent.slot)
        .order('slot', { ascending: false })
        .limit(limit);

      if (fetchError) {
        setHistoryError(fetchError.message);
        return;
      }

      const parsed = (data ?? []).map(parseMarketUpdateEvent);
      setHistoricalEvents((previous) => sortBySlotDesc(dedupeById([...previous, ...parsed])));
      if (parsed.length < limit) {
        setHasMoreHistory(false);
      }
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Failed to load more market history');
    } finally {
      setLoadingMoreHistory(false);
      loadingMoreHistoryRef.current = false;
    }
  }, [events, hasMoreHistory, limit, marketId]);

  useEffect(() => {
    const channel = supabase
      .channel(`market_updates_${marketId}`)
      .on<MarketUpdateEventRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_update_events',
          filter: `market_id=eq.${marketId}`,
        },
        (payload) => {
          const parsed = parseMarketUpdateEvent(payload.new);

          queryClient.setQueryData<MarketUpdateEvent[]>(queryKey, (previous) => {
            const current = previous ?? [];
            return sortBySlotDesc(dedupeById([parsed, ...current])).slice(0, limit);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, limit, queryClient, queryKey]);

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

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './client';
import type { MarketUpdateEvent, MarketUpdateEventRow } from './types';
import { parseMarketUpdateEvent } from './types';
import { queryKeys } from '../../app/query/keys';

interface UseMarketUpdatesOptions {
  marketId: number;
  limit?: number;
}

export function useMarketUpdates({ marketId, limit = 50 }: UseMarketUpdatesOptions) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.marketUpdates.list(marketId, limit), [marketId, limit]);

  const query = useQuery({
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
  });

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
            const deduped = current.filter((event) => event.id !== parsed.id);
            return [parsed, ...deduped].slice(0, limit);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, limit, queryClient, queryKey]);

  return {
    events: query.data ?? [],
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './client';
import type { MarketUpdateEvent, MarketUpdateEventRow } from './types';
import { parseMarketUpdateEvent } from './types';

interface UseMarketUpdatesOptions {
  marketId: number;
  limit?: number;
}

export function useMarketUpdates({ marketId, limit = 50 }: UseMarketUpdatesOptions) {
  const [events, setEvents] = useState<MarketUpdateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('market_update_events')
      .select('*')
      .eq('market_id', marketId)
      .order('slot', { ascending: false })
      .limit(limit);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setEvents((data ?? []).map(parseMarketUpdateEvent));
    setLoading(false);
  }, [marketId, limit]);

  useEffect(() => {
    fetchInitial();

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
          setEvents((prev) => [parsed, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, limit, fetchInitial]);

  return { events, loading, error, refetch: fetchInitial };
}

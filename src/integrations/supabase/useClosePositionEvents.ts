import { useState, useEffect, useCallback } from 'react';
import { supabase } from './client';
import type { ClosePositionEvent } from './types';
import { parseClosePositionEvent } from './types';

interface UseClosePositionEventsOptions {
  positionAuthority: string;
  marketId?: number;
  limit?: number;
}

export function useClosePositionEvents({
  positionAuthority,
  marketId,
  limit = 50,
}: UseClosePositionEventsOptions) {
  const [events, setEvents] = useState<ClosePositionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('close_position_events')
      .select('*')
      .eq('position_authority', positionAuthority)
      .order('slot', { ascending: false })
      .limit(limit);

    if (marketId !== undefined) {
      query = query.eq('market_id', marketId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setEvents((data ?? []).map(parseClosePositionEvent));
    setLoading(false);
  }, [positionAuthority, marketId, limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { events, loading, error, refetch: fetch };
}

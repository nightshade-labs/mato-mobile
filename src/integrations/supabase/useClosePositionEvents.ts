import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './client';
import type { ClosePositionEvent } from './types';
import { parseClosePositionEvent } from './types';
import { queryKeys } from '../../app/query/keys';

interface UseClosePositionEventsOptions {
  positionAuthority: string;
  marketId?: number;
  limit?: number;
}

export function useClosePositionEvents({ positionAuthority, marketId, limit = 50 }: UseClosePositionEventsOptions) {
  const queryKey = useMemo(
    () => queryKeys.closePositionEvents.list(positionAuthority, marketId, limit),
    [positionAuthority, marketId, limit],
  );

  const query = useQuery<ClosePositionEvent[]>({
    queryKey,
    enabled: !!positionAuthority,
    queryFn: async () => {
      let request = supabase
        .from('close_position_events')
        .select('*')
        .eq('position_authority', positionAuthority)
        .order('slot', { ascending: false })
        .limit(limit);

      if (marketId !== undefined) {
        request = request.eq('market_id', marketId);
      }

      const { data, error: fetchError } = await request;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return (data ?? []).map(parseClosePositionEvent);
    },
  });

  return {
    events: query.data ?? [],
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

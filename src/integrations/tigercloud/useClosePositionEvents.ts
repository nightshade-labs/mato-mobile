import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ClosePositionEvent } from './types';
import { fetchClosePositionEvents } from './api';
import { queryKeys } from '../../query/keys';

const EMPTY_CLOSE_POSITION_EVENTS: ClosePositionEvent[] = [];

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
    queryFn: () =>
      fetchClosePositionEvents({
        limit,
        marketId,
        positionAuthority,
      }),
  });

  return {
    events: query.data ?? EMPTY_CLOSE_POSITION_EVENTS,
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

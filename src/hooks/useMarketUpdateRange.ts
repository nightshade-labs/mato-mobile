import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import type { MarketUpdateEvent } from '../integrations/supabase/types';
import { parseMarketUpdateEvent } from '../integrations/supabase/types';
import { queryKeys } from '../query/keys';

interface UseMarketUpdateRangeOptions {
  marketId: number;
  startSlot: number | null;
  endSlot: number | null;
}

const PAGE_SIZE = 1000;

function sortBySlotAsc(events: MarketUpdateEvent[]): MarketUpdateEvent[] {
  return [...events].sort((left, right) => {
    if (left.slot === right.slot) return left.id - right.id;
    return left.slot - right.slot;
  });
}

export function useMarketUpdateRange({ marketId, startSlot, endSlot }: UseMarketUpdateRangeOptions) {
  const queryKey = useMemo(() => queryKeys.marketUpdates.range(marketId, startSlot, endSlot), [marketId, startSlot, endSlot]);
  const enabled = startSlot !== null && endSlot !== null && startSlot <= endSlot;

  const query = useQuery<MarketUpdateEvent[]>({
    queryKey,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (startSlot === null || endSlot === null || startSlot > endSlot) {
        return [];
      }

      const history: MarketUpdateEvent[] = [];
      const { data: anchorData, error: anchorError } = await supabase
        .from('market_update_events')
        .select('*')
        .eq('market_id', marketId)
        .lt('slot', startSlot)
        .order('slot', { ascending: false })
        .limit(1);

      if (anchorError) {
        throw new Error(anchorError.message);
      }

      if (anchorData && anchorData.length > 0) {
        history.push(parseMarketUpdateEvent(anchorData[0]));
      }

      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('market_update_events')
          .select('*')
          .eq('market_id', marketId)
          .gte('slot', startSlot)
          .lte('slot', endSlot)
          .order('slot', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          throw new Error(error.message);
        }

        const page = (data ?? []).map(parseMarketUpdateEvent);
        history.push(...page);

        if (page.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      return sortBySlotAsc(history);
    },
  });

  return {
    events: query.data ?? [],
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

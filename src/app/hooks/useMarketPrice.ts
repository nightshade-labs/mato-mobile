import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import type { MarketUpdateEventRow } from '../../integrations/supabase/types';
import { queryKeys } from '../query/keys';

interface UseMarketPriceOptions {
  marketId: number;
  baseDecimals: number;
  quoteDecimals: number;
}

function computePrice(
  baseFlow: string,
  quoteFlow: string,
  baseDecimals: number,
  quoteDecimals: number,
): number | null {
  const base = Number(baseFlow);
  if (base === 0) return null;
  return (Number(quoteFlow) / 10 ** quoteDecimals) / (base / 10 ** baseDecimals);
}

export function useMarketPrice({ marketId, baseDecimals, quoteDecimals }: UseMarketPriceOptions) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.marketPrice.byMarket(marketId), [marketId]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_update_events')
        .select('*')
        .eq('market_id', marketId)
        .order('slot', { ascending: false })
        .limit(1)
        .single<MarketUpdateEventRow>();

      if (error) throw new Error(error.message);

      return {
        price: computePrice(data.base_flow, data.quote_flow, baseDecimals, quoteDecimals),
        slot: data.slot,
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`market_price_${marketId}`)
      .on<MarketUpdateEventRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_update_events',
          filter: `market_id=eq.${marketId}`,
        },
        (payload) => {
          const { base_flow, quote_flow, slot } = payload.new;
          const price = computePrice(base_flow, quote_flow, baseDecimals, quoteDecimals);
          queryClient.setQueryData(queryKey, { price, slot });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, baseDecimals, quoteDecimals, queryClient, queryKey]);

  return {
    price: query.data?.price ?? null,
    slot: query.data?.slot ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

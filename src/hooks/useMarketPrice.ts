import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import type { MarketUpdateEventRow } from '../integrations/supabase/types';
import { queryKeys } from '../query/keys';
import { useMarketConfig } from './useMarketConfig';

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

export function useMarketPrice(marketId: number) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.marketPrice.byMarket(marketId), [marketId]);
  const { config } = useMarketConfig(marketId);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!config) throw new Error('Market config not loaded');

      const { data, error } = await supabase
        .from('market_update_events')
        .select('*')
        .eq('market_id', marketId)
        .order('slot', { ascending: false })
        .limit(1)
        .single<MarketUpdateEventRow>();

      if (error) throw new Error(error.message);

      return {
        price: computePrice(data.base_flow, data.quote_flow, config.base_decimals, config.quote_decimals),
        slot: data.slot,
      };
    },
    enabled: config !== null,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!config) return;

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
          const price = computePrice(base_flow, quote_flow, config.base_decimals, config.quote_decimals);
          queryClient.setQueryData(queryKey, { price, slot });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, config, queryClient, queryKey]);

  return {
    price: query.data?.price ?? null,
    slot: query.data?.slot ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

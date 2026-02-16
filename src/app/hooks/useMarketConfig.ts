import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import type { MarketConfigRow } from '../../integrations/supabase/types';
import { queryKeys } from '../query/keys';

export function useMarketConfig(marketId: number) {
  const query = useQuery({
    queryKey: queryKeys.marketConfig.byMarket(marketId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_configs')
        .select('*')
        .eq('market_id', marketId)
        .single<MarketConfigRow>();

      if (error) throw new Error(error.message);

      return data;
    },
    staleTime: Infinity,
  });

  return {
    config: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

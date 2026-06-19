import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readApiUrl } from '../api/readApi';
import { queryKeys } from '../query/keys';

interface ReadApiPriceResponse {
  market_id: number;
  slot: number;
  event_time: string;
  price: number;
}

type EventSourceLike = {
  addEventListener: (type: string, listener: (event: { data: string }) => void) => void;
  close: () => void;
};

export function useMarketPrice(marketId: number) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.marketPrice.byMarket(marketId), [marketId]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(readApiUrl(`/v1/markets/${marketId}/price`), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to fetch market price (${response.status}): ${body || response.statusText}`);
      }

      const data = (await response.json()) as ReadApiPriceResponse;
      return {
        price: Number.isFinite(data.price) ? data.price : null,
        slot: data.slot,
      };
    },
    enabled: true,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const EventSourceCtor = (globalThis as { EventSource?: new (url: string) => EventSourceLike }).EventSource;
    if (!EventSourceCtor) {
      return;
    }

    const stream = new EventSourceCtor(readApiUrl(`/v1/markets/${marketId}/stream`));
    stream.addEventListener('price_update', (event) => {
      try {
        const payload = JSON.parse(event.data) as ReadApiPriceResponse;
        if (!Number.isFinite(payload.price) || !Number.isFinite(payload.slot)) {
          return;
        }

        queryClient.setQueryData(queryKey, {
          price: payload.price,
          slot: payload.slot,
        });
      } catch (error) {
        console.warn('Failed to parse market price stream payload', error);
      }
    });

    return () => {
      stream.close();
    };
  }, [marketId, queryClient, queryKey]);

  return {
    price: query.data?.price ?? null,
    slot: query.data?.slot ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

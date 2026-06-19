import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { queryKeys } from '../query/keys';
import type { TradePosition } from './useTradePositions';
import { resolver } from '../utils/accountResolver';

export function useMarketTradePositions(market: PublicKey | null) {
  const program = useProgram();

  const query = useQuery<TradePosition[]>({
    enabled: !!market,
    queryKey: [...queryKeys.streamingMarket.byMarket(market), 'tradePositions'] as const,
    queryFn: async () => {
      if (!market) return [];

      const accounts = await program.account.tradePosition.all();

      return accounts
        .map((a) => ({
          publicKey: a.publicKey,
          authority: a.account.authority as PublicKey,
          id: a.account.id as BN,
          amount: a.account.amount as BN,
          startSlot: a.account.startSlot as BN,
          endSlot: a.account.endSlot as BN,
          bookkeepingSnapshot: a.account.bookkeepingSnapshot as BN,
          isBuy: a.account.isBuy === 1,
        }))
        .filter((position) =>
          resolver.tradePositionPda(market, position.authority, position.id).equals(position.publicKey),
        );
    },
    refetchInterval: 20_000,
  });

  return {
    positions: query.data ?? [],
    loading: !!market && (query.isPending || query.isFetching),
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

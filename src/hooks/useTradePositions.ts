import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { queryKeys } from '../query/keys';

export interface TradePosition {
  publicKey: PublicKey;
  authority: PublicKey;
  id: BN;
  amount: BN;
  startSlot: BN;
  endSlot: BN;
  bookkeepingSnapshot: BN;
  isBuy: boolean;
}

export function useTradePositions(authority: PublicKey | null) {
  const program = useProgram();

  const query = useQuery<TradePosition[]>({
    queryKey: queryKeys.tradePositions.byAuthority(authority),
    enabled: !!authority,
    queryFn: async () => {
      if (!authority) return [];

      const accounts = await program.account.tradePosition.all([
        { memcmp: { offset: 8, bytes: authority.toBase58() } },
      ]);

      return accounts.map((a) => ({
        publicKey: a.publicKey,
        authority: a.account.authority as PublicKey,
        id: a.account.id as BN,
        amount: a.account.amount as BN,
        startSlot: a.account.startSlot as BN,
        endSlot: a.account.endSlot as BN,
        bookkeepingSnapshot: a.account.bookkeepingSnapshot as BN,
        isBuy: a.account.isBuy === 1,
      }));
    },
  });

  return { positions: query.data ?? [], loading: query.isPending || query.isFetching, refetch: query.refetch };
}

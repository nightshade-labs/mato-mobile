import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '../providers/ConnectionProvider';
import { useProgram } from './useProgram';
import { resolver } from '../../utils/accountResolver';
import { queryKeys } from '../query/keys';

export interface StreamingMarketState {
  currentSlot: number;
  marketBaseFlow: bigint;
  marketQuoteFlow: bigint;
  bookkeepingBasePerQuote: bigint;
  bookkeepingQuotePerBase: bigint;
  bookkeepingLastUpdateSlot: number;
}

export function useStreamingMarketState(market: PublicKey, enabled: boolean = true) {
  const { connection } = useConnection();
  const program = useProgram();

  const query = useQuery<StreamingMarketState>({
    queryKey: queryKeys.streamingMarket.byMarket(market),
    enabled,
    refetchInterval: 1000,
    queryFn: async () => {
      const bookkeeping = resolver.bookkeepingPda(market);
      const [currentSlot, marketAccount, bookkeepingAccount] = await Promise.all([
        connection.getSlot('confirmed'),
        program.account.market.fetch(market),
        program.account.bookkeeping.fetch(bookkeeping),
      ]);

      return {
        currentSlot,
        marketBaseFlow: BigInt(marketAccount.baseFlow.toString()),
        marketQuoteFlow: BigInt(marketAccount.quoteFlow.toString()),
        bookkeepingBasePerQuote: BigInt(bookkeepingAccount.basePerQuote.toString()),
        bookkeepingQuotePerBase: BigInt(bookkeepingAccount.quotePerBase.toString()),
        bookkeepingLastUpdateSlot: Number(bookkeepingAccount.lastUpdateSlot.toString()),
      };
    },
  });

  return {
    state: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

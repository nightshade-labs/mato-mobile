import { useQuery } from '@tanstack/react-query';
import { getMint, NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import type { Connection, PublicKey } from '@solana/web3.js';
import { fetchMarketConfig, TigerCloudApiError } from '../integrations/tigercloud/api';
import type { MarketConfig } from '../integrations/tigercloud/types';
import { useConnection } from '../providers/ConnectionProvider';
import { queryKeys } from '../query/keys';
import { resolver } from '../utils/accountResolver';
import { getTokenProgram } from '../utils/token';
import { useProgram } from './useProgram';

const KNOWN_TOKEN_TICKERS: Record<string, string> = {
  [NATIVE_MINT.toBase58()]: 'SOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkYJpxMzLJQAiLDwA: 'USDT',
};

async function fetchMintDecimals(connection: Connection, mint: PublicKey) {
  if (mint.equals(NATIVE_MINT)) {
    return 9;
  }

  const tokenProgram = await getTokenProgram(connection, mint);
  const mintAccount = await getMint(connection, mint, 'confirmed', tokenProgram);
  return mintAccount.decimals;
}

async function fetchOnChainMarketConfig({
  connection,
  marketId,
  program,
}: {
  connection: Connection;
  marketId: number;
  program: ReturnType<typeof useProgram>;
}): Promise<MarketConfig> {
  const marketPda = resolver.marketPda(new BN(marketId));
  const market = await program.account.market.fetch(marketPda);
  const baseMint = market.baseMint as PublicKey;
  const quoteMint = market.quoteMint as PublicKey;
  const [baseDecimals, quoteDecimals] = await Promise.all([
    fetchMintDecimals(connection, baseMint),
    fetchMintDecimals(connection, quoteMint),
  ]);
  const baseMintAddress = baseMint.toBase58();
  const quoteMintAddress = quoteMint.toBase58();

  return {
    id: marketId,
    market_id: marketId,
    base_ticker: KNOWN_TOKEN_TICKERS[baseMintAddress] ?? null,
    quote_ticker: KNOWN_TOKEN_TICKERS[quoteMintAddress] ?? null,
    base_mint: baseMintAddress,
    quote_mint: quoteMintAddress,
    base_decimals: baseDecimals,
    quote_decimals: quoteDecimals,
    created_at: null,
  };
}

export function useMarketConfig(marketId: number) {
  const { connection } = useConnection();
  const program = useProgram();

  const query = useQuery({
    queryKey: queryKeys.marketConfig.byMarket(marketId),
    queryFn: async () => {
      try {
        return await fetchMarketConfig(marketId);
      } catch (error) {
        if (error instanceof TigerCloudApiError && error.status === 404) {
          return fetchOnChainMarketConfig({
            connection,
            marketId,
            program,
          });
        }

        throw error;
      }
    },
    staleTime: Infinity,
  });

  return {
    config: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

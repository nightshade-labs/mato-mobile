import { PublicKey } from '@solana/web3.js';

function toAuthorityKey(authority: PublicKey | string | null | undefined): string {
  if (!authority) return 'none';
  return typeof authority === 'string' ? authority : authority.toBase58();
}

export const queryKeys = {
  balance: {
    all: ['balance'] as const,
    byAuthority: (authority: PublicKey | string | null | undefined) => ['balance', toAuthorityKey(authority)] as const,
  },
  tradePositions: {
    all: ['tradePositions'] as const,
    byAuthority: (authority: PublicKey | string | null | undefined) =>
      ['tradePositions', toAuthorityKey(authority)] as const,
  },
  marketUpdates: {
    all: ['marketUpdates'] as const,
    list: (marketId: number, limit: number) => ['marketUpdates', marketId, limit] as const,
  },
  marketConfig: {
    all: ['marketConfig'] as const,
    byMarket: (marketId: number) => ['marketConfig', marketId] as const,
  },
  marketPrice: {
    all: ['marketPrice'] as const,
    byMarket: (marketId: number) => ['marketPrice', marketId] as const,
  },
  closePositionEvents: {
    all: ['closePositionEvents'] as const,
    list: (positionAuthority: string, marketId: number | undefined, limit: number) =>
      ['closePositionEvents', positionAuthority, marketId ?? 'all', limit] as const,
  },
};

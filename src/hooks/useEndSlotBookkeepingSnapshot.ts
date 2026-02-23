import { useMemo } from 'react';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { resolver } from '../utils/accountResolver';
import { ARRAY_LENGTH } from '../utils/constants';
import { useProgram } from './useProgram';

interface SnapshotLocation {
  pricesAccountIndex: number;
  snapshotIndex: number;
}

function resolveSnapshotLocation(endSlot: number, endSlotInterval: number): SnapshotLocation | null {
  if (!Number.isFinite(endSlot) || endSlot < 0) return null;
  if (!Number.isFinite(endSlotInterval) || endSlotInterval <= 0) return null;

  const slotsPerPricesAccount = ARRAY_LENGTH * endSlotInterval;
  if (!Number.isFinite(slotsPerPricesAccount) || slotsPerPricesAccount <= 0) return null;

  return {
    pricesAccountIndex: Math.floor(endSlot / slotsPerPricesAccount),
    snapshotIndex: Math.floor(endSlot / endSlotInterval) % ARRAY_LENGTH,
  };
}

interface UseEndSlotBookkeepingSnapshotArgs {
  market: PublicKey;
  endSlot: number;
  endSlotInterval: number | null;
  isBuy: boolean;
  enabled?: boolean;
}

export function useEndSlotBookkeepingSnapshot({
  market,
  endSlot,
  endSlotInterval,
  isBuy,
  enabled = true,
}: UseEndSlotBookkeepingSnapshotArgs) {
  const program = useProgram();

  const snapshotLocation = useMemo(() => {
    if (endSlotInterval === null) return null;
    return resolveSnapshotLocation(endSlot, endSlotInterval);
  }, [endSlot, endSlotInterval]);

  const query = useQuery<bigint | null>({
    queryKey: [
      'endSlotBookkeepingSnapshot',
      market.toBase58(),
      snapshotLocation?.pricesAccountIndex ?? 'none',
      snapshotLocation?.snapshotIndex ?? 'none',
      isBuy ? 'buy' : 'sell',
    ],
    enabled: enabled && snapshotLocation !== null,
    staleTime: Infinity,
    queryFn: async () => {
      if (!snapshotLocation) return null;

      const pricesPda = resolver.pricesPda(market, new BN(snapshotLocation.pricesAccountIndex));

      try {
        const pricesAccount = await program.account.prices.fetch(pricesPda);
        const snapshots = isBuy ? pricesAccount.basePerQuoteSnapshot : pricesAccount.quotePerBaseSnapshot;
        const snapshot = snapshots[snapshotLocation.snapshotIndex];
        if (snapshot === undefined || snapshot === null) return null;
        return BigInt(snapshot.toString());
      } catch {
        return null;
      }
    },
  });

  return {
    snapshot: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}


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

function resolveSnapshotLocation(slot: number, endSlotInterval: number): SnapshotLocation | null {
  if (!Number.isFinite(slot) || slot < 0) return null;
  if (!Number.isFinite(endSlotInterval) || endSlotInterval <= 0) return null;

  const slotsPerPricesAccount = ARRAY_LENGTH * endSlotInterval;
  if (!Number.isFinite(slotsPerPricesAccount) || slotsPerPricesAccount <= 0) return null;

  return {
    pricesAccountIndex: Math.floor(slot / slotsPerPricesAccount),
    snapshotIndex: Math.floor(slot / endSlotInterval) % ARRAY_LENGTH,
  };
}

interface UseEndSlotBookkeepingSnapshotArgs {
  market: PublicKey;
  endSlot: number;
  endSlotInterval: number | null;
  currentSlot: number | null;
  isBuy: boolean;
  enabled?: boolean;
}

export function useEndSlotBookkeepingSnapshot({
  market,
  endSlot,
  endSlotInterval,
  currentSlot,
  isBuy,
  enabled = true,
}: UseEndSlotBookkeepingSnapshotArgs) {
  const program = useProgram();

  const snapshotLocation = useMemo(() => {
    if (endSlotInterval === null) return null;
    return resolveSnapshotLocation(endSlot, endSlotInterval);
  }, [endSlot, endSlotInterval]);
  const snapshotReadySlot = useMemo(() => {
    if (endSlotInterval === null || endSlotInterval <= 0) return null;
    return endSlot + ARRAY_LENGTH * endSlotInterval;
  }, [endSlot, endSlotInterval]);
  const isSnapshotLikelyReady = useMemo(() => {
    if (currentSlot === null || snapshotReadySlot === null) return false;
    return currentSlot >= snapshotReadySlot;
  }, [currentSlot, snapshotReadySlot]);

  const query = useQuery<bigint | null>({
    queryKey: [
      'endSlotBookkeepingSnapshot',
      market.toBase58(),
      snapshotLocation?.pricesAccountIndex ?? 'none',
      snapshotLocation?.snapshotIndex ?? 'none',
      isBuy ? 'buy' : 'sell',
    ],
    enabled: enabled && snapshotLocation !== null && isSnapshotLikelyReady,
    staleTime: Infinity,
    refetchInterval: (query) => {
      if (!enabled || snapshotLocation === null || !isSnapshotLikelyReady) return false;
      return query.state.data === null ? 2000 : false;
    },
    queryFn: async () => {
      if (!snapshotLocation) return null;
      const fallbackLocation =
        endSlotInterval !== null && endSlotInterval > 0
          ? resolveSnapshotLocation(endSlot - endSlotInterval, endSlotInterval)
          : null;

      const candidateLocations = [snapshotLocation, fallbackLocation].filter(
        (location): location is SnapshotLocation => location !== null,
      );
      const uniquePricesIndices = Array.from(new Set(candidateLocations.map((location) => location.pricesAccountIndex)));
      const fetchedByIndex = new Map<number, any>();

      await Promise.all(
        uniquePricesIndices.map(async (index) => {
          try {
            const pricesPda = resolver.pricesPda(market, new BN(index));
            const pricesAccount = await program.account.prices.fetch(pricesPda);
            fetchedByIndex.set(index, pricesAccount);
          } catch {
            fetchedByIndex.set(index, null);
          }
        }),
      );

      const readSnapshot = (location: SnapshotLocation): bigint | null => {
        const pricesAccount = fetchedByIndex.get(location.pricesAccountIndex);
        if (!pricesAccount) return null;
        const snapshots = isBuy ? pricesAccount.basePerQuoteSnapshot : pricesAccount.quotePerBaseSnapshot;
        const snapshot = snapshots[location.snapshotIndex];
        if (snapshot === undefined || snapshot === null) return null;
        return BigInt(snapshot.toString());
      };

      const primarySnapshot = readSnapshot(snapshotLocation);
      const fallbackSnapshot = fallbackLocation ? readSnapshot(fallbackLocation) : null;

      if (primarySnapshot === null) return fallbackSnapshot;
      if (fallbackSnapshot === null) return primarySnapshot;
      return primarySnapshot >= fallbackSnapshot ? primarySnapshot : fallbackSnapshot;
    },
  });

  return {
    snapshot: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    isSnapshotLikelyReady,
  };
}

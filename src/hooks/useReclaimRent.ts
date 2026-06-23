import { useCallback, useMemo, useState } from 'react';
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import BN from 'bn.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useConnection } from '../providers/ConnectionProvider';
import { queryKeys } from '../query/keys';
import { resolver } from '../utils/accountResolver';
import { ARRAY_LENGTH, MAX_RECLAIM_RENT_ACCOUNTS_PER_TRANSACTION } from '../utils/constants';
import { handleMWAError } from '../utils/mwaErrorHandler';
import { useProgram } from './useProgram';

type ReclaimRentStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';
type RentAccountKind = 'exits' | 'prices';

interface RentAccountCandidate {
  index: bigint;
  kind: RentAccountKind;
  publicKey: PublicKey;
}

interface ReclaimRentResult {
  status: ReclaimRentStatus;
  signature: string | null;
  error: string | null;
  reclaimedCount: number;
}

interface ReclaimRentMutationResult {
  authority: PublicKey;
  signature: string;
}

type AnchorRentAccount = {
  account: {
    index: BN;
    openPositions?: BN;
  };
  publicKey: PublicKey;
};

function bnToBigInt(value: BN): bigint {
  return BigInt(value.toString(10));
}

function bigintToBn(value: bigint): BN {
  return new BN(value.toString());
}

function getReferenceIndex(currentSlot: number, endSlotInterval: number): bigint {
  return BigInt(Math.floor((currentSlot + 20) / (ARRAY_LENGTH * endSlotInterval)));
}

function isRentAccountCloseable(currentSlot: number, endSlotInterval: bigint, index: bigint): boolean {
  return BigInt(Math.floor(currentSlot)) > (index + 1n) * BigInt(ARRAY_LENGTH) * endSlotInterval;
}

function selectCloseableRentAccounts({
  currentSlot,
  endSlotInterval,
  exitsAccounts,
  previousIndex,
  pricesAccounts,
}: {
  currentSlot: number;
  endSlotInterval: bigint;
  exitsAccounts: AnchorRentAccount[];
  previousIndex: bigint | null;
  pricesAccounts: AnchorRentAccount[];
}): RentAccountCandidate[] {
  if (previousIndex === null) return [];

  const mappedPricesAccounts = pricesAccounts.map((account) => ({
    index: bnToBigInt(account.account.index),
    openPositions: bnToBigInt(account.account.openPositions ?? new BN(0)),
    publicKey: account.publicKey,
  }));
  const indicesWithOpenPositions = new Set(
    mappedPricesAccounts.filter((account) => account.openPositions > 0n).map((account) => account.index),
  );

  const exitsCandidates = exitsAccounts
    .map(
      (account): RentAccountCandidate => ({
        index: bnToBigInt(account.account.index),
        kind: 'exits',
        publicKey: account.publicKey,
      }),
    )
    .filter(
      (account) =>
        account.index < previousIndex &&
        !indicesWithOpenPositions.has(account.index) &&
        isRentAccountCloseable(currentSlot, endSlotInterval, account.index),
    );

  const pricesCandidates = mappedPricesAccounts
    .filter(
      (account) =>
        account.index < previousIndex &&
        account.openPositions === 0n &&
        isRentAccountCloseable(currentSlot, endSlotInterval, account.index),
    )
    .map(
      (account): RentAccountCandidate => ({
        index: account.index,
        kind: 'prices',
        publicKey: account.publicKey,
      }),
    );

  return [...exitsCandidates, ...pricesCandidates].sort((left, right) => {
    if (left.index === right.index) {
      if (left.kind === right.kind) return 0;
      return left.kind === 'exits' ? -1 : 1;
    }
    return left.index < right.index ? -1 : 1;
  });
}

export function useReclaimRent(market: PublicKey, owner: PublicKey | null) {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const program = useProgram();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ReclaimRentResult>({
    status: 'idle',
    signature: null,
    error: null,
    reclaimedCount: 0,
  });

  const shouldFetch = Boolean(owner);

  const exitsQuery = useQuery({
    enabled: shouldFetch,
    queryKey: [...queryKeys.rentAccounts.byAuthority(owner), 'exits'] as const,
    queryFn: async () => {
      if (!owner) return [];
      return program.account.exits.all([{ memcmp: { offset: 8, bytes: owner.toBase58() } }]);
    },
    refetchInterval: shouldFetch ? 10_000 : false,
    refetchIntervalInBackground: true,
  });

  const pricesQuery = useQuery({
    enabled: shouldFetch,
    queryKey: [...queryKeys.rentAccounts.byAuthority(owner), 'prices'] as const,
    queryFn: async () => {
      if (!owner) return [];
      return program.account.prices.all([{ memcmp: { offset: 8, bytes: owner.toBase58() } }]);
    },
    refetchInterval: shouldFetch ? 10_000 : false,
    refetchIntervalInBackground: true,
  });

  const runtimeQuery = useQuery({
    enabled: shouldFetch,
    queryKey: queryKeys.rentAccounts.runtime(market),
    queryFn: async () => {
      const [slot, marketAccount] = await Promise.all([
        connection.getSlot('confirmed'),
        program.account.market.fetch(market),
      ]);
      const endSlotInterval = (marketAccount.endSlotInterval as BN).toNumber();
      const referenceIndex = getReferenceIndex(slot, endSlotInterval);

      return {
        currentSlot: slot,
        endSlotInterval: BigInt(endSlotInterval),
        previousIndex: referenceIndex > 0n ? referenceIndex - 1n : null,
        referenceIndex,
      };
    },
    refetchInterval: shouldFetch ? 10_000 : false,
    refetchIntervalInBackground: true,
  });

  const closeableAccounts = useMemo<RentAccountCandidate[]>(() => {
    if (!runtimeQuery.data) return [];

    return selectCloseableRentAccounts({
      currentSlot: runtimeQuery.data.currentSlot,
      endSlotInterval: runtimeQuery.data.endSlotInterval,
      exitsAccounts: exitsQuery.data ?? [],
      previousIndex: runtimeQuery.data.previousIndex,
      pricesAccounts: pricesQuery.data ?? [],
    });
  }, [exitsQuery.data, pricesQuery.data, runtimeQuery.data]);

  const mutation = useMutation<ReclaimRentMutationResult, unknown, void>({
    mutationFn: async () => {
      let authority: PublicKey | null = null;

      const signature = await transact(async (wallet) => {
        setResult((prev) => ({ ...prev, status: 'signing' }));

        const account = await authorizeSession(wallet);
        authority = account.publicKey;

        const [slot, marketAccount] = await Promise.all([
          connection.getSlot('confirmed'),
          program.account.market.fetch(market),
        ]);
        const endSlotInterval = (marketAccount.endSlotInterval as BN).toNumber();
        const referenceIndex = getReferenceIndex(slot, endSlotInterval);
        if (referenceIndex <= 0n) {
          throw new Error('Reclaim rent is not available yet.');
        }

        const previousIndex = referenceIndex - 1n;
        const [latestExitsQuery, latestPricesQuery] = await Promise.all([exitsQuery.refetch(), pricesQuery.refetch()]);
        const latestCloseableAccounts = selectCloseableRentAccounts({
          currentSlot: slot,
          endSlotInterval: BigInt(endSlotInterval),
          exitsAccounts: latestExitsQuery.data ?? exitsQuery.data ?? [],
          previousIndex,
          pricesAccounts: latestPricesQuery.data ?? pricesQuery.data ?? [],
        });
        const selectedAccounts = latestCloseableAccounts.slice(0, MAX_RECLAIM_RENT_ACCOUNTS_PER_TRANSACTION);

        if (selectedAccounts.length === 0) {
          throw new Error('No reclaimable rent accounts available.');
        }

        const referenceIndexBn = bigintToBn(referenceIndex);
        const previousIndexBn = bigintToBn(previousIndex);
        const currentExits = resolver.exitsPda(market, referenceIndexBn);
        const previousExits = resolver.exitsPda(market, previousIndexBn);
        const currentPrices = resolver.pricesPda(market, referenceIndexBn);
        const previousPrices = resolver.pricesPda(market, previousIndexBn);
        const bookkeeping = resolver.bookkeepingPda(market);
        const instructions: TransactionInstruction[] = [];

        for (const rentAccount of selectedAccounts) {
          const builder =
            rentAccount.kind === 'exits'
              ? program.methods.closeExitsAccount(referenceIndexBn).accountsPartial({
                  signer: account.publicKey,
                  owner: account.publicKey,
                  exits: rentAccount.publicKey,
                  market,
                  bookkeeping,
                  currentExits,
                  previousExits,
                  currentPrices,
                  previousPrices,
                  systemProgram: SystemProgram.programId,
                })
              : program.methods.closePricesAccount(referenceIndexBn).accountsPartial({
                  signer: account.publicKey,
                  owner: account.publicKey,
                  prices: rentAccount.publicKey,
                  market,
                  bookkeeping,
                  currentExits,
                  previousExits,
                  currentPrices,
                  previousPrices,
                  systemProgram: SystemProgram.programId,
                });

          instructions.push(await builder.instruction());
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        const transaction = new VersionedTransaction(
          new TransactionMessage({
            payerKey: account.publicKey,
            recentBlockhash: blockhash,
            instructions,
          }).compileToV0Message(),
        );

        const [sig] = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        setResult((prev) => ({
          ...prev,
          reclaimedCount: selectedAccounts.length,
          signature: sig,
          status: 'confirming',
        }));

        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

        return sig;
      });

      if (!authority) {
        throw new Error('Wallet authorization did not return a selected authority');
      }

      return { authority, signature };
    },
    onSuccess: async ({ authority, signature }) => {
      setResult((previous) => ({
        status: 'success',
        signature,
        error: null,
        reclaimedCount: previous.reclaimedCount,
      }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance.byAuthority(authority) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rentAccounts.byAuthority(authority) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rentAccounts.runtime(market) }),
      ]);
    },
    onError: (error) => {
      const mwaError = handleMWAError(error);

      if (mwaError.isUserCancellation) {
        setResult({ status: 'idle', signature: null, error: null, reclaimedCount: 0 });
        return;
      }

      setResult({ status: 'error', signature: null, error: mwaError.userMessage, reclaimedCount: 0 });
    },
  });

  const reclaimRent = useCallback(async (): Promise<boolean> => {
    setResult({ status: 'building', signature: null, error: null, reclaimedCount: 0 });
    try {
      await mutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }, [mutation]);

  const reset = useCallback(() => {
    mutation.reset();
    setResult({ status: 'idle', signature: null, error: null, reclaimedCount: 0 });
  }, [mutation]);

  return {
    closeableCount: closeableAccounts.length,
    error: result.error,
    isLoadingEligibility: shouldFetch && (exitsQuery.isPending || pricesQuery.isPending || runtimeQuery.isPending),
    isReclaiming: result.status === 'building' || result.status === 'signing' || result.status === 'confirming',
    reclaimRent,
    reclaimedCount: result.reclaimedCount,
    reset,
    signature: result.signature,
    status: result.status,
  };
}

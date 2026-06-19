import { useState, useCallback } from 'react';
import { PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { NATIVE_MINT, getAssociatedTokenAddressSync, createCloseAccountInstruction } from '@solana/spl-token';
import BN from 'bn.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useProgram } from './useProgram';
import { handleMWAError } from '../utils/mwaErrorHandler';
import { resolver } from '../utils/accountResolver';
import { ARRAY_LENGTH } from '../utils/constants';
import { getTokenProgram } from '../utils/token';
import { queryKeys } from '../query/keys';

type ClosePositionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface ClosePositionResult {
  status: ClosePositionStatus;
  signature: string | null;
  error: string | null;
  closedCount: number;
}

interface ClosePositionAccounts {
  market: PublicKey;
  tradePosition?: PublicKey;
  tradePositions?: PublicKey[];
}

interface ClosePositionMutationResult {
  signature: string;
  authority: PublicKey;
}

export function useClosePosition() {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const program = useProgram();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ClosePositionResult>({
    status: 'idle',
    signature: null,
    error: null,
    closedCount: 0,
  });

  const mutation = useMutation<ClosePositionMutationResult, unknown, ClosePositionAccounts>({
    mutationFn: async (accounts) => {
      let authority: PublicKey | null = null;

      const signature = await transact(async (wallet) => {
        setResult((prev) => ({ ...prev, status: 'signing' }));

        const account = await authorizeSession(wallet);
        authority = account.publicKey;

        const market = await program.account.market.fetch(accounts.market);
        const [baseTokenProgram, quoteTokenProgram] = await Promise.all([
          getTokenProgram(connection, market.baseMint),
          getTokenProgram(connection, market.quoteMint),
        ]);

        const endSlotInterval = market.endSlotInterval.toNumber();
        const slot = await connection.getSlot('confirmed');
        const referenceIndex = new BN(Math.floor((slot + 20) / (ARRAY_LENGTH * endSlotInterval)));
        const previousIndex = referenceIndex.sub(new BN(1));

        const currentExits = resolver.exitsPda(accounts.market, referenceIndex);
        const previousExits = resolver.exitsPda(accounts.market, previousIndex);
        const currentPrices = resolver.pricesPda(accounts.market, referenceIndex);
        const previousPrices = resolver.pricesPda(accounts.market, previousIndex);
        const tradePositionAddresses =
          accounts.tradePositions && accounts.tradePositions.length > 0
            ? accounts.tradePositions
            : accounts.tradePosition
              ? [accounts.tradePosition]
              : [];
        if (tradePositionAddresses.length === 0) {
          throw new Error('No positions selected to close');
        }

        const instructions: TransactionInstruction[] = [];
        for (const tradePositionAddress of tradePositionAddresses) {
          const tradePosition = await program.account.tradePosition.fetch(tradePositionAddress);
          const futureIndex = new BN(tradePosition.endSlot.toNumber() / ARRAY_LENGTH / endSlotInterval);
          const futureExits = resolver.exitsPda(accounts.market, futureIndex);
          const futurePrices = resolver.pricesPda(accounts.market, futureIndex);

          const ix = await program.methods
            .authorityClosePosition(referenceIndex)
            .accountsPartial({
              authority: account.publicKey,
              baseMint: market.baseMint,
              quoteMint: market.quoteMint,
              market: accounts.market,
              tradePosition: tradePositionAddress,
              futureExits,
              futurePrices,
              currentExits,
              previousExits,
              currentPrices,
              previousPrices,
              baseTokenProgram,
              quoteTokenProgram,
            })
            .instruction();

          instructions.push(ix);
        }

        // If base or quote is native mint, close the WSOL ATA to unwrap back to SOL
        for (const [mint, tokenProgram] of [
          [market.baseMint, baseTokenProgram],
          [market.quoteMint, quoteTokenProgram],
        ] as const) {
          if (mint.equals(NATIVE_MINT)) {
            const ata = getAssociatedTokenAddressSync(NATIVE_MINT, account.publicKey, false, tokenProgram);
            instructions.push(
              createCloseAccountInstruction(ata, account.publicKey, account.publicKey, [], tokenProgram),
            );
          }
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        const transaction = new VersionedTransaction(
          new TransactionMessage({
            payerKey: account.publicKey,
            recentBlockhash: blockhash,
            instructions,
          }).compileToV0Message(),
        );

        // Nice for debugging
        // const sim = await connection.simulateTransaction(transaction);
        // console.log('Simulation logs:', sim.value.logs);
        // if (sim.value.err) {
        //   console.log('Simulation error:', JSON.stringify(sim.value.err));
        //   throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
        // }

        const [sig] = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        setResult((prev) => ({ ...prev, status: 'confirming', signature: sig }));

        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

        return sig;
      });

      if (!authority) {
        throw new Error('Wallet authorization did not return a selected authority');
      }

      return { signature, authority };
    },
    onSuccess: async ({ signature, authority }) => {
      setResult((previous) => ({ status: 'success', signature, error: null, closedCount: previous.closedCount }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance.byAuthority(authority) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tradePositions.byAuthority(authority) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.closePositionEvents.all }),
      ]);
    },
    onError: (error) => {
      const mwaError = handleMWAError(error);

      if (mwaError.isUserCancellation) {
        setResult({ status: 'idle', signature: null, error: null, closedCount: 0 });
        return;
      }

      setResult({ status: 'error', signature: null, error: mwaError.userMessage, closedCount: 0 });
    },
  });

  const closePosition = useCallback(
    async (accounts: ClosePositionAccounts): Promise<boolean> => {
      const closedCount = accounts.tradePositions?.length ?? (accounts.tradePosition ? 1 : 0);
      setResult({ status: 'building', signature: null, error: null, closedCount });
      try {
        await mutation.mutateAsync(accounts);
        return true;
      } catch {
        return false;
      }
    },
    [mutation],
  );

  const reset = useCallback(() => {
    mutation.reset();
    setResult({ status: 'idle', signature: null, error: null, closedCount: 0 });
  }, [mutation]);

  return { closePosition, reset, ...result };
}

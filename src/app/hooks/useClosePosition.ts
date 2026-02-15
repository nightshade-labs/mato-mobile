import { useState, useCallback } from 'react';
import { PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { NATIVE_MINT, getAssociatedTokenAddressSync, createCloseAccountInstruction } from '@solana/spl-token';
import BN from 'bn.js';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useProgram } from './useProgram';
import { handleMWAError } from '../../utils/mwaErrorHandler';
import { resolver } from '../../utils/accountResolver';
import { ARRAY_LENGTH } from '../../utils/constants';
import { getTokenProgram } from '../../utils/token';

type ClosePositionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface ClosePositionResult {
  status: ClosePositionStatus;
  signature: string | null;
  error: string | null;
}

interface ClosePositionAccounts {
  market: PublicKey;
  tradePosition: PublicKey;
}

export function useClosePosition() {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const program = useProgram();
  const [result, setResult] = useState<ClosePositionResult>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const closePosition = useCallback(
    async (accounts: ClosePositionAccounts): Promise<boolean> => {
      setResult({ status: 'building', signature: null, error: null });

      try {
        const signature = await transact(async (wallet) => {
          setResult((prev) => ({ ...prev, status: 'signing' }));

          const account = await authorizeSession(wallet);

          const market = await program.account.market.fetch(accounts.market);
          const [baseTokenProgram, quoteTokenProgram] = await Promise.all([
            getTokenProgram(connection, market.baseMint),
            getTokenProgram(connection, market.quoteMint),
          ]);

          const endSlotInterval = market.endSlotInterval.toNumber();
          const tradePosition = await program.account.tradePosition.fetch(accounts.tradePosition);
          const futureIndex = new BN(tradePosition.endSlot.toNumber() / ARRAY_LENGTH / endSlotInterval);

          // Derive exits/prices PDAs from current slot
          const slot = await connection.getSlot('confirmed');
          const referenceIndex = new BN(Math.floor((slot + 20) / (ARRAY_LENGTH * endSlotInterval)));
          const previousIndex = referenceIndex.sub(new BN(1));

          const currentExits = resolver.exitsPda(accounts.market, referenceIndex);
          const previousExits = resolver.exitsPda(accounts.market, previousIndex);
          const currentPrices = resolver.pricesPda(accounts.market, referenceIndex);
          const previousPrices = resolver.pricesPda(accounts.market, previousIndex);
          const futureExits = resolver.exitsPda(accounts.market, futureIndex);
          const futurePrices = resolver.pricesPda(accounts.market, futureIndex);

          const ix = await program.methods
            .authorityClosePosition(referenceIndex)
            .accountsPartial({
              authority: account.publicKey,
              baseMint: market.baseMint,
              quoteMint: market.quoteMint,
              market: accounts.market,
              tradePosition: accounts.tradePosition,
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

          const instructions: TransactionInstruction[] = [ix];

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

        setResult({ status: 'success', signature, error: null });
        return true;
      } catch (error) {
        const mwaError = handleMWAError(error);

        if (mwaError.isUserCancellation) {
          setResult({ status: 'idle', signature: null, error: null });
          return false;
        }

        setResult({ status: 'error', signature: null, error: mwaError.userMessage });
        return false;
      }
    },
    [connection, authorizeSession, program],
  );

  const reset = useCallback(() => {
    setResult({ status: 'idle', signature: null, error: null });
  }, []);

  return { closePosition, reset, ...result };
}

import { useState, useCallback } from 'react';
import {
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
} from '@solana/spl-token';
import BN from 'bn.js';
import { useQueryClient } from '@tanstack/react-query';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useProgram } from './useProgram';
import { handleMWAError } from '../../utils/mwaErrorHandler';
import { resolver } from '../../utils/accountResolver';
import { getTokenProgram } from '../../utils/token';
import { ARRAY_LENGTH } from '../../utils/constants';
import { queryKeys } from '../query/keys';

type SubmitOrderStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface SubmitOrderResult {
  status: SubmitOrderStatus;
  signature: string | null;
  error: string | null;
}

interface SubmitOrderArgs {
  id: BN;
  is_buy: boolean;
  amount: number;
  duration: number;
}

interface SubmitOrderAccounts {
  market: PublicKey;
}

export function useSubmitOrder() {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const program = useProgram();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SubmitOrderResult>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const submitOrder = useCallback(
    async (args: SubmitOrderArgs, accounts: SubmitOrderAccounts): Promise<boolean> => {
      setResult({ status: 'building', signature: null, error: null });
      let authority: PublicKey | null = null;

      try {
        const signature = await transact(async (wallet) => {
          setResult((prev) => ({ ...prev, status: 'signing' }));

          const account = await authorizeSession(wallet);
          authority = account.publicKey;
          const instructions: TransactionInstruction[] = [];

          const market = await program.account.market.fetch(accounts.market);
          const endSlotInterval = market.endSlotInterval.toNumber();
          let mint: PublicKey;
          if (args.is_buy) {
            mint = market.quoteMint;
          } else {
            mint = market.baseMint;
          }

          const tokenProgram = await getTokenProgram(connection, mint);
          const isNativeMint = mint.equals(NATIVE_MINT);

          if (isNativeMint) {
            const ata = getAssociatedTokenAddressSync(NATIVE_MINT, account.publicKey, false, tokenProgram);

            let existingBalance = 0n;
            try {
              const tokenAccount = await getAccount(connection, ata, 'confirmed', tokenProgram);
              existingBalance = tokenAccount.amount;
            } catch {
              instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                  account.publicKey,
                  ata,
                  account.publicKey,
                  NATIVE_MINT,
                  tokenProgram,
                ),
              );
            }

            const requiredAmount = BigInt(args.amount.toString());
            if (existingBalance < requiredAmount) {
              const shortfall = requiredAmount - existingBalance;
              instructions.push(
                SystemProgram.transfer({
                  fromPubkey: account.publicKey,
                  toPubkey: ata,
                  lamports: Number(shortfall),
                }),
              );
            }

            instructions.push(createSyncNativeInstruction(ata, tokenProgram));
          }

          // Derive exits/prices PDAs from current slot
          const slot = await connection.getSlot('confirmed');
          // slot + 20 prevents that exits and prices are wrong when close to the end of their interval
          const referenceIndex = new BN(Math.floor((slot + 20) / (ARRAY_LENGTH * endSlotInterval)));
          const endSlot = Math.floor((slot + args.duration + endSlotInterval / 2) / endSlotInterval) * endSlotInterval;
          const futureIndex = new BN(Math.floor(endSlot / (ARRAY_LENGTH * endSlotInterval)));
          const previousIndex = referenceIndex.sub(new BN(1));

          const currentExits = resolver.exitsPda(accounts.market, referenceIndex);
          const previousExits = resolver.exitsPda(accounts.market, previousIndex);
          const currentPrices = resolver.pricesPda(accounts.market, referenceIndex);
          const previousPrices = resolver.pricesPda(accounts.market, previousIndex);
          const futureExits = resolver.exitsPda(accounts.market, futureIndex);
          const futurePrices = resolver.pricesPda(accounts.market, futureIndex);

          const ix = await program.methods
            .submitOrder(args.id, futureIndex, referenceIndex, new BN(args.amount), new BN(endSlot))
            .accountsPartial({
              authority: account.publicKey,
              mint: mint,
              market: accounts.market,
              currentExits,
              previousExits,
              currentPrices,
              previousPrices,
              futureExits,
              futurePrices,
              tokenProgram,
            })
            .instruction();

          instructions.push(ix);

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          const transaction = new VersionedTransaction(
            new TransactionMessage({
              payerKey: account.publicKey,
              recentBlockhash: blockhash,
              instructions,
            }).compileToV0Message(),
          );

          // // Simulate to get program logs before sending, nice for debugging
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

        if (authority) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.balance.byAuthority(authority) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.tradePositions.byAuthority(authority) }),
          ]);
        }

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
    [connection, authorizeSession, program, queryClient],
  );

  const reset = useCallback(() => {
    setResult({ status: 'idle', signature: null, error: null });
  }, []);

  return { submitOrder, reset, ...result };
}

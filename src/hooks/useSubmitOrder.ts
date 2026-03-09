import { useState, useCallback } from 'react';
import {
  Connection,
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useProgram } from './useProgram';
import { handleMWAError } from '../utils/mwaErrorHandler';
import { resolver } from '../utils/accountResolver';
import { getTokenProgram } from '../utils/token';
import { ARRAY_LENGTH } from '../utils/constants';
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

interface SubmitOrderMutationVariables {
  args: SubmitOrderArgs;
  accounts: SubmitOrderAccounts;
}

interface SubmitOrderMutationResult {
  signature: string;
  authority: PublicKey;
}

type DebugAccountDescriptor = {
  name: string;
  pubkey: PublicKey;
  expectedType: 'exits' | 'prices';
};

type DebugSubmissionContext = {
  slot: number;
  referenceIndex: string;
  previousIndex: string;
  futureIndex: string;
  accounts: DebugAccountDescriptor[];
};

const EXITS_DISCRIMINATOR = [240, 175, 85, 167, 2, 200, 2, 180] as const;
const PRICES_DISCRIMINATOR = [74, 25, 25, 70, 56, 98, 39, 21] as const;

function toDebugString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function trimText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function hasDiscriminator(data: Buffer<ArrayBufferLike>, discriminator: readonly number[]): boolean {
  if (data.length < discriminator.length) return false;
  for (let i = 0; i < discriminator.length; i += 1) {
    if (data[i] !== discriminator[i]) return false;
  }
  return true;
}

async function inspectAccountType(
  connection: Connection,
  pubkey: PublicKey,
): Promise<'missing' | 'exits' | 'prices' | `unknown:${string}`> {
  const info = await connection.getAccountInfo(pubkey, 'processed');
  if (!info) return 'missing';

  if (hasDiscriminator(info.data, EXITS_DISCRIMINATOR)) return 'exits';
  if (hasDiscriminator(info.data, PRICES_DISCRIMINATOR)) return 'prices';

  if (info.data.length < 8) return `unknown:len-${info.data.length}`;
  return `unknown:${info.data.subarray(0, 8).toString('hex')}`;
}

async function buildSubmissionDebugErrorMessage(
  connection: Connection,
  transaction: VersionedTransaction,
  error: unknown,
  context: DebugSubmissionContext,
): Promise<string> {
  const errRecord = (error as { code?: unknown } | null) ?? null;
  const walletCode = typeof errRecord?.code === 'string' ? errRecord.code : null;
  const walletMessage = toDebugString(error);

  let simulationErr: string | null = null;
  let simulationLogs: string[] = [];

  try {
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: 'processed',
    });

    if (simulation.value.err) {
      simulationErr = toDebugString(simulation.value.err);
    }
    simulationLogs = simulation.value.logs ?? [];
  } catch (simulationFailure) {
    simulationErr = `simulation_failed: ${toDebugString(simulationFailure)}`;
  }

  const accountTypeFindings = await Promise.all(
    context.accounts.map(async (account) => {
      try {
        const detectedType = await inspectAccountType(connection, account.pubkey);
        return `${account.name}=${account.pubkey.toBase58()}(expected:${account.expectedType},actual:${detectedType})`;
      } catch (inspectError) {
        return `${account.name}=${account.pubkey.toBase58()}(inspect_error:${toDebugString(inspectError)})`;
      }
    }),
  );

  const logExcerpt = simulationLogs.slice(-6).join(' | ');

  const messageParts = [
    'Order submission failed before broadcast.',
    `slot=${context.slot}.`,
    `reference_index=${context.referenceIndex}.`,
    `previous_index=${context.previousIndex}.`,
    `future_index=${context.futureIndex}.`,
    walletCode ? `wallet_code=${walletCode}.` : null,
    walletMessage ? `wallet_message=${trimText(walletMessage, 220)}.` : null,
    simulationErr ? `simulation_error=${trimText(simulationErr, 220)}.` : null,
    logExcerpt ? `logs=${trimText(logExcerpt, 320)}.` : null,
    accountTypeFindings.length > 0 ? `accounts=${trimText(accountTypeFindings.join('; '), 500)}.` : null,
  ].filter(Boolean);

  return messageParts.join(' ');
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

  const mutation = useMutation<SubmitOrderMutationResult, unknown, SubmitOrderMutationVariables>({
    mutationFn: async ({ args, accounts }) => {
      let authority: PublicKey | null = null;

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
        const debugContext: DebugSubmissionContext = {
          slot,
          referenceIndex: referenceIndex.toString(),
          previousIndex: previousIndex.toString(),
          futureIndex: futureIndex.toString(),
          accounts: [
            { name: 'current_exits', pubkey: currentExits, expectedType: 'exits' },
            { name: 'previous_exits', pubkey: previousExits, expectedType: 'exits' },
            { name: 'future_exits', pubkey: futureExits, expectedType: 'exits' },
            { name: 'current_prices', pubkey: currentPrices, expectedType: 'prices' },
            { name: 'previous_prices', pubkey: previousPrices, expectedType: 'prices' },
            { name: 'future_prices', pubkey: futurePrices, expectedType: 'prices' },
          ],
        };

        const updateBooksIx = await program.methods
          .updateBooks(referenceIndex, new BN(slot))
          .accountsPartial({
            signer: account.publicKey,
            market: accounts.market,
            referenceExits: currentExits,
            previousExits,
            referencePrices: currentPrices,
            previousPrices,
          })
          .instruction();

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

        instructions.push(updateBooksIx);
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

        let sig: string;
        try {
          [sig] = await wallet.signAndSendTransactions({
            transactions: [transaction],
            skipPreflight: true,
          });
        } catch (sendError) {
          const mwaError = handleMWAError(sendError);
          if (mwaError.isUserCancellation) {
            throw sendError;
          }

          const debugMessage = await buildSubmissionDebugErrorMessage(connection, transaction, sendError, debugContext);
          console.error('[useSubmitOrder] send failed', {
            originalError: sendError,
            debugMessage,
          });
          throw new Error(debugMessage);
        }

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
      setResult({ status: 'success', signature, error: null });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance.byAuthority(authority) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tradePositions.byAuthority(authority) }),
      ]);
    },
    onError: (error) => {
      const mwaError = handleMWAError(error);

      if (mwaError.isUserCancellation) {
        setResult({ status: 'idle', signature: null, error: null });
        return;
      }

      setResult({ status: 'error', signature: null, error: mwaError.userMessage });
    },
  });

  const submitOrder = useCallback(
    async (args: SubmitOrderArgs, accounts: SubmitOrderAccounts): Promise<boolean> => {
      setResult({ status: 'building', signature: null, error: null });
      try {
        await mutation.mutateAsync({ args, accounts });
        return true;
      } catch {
        return false;
      }
    },
    [mutation],
  );

  const reset = useCallback(() => {
    mutation.reset();
    setResult({ status: 'idle', signature: null, error: null });
  }, [mutation]);

  return { submitOrder, reset, ...result };
}

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
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useProgram } from './useProgram';
import { handleMWAError } from '../../utils/mwaErrorHandler';

type SubmitOrderStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface SubmitOrderResult {
  status: SubmitOrderStatus;
  signature: string | null;
  error: string | null;
}

interface SubmitOrderArgs {
  id: BN;
  futureIndex: BN;
  referenceIndex: BN;
  amount: BN;
  endSlot: BN;
}

interface SubmitOrderAccounts {
  mint: PublicKey;
  market: PublicKey;
  currentExits: PublicKey;
  previousExits: PublicKey;
  currentPrices: PublicKey;
  previousPrices: PublicKey;
}

export function useSubmitOrder() {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const program = useProgram();
  const [result, setResult] = useState<SubmitOrderResult>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const submitOrder = useCallback(
    async (args: SubmitOrderArgs, accounts: SubmitOrderAccounts): Promise<boolean> => {
      setResult({ status: 'building', signature: null, error: null });

      try {
        const signature = await transact(async (wallet) => {
          setResult((prev) => ({ ...prev, status: 'signing' }));

          const account = await authorizeSession(wallet);
          const instructions: TransactionInstruction[] = [];

          const isNativeMint = accounts.mint.equals(NATIVE_MINT);

          if (isNativeMint) {
            const ata = getAssociatedTokenAddressSync(
              NATIVE_MINT,
              account.publicKey,
              false,
              TOKEN_PROGRAM_ID,
            );

            let existingBalance = 0n;
            try {
              const tokenAccount = await getAccount(connection, ata, 'confirmed', TOKEN_PROGRAM_ID);
              existingBalance = tokenAccount.amount;
            } catch {
              // ATA doesn't exist — create it
              instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                  account.publicKey,
                  ata,
                  account.publicKey,
                  NATIVE_MINT,
                  TOKEN_PROGRAM_ID,
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

            instructions.push(createSyncNativeInstruction(ata, TOKEN_PROGRAM_ID));
          }

          const ix = await program.methods
            .submitOrder(args.id, args.futureIndex, args.referenceIndex, args.amount, args.endSlot)
            .accounts({
              authority: account.publicKey,
              mint: accounts.mint,
              market: accounts.market,
              currentExits: accounts.currentExits,
              previousExits: accounts.previousExits,
              currentPrices: accounts.currentPrices,
              previousPrices: accounts.previousPrices,
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

  return { submitOrder, reset, ...result };
}

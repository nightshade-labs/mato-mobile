// hooks/useSendSol.ts
import { useState, useCallback } from 'react';
import { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { handleMWAError } from '../../utils/mwaErrorHandler';

type SendStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface SendResult {
  status: SendStatus;
  signature: string | null;
  error: string | null;
}

export function useSendSol() {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const [result, setResult] = useState<SendResult>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const send = useCallback(
    async (recipientAddress: string, amountSol: number): Promise<boolean> => {
      // Reset state
      setResult({ status: 'building', signature: null, error: null });

      try {
        // Validate recipient address
        let recipientPubkey: PublicKey;
        try {
          recipientPubkey = new PublicKey(recipientAddress);
        } catch {
          setResult({ status: 'error', signature: null, error: 'Invalid recipient address' });
          return false;
        }

        // Validate amount
        if (amountSol <= 0) {
          setResult({ status: 'error', signature: null, error: 'Amount must be greater than 0' });
          return false;
        }

        const signature = await transact(async (wallet) => {
          setResult((prev) => ({ ...prev, status: 'signing' }));

          const account = await authorizeSession(wallet);

          // Get fresh blockhash
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          // Build transaction
          const transaction = new VersionedTransaction(
            new TransactionMessage({
              payerKey: account.publicKey,
              recentBlockhash: blockhash,
              instructions: [
                SystemProgram.transfer({
                  fromPubkey: account.publicKey,
                  toPubkey: recipientPubkey,
                  lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
                }),
              ],
            }).compileToV0Message(),
          );

          // Sign and send
          const [sig] = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });

          setResult((prev) => ({ ...prev, status: 'confirming', signature: sig }));

          // Wait for confirmation
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

          return sig;
        });

        setResult({ status: 'success', signature, error: null });
        return true;
      } catch (error) {
        const mwaError = handleMWAError(error);

        // Don't show error for user cancellation
        if (mwaError.isUserCancellation) {
          setResult({ status: 'idle', signature: null, error: null });
          return false;
        }

        setResult({ status: 'error', signature: null, error: mwaError.userMessage });
        return false;
      }
    },
    [connection, authorizeSession],
  );

  const reset = useCallback(() => {
    setResult({ status: 'idle', signature: null, error: null });
  }, []);

  return { send, reset, ...result };
}

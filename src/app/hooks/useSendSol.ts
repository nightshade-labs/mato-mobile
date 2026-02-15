// hooks/useSendSol.ts
import { useState, useCallback } from 'react';
import { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { handleMWAError } from '../../utils/mwaErrorHandler';
import { queryKeys } from '../query/keys';

type SendStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface SendResult {
  status: SendStatus;
  signature: string | null;
  error: string | null;
}

interface SendMutationVariables {
  recipientPubkey: PublicKey;
  amountSol: number;
}

interface SendMutationResult {
  signature: string;
  authority: PublicKey;
}

export function useSendSol() {
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SendResult>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const mutation = useMutation<SendMutationResult, unknown, SendMutationVariables>({
    mutationFn: async ({ recipientPubkey, amountSol }) => {
      let authority: PublicKey | null = null;

      const signature = await transact(async (wallet) => {
        setResult((prev) => ({ ...prev, status: 'signing' }));

        const account = await authorizeSession(wallet);
        authority = account.publicKey;

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

      if (!authority) {
        throw new Error('Wallet authorization did not return a selected authority');
      }

      return { signature, authority };
    },
    onSuccess: async ({ signature, authority }) => {
      setResult({ status: 'success', signature, error: null });
      await queryClient.invalidateQueries({ queryKey: queryKeys.balance.byAuthority(authority) });
    },
    onError: (error) => {
      const mwaError = handleMWAError(error);

      // Don't show error for user cancellation
      if (mwaError.isUserCancellation) {
        setResult({ status: 'idle', signature: null, error: null });
        return;
      }

      setResult({ status: 'error', signature: null, error: mwaError.userMessage });
    },
  });

  const send = useCallback(
    async (recipientAddress: string, amountSol: number): Promise<boolean> => {
      // Reset state
      setResult({ status: 'building', signature: null, error: null });
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

      try {
        await mutation.mutateAsync({ recipientPubkey, amountSol });
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

  return { send, reset, ...result };
}

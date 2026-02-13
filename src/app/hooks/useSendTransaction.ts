// hooks/useSendTransaction.ts
import { useCallback } from 'react';
import { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useConnection } from '../providers/ConnectionProvider';

export function useSendSol() {
  const { authorizeSession } = useAuthorization();
  const { connection } = useConnection();

  return useCallback(
    async (recipient: PublicKey, amountSol: number): Promise<string> => {
      return await transact(async (wallet) => {
        // Use provider's authorize function
        const account = await authorizeSession(wallet);

        const { blockhash } = await connection.getLatestBlockhash();

        const transaction = new VersionedTransaction(
          new TransactionMessage({
            payerKey: account.publicKey,
            recentBlockhash: blockhash,
            instructions: [
              SystemProgram.transfer({
                fromPubkey: account.publicKey,
                toPubkey: recipient,
                lamports: amountSol * LAMPORTS_PER_SOL,
              }),
            ],
          }).compileToV0Message(),
        );

        const [signature] = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        return signature;
      });
    },
    [authorizeSession, connection],
  );
}

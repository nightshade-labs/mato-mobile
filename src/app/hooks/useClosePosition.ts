import { useState, useCallback } from 'react';
import { PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import BN from 'bn.js';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useProgram } from './useProgram';
import { handleMWAError } from '../../utils/mwaErrorHandler';

type ClosePositionStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'success' | 'error';

interface ClosePositionResult {
  status: ClosePositionStatus;
  signature: string | null;
  error: string | null;
}

interface ClosePositionAccounts {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  market: PublicKey;
  tradePosition: PublicKey;
  futureExits: PublicKey;
  futurePrices: PublicKey;
  currentExits: PublicKey;
  previousExits: PublicKey;
  currentPrices: PublicKey;
  previousPrices: PublicKey;
  baseTokenProgram: PublicKey;
  quoteTokenProgram: PublicKey;
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
    async (referenceIndex: BN, accounts: ClosePositionAccounts): Promise<boolean> => {
      setResult({ status: 'building', signature: null, error: null });

      try {
        const signature = await transact(async (wallet) => {
          setResult((prev) => ({ ...prev, status: 'signing' }));

          const account = await authorizeSession(wallet);

          const ix = await program.methods
            .authorityClosePosition(referenceIndex)
            .accounts({
              authority: account.publicKey,
              baseMint: accounts.baseMint,
              quoteMint: accounts.quoteMint,
              market: accounts.market,
              tradePosition: accounts.tradePosition,
              futureExits: accounts.futureExits,
              futurePrices: accounts.futurePrices,
              currentExits: accounts.currentExits,
              previousExits: accounts.previousExits,
              currentPrices: accounts.currentPrices,
              previousPrices: accounts.previousPrices,
              baseTokenProgram: accounts.baseTokenProgram,
              quoteTokenProgram: accounts.quoteTokenProgram,
            })
            .instruction();

          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          const transaction = new VersionedTransaction(
            new TransactionMessage({
              payerKey: account.publicKey,
              recentBlockhash: blockhash,
              instructions: [ix],
            }).compileToV0Message(),
          );

          const [sig] = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });

          setResult((prev) => ({ ...prev, status: 'confirming', signature: sig }));

          await connection.confirmTransaction(
            { signature: sig, blockhash, lastValidBlockHeight },
            'confirmed',
          );

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

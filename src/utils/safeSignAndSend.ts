import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { toByteArray } from 'react-native-quick-base64';
import { Alert } from 'react-native';
import { APP_IDENTITY, CLUSTER, RPC_ENDPOINT } from './constants';

const connection = new Connection(RPC_ENDPOINT, 'confirmed');

export async function transferSol(instructions: TransactionInstruction[]): Promise<string | null> {
  try {
    return await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        identity: APP_IDENTITY,
        chain: CLUSTER,
      });

      const signerPubkey = new PublicKey(toByteArray(authResult.accounts[0].address));

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: signerPubkey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);

      const [signature] = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      return signature;
    });
  } catch (error: any) {
    if (error.code === 4001) {
      Alert.alert('Cancelled', 'Transaction was cancelled.');
    } else if (error.code === -32603) {
      Alert.alert('Failed', 'Transaction simulation failed. Check your balance.');
    } else {
      Alert.alert('Error', error.message);
    }
    return null;
  }
}

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { toByteArray } from 'react-native-quick-base64';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_IDENTITY, AUTH_TOKEN_KEY } from '../../utils/constants';

interface ConnectButtonProps {
  onConnect: (publicKey: PublicKey, authToken: string) => void;
  onError: (error: Error) => void;
}

export function ConnectButton({ onConnect, onError }: ConnectButtonProps) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);

    try {
      const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

      await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          identity: APP_IDENTITY,
          chain: 'solana:devnet',
          auth_token: cachedToken ?? undefined,
        });

        await AsyncStorage.setItem(AUTH_TOKEN_KEY, authResult.auth_token);

        const publicKey = new PublicKey(toByteArray(authResult.accounts[0].address));

        onConnect(publicKey, authResult.auth_token);
      });
    } catch (error: any) {
      if (error.code === 4001) {
        // User cancelled - not an error to report
        console.log('User cancelled connection');
      } else {
        onError(error);
      }
    } finally {
      setConnecting(false);
    }
  }, [connecting, onConnect, onError]);

  return (
    <TouchableOpacity
      style={[styles.button, connecting && styles.buttonDisabled]}
      onPress={handleConnect}
      disabled={connecting}
    >
      {connecting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Connect Wallet</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#512da8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

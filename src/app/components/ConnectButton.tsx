// components/ConnectButton.tsx
import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { handleMWAError } from '../../utils/mwaErrorHandler';

export function ConnectButton() {
  const { selectedAccount, authorizeSession, deauthorizeSession } = useAuthorization();

  const handleConnect = async () => {
    try {
      await transact(async (wallet) => {
        await authorizeSession(wallet);
      });
    } catch (error) {
      const mwaError = handleMWAError(error);
      if (!mwaError.isUserCancellation) {
        Alert.alert('Connection Error', mwaError.userMessage);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await transact(async (wallet) => {
        await deauthorizeSession(wallet);
      });
    } catch (error) {
      console.log('Disconnect error:', error);
    }
  };

  if (selectedAccount) {
    return (
      <TouchableOpacity className="border border-gray-500 rounded-lg p-3 items-center" onPress={handleDisconnect}>
        <Text className="text-gray-400 text-sm">Disconnect Wallet</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity className="bg-[#512da8] rounded-lg p-4 items-center" onPress={handleConnect}>
      <Text className="text-white text-base font-semibold">Connect Wallet</Text>
    </TouchableOpacity>
  );
}

// components/ConnectButton.tsx
import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { handleMWAError } from '../utils/mwaErrorHandler';
import { queryKeys } from '../query/keys';
import { uiColors } from '../theme/colors';

interface ConnectButtonProps {
  variant?: 'default' | 'compact';
}

export function ConnectButton({ variant = 'default' }: ConnectButtonProps) {
  const { selectedAccount, authorizeSession, deauthorizeSession } = useAuthorization();
  const queryClient = useQueryClient();

  const handleConnect = async () => {
    try {
      const account = await transact(async (wallet) => {
        return authorizeSession(wallet);
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.balance.byAuthority(account.publicKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tradePositions.byAuthority(account.publicKey) }),
      ]);
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

      queryClient.removeQueries({ queryKey: queryKeys.balance.all });
      queryClient.removeQueries({ queryKey: queryKeys.tradePositions.all });
      queryClient.removeQueries({ queryKey: queryKeys.closePositionEvents.all });
    } catch (error) {
      console.log('Disconnect error:', error);
    }
  };

  if (selectedAccount) {
    if (variant === 'compact') {
      return (
        <TouchableOpacity
          className="rounded-full px-4 py-2 items-center"
          style={{ backgroundColor: uiColors.panelSoft, borderWidth: 1, borderColor: uiColors.border }}
          onPress={handleDisconnect}
        >
          <Text className="text-xs font-semibold" style={{ color: uiColors.textSecondary }}>
            Disconnect
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        className="rounded-xl p-4 items-center"
        style={{ backgroundColor: uiColors.panelSoft, borderWidth: 1, borderColor: uiColors.border }}
        onPress={handleDisconnect}
      >
        <Text className="text-sm font-semibold" style={{ color: uiColors.textSecondary }}>
          Disconnect Wallet
        </Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        className="rounded-full px-4 py-2 items-center"
        style={{ backgroundColor: uiColors.primary }}
        onPress={handleConnect}
      >
        <Text className="text-xs font-semibold" style={{ color: uiColors.primaryText }}>
          Connect
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity className="rounded-xl p-4 items-center" style={{ backgroundColor: uiColors.primary }} onPress={handleConnect}>
      <Text className="text-base font-semibold" style={{ color: uiColors.primaryText }}>
        Connect Wallet
      </Text>
    </TouchableOpacity>
  );
}

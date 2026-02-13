// src/providers/AuthorizationProvider.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  AuthorizeAPI,
  DeauthorizeAPI,
  AuthorizationResult,
  Account as MWAAccount,
} from '@solana-mobile/mobile-wallet-adapter-protocol';
import { toByteArray } from 'react-native-quick-base64';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Account, Authorization, AuthorizationContextValue } from './types';
import { APP_IDENTITY, AUTH_TOKEN_KEY, CLUSTER } from '../../utils/constants';

// Convert MWA account format to our Account type
function convertAccount(mwaAccount: MWAAccount): Account {
  return {
    address: mwaAccount.address,
    label: mwaAccount.label,
    publicKey: new PublicKey(toByteArray(mwaAccount.address)),
  };
}

// Create the context
const AuthorizationContext = createContext<AuthorizationContextValue>({
  accounts: null,
  selectedAccount: null,
  authorizeSession: async () => {
    throw new Error('AuthorizationProvider not mounted');
  },
  deauthorizeSession: async () => {
    throw new Error('AuthorizationProvider not mounted');
  },
  onChangeAccount: () => {
    throw new Error('AuthorizationProvider not mounted');
  },
});

// The provider component
export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);

  // Load cached auth token on mount
  useEffect(() => {
    AsyncStorage.getItem(AUTH_TOKEN_KEY).then((token) => {
      if (token) {
        // We have a token but no account info yet
        // The next authorizeSession call will populate accounts
        console.log('Found cached auth token');
      }
    });
  }, []);

  // Handle authorization result from wallet
  const handleAuthorizationResult = useCallback(
    async (result: AuthorizationResult): Promise<Authorization> => {
      const accounts = result.accounts.map(convertAccount);

      // Determine which account to select
      let selectedAccount: Account;

      if (authorization?.selectedAccount && accounts.some((a) => a.address === authorization.selectedAccount.address)) {
        // Keep the previously selected account if still available
        selectedAccount = authorization.selectedAccount;
      } else {
        // Select the first account
        selectedAccount = accounts[0];
      }

      const newAuth: Authorization = {
        accounts,
        authToken: result.auth_token,
        selectedAccount,
      };

      // Cache the token
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, result.auth_token);

      setAuthorization(newAuth);
      return newAuth;
    },
    [authorization?.selectedAccount],
  );

  // Authorize a session (called inside transact callback)
  const authorizeSession = useCallback(
    async (wallet: AuthorizeAPI): Promise<Account> => {
      const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

      const result = await wallet.authorize({
        identity: APP_IDENTITY,
        chain: CLUSTER,
        auth_token: cachedToken ?? undefined,
      });

      const auth = await handleAuthorizationResult(result);
      return auth.selectedAccount;
    },
    [handleAuthorizationResult],
  );

  // Deauthorize (called inside transact callback)
  const deauthorizeSession = useCallback(
    async (wallet: DeauthorizeAPI): Promise<void> => {
      const authToken = authorization?.authToken;
      if (!authToken) return;

      await wallet.deauthorize({ auth_token: authToken });
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthorization(null);
    },
    [authorization?.authToken],
  );

  // Switch selected account
  const onChangeAccount = useCallback(
    (account: Account): void => {
      if (!authorization) return;

      const exists = authorization.accounts.some((a) => a.address === account.address);

      if (!exists) {
        throw new Error('Account not in authorized set');
      }

      setAuthorization((prev) => (prev ? { ...prev, selectedAccount: account } : null));
    },
    [authorization],
  );

  const value = useMemo(
    (): AuthorizationContextValue => ({
      accounts: authorization?.accounts ?? null,
      selectedAccount: authorization?.selectedAccount ?? null,
      authorizeSession,
      deauthorizeSession,
      onChangeAccount,
    }),
    [authorization, authorizeSession, deauthorizeSession, onChangeAccount],
  );

  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
}

// Hook for consuming components
export function useAuthorization(): AuthorizationContextValue {
  return useContext(AuthorizationContext);
}

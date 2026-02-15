import React, { ReactNode, useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

function useAppStateFocus() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    onAppStateChange(AppState.currentState);
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);
}

function useNetworkStatus() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    return onlineManager.setEventListener((setOnline) => {
      Network.getNetworkStateAsync()
        .then((state) => {
          const isOnline = state.isConnected === true && state.isInternetReachable !== false;
          setOnline(isOnline);
        })
        .catch(() => {
          setOnline(true);
        });

      const subscription = Network.addNetworkStateListener((state) => {
        const isOnline = state.isConnected === true && state.isInternetReachable !== false;
        setOnline(isOnline);
      });

      return () => {
        subscription.remove();
      };
    });
  }, []);
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useAppStateFocus();
  useNetworkStatus();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

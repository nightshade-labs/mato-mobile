import '../global.css';

import { Slot } from 'expo-router';
import { MobileWalletProvider, createSolanaDevnet } from '@wallet-ui/react-native-kit';
import { APP_IDENTITY } from '../utils/constants';
import { AuthorizationProvider } from './providers/AuthorizationProvider';
import { ConnectionProvider } from './providers/ConnectionProvider';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';

const cluster = createSolanaDevnet();

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileWalletProvider cluster={cluster} identity={APP_IDENTITY}>
          <ConnectionProvider>
            <AuthorizationProvider>
              <SafeAreaView style={{ flex: 1 }}>
                <StatusBar barStyle="light-content" />
                <Slot />
              </SafeAreaView>
            </AuthorizationProvider>
          </ConnectionProvider>
        </MobileWalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

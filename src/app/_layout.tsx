import '../global.css';

import { Slot } from 'expo-router';
import { MobileWalletProvider, createSolanaDevnet, createSolanaMainnet } from '@wallet-ui/react-native-kit';
import { Toaster } from 'sonner-native';
import { APP_IDENTITY, RPC_ENDPOINT, SOLANA_NETWORK } from '../utils/constants';
import { AuthorizationProvider } from '../providers/AuthorizationProvider';
import { ConnectionProvider } from '../providers/ConnectionProvider';
import { QueryProvider } from '../providers/QueryProvider';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar, Text, View } from 'react-native';
import { uiColors } from '../theme/colors';

const cluster = SOLANA_NETWORK === 'devnet' ? createSolanaDevnet() : createSolanaMainnet(RPC_ENDPOINT);
const TOAST_ICON_SIZE = 20;

const successToastIcon = (
  <View
    style={{
      width: TOAST_ICON_SIZE,
      height: TOAST_ICON_SIZE,
      borderRadius: TOAST_ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(34, 197, 94, 0.14)',
    }}
  >
    <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700', lineHeight: 14 }}>✓</Text>
  </View>
);

const errorToastIcon = (
  <View
    style={{
      width: TOAST_ICON_SIZE,
      height: TOAST_ICON_SIZE,
      borderRadius: TOAST_ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(248, 113, 113, 0.14)',
    }}
  >
    <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700', lineHeight: 14 }}>!</Text>
  </View>
);

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MobileWalletProvider cluster={cluster} identity={APP_IDENTITY}>
          <QueryProvider>
            <ConnectionProvider>
              <AuthorizationProvider>
                <SafeAreaView style={{ flex: 1, backgroundColor: uiColors.background }}>
                  <StatusBar barStyle="light-content" backgroundColor={uiColors.background} />
                  <Slot />
                </SafeAreaView>
                <Toaster
                  position="bottom-center"
                  duration={10000}
                  offset={16}
                  richColors={false}
                  closeButton={false}
                  icons={{ success: successToastIcon, error: errorToastIcon }}
                  toastOptions={{
                    style: {
                      backgroundColor: '#0f1115',
                      borderColor: '#232833',
                      borderWidth: 1,
                      borderRadius: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                    },
                    titleStyle: {
                      color: '#f3f4f6',
                      fontSize: 14,
                      fontWeight: '600',
                      lineHeight: 18,
                    },
                    descriptionStyle: {
                      color: '#9aa4b2',
                      fontSize: 12,
                      lineHeight: 16,
                    },
                    actionButtonStyle: {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: '#3a4352',
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    },
                    actionButtonTextStyle: {
                      color: '#d5d9df',
                      fontSize: 12,
                      lineHeight: 16,
                      fontWeight: '500',
                    },
                    buttonsStyle: {
                      marginTop: 10,
                      gap: 10,
                    },
                  }}
                />
              </AuthorizationProvider>
            </ConnectionProvider>
          </QueryProvider>
        </MobileWalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

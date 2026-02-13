import '../global.css';

import { Slot } from 'expo-router';
import { MobileWalletProvider, createSolanaDevnet } from '@wallet-ui/react-native-kit';
import { APP_IDENTITY } from '../utils/constants';
import { AuthorizationProvider } from './providers/AuthorizationProvider';
import { ConnectionProvider } from './providers/ConnectionProvider';

const cluster = createSolanaDevnet();

export default function Layout() {
  return (
    <MobileWalletProvider cluster={cluster} identity={APP_IDENTITY}>
      <ConnectionProvider>
        <AuthorizationProvider>
          <Slot />
        </AuthorizationProvider>
      </ConnectionProvider>
    </MobileWalletProvider>
  );
}

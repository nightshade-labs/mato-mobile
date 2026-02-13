import '../global.css'

import { Slot } from 'expo-router'
import { MobileWalletProvider, createSolanaDevnet } from '@wallet-ui/react-native-kit'
import { APP_IDENTITY } from '../utils/constants'

const cluster = createSolanaDevnet()

export default function Layout() {
  return (
    <MobileWalletProvider cluster={cluster} identity={APP_IDENTITY}>
      <Slot />
    </MobileWalletProvider>
  )
}

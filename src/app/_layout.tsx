import '../global.css'

import { Slot } from 'expo-router'
import { MobileWalletProvider, createSolanaDevnet } from '@wallet-ui/react-native-kit'

const cluster = createSolanaDevnet()
const identity = {
  name: 'Mato',
  uri: 'https://github.com/nightshade-labs/mato-mobile',
}

export default function Layout() {
  return (
    <MobileWalletProvider cluster={cluster} identity={identity}>
      <Slot />
    </MobileWalletProvider>
  )
}

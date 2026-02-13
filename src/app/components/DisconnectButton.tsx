import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { Button } from 'react-native';

export function DisconnectButton() {
  const { selectedAccount, deauthorizeSession } = useAuthorization();

  const handleDisconnect = async () => {
    await transact(async (wallet) => {
      await deauthorizeSession(wallet);
    });
  };

  if (!selectedAccount) return null;

  return <Button title="Disconnect" onPress={handleDisconnect} />;
}

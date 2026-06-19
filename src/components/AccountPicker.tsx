import { Text, TouchableOpacity, View } from 'react-native';
import { useAuthorization } from '../providers/AuthorizationProvider';

export default function AccountPicker() {
  const { accounts, selectedAccount, onChangeAccount } = useAuthorization();

  if (!accounts || accounts.length <= 1) return null;

  return (
    <View>
      <Text>Select Account:</Text>
      {accounts.map((account) => (
        <TouchableOpacity
          key={account.address}
          onPress={() => onChangeAccount(account)}
          className={`p-2 rounded ${account.address === selectedAccount?.address ? 'bg-blue-500' : 'bg-gray-200'}`}
        >
          <Text>{account.label ?? account.publicKey.toBase58().slice(0, 8)}...</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

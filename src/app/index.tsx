import { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useMobileWallet } from '@wallet-ui/react-native-kit';
import { useMarketUpdates } from '../integrations/supabase/useMarketUpdates';
import { aggregateCandles } from '../utils/candles';
import { CandleChart } from './components/CandleChart';

export default function App() {
  const { account, connect, disconnect } = useMobileWallet();
  const { events, loading } = useMarketUpdates({ marketId: 1, limit: 100000 });
  const candles = useMemo(() => aggregateCandles(events), [events]);

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {loading ? (
        <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : candles.length === 0 ? (
        <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <Text className="text-gray-500">No market data available</Text>
        </View>
      ) : (
        <CandleChart data={candles} />
      )}

      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl font-extrabold text-gray-800 dark:text-white mb-3 tracking-tight">🚀 Welcome</Text>

        <Text className="text-xl dark:text-white text-gray-700 mb-8 text-center leading-relaxed">
          Build beautiful apps with <Text className="text-blue-500 font-semibold">Expo + Uniwind + @solana/kit 🔥</Text>
        </Text>

        <View className="mb-8 items-center">
          {account ? (
            <View className="items-center">
              <Text className="text-gray-600 dark:text-gray-400 mb-2">
                Connected: {account.address.toString().slice(0, 8)}...
              </Text>
              <Pressable onPress={disconnect} className="bg-red-500 px-6 py-3 rounded-xl active:bg-red-600">
                <Text className="text-white font-bold">Disconnect Wallet</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={connect} className="bg-blue-600 px-6 py-3 rounded-xl active:bg-blue-700">
              <Text className="text-white font-bold text-lg">Connect Wallet</Text>
            </Pressable>
          )}
        </View>

        <Text className="text-base text-gray-600 dark:text-white text-center max-w-sm">
          Start customizing your app by editing{' '}
          <Text className="font-semibold text-gray-800 dark:text-white">app/index.tsx</Text>
        </Text>

        <StatusBar style="auto" />
      </View>
    </View>
  );
}

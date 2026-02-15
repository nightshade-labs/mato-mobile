import { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Pressable, ActivityIndicator } from 'react-native';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { useMarketUpdates } from '../integrations/supabase/useMarketUpdates';
import { aggregateCandles } from '../utils/candles';
import { resolver } from '../utils/accountResolver';
import { CandleChart } from './components/CandleChart';
import { ConnectButton } from './components/ConnectButton';
import { useAuthorization } from './providers/AuthorizationProvider';
import { useSubmitOrder } from './hooks/useSubmitOrder';
import { useClosePosition } from './hooks/useClosePosition';
import { useTradePositions } from './hooks/useTradePositions';

const MARKET = resolver.marketPda(new BN(1));

export default function App() {
  const { events, loading } = useMarketUpdates({ marketId: 1, limit: 100000 });
  const candles = useMemo(() => aggregateCandles(events), [events]);
  const { selectedAccount } = useAuthorization();
  const { submitOrder, status, error: orderError } = useSubmitOrder();
  const { closePosition, status: closeStatus } = useClosePosition();
  const { positions, loading: positionsLoading } = useTradePositions(selectedAccount?.publicKey ?? null);

  const handleTestOrder = async () => {
    const durationInSlots = 5000;
    const id = new BN(Date.now());

    await submitOrder({ id, is_buy: false, amount: LAMPORTS_PER_SOL, duration: durationInSlots }, { market: MARKET });
  };

  const handleTestClose = async (id: BN) => {
    if (!selectedAccount) return;

    const tradePosition = resolver.tradePositionPda(MARKET, selectedAccount.publicKey, id);

    await closePosition({
      market: MARKET,
      tradePosition,
    });
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {/* {loading ? (
        <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : candles.length === 0 ? (
        <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
          <Text className="text-gray-500">No market data available</Text>
        </View>
      ) : (
        <CandleChart data={candles} />
      )} */}

      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl font-extrabold text-gray-800 dark:text-white mb-3 tracking-tight">🚀 Welcome</Text>

        <Text className="text-xl dark:text-white text-gray-700 mb-8 text-center leading-relaxed">
          Build beautiful apps with <Text className="text-blue-500 font-semibold">Expo + Uniwind + @solana/kit 🔥</Text>
        </Text>
        <View className=" items-center">
          {selectedAccount && (
            <View className="items-center">
              <Text className="text-gray-600 dark:text-gray-400 mb-2">
                Connected: {selectedAccount.publicKey.toString().slice(0, 4)}...
                {selectedAccount.publicKey.toString().slice(-4)}
              </Text>
            </View>
          )}
        </View>

        <View className="mb-8 items-center">
          <ConnectButton />
        </View>

        {selectedAccount && (
          <View className="mb-4 items-center">
            <Pressable
              onPress={handleTestOrder}
              disabled={status === 'building' || status === 'signing' || status === 'confirming'}
              className="bg-green-600 px-6 py-3 rounded-xl active:bg-green-700"
            >
              <Text className="text-white font-bold">
                {status === 'building'
                  ? 'Building...'
                  : status === 'signing'
                    ? 'Signing...'
                    : status === 'confirming'
                      ? 'Confirming...'
                      : 'Submit 1 SOL Order'}
              </Text>
            </Pressable>
            {status === 'success' && <Text className="text-green-500 mt-2">Order submitted!</Text>}
            {status === 'error' && <Text className="text-red-500 mt-2">{orderError}</Text>}
          </View>
        )}

        {selectedAccount && (
          <View className="mt-4 w-full">
            <Text className="text-lg font-bold text-gray-800 dark:text-white mb-2">Trade Positions</Text>
            {positionsLoading ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : positions.length === 0 ? (
              <Text className="text-gray-500">No open positions</Text>
            ) : (
              positions.map((pos) => (
                <View key={pos.publicKey.toString()} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-2">
                  <Text className="text-gray-800 dark:text-white font-mono">ID: {pos.id.toString()}</Text>
                  <Pressable
                    onPress={() => handleTestClose(pos.id)}
                    disabled={closeStatus === 'building' || closeStatus === 'signing' || closeStatus === 'confirming'}
                    className="bg-red-600 px-6 py-3 rounded-xl active:bg-red-700 mt-3"
                  >
                    <Text className="text-white font-bold">
                      {closeStatus === 'building'
                        ? 'Building...'
                        : closeStatus === 'signing'
                          ? 'Signing...'
                          : closeStatus === 'confirming'
                            ? 'Confirming...'
                            : 'Close Position'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        <StatusBar style="auto" />
      </View>
    </View>
  );
}

import { useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import { resolver } from '../utils/accountResolver';
import { parseTokenAmount } from '../utils/token';
import { useMarketConfig } from './hooks/useMarketConfig';
import { useMarketPrice } from './hooks/useMarketPrice';
import { useMintBalance } from './hooks/useMintBalance';
import { useSubmitOrder } from './hooks/useSubmitOrder';
import { useTradePositions } from './hooks/useTradePositions';
import { useClosePosition } from './hooks/useClosePosition';
import { useStreamingMarketState } from './hooks/useStreamingMarketState';
import { ConnectButton } from './components/ConnectButton';
import { PercentageSlider } from './components/PercentageSlider';
import { ClosedPositionsList } from './components/ClosedPositionsList';
import { ActivePositionCard } from './components/ActivePositionCard';
import { useAuthorization } from './providers/AuthorizationProvider';
import type { MarketConfigRow } from '../integrations/supabase/types';

type OrderSide = 'buy' | 'sell';

const MARKET_ID = 1;
const MARKET = resolver.marketPda(new BN(MARKET_ID));
const SLOT_DURATION_SECONDS = 0.4;
const MIN_DURATION_SECONDS = 5 * 60;
const MAX_DURATION_SECONDS = 365 * 24 * 60 * 60;

const DURATION_OPTIONS = [
  { label: '5m', seconds: 5 * 60 },
  { label: '10m', seconds: 10 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '1h', seconds: 60 * 60 },
  { label: '2h', seconds: 2 * 60 * 60 },
  { label: '4h', seconds: 4 * 60 * 60 },
  { label: '12h', seconds: 12 * 60 * 60 },
  { label: '1d', seconds: 24 * 60 * 60 },
  { label: '3d', seconds: 3 * 24 * 60 * 60 },
  { label: '1w', seconds: 7 * 24 * 60 * 60 },
  { label: '1mo', seconds: 30 * 24 * 60 * 60 },
  { label: '3mo', seconds: 90 * 24 * 60 * 60 },
  { label: '6mo', seconds: 180 * 24 * 60 * 60 },
  { label: '1y', seconds: 365 * 24 * 60 * 60 },
] as const;

function shortenAddress(value: string | null | undefined): string {
  if (!value) return 'N/A';
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function resolveTicker(config: MarketConfigRow | null, side: OrderSide): string {
  if (!config) return side === 'buy' ? 'QUOTE' : 'BASE';

  const symbol =
    side === 'buy' ? (config.quote_ticker ?? shortenAddress(config.quote_mint)) : (config.base_ticker ?? shortenAddress(config.base_mint));

  return symbol.toUpperCase();
}

function formatUiAmount(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function sanitizeAmountInput(raw: string): string {
  const normalized = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [whole, ...fractionParts] = normalized.split('.');
  if (fractionParts.length === 0) return whole;
  return `${whole}.${fractionParts.join('')}`;
}

function formatAtomsToInput(balanceAtoms: bigint, decimals: number): string {
  if (balanceAtoms <= 0n) return '';
  if (decimals <= 0) return balanceAtoms.toString();

  const divisor = 10n ** BigInt(decimals);
  const whole = balanceAtoms / divisor;
  const fraction = (balanceAtoms % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  if (fraction.length === 0) return whole.toString();
  return `${whole.toString()}.${fraction}`;
}

function toSliderPercent(amountAtoms: bigint | null, availableAtoms: bigint | null): number {
  if (!amountAtoms || amountAtoms <= 0n) return 0;
  if (!availableAtoms || availableAtoms <= 0n) return 0;
  const clamped = amountAtoms > availableAtoms ? availableAtoms : amountAtoms;
  return Number((clamped * 10000n) / availableAtoms) / 100;
}

function atomsFromPercent(availableAtoms: bigint, percent: number): bigint {
  const clamped = Math.min(100, Math.max(0, percent));
  const basisPoints = BigInt(Math.round(clamped * 100));
  return (availableAtoms * basisPoints) / 10000n;
}

function durationToSlots(seconds: number): number {
  return Math.max(1, Math.round(seconds / SLOT_DURATION_SECONDS));
}

export default function App() {
  const { selectedAccount } = useAuthorization();
  const positionAuthority = selectedAccount?.publicKey.toBase58() ?? '';
  const { config, loading: configLoading, error: configError } = useMarketConfig(MARKET_ID);
  const { price: marketPrice } = useMarketPrice(MARKET_ID);
  const { submitOrder, status, error: orderError, signature } = useSubmitOrder();
  const { positions, loading: positionsLoading } = useTradePositions(selectedAccount?.publicKey ?? null);
  const { closePosition, status: closeStatus, error: closeError, signature: closeSignature } = useClosePosition();
  const { state: streamingState, error: streamingStateError } = useStreamingMarketState(MARKET, !!selectedAccount);
  const [side, setSide] = useState<OrderSide>('buy');
  const [amountInput, setAmountInput] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(30 * 60);
  const [validationError, setValidationError] = useState<string | null>(null);

  const baseMint = config?.base_mint ?? null;
  const quoteMint = config?.quote_mint ?? null;
  const baseDecimals = config?.base_decimals ?? 0;
  const quoteDecimals = config?.quote_decimals ?? 0;

  const baseTicker = resolveTicker(config, 'sell');
  const quoteTicker = resolveTicker(config, 'buy');

  const baseBalance = useMintBalance(baseMint, baseDecimals);
  const quoteBalance = useMintBalance(quoteMint, quoteDecimals);

  const amountTokenTicker = side === 'sell' ? baseTicker : quoteTicker;
  const amountDecimals = side === 'sell' ? baseDecimals : quoteDecimals;
  const availableAmountAtoms = side === 'sell' ? baseBalance.balanceAtoms : quoteBalance.balanceAtoms;
  const availableAmountUi = side === 'sell' ? baseBalance.balanceUi : quoteBalance.balanceUi;
  const availableAmountLoading = side === 'sell' ? baseBalance.loading : quoteBalance.loading;
  const availableAmountDisplay = selectedAccount ? availableAmountUi : 0;

  const amountAtoms = useMemo(() => parseTokenAmount(amountInput, amountDecimals), [amountInput, amountDecimals]);
  const amountExceedsAvailable =
    amountAtoms !== null && availableAmountAtoms !== null && amountAtoms > availableAmountAtoms;
  const sliderValue = useMemo(
    () => toSliderPercent(amountAtoms, availableAmountAtoms),
    [amountAtoms, availableAmountAtoms],
  );
  const isSubmitting = status === 'building' || status === 'signing' || status === 'confirming';
  const isClosing = closeStatus === 'building' || closeStatus === 'signing' || closeStatus === 'confirming';

  const submitDisabled =
    isSubmitting ||
    !config ||
    availableAmountLoading ||
    !amountAtoms ||
    amountAtoms <= 0n ||
    amountExceedsAvailable ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS;

  const statusLabel =
    status === 'building'
      ? 'Building...'
      : status === 'signing'
        ? 'Signing...'
        : status === 'confirming'
          ? 'Confirming...'
          : `Submit ${side === 'buy' ? 'Buy' : 'Sell'} Order`;
  const closeButtonLabel = isClosing
    ? closeStatus === 'building'
      ? 'Building...'
      : closeStatus === 'signing'
        ? 'Signing...'
        : 'Confirming...'
    : 'Close Position';

  const handleSideChange = (nextSide: OrderSide) => {
    setSide(nextSide);
    setAmountInput('');
    setValidationError(null);
  };

  const handleAmountChange = (nextAmount: string) => {
    setAmountInput(sanitizeAmountInput(nextAmount));
    setValidationError(null);
  };

  const handleSliderChange = (percent: number) => {
    if (!availableAmountAtoms || availableAmountAtoms <= 0n) {
      setAmountInput('');
      return;
    }

    const nextAmountAtoms = atomsFromPercent(availableAmountAtoms, percent);
    setAmountInput(formatAtomsToInput(nextAmountAtoms, amountDecimals));
    setValidationError(null);
  };

  const handleSubmitOrder = async () => {
    if (!config) {
      setValidationError('Market config is not loaded yet.');
      return;
    }

    if (!amountAtoms || amountAtoms <= 0n) {
      setValidationError(`Enter a valid ${amountTokenTicker} amount.`);
      return;
    }

    if (!availableAmountAtoms || amountAtoms > availableAmountAtoms) {
      setValidationError(`Amount exceeds available ${amountTokenTicker} balance.`);
      return;
    }

    if (amountAtoms > BigInt(Number.MAX_SAFE_INTEGER)) {
      setValidationError('Amount is too large to submit safely.');
      return;
    }

    setValidationError(null);
    const durationSlots = durationToSlots(durationSeconds);
    const id = new BN(Date.now());
    const success = await submitOrder(
      {
        id,
        is_buy: side === 'buy',
        amount: Number(amountAtoms),
        duration: durationSlots,
      },
      { market: MARKET },
    );

    if (success) {
      setAmountInput('');
    }
  };

  const handleClosePosition = async (tradePosition: PublicKey) => {
    await closePosition({
      market: MARKET,
      tradePosition,
    });
  };

  return (
    <View className="flex-1 bg-[#0f1224]">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-5 py-6">
        <View className="rounded-2xl bg-[#171b34] border border-[#2a2f53] p-5 mb-5">
          <Text className="text-[#8b93bd] text-xs mb-2">Market</Text>
          <Text className="text-white text-2xl font-bold">
            {baseTicker}/{quoteTicker}
          </Text>
          <Text className="text-[#b6bee3] text-base mt-2">
            {marketPrice !== null ? `$${marketPrice.toFixed(4)}` : 'Loading price...'}
          </Text>
          {config && (
            <Text className="text-[#8b93bd] text-xs mt-3">
              Base mint: {shortenAddress(config.base_mint)} • Quote mint: {shortenAddress(config.quote_mint)}
            </Text>
          )}
        </View>

        {selectedAccount && (
          <View className="rounded-2xl bg-[#171b34] border border-[#2a2f53] p-5 mb-5">
            <Text className="text-[#8b93bd] text-xs mb-2">Connected wallet</Text>
            <Text className="text-white text-sm mb-3">
              {selectedAccount.publicKey.toBase58().slice(0, 4)}...
              {selectedAccount.publicKey.toBase58().slice(-4)}
            </Text>
            <ConnectButton />
          </View>
        )}

        <View className="rounded-2xl bg-[#171b34] border border-[#2a2f53] p-5">
          <Text className="text-white text-xl font-bold mb-4">Create Order</Text>

          <View className="flex-row bg-[#10142a] rounded-xl p-1 mb-4">
            <Pressable
              onPress={() => handleSideChange('buy')}
              className={`flex-1 py-3 rounded-lg items-center ${side === 'buy' ? 'bg-[#27b46e]' : 'bg-transparent'}`}
            >
              <Text className={`font-semibold ${side === 'buy' ? 'text-white' : 'text-[#8b93bd]'}`}>Buy</Text>
            </Pressable>
            <Pressable
              onPress={() => handleSideChange('sell')}
              className={`flex-1 py-3 rounded-lg items-center ${side === 'sell' ? 'bg-[#d4525d]' : 'bg-transparent'}`}
            >
              <Text className={`font-semibold ${side === 'sell' ? 'text-white' : 'text-[#8b93bd]'}`}>Sell</Text>
            </Pressable>
          </View>

          <View className="mb-4">
            <Text className="text-[#8b93bd] text-sm mb-1">Available to trade</Text>
            {selectedAccount && availableAmountLoading ? (
              <ActivityIndicator size="small" color="#c5cbe8" />
            ) : (
              <Text className="text-white text-lg font-semibold">
                {formatUiAmount(availableAmountDisplay)} {amountTokenTicker}
              </Text>
            )}
          </View>

          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[#8b93bd] text-sm">Order size ({amountTokenTicker})</Text>
              <Pressable
                onPress={() => handleSliderChange(100)}
                disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
                className={`px-3 py-1 rounded-full ${
                  !availableAmountAtoms || availableAmountAtoms <= 0n ? 'bg-[#272d4d]' : 'bg-[#303a64]'
                }`}
              >
                <Text className="text-[#d7defa] text-xs font-semibold">Max</Text>
              </Pressable>
            </View>
            <TextInput
              value={amountInput}
              onChangeText={handleAmountChange}
              placeholder={`0.00 ${amountTokenTicker}`}
              placeholderTextColor="#6f7699"
              keyboardType="decimal-pad"
              className="rounded-xl border border-[#323a64] bg-[#10142a] px-4 py-3 text-white text-lg"
            />
            <View className="mt-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[#8b93bd] text-xs">Use balance</Text>
                <Text className="text-[#b6bee3] text-xs">{sliderValue.toFixed(2)}%</Text>
              </View>
              <PercentageSlider
                value={sliderValue}
                onChange={handleSliderChange}
                disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
              />
              <View className="flex-row mt-3">
                {[25, 50, 75, 100].map((percent) => (
                  <Pressable
                    key={percent}
                    onPress={() => handleSliderChange(percent)}
                    disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
                    className={`px-3 py-1 rounded-full border ${
                      !availableAmountAtoms || availableAmountAtoms <= 0n
                        ? 'border-[#30395d] bg-[#242a46]'
                        : 'border-[#42508a] bg-[#2a3258]'
                    } mr-2`}
                  >
                    <Text className="text-[#d7defa] text-xs">{percent}%</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View className="mb-5">
            <Text className="text-[#8b93bd] text-sm mb-2">Duration</Text>
            <Text className="text-[#b6bee3] text-xs mb-2">Choose how long the order remains active.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                {DURATION_OPTIONS.map((option) => (
                  <Pressable
                    key={option.seconds}
                    onPress={() => {
                      setDurationSeconds(option.seconds);
                      setValidationError(null);
                    }}
                    className={`px-4 py-2 rounded-full border ${
                      option.seconds === durationSeconds
                        ? 'bg-[#512da8] border-[#7e65c7]'
                        : 'bg-[#10142a] border-[#323a64]'
                    } mr-2`}
                  >
                    <Text className={`${option.seconds === durationSeconds ? 'text-white' : 'text-[#b6bee3]'} text-sm`}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {configLoading && <Text className="text-[#b6bee3] text-sm mb-3">Loading market config...</Text>}
          {configError && <Text className="text-[#f48993] text-sm mb-3">{configError}</Text>}
          {amountExceedsAvailable && (
            <Text className="text-[#f48993] text-sm mb-3">Amount exceeds available balance.</Text>
          )}
          {validationError && <Text className="text-[#f48993] text-sm mb-3">{validationError}</Text>}
          {status === 'success' && (
            <Text className="text-[#6ee7a3] text-sm mb-3">
              Order submitted{signature ? `: ${signature.slice(0, 6)}...${signature.slice(-6)}` : ''}.
            </Text>
          )}
          {status === 'error' && orderError && <Text className="text-[#f48993] text-sm mb-3">{orderError}</Text>}

          {selectedAccount ? (
            <Pressable
              onPress={handleSubmitOrder}
              disabled={submitDisabled}
              className={`rounded-xl py-4 items-center ${submitDisabled ? 'bg-[#31395f]' : 'bg-[#512da8]'}`}
            >
              <Text className="text-white font-semibold text-base">{statusLabel}</Text>
            </Pressable>
          ) : (
            <ConnectButton />
          )}
        </View>

        {selectedAccount && (
          <View className="rounded-2xl bg-[#171b34] border border-[#2a2f53] p-5 mt-5">
            <Text className="text-white text-xl font-bold mb-4">Active Positions</Text>

            {positionsLoading ? (
              <ActivityIndicator size="small" color="#c5cbe8" />
            ) : positions.length === 0 ? (
              <Text className="text-[#8b93bd] text-sm">No active positions.</Text>
            ) : (
              <View>
                {positions.map((position) => (
                  <ActivePositionCard
                    key={position.publicKey.toBase58()}
                    position={position}
                    baseTicker={baseTicker}
                    quoteTicker={quoteTicker}
                    baseDecimals={baseDecimals}
                    quoteDecimals={quoteDecimals}
                    isClosing={isClosing}
                    closeButtonLabel={closeButtonLabel}
                    onClose={() => handleClosePosition(position.publicKey)}
                    streamingState={streamingState}
                  />
                ))}
              </View>
            )}

            {closeStatus === 'success' && (
              <Text className="text-[#6ee7a3] text-sm mt-2">
                Position closed{closeSignature ? `: ${closeSignature.slice(0, 6)}...${closeSignature.slice(-6)}` : ''}.
              </Text>
            )}
            {closeStatus === 'error' && closeError && <Text className="text-[#f48993] text-sm mt-2">{closeError}</Text>}
            {streamingStateError && <Text className="text-[#f48993] text-sm mt-2">{streamingStateError}</Text>}
          </View>
        )}

        {selectedAccount && (
          <ClosedPositionsList
            positionAuthority={positionAuthority}
            marketId={MARKET_ID}
            baseTicker={baseTicker}
            quoteTicker={quoteTicker}
            baseDecimals={baseDecimals}
            quoteDecimals={quoteDecimals}
          />
        )}
      </ScrollView>

      <StatusBar style="light" />
    </View>
  );
}

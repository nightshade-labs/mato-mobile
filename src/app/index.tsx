import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// StatusBar is configured in _layout.tsx
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import { resolver } from '../utils/accountResolver';
import { parseTokenAmount } from '../utils/token';
import { useMarketConfig } from '../hooks/useMarketConfig';
import { useMarketPrice } from '../hooks/useMarketPrice';
import { useMintBalance } from '../hooks/useMintBalance';
import { useSubmitOrder } from '../hooks/useSubmitOrder';
import { useTradePositions } from '../hooks/useTradePositions';
import { useClosePosition } from '../hooks/useClosePosition';
import { useStreamingMarketState } from '../hooks/useStreamingMarketState';
import { useMarketUpdates } from '../integrations/supabase/useMarketUpdates';
import { aggregateCandles } from '../utils/candles';
import { ConnectButton } from '../components/ConnectButton';
import { PercentageSlider } from '../components/PercentageSlider';
import { ClosedPositionsList } from '../components/ClosedPositionsList';
import { ActivePositionCard } from '../components/ActivePositionCard';
import { CandleChart } from '../components/CandleChart';
import { TradingViewChart } from '../components/TradingViewChart';
import type { TradingViewCandle, TradingViewCrosshairData } from '../components/TradingViewChart';
import { useAuthorization } from '../providers/AuthorizationProvider';
import type { MarketConfigRow } from '../integrations/supabase/types';
import { uiColors } from '../theme/colors';

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

const CHART_TIMEFRAMES = [
  { label: '5m', intervalMs: 5 * 60 * 1000 },
  { label: '1h', intervalMs: 60 * 60 * 1000 },
  { label: '1D', intervalMs: 24 * 60 * 60 * 1000 },
  { label: '1W', intervalMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

const ENABLE_ADVANCED_CHART = process.env.EXPO_PUBLIC_ENABLE_ADVANCED_CHART !== 'false';
const CHART_TIMEFRAME_STORAGE_KEY = 'mato_mobile_chart_timeframe';

type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number]['label'];
type MarketPanelTab = 'chart' | 'orderBook' | 'trades';
type PositionPanelTab = 'active' | 'closed';

type FeedbackType = 'success' | 'error';

interface FeedbackMessage {
  type: FeedbackType;
  message: string;
}

function shortenAddress(value: string | null | undefined): string {
  if (!value) return 'N/A';
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function resolveTicker(config: MarketConfigRow | null, side: OrderSide): string {
  if (!config) return side === 'buy' ? 'QUOTE' : 'BASE';

  const symbol =
    side === 'buy'
      ? (config.quote_ticker ?? shortenAddress(config.quote_mint))
      : (config.base_ticker ?? shortenAddress(config.base_mint));

  return symbol.toUpperCase();
}

function formatUiAmount(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function formatSignedNumber(value: number, decimals: number): string {
  const absolute = Math.abs(value).toFixed(decimals);
  return `${value >= 0 ? '+' : '-'}${absolute}`;
}

function formatCompactNumber(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function marketPriceFromFlows(
  baseFlow: bigint,
  quoteFlow: bigint,
  baseDecimals: number,
  quoteDecimals: number,
): number | null {
  if (baseFlow === 0n) return null;
  const base = Number(baseFlow) / 10 ** baseDecimals;
  if (base === 0) return null;
  const quote = Number(quoteFlow) / 10 ** quoteDecimals;
  const price = Math.abs(quote) / Math.abs(base);
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}

function formatCrosshairTimeLabel(value: number | string | null): string | null {
  if (value === null) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const date = new Date(numeric * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function aggregateTradingViewCandles(
  events: { created_at: string; base_flow: bigint; quote_flow: bigint }[],
  intervalMs: number,
  baseDecimals: number,
  quoteDecimals: number,
): TradingViewCandle[] {
  const bucketMap = new Map<number, number[]>();
  const bucketVolumeMap = new Map<number, number>();

  for (const event of events) {
    const price = marketPriceFromFlows(event.base_flow, event.quote_flow, baseDecimals, quoteDecimals);
    if (price === null) continue;

    const timestampMs = new Date(event.created_at).getTime();
    const bucketMs = Math.floor(timestampMs / intervalMs) * intervalMs;
    const prices = bucketMap.get(bucketMs);
    if (prices) {
      prices.push(price);
    } else {
      bucketMap.set(bucketMs, [price]);
    }

    const quoteVolume = Math.abs(Number(event.quote_flow) / 10 ** quoteDecimals);
    bucketVolumeMap.set(bucketMs, (bucketVolumeMap.get(bucketMs) ?? 0) + quoteVolume);
  }

  const candles: TradingViewCandle[] = [];
  for (const [bucketMs, prices] of bucketMap) {
    candles.push({
      time: Math.floor(bucketMs / 1000),
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: bucketVolumeMap.get(bucketMs) ?? 0,
    });
  }

  return candles.sort((a, b) => a.time - b.time);
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
  const { price: marketPrice, error: marketPriceError } = useMarketPrice(MARKET_ID);
  const { submitOrder, status, error: orderError, signature } = useSubmitOrder();
  const { positions, loading: positionsLoading } = useTradePositions(selectedAccount?.publicKey ?? null);
  const { closePosition, status: closeStatus, error: closeError, signature: closeSignature } = useClosePosition();
  const { state: streamingState, error: streamingStateError } = useStreamingMarketState(MARKET, !!selectedAccount);
  const {
    events: marketEvents,
    loading: marketEventsLoading,
    error: marketEventsError,
  } = useMarketUpdates({
    marketId: MARKET_ID,
    limit: 600,
  });
  const [side, setSide] = useState<OrderSide>('buy');
  const [amountInput, setAmountInput] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(30 * 60);
  const [marketPanelTab, setMarketPanelTab] = useState<MarketPanelTab>('chart');
  const [positionPanelTab, setPositionPanelTab] = useState<PositionPanelTab>('active');
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1h');
  const [crosshairData, setCrosshairData] = useState<TradingViewCrosshairData | null>(null);
  const [isChartTimeframeReady, setIsChartTimeframeReady] = useState(false);
  const [isSwitchingTimeframe, setIsSwitchingTimeframe] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const chartIntervalMs = useMemo(
    () => CHART_TIMEFRAMES.find((option) => option.label === chartTimeframe)?.intervalMs ?? 60 * 60 * 1000,
    [chartTimeframe],
  );
  const chartCandles = useMemo(() => {
    if (!config) return [];
    return aggregateCandles(marketEvents, chartIntervalMs, config.base_decimals, config.quote_decimals);
  }, [marketEvents, chartIntervalMs, config]);
  const tradingViewCandles = useMemo(() => {
    if (!config) return [];
    return aggregateTradingViewCandles(marketEvents, chartIntervalMs, config.base_decimals, config.quote_decimals);
  }, [marketEvents, chartIntervalMs, config]);
  const latestChartCandle = chartCandles.length > 0 ? chartCandles[chartCandles.length - 1] : null;
  const latestTradingViewCandle =
    tradingViewCandles.length > 0 ? tradingViewCandles[tradingViewCandles.length - 1] : null;
  const recentTickPrices = useMemo(() => {
    if (!config) return [] as number[];
    return marketEvents
      .slice(0, 2)
      .map((event) =>
        marketPriceFromFlows(event.base_flow, event.quote_flow, config.base_decimals, config.quote_decimals),
      )
      .filter((value): value is number => value !== null);
  }, [marketEvents, config]);
  const latestTickPrice = recentTickPrices.length > 0 ? recentTickPrices[0] : null;
  const previousTickPrice = recentTickPrices.length > 1 ? recentTickPrices[1] : null;
  const onChainIndicativePrice = useMemo(() => {
    if (!config || !streamingState) return null;
    return marketPriceFromFlows(
      streamingState.marketBaseFlow,
      streamingState.marketQuoteFlow,
      config.base_decimals,
      config.quote_decimals,
    );
  }, [config, streamingState]);

  const displayPrice = marketPrice ?? latestTickPrice ?? onChainIndicativePrice ?? latestChartCandle?.close ?? null;
  const priceDelta =
    latestTickPrice !== null && previousTickPrice !== null
      ? latestTickPrice - previousTickPrice
      : latestChartCandle
        ? latestChartCandle.close - latestChartCandle.open
        : null;
  const priceDeltaPercent =
    priceDelta !== null && displayPrice !== null && displayPrice > 0 ? (priceDelta / displayPrice) * 100 : null;

  const recent24hEvents = useMemo(() => {
    if (!config) return [];
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    return marketEvents.filter((event) => new Date(event.created_at).getTime() >= threshold);
  }, [marketEvents, config]);

  const marketStats = useMemo(() => {
    if (!config || recent24hEvents.length === 0) {
      return { high: null as number | null, low: null as number | null, volumeQuote: null as number | null };
    }

    const prices = recent24hEvents
      .map((event) =>
        marketPriceFromFlows(event.base_flow, event.quote_flow, config.base_decimals, config.quote_decimals),
      )
      .filter((value): value is number => value !== null);

    if (prices.length === 0) {
      return { high: null as number | null, low: null as number | null, volumeQuote: null as number | null };
    }

    const volumeQuote = recent24hEvents.reduce((sum, event) => {
      return sum + Math.abs(Number(event.quote_flow) / 10 ** config.quote_decimals);
    }, 0);

    return {
      high: Math.max(...prices),
      low: Math.min(...prices),
      volumeQuote,
    };
  }, [recent24hEvents, config]);

  const amountUiValue = useMemo(() => {
    if (!amountAtoms || amountAtoms <= 0n) return null;
    return Number(amountAtoms) / 10 ** amountDecimals;
  }, [amountAtoms, amountDecimals]);

  const estimatedConversionText = useMemo(() => {
    if (!amountUiValue || !displayPrice || displayPrice <= 0) return null;
    if (side === 'buy') {
      const estimatedBase = amountUiValue / displayPrice;
      return `~${formatUiAmount(estimatedBase)} ${baseTicker}`;
    }
    const estimatedQuote = amountUiValue * displayPrice;
    return `~${formatUiAmount(estimatedQuote)} ${quoteTicker}`;
  }, [amountUiValue, displayPrice, side, baseTicker, quoteTicker]);

  const priceImpactPercent = useMemo(() => {
    if (!amountAtoms || amountAtoms <= 0n || !streamingState) return null;
    const slots = durationToSlots(durationSeconds);
    const userFlowPerSlot = amountAtoms / BigInt(slots);
    if (userFlowPerSlot <= 0n) return null;

    if (side === 'buy') {
      if (streamingState.marketQuoteFlow <= 0n) return null;
      return (Number(userFlowPerSlot) / Number(streamingState.marketQuoteFlow)) * 100;
    }
    if (streamingState.marketBaseFlow <= 0n) return null;
    return (Number(userFlowPerSlot) / Number(streamingState.marketBaseFlow + userFlowPerSlot)) * 100;
  }, [amountAtoms, durationSeconds, streamingState, side]);

  const activeOhlcv = useMemo(() => {
    if (crosshairData) {
      return {
        time: crosshairData.time,
        open: crosshairData.open,
        high: crosshairData.high,
        low: crosshairData.low,
        close: crosshairData.close,
        volume: crosshairData.volume,
      };
    }
    if (latestTradingViewCandle) {
      return {
        time: latestTradingViewCandle.time,
        open: latestTradingViewCandle.open,
        high: latestTradingViewCandle.high,
        low: latestTradingViewCandle.low,
        close: latestTradingViewCandle.close,
        volume: latestTradingViewCandle.volume,
      };
    }
    return null;
  }, [crosshairData, latestTradingViewCandle]);
  const activeOhlcvTimeLabel = useMemo(() => formatCrosshairTimeLabel(activeOhlcv?.time ?? null), [activeOhlcv]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const restoreChartTimeframe = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHART_TIMEFRAME_STORAGE_KEY);
        if (!mounted || !stored) return;
        const isValid = CHART_TIMEFRAMES.some((option) => option.label === stored);
        if (isValid) {
          setChartTimeframe(stored as ChartTimeframe);
        }
      } finally {
        if (mounted) {
          setIsChartTimeframeReady(true);
        }
      }
    };

    restoreChartTimeframe();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isChartTimeframeReady) return;
    AsyncStorage.setItem(CHART_TIMEFRAME_STORAGE_KEY, chartTimeframe).catch(() => {});
  }, [chartTimeframe, isChartTimeframeReady]);

  useEffect(() => {
    setCrosshairData(null);
    if (!isChartTimeframeReady) return;
    setIsSwitchingTimeframe(true);
    const timeout = setTimeout(() => setIsSwitchingTimeframe(false), 220);
    return () => clearTimeout(timeout);
  }, [chartTimeframe, isChartTimeframeReady]);

  const handleSideChange = (nextSide: OrderSide) => {
    setSide(nextSide);
    setAmountInput('');
    setValidationError(null);
  };

  const handleAmountChange = (nextAmount: string) => {
    setAmountInput(sanitizeAmountInput(nextAmount));
    setValidationError(null);
  };

  const handleSliderChange = useCallback(
    (percent: number) => {
      if (!availableAmountAtoms || availableAmountAtoms <= 0n) {
        setAmountInput('');
        return;
      }

      const nextAmountAtoms = atomsFromPercent(availableAmountAtoms, percent);
      setAmountInput(formatAtomsToInput(nextAmountAtoms, amountDecimals));
      setValidationError(null);
    },
    [availableAmountAtoms, amountDecimals],
  );

  const handleTimeframeChange = (next: ChartTimeframe) => {
    if (next === chartTimeframe) return;
    setChartTimeframe(next);
  };

  const pushFeedback = useCallback((type: FeedbackType, message: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback({ type, message });
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 4000);
  }, []);

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

  useEffect(() => {
    if (status === 'success') {
      pushFeedback(
        'success',
        `Order submitted${signature ? ` (${signature.slice(0, 6)}...${signature.slice(-6)})` : ''}`,
      );
      return;
    }
    if (status === 'error' && orderError) {
      pushFeedback('error', orderError);
    }
  }, [status, orderError, signature, pushFeedback]);

  useEffect(() => {
    if (closeStatus === 'success') {
      pushFeedback(
        'success',
        `Position closed${closeSignature ? ` (${closeSignature.slice(0, 6)}...${closeSignature.slice(-6)})` : ''}`,
      );
      return;
    }
    if (closeStatus === 'error' && closeError) {
      pushFeedback('error', closeError);
    }
  }, [closeStatus, closeError, closeSignature, pushFeedback]);

  return (
    <View className="flex-1" style={{ backgroundColor: uiColors.background }}>
      {/* Sticky market header */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="px-4 pt-3 pb-2 border-b"
        style={{ backgroundColor: uiColors.background, borderBottomColor: uiColors.divider }}
      >
        <View className="mb-2 flex-row items-center justify-between">
          <Image
            source={require('../../assets/splash.png')}
            style={{ width: 48, height: 48 }}
            resizeMode="contain"
          />
          <View className="flex-row items-center">
            {selectedAccount ? (
              <Text className="text-[#9ba5d2] text-xs mr-3">
                {selectedAccount.publicKey.toBase58().slice(0, 4)}...
                {selectedAccount.publicKey.toBase58().slice(-4)}
              </Text>
            ) : null}
            <ConnectButton variant="compact" />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-white text-xl font-semibold mr-2">
              {baseTicker}/{quoteTicker}
            </Text>
            <Text className="text-[#7f89ba] text-[10px]">Spot</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-white text-xl font-semibold">
              {displayPrice !== null ? `$${displayPrice.toFixed(4)}` : '—'}
            </Text>
            {priceDelta !== null && priceDeltaPercent !== null && (
              <View
                className="ml-2 px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: priceDelta >= 0 ? uiColors.successBg : uiColors.dangerBg,
                }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: priceDelta >= 0 ? uiColors.accentText : uiColors.dangerText }}
                >
                  {formatSignedNumber(priceDeltaPercent, 2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {feedback && (
          <Pressable
            onPress={() => setFeedback(null)}
            className="border px-4 py-2 mb-3"
            style={{
              backgroundColor: feedback.type === 'error' ? uiColors.dangerBg : uiColors.successBg,
              borderColor: feedback.type === 'error' ? uiColors.dangerBorder : uiColors.successBorder,
            }}
          >
            <Text className="text-sm" style={{ color: feedback.type === 'error' ? '#ffd3d8' : '#d2ffe8' }}>
              {feedback.message}
            </Text>
          </Pressable>
        )}

        <View className="mb-3 px-4">
          <View className="flex-row justify-between">
            <View className="flex-1 pr-2 border-r" style={{ borderRightColor: uiColors.divider }}>
              <Text className="text-[#7380b4] text-[10px] uppercase">24h High</Text>
              <Text className="text-[#d7defa] text-xs font-semibold mt-0.5">
                {marketStats.high === null ? '—' : `$${marketStats.high.toFixed(4)}`}
              </Text>
            </View>
            <View className="flex-1 px-2 border-r" style={{ borderRightColor: uiColors.divider }}>
              <Text className="text-[#7380b4] text-[10px] uppercase">24h Low</Text>
              <Text className="text-[#d7defa] text-xs font-semibold mt-0.5">
                {marketStats.low === null ? '—' : `$${marketStats.low.toFixed(4)}`}
              </Text>
            </View>
            <View className="flex-1 pl-2">
              <Text className="text-[#7380b4] text-[10px] uppercase">24h Vol ({quoteTicker})</Text>
              <Text className="text-[#d7defa] text-xs font-semibold mt-0.5">
                {marketStats.volumeQuote === null ? '—' : formatCompactNumber(marketStats.volumeQuote)}
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-4">
          <View className="flex-row items-end border-b mb-2 px-4" style={{ borderBottomColor: uiColors.divider }}>
            {[
              { key: 'chart', label: 'Chart' },
              { key: 'orderBook', label: 'Order Book' },
              { key: 'trades', label: 'Trades' },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setMarketPanelTab(tab.key as MarketPanelTab)}
                className={`px-2 py-2 mr-4 border-b ${
                  marketPanelTab === tab.key ? 'border-[#34d399]' : 'border-transparent'
                }`}
              >
                <Text className={`${marketPanelTab === tab.key ? 'text-[#d7fff1]' : 'text-[#8e97c2]'} text-sm`}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {marketPanelTab === 'chart' && (
            <>
              <View className="flex-row items-center justify-between mb-2 px-4">
                <Text className="text-white text-lg font-semibold">Chart</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row items-end">
                    {CHART_TIMEFRAMES.map((option) => (
                      <Pressable
                        key={option.label}
                        onPress={() => handleTimeframeChange(option.label)}
                        className={`px-2 pb-1 mr-3 border-b ${
                          option.label === chartTimeframe ? 'border-[#34d399]' : 'border-transparent'
                        }`}
                      >
                        <Text
                          className={`${option.label === chartTimeframe ? 'text-[#d7fff1]' : 'text-[#8e97c2]'} text-sm`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {activeOhlcv && (
                <View
                  className="mb-2 border-y py-1.5 px-4"
                  style={{ borderTopColor: uiColors.divider, borderBottomColor: uiColors.divider }}
                >
                  <View className="flex-row justify-between">
                    <Text className="text-[#b6bee3] text-[11px]">O {activeOhlcv.open.toFixed(2)}</Text>
                    <Text className="text-[#b6bee3] text-[11px]">H {activeOhlcv.high.toFixed(2)}</Text>
                    <Text className="text-[#b6bee3] text-[11px]">L {activeOhlcv.low.toFixed(2)}</Text>
                    <Text className="text-[#b6bee3] text-[11px]">C {activeOhlcv.close.toFixed(2)}</Text>
                    <Text className="text-[#b6bee3] text-[11px]" numberOfLines={1}>
                      V {activeOhlcv.volume === null ? '—' : formatCompactNumber(activeOhlcv.volume)}
                    </Text>
                  </View>
                  {activeOhlcvTimeLabel && (
                    <Text className="text-[#8b93bd] text-[10px] mt-1">{activeOhlcvTimeLabel}</Text>
                  )}
                </View>
              )}

              {!isChartTimeframeReady ? (
                <ActivityIndicator size="small" color="#c5cbe8" />
              ) : marketEventsLoading && chartCandles.length === 0 && tradingViewCandles.length === 0 ? (
                <ActivityIndicator size="small" color="#c5cbe8" />
              ) : chartCandles.length === 0 && tradingViewCandles.length === 0 ? (
                <Text className="text-[#8b93bd] text-sm">Not enough market updates to render chart yet.</Text>
              ) : (
                <View className="overflow-hidden bg-[#0e1428] relative">
                  {ENABLE_ADVANCED_CHART ? (
                    <TradingViewChart
                      data={tradingViewCandles}
                      lastCandle={latestTradingViewCandle}
                      onCrosshairMove={setCrosshairData}
                      height={320}
                    />
                  ) : (
                    <CandleChart data={chartCandles} height={250} />
                  )}
                  {isSwitchingTimeframe && (
                    <View
                      className="absolute inset-0 items-center justify-center"
                      style={{ backgroundColor: 'rgba(16, 20, 42, 0.55)' }}
                    >
                      <Text className="text-[#d7defa] text-xs">Switching timeframe...</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {marketPanelTab === 'orderBook' && (
            <View className="bg-[#0e1428] p-4">
              <Text className="text-white text-base font-semibold mb-2">Order Book</Text>
              <Text className="text-[#8e97c2] text-sm">
                Order book snapshots are not available in the current market feed yet.
              </Text>
            </View>
          )}

          {marketPanelTab === 'trades' && (
            <View className="bg-[#0e1428] p-4">
              {selectedAccount ? (
                <ClosedPositionsList
                  embedded
                  positionAuthority={positionAuthority}
                  marketId={MARKET_ID}
                  baseTicker={baseTicker}
                  quoteTicker={quoteTicker}
                  baseDecimals={baseDecimals}
                  quoteDecimals={quoteDecimals}
                  limit={10}
                />
              ) : (
                <Text className="text-[#8e97c2] text-sm py-3">Connect wallet to view recent trades.</Text>
              )}
            </View>
          )}

          {marketEventsError && <Text className="text-[#f48993] text-sm mt-2 px-4">{marketEventsError}</Text>}
          {marketPriceError && <Text className="text-[#f48993] text-sm mt-2 px-4">{marketPriceError}</Text>}
        </View>

        <View className="bg-[#121a33] p-4">
          <Text className="text-white text-lg font-semibold mb-2">Create Order</Text>

          <View className="flex-row bg-[#0c1225] rounded-xl p-1 mb-3">
            <Pressable
              onPress={() => handleSideChange('buy')}
              className={`flex-1 py-3 rounded-lg items-center ${side === 'buy' ? 'bg-[#34d399]' : 'bg-transparent'}`}
            >
              <Text className={`font-semibold ${side === 'buy' ? 'text-white' : 'text-[#8b93bd]'}`}>Buy</Text>
            </Pressable>
            <Pressable
              onPress={() => handleSideChange('sell')}
              className={`flex-1 py-3 rounded-lg items-center ${side === 'sell' ? 'bg-[#ef4444]' : 'bg-transparent'}`}
            >
              <Text className={`font-semibold ${side === 'sell' ? 'text-white' : 'text-[#8b93bd]'}`}>Sell</Text>
            </Pressable>
          </View>

          <View className="mb-3 pb-3 border-b" style={{ borderBottomColor: uiColors.divider }}>
            <Text className="text-[#8b93bd] text-sm mb-1">Available</Text>
            {selectedAccount && availableAmountLoading ? (
              <ActivityIndicator size="small" color="#c5cbe8" />
            ) : (
              <Text className="text-white text-lg font-semibold">
                {formatUiAmount(availableAmountDisplay)} {amountTokenTicker}
              </Text>
            )}
          </View>

          <View className="mb-3 pb-3 border-b" style={{ borderBottomColor: uiColors.divider }}>
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
            {estimatedConversionText && (
              <Text className="text-[#8b93bd] text-xs mt-2">Estimated receive: {estimatedConversionText}</Text>
            )}
            {priceImpactPercent !== null && (
              <View className="flex-row items-center mt-1">
                <Text className="text-[#7380b4] text-xs">Price impact: </Text>
                <Text
                  className="text-xs font-medium"
                  style={{
                    color:
                      priceImpactPercent < 1
                        ? uiColors.accentText
                        : priceImpactPercent < 5
                          ? uiColors.warningText
                          : uiColors.dangerText,
                  }}
                >
                  {priceImpactPercent < 0.01 ? '<0.01' : priceImpactPercent.toFixed(2)}%
                </Text>
              </View>
            )}
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

          <View className="mb-3">
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
            <Text className="text-[#86efac] text-sm mb-3">
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
            <Text className="text-[#8e97c2] text-sm">Connect wallet from top bar to place orders.</Text>
          )}
        </View>

        {selectedAccount && (
          <View className="bg-[#171b34] border-t border-b border-[#2a2f53] p-4 mt-4">
            <View className="flex-row items-end border-b mb-3" style={{ borderBottomColor: uiColors.divider }}>
              {[
                { key: 'active', label: `Positions (${positions.length})` },
                { key: 'closed', label: 'Closed' },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setPositionPanelTab(tab.key as PositionPanelTab)}
                  className={`px-2 py-2 mr-4 border-b ${
                    positionPanelTab === tab.key ? 'border-[#34d399]' : 'border-transparent'
                  }`}
                >
                  <Text className={`${positionPanelTab === tab.key ? 'text-[#d7fff1]' : 'text-[#8e97c2]'} text-sm`}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {positionPanelTab === 'active' ? (
              <>
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
                  <Text className="text-[#86efac] text-sm mt-2">
                    Position closed
                    {closeSignature ? `: ${closeSignature.slice(0, 6)}...${closeSignature.slice(-6)}` : ''}.
                  </Text>
                )}
                {closeStatus === 'error' && closeError && (
                  <Text className="text-[#f48993] text-sm mt-2">{closeError}</Text>
                )}
                {streamingStateError && <Text className="text-[#f48993] text-sm mt-2">{streamingStateError}</Text>}
              </>
            ) : (
              <ClosedPositionsList
                embedded
                positionAuthority={positionAuthority}
                marketId={MARKET_ID}
                baseTicker={baseTicker}
                quoteTicker={quoteTicker}
                baseDecimals={baseDecimals}
                quoteDecimals={quoteDecimals}
              />
            )}
          </View>
        )}
      </ScrollView>

    </View>
  );
}

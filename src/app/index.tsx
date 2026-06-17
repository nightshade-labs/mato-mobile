import { useCallback, useEffect, useMemo, useState } from 'react';
// StatusBar is configured in _layout.tsx
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BN from 'bn.js';
import { toast } from 'sonner-native';
import { PublicKey } from '@solana/web3.js';
import { resolver } from '../utils/accountResolver';
import { getMaxTransferAmount, parseTokenAmount } from '../utils/token';
import { useMarketConfig } from '../hooks/useMarketConfig';
import { useMarketPrice } from '../hooks/useMarketPrice';
import { useMintBalance } from '../hooks/useMintBalance';
import { useSubmitOrder } from '../hooks/useSubmitOrder';
import { useTradePositions } from '../hooks/useTradePositions';
import { useClosePosition } from '../hooks/useClosePosition';
import { useStreamingMarketState } from '../hooks/useStreamingMarketState';
import { useMarketCandles } from '../hooks/useMarketCandles';
import { useMarketUpdates } from '../integrations/supabase/useMarketUpdates';
import { ConnectButton } from '../components/ConnectButton';
import { PercentageSlider } from '../components/PercentageSlider';
import { ClosedPositionsList } from '../components/ClosedPositionsList';
import { ActivePositionCard } from '../components/ActivePositionCard';
import { CandleChart } from '../components/CandleChart';
import { TradingViewChart } from '../components/TradingViewChart';
import type { TradingViewCrosshairData } from '../components/TradingViewChart';
import { BottomNavigation } from '../components/BottomNavigation';
import type { BottomNavTab } from '../components/BottomNavigation';
import { OrderBookTable } from '../components/OrderBookTable';
import { useAuthorization } from '../providers/AuthorizationProvider';
import type { MarketConfigRow } from '../integrations/supabase/types';
import { useSolBalance } from '../hooks/useSolBalance';
import { useMarketTradePositions } from '../hooks/useMarketTradePositions';
import {
  CHART_TIMEFRAMES,
  CLUSTER,
  DEFAULT_MARKET_UPDATES_LIMIT,
  DURATION_OPTIONS,
  HIGH_PRICE_IMPACT_WARNING_THRESHOLD_PERCENT,
  MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
  MARKET_ID,
  MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
  MIN_TRADE_AMOUNT_ATOMS,
  NATIVE_FEE_BUFFER_ATOMS,
  SLOT_DURATION_SECONDS,
} from '../utils/constants';
import type { ChartTimeframe, MarketPanelTab, OrderSide, PositionPanelTab } from '../utils/constants';
import {
  formatAtoms,
  formatSol,
  isEndedPosition,
  isNativeBalanceBelowTransactionMinimum,
  selectBatchClosePositions,
} from '../utils/trading';
import { uiColors } from '../theme/colors';

const MARKET = resolver.marketPda(new BN(MARKET_ID));
const MIN_DURATION_SECONDS = 1 * 60;
const MAX_DURATION_SECONDS = 365 * 24 * 60 * 60;
const PRECISION_FACTOR = 1000000000;

const ENABLE_ADVANCED_CHART = process.env.EXPO_PUBLIC_ENABLE_ADVANCED_CHART !== 'false';
const CHART_TIMEFRAME_STORAGE_KEY = 'mato_mobile_chart_timeframe';

const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };
const OVERLINE: TextStyle = { textTransform: 'uppercase', letterSpacing: 0.8 };

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

function explorerTransactionUrl(signature: string): string {
  const explorerCluster = CLUSTER.startsWith('solana:') ? CLUSTER.slice('solana:'.length) : 'mainnet';
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=${encodeURIComponent(explorerCluster)}`;
}

export default function App() {
  const { selectedAccount } = useAuthorization();
  const positionAuthority = selectedAccount?.publicKey.toBase58() ?? '';
  const { config, loading: configLoading, error: configError } = useMarketConfig(MARKET_ID);
  const { price: marketPrice, error: marketPriceError } = useMarketPrice(MARKET_ID);
  const { submitOrder, status, error: orderError, signature } = useSubmitOrder();
  const { positions, loading: positionsLoading } = useTradePositions(selectedAccount?.publicKey ?? null);
  const {
    closePosition,
    status: closeStatus,
    error: closeError,
    signature: closeSignature,
    closedCount,
  } = useClosePosition();
  const { state: streamingState, error: streamingStateError } = useStreamingMarketState(MARKET, !!selectedAccount);
  const nativeSolBalance = useSolBalance();
  const orderBookPositions = useMarketTradePositions(MARKET);
  const { events: marketEvents, error: marketEventsError } = useMarketUpdates({
    marketId: MARKET_ID,
    limit: DEFAULT_MARKET_UPDATES_LIMIT,
  });
  const [activeTab, setActiveTab] = useState<BottomNavTab>('trade');
  const [side, setSide] = useState<OrderSide>('buy');
  const [amountInput, setAmountInput] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(30 * 60);
  const [marketPanelTab, setMarketPanelTab] = useState<MarketPanelTab>('chart');
  const [positionPanelTab, setPositionPanelTab] = useState<PositionPanelTab>('active');
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1h');
  const [chartResetSignal, setChartResetSignal] = useState(0);
  const [crosshairData, setCrosshairData] = useState<TradingViewCrosshairData | null>(null);
  const [isChartTimeframeReady, setIsChartTimeframeReady] = useState(false);
  const [isSwitchingTimeframe, setIsSwitchingTimeframe] = useState(false);
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
  const availableAmountAtoms =
    side === 'sell'
      ? getMaxTransferAmount(baseBalance.balanceAtoms, 2000000n)
      : getMaxTransferAmount(quoteBalance.balanceAtoms, 0n);
  const availableAmountUi = side === 'sell' ? baseBalance.balanceUi : quoteBalance.balanceUi;
  const availableAmountLoading = side === 'sell' ? baseBalance.loading : quoteBalance.loading;
  const availableAmountDisplay = selectedAccount ? availableAmountUi : 0;

  const amountAtoms = useMemo(() => parseTokenAmount(amountInput, amountDecimals), [amountInput, amountDecimals]);
  const amountExceedsAvailable =
    amountAtoms !== null && availableAmountAtoms !== null && amountAtoms > availableAmountAtoms;
  const amountBelowMinimum = amountAtoms !== null && amountAtoms > 0n && amountAtoms < MIN_TRADE_AMOUNT_ATOMS;
  const sliderValue = useMemo(
    () => toSliderPercent(amountAtoms, availableAmountAtoms),
    [amountAtoms, availableAmountAtoms],
  );
  const isSubmitting = status === 'building' || status === 'signing' || status === 'confirming';
  const isClosing = closeStatus === 'building' || closeStatus === 'signing' || closeStatus === 'confirming';
  const hasLowSubmitNativeSolBalance =
    !!selectedAccount && isNativeBalanceBelowTransactionMinimum(nativeSolBalance.lamports, NATIVE_FEE_BUFFER_ATOMS);
  const hasLowMaintenanceNativeSolBalance =
    !!selectedAccount &&
    isNativeBalanceBelowTransactionMinimum(nativeSolBalance.lamports, MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS);
  const nativeSolBalanceDisplay = formatSol(nativeSolBalance.lamports);
  const requiredSubmitNativeSolDisplay = formatAtoms(NATIVE_FEE_BUFFER_ATOMS, 9);
  const requiredMaintenanceNativeSolDisplay = formatAtoms(MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS, 9);
  const lowSubmitNativeSolWarning =
    hasLowSubmitNativeSolBalance && nativeSolBalanceDisplay !== null
      ? `Wallet has ${nativeSolBalanceDisplay} SOL. Add SOL before submitting; at least ${requiredSubmitNativeSolDisplay} SOL is required for fees and rent.`
      : null;
  const lowMaintenanceNativeSolWarning =
    hasLowMaintenanceNativeSolBalance && nativeSolBalanceDisplay !== null
      ? `Wallet has ${nativeSolBalanceDisplay} SOL. Add SOL before closing positions; at least ${requiredMaintenanceNativeSolDisplay} SOL is required for fees.`
      : null;

  const submitDisabled =
    !selectedAccount ||
    isSubmitting ||
    !config ||
    availableAmountLoading ||
    !amountAtoms ||
    amountAtoms <= 0n ||
    amountExceedsAvailable ||
    amountBelowMinimum ||
    hasLowSubmitNativeSolBalance ||
    durationSeconds < MIN_DURATION_SECONDS ||
    durationSeconds > MAX_DURATION_SECONDS;

  const closeButtonLabel = isClosing
    ? closeStatus === 'building'
      ? 'Building...'
      : closeStatus === 'signing'
        ? 'Signing...'
        : 'Confirming...'
    : 'Close Position';

  const {
    chartCandles,
    tradingViewCandles,
    hasMoreHistory,
    loading: candlesLoading,
    loadingMoreHistory,
    error: candlesError,
    loadMoreHistory,
  } = useMarketCandles({
    marketId: MARKET_ID,
    timeframe: chartTimeframe,
  });
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
  const hasAmountInput = amountUiValue !== null && amountUiValue > 0;
  const activePositionsNewestFirst = useMemo(() => [...positions].sort((a, b) => b.id.cmp(a.id)), [positions]);
  const currentSlot = streamingState?.currentSlot ?? null;
  const endedPositions = useMemo(
    () => positions.filter((position) => isEndedPosition(position, currentSlot)),
    [currentSlot, positions],
  );
  const endedBatchPositions = useMemo(
    () =>
      selectBatchClosePositions({
        currentSlot,
        maxPositions: MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
        mode: 'ended',
        positions,
      }),
    [currentSlot, positions],
  );
  const allBatchPositions = useMemo(
    () =>
      selectBatchClosePositions({
        currentSlot,
        maxPositions: MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
        mode: 'all',
        positions,
      }),
    [currentSlot, positions],
  );

  const priceImpactPercent = useMemo(() => {
    if (!amountAtoms || amountAtoms <= 0n || !streamingState) return null;
    const slots = durationToSlots(durationSeconds);
    const userFlowPerSlot = amountAtoms / BigInt(slots);
    if (userFlowPerSlot <= 0n) return null;

    if (side === 'buy') {
      if (streamingState.marketQuoteFlow <= 0n) return null;
      return (Number(userFlowPerSlot) / (Number(streamingState.marketQuoteFlow) / PRECISION_FACTOR)) * 100;
    }
    if (streamingState.marketBaseFlow <= 0n) return null;
    return (
      (Number(userFlowPerSlot) / (Number(streamingState.marketBaseFlow) / PRECISION_FACTOR + Number(userFlowPerSlot))) *
      100
    );
  }, [amountAtoms, durationSeconds, streamingState, side]);
  const signedPriceImpactPercent = useMemo(() => {
    if (priceImpactPercent === null) return null;
    return side === 'buy' ? priceImpactPercent : -priceImpactPercent;
  }, [priceImpactPercent, side]);
  const executionPrice = useMemo(() => {
    if (displayPrice === null || displayPrice <= 0) return null;
    if (signedPriceImpactPercent === null) return displayPrice;

    const nextPrice = displayPrice * (1 + signedPriceImpactPercent / 100);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) return null;
    return nextPrice;
  }, [displayPrice, signedPriceImpactPercent]);
  const estimatedConversionText = useMemo(() => {
    const outputTicker = side === 'buy' ? baseTicker : quoteTicker;
    if (!hasAmountInput || !executionPrice || executionPrice <= 0) return `0 ${outputTicker}`;
    if (side === 'buy') {
      const estimatedBase = amountUiValue / executionPrice;
      return `~${formatUiAmount(estimatedBase)} ${baseTicker}`;
    }
    const estimatedQuote = amountUiValue * executionPrice;
    return `~${formatUiAmount(estimatedQuote)} ${quoteTicker}`;
  }, [amountUiValue, executionPrice, side, baseTicker, quoteTicker, hasAmountInput]);
  const priceImpactDisplay =
    priceImpactPercent === null ? '0%' : `${priceImpactPercent < 0.001 ? '<0.001' : priceImpactPercent.toFixed(3)}%`;
  const hasHighPriceImpact =
    hasAmountInput && priceImpactPercent !== null && priceImpactPercent >= HIGH_PRICE_IMPACT_WARNING_THRESHOLD_PERCENT;
  const priceImpactWarningText = hasHighPriceImpact
    ? `Price impact is above ${HIGH_PRICE_IMPACT_WARNING_THRESHOLD_PERCENT}%. Review the execution price before submitting.`
    : null;
  const priceImpactTextColor =
    !hasAmountInput || priceImpactPercent === null
      ? uiColors.textMuted
      : priceImpactPercent < 0.1
        ? uiColors.buyText
        : priceImpactPercent < 1
          ? uiColors.warningText
          : uiColors.dangerText;
  const executionPriceArrow =
    signedPriceImpactPercent === null || signedPriceImpactPercent === 0
      ? ''
      : signedPriceImpactPercent > 0
        ? '↑ '
        : '↓ ';
  const executionPriceDisplay =
    executionPrice === null ? '—' : `${executionPriceArrow}$${formatUiAmount(executionPrice)}`;
  const statusLabel =
    status === 'building'
      ? 'Building...'
      : status === 'signing'
        ? 'Signing...'
        : status === 'confirming'
          ? 'Confirming...'
          : amountExceedsAvailable
            ? 'Amount exceeds balance'
            : amountBelowMinimum
              ? 'Amount too small'
              : hasLowSubmitNativeSolBalance
                ? 'Add SOL to submit'
                : hasHighPriceImpact
                  ? 'Review price impact'
                  : `Submit ${side === 'buy' ? 'Buy' : 'Sell'} Order`;

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

  const handleResetChartView = useCallback(() => {
    setChartResetSignal((previous) => previous + 1);
    setCrosshairData(null);
  }, []);

  const handleLoadMoreMarketHistory = useCallback(() => {
    void loadMoreHistory();
  }, [loadMoreHistory]);

  const handleSubmitOrder = async () => {
    if (hasHighPriceImpact) {
      Alert.alert(
        'Review price impact',
        `Price impact is ${priceImpactDisplay}. Estimated execution is ${executionPriceDisplay}.`,
        [
          { style: 'cancel', text: 'Cancel' },
          {
            text: 'Submit',
            onPress: () => {
              void submitValidatedOrder();
            },
          },
        ],
      );
      return;
    }

    await submitValidatedOrder();
  };

  const submitValidatedOrder = async () => {
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

    if (amountAtoms < MIN_TRADE_AMOUNT_ATOMS) {
      setValidationError(
        `Minimum order size is ${formatAtoms(MIN_TRADE_AMOUNT_ATOMS, amountDecimals)} ${amountTokenTicker}.`,
      );
      return;
    }

    if (lowSubmitNativeSolWarning) {
      setValidationError(lowSubmitNativeSolWarning);
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
      await Promise.allSettled([baseBalance.refresh(), quoteBalance.refresh(), nativeSolBalance.refresh()]);
    }
  };

  const handleClosePosition = async (tradePosition: PublicKey) => {
    if (lowMaintenanceNativeSolWarning) {
      toast.error(lowMaintenanceNativeSolWarning);
      return;
    }
    const success = await closePosition({
      market: MARKET,
      tradePosition,
    });
    if (success) {
      await Promise.allSettled([baseBalance.refresh(), quoteBalance.refresh(), nativeSolBalance.refresh()]);
    }
  };

  const handleBatchClosePositions = async (tradePositions: PublicKey[]) => {
    if (lowMaintenanceNativeSolWarning) {
      toast.error(lowMaintenanceNativeSolWarning);
      return;
    }
    if (tradePositions.length === 0) {
      toast.error('No matching positions to close');
      return;
    }

    const success = await closePosition({
      market: MARKET,
      tradePositions,
    });
    if (success) {
      await Promise.allSettled([baseBalance.refresh(), quoteBalance.refresh(), nativeSolBalance.refresh()]);
    }
  };

  const openExplorerTransaction = useCallback(async (transactionSignature: string) => {
    const url = explorerTransactionUrl(transactionSignature);
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      toast.error('Could not open Solana Explorer');
      return;
    }
    await Linking.openURL(url);
  }, []);

  useEffect(() => {
    if (status === 'success') {
      toast.success('Order submitted', {
        action: signature
          ? {
              label: 'View tx',
              onClick: () => {
                void openExplorerTransaction(signature);
              },
            }
          : undefined,
      });
      return;
    }
    if (status === 'error' && orderError) {
      toast.error(orderError);
    }
  }, [status, orderError, signature, openExplorerTransaction]);

  useEffect(() => {
    if (closeStatus === 'success') {
      toast.success(closedCount > 1 ? 'Positions closed' : 'Position closed', {
        description: closedCount > 1 ? `${closedCount} positions were closed.` : undefined,
        action: closeSignature
          ? {
              label: 'View tx',
              onClick: () => {
                void openExplorerTransaction(closeSignature);
              },
            }
          : undefined,
      });
      return;
    }
    if (closeStatus === 'error' && closeError) {
      toast.error(closeError);
    }
  }, [closeStatus, closeError, closeSignature, closedCount, openExplorerTransaction]);

  return (
    <View className="flex-1" style={{ backgroundColor: uiColors.background }}>
      {/* Sticky market header */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="px-4 pt-4 pb-3 border-b"
        style={{ backgroundColor: uiColors.background, borderBottomColor: uiColors.divider }}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48 }} resizeMode="contain" />
          <View className="flex-row items-center">
            {selectedAccount ? (
              <Text className="text-[11px] font-medium mr-3" style={{ color: uiColors.textMuted }}>
                {selectedAccount.publicKey.toBase58().slice(0, 4)}...
                {selectedAccount.publicKey.toBase58().slice(-4)}
              </Text>
            ) : null}
            <ConnectButton variant="compact" />
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-white text-xl font-semibold tracking-tight leading-7 mr-2">
              {baseTicker}/{quoteTicker}
            </Text>
            <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
              Spot
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-white text-[26px] font-semibold leading-8" style={TABULAR_NUMS}>
              {displayPrice !== null ? `$${displayPrice.toFixed(4)}` : '—'}
            </Text>
            {priceDelta !== null && priceDeltaPercent !== null && (
              <View
                className="ml-2 px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: priceDelta >= 0 ? uiColors.successBg : uiColors.dangerBg,
                }}
              >
                <Text
                  className="text-[11px] font-semibold leading-4"
                  style={[{ color: priceDelta >= 0 ? uiColors.buyText : uiColors.dangerText }, TABULAR_NUMS]}
                >
                  {formatSignedNumber(priceDeltaPercent, 2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 12 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4 px-4">
          <View className="flex-row justify-between">
            <View className="flex-1 pr-2 border-r" style={{ borderRightColor: uiColors.divider }}>
              <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
                24h High
              </Text>
              <Text
                className="text-[14px] font-semibold mt-0.5 leading-5"
                style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
              >
                {marketStats.high === null ? '—' : `$${marketStats.high.toFixed(4)}`}
              </Text>
            </View>
            <View className="flex-1 px-2 border-r" style={{ borderRightColor: uiColors.divider }}>
              <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
                24h Low
              </Text>
              <Text
                className="text-[14px] font-semibold mt-0.5 leading-5"
                style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
              >
                {marketStats.low === null ? '—' : `$${marketStats.low.toFixed(4)}`}
              </Text>
            </View>
            <View className="flex-1 pl-2">
              <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
                24h Vol ({quoteTicker})
              </Text>
              <Text
                className="text-[14px] font-semibold mt-0.5 leading-5"
                style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
              >
                {marketStats.volumeQuote === null ? '—' : formatCompactNumber(marketStats.volumeQuote)}
              </Text>
            </View>
          </View>
        </View>

        {activeTab === 'market' && (
          <View className="mb-5">
            <View className="flex-row items-end border-b mb-3 px-4" style={{ borderBottomColor: uiColors.divider }}>
              {[
                { key: 'chart', label: 'Chart' },
                { key: 'orderBook', label: 'Order Book' },
                { key: 'trades', label: 'Trades' },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setMarketPanelTab(tab.key as MarketPanelTab)}
                  className="px-2 pb-2.5 pt-1.5 mr-4 border-b"
                  style={{ borderBottomColor: marketPanelTab === tab.key ? uiColors.primary : 'transparent' }}
                >
                  <Text
                    className="text-[15px] font-medium leading-5"
                    style={{ color: marketPanelTab === tab.key ? uiColors.primaryText : uiColors.textMuted }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {marketPanelTab === 'chart' && (
              <>
                <View className="flex-row items-center justify-between mb-3 px-4">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 mr-3">
                    <View className="flex-row items-end">
                      {CHART_TIMEFRAMES.map((option) => (
                        <Pressable
                          key={option.label}
                          onPress={() => handleTimeframeChange(option.label)}
                          className="px-2 pb-1.5 mr-3 border-b"
                          style={{
                            borderBottomColor: option.label === chartTimeframe ? uiColors.primary : 'transparent',
                          }}
                        >
                          <Text
                            className="text-[15px] font-medium leading-5"
                            style={{
                              color: option.label === chartTimeframe ? uiColors.primaryText : uiColors.textMuted,
                            }}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                  {ENABLE_ADVANCED_CHART && (
                    <Pressable
                      onPress={handleResetChartView}
                      className="px-3 py-1.5 border"
                      style={{ borderColor: uiColors.divider }}
                    >
                      <Text className="text-xs font-semibold tracking-wide" style={{ color: uiColors.textSecondary }}>
                        Reset
                      </Text>
                    </Pressable>
                  )}
                </View>

                {activeOhlcv && (
                  <View
                    className="mb-3 border-y py-2 px-4"
                    style={{ borderTopColor: uiColors.divider, borderBottomColor: uiColors.divider }}
                  >
                    <View className="flex-row justify-between">
                      <Text className="text-[11px] leading-5" style={{ color: uiColors.textSubtle }}>
                        O{' '}
                        <Text
                          className="text-xs font-semibold leading-5"
                          style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                        >
                          {activeOhlcv.open.toFixed(2)}
                        </Text>
                      </Text>
                      <Text className="text-[11px] leading-5" style={{ color: uiColors.textSubtle }}>
                        H{' '}
                        <Text
                          className="text-xs font-semibold leading-5"
                          style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                        >
                          {activeOhlcv.high.toFixed(2)}
                        </Text>
                      </Text>
                      <Text className="text-[11px] leading-5" style={{ color: uiColors.textSubtle }}>
                        L{' '}
                        <Text
                          className="text-xs font-semibold leading-5"
                          style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                        >
                          {activeOhlcv.low.toFixed(2)}
                        </Text>
                      </Text>
                      <Text className="text-[11px] leading-5" style={{ color: uiColors.textSubtle }}>
                        C{' '}
                        <Text
                          className="text-xs font-semibold leading-5"
                          style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                        >
                          {activeOhlcv.close.toFixed(2)}
                        </Text>
                      </Text>
                      <Text className="text-[11px] leading-5" style={{ color: uiColors.textSubtle }} numberOfLines={1}>
                        V{' '}
                        <Text
                          className="text-xs font-semibold leading-5"
                          style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                        >
                          {activeOhlcv.volume === null ? '—' : formatCompactNumber(activeOhlcv.volume)}
                        </Text>
                      </Text>
                    </View>
                    {activeOhlcvTimeLabel && (
                      <Text className="text-[11px] mt-1 leading-4" style={{ color: uiColors.textSubtle }}>
                        {activeOhlcvTimeLabel}
                      </Text>
                    )}
                  </View>
                )}

                {!isChartTimeframeReady ? (
                  <ActivityIndicator size="small" color={uiColors.textMuted} />
                ) : candlesLoading && chartCandles.length === 0 && tradingViewCandles.length === 0 ? (
                  <ActivityIndicator size="small" color={uiColors.textMuted} />
                ) : chartCandles.length === 0 && tradingViewCandles.length === 0 ? (
                  <Text className="text-sm" style={{ color: uiColors.textSubtle }}>
                    Not enough market updates to render chart yet.
                  </Text>
                ) : (
                  <View className="overflow-hidden relative" style={{ backgroundColor: uiColors.chartBackground }}>
                    {ENABLE_ADVANCED_CHART ? (
                      <TradingViewChart
                        data={tradingViewCandles}
                        lastCandle={latestTradingViewCandle}
                        onCrosshairMove={setCrosshairData}
                        onRequestMoreHistory={handleLoadMoreMarketHistory}
                        resetSignal={chartResetSignal}
                        hasMoreHistory={hasMoreHistory}
                        loadingMoreHistory={loadingMoreHistory}
                        height={320}
                      />
                    ) : (
                      <CandleChart data={chartCandles} height={250} />
                    )}
                    {isSwitchingTimeframe && (
                      <View
                        className="absolute inset-0 items-center justify-center"
                        style={{ backgroundColor: uiColors.overlay }}
                      >
                        <Text className="text-xs" style={{ color: uiColors.textSecondary }}>
                          Switching timeframe...
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {marketPanelTab === 'orderBook' && (
              <View className="px-4 py-3">
                <OrderBookTable
                  baseDecimals={baseDecimals}
                  baseTicker={baseTicker}
                  currentSlot={currentSlot}
                  isLoading={orderBookPositions.loading}
                  positions={orderBookPositions.positions}
                  quoteDecimals={quoteDecimals}
                  quoteTicker={quoteTicker}
                  streamingState={streamingState}
                />
                {orderBookPositions.error && (
                  <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
                    {orderBookPositions.error}
                  </Text>
                )}
              </View>
            )}

            {marketPanelTab === 'trades' && (
              <View className="px-4 py-5" style={{ backgroundColor: uiColors.panel }}>
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
                    marketHistorySeed={marketEvents}
                  />
                ) : (
                  <Text className="text-sm leading-6 py-3" style={{ color: uiColors.textMuted }}>
                    Connect wallet to view recent trades.
                  </Text>
                )}
              </View>
            )}

            {marketEventsError && (
              <Text className="text-sm leading-5 mt-2 px-4" style={{ color: uiColors.dangerText }}>
                {marketEventsError}
              </Text>
            )}
            {candlesError && (
              <Text className="text-sm leading-5 mt-2 px-4" style={{ color: uiColors.dangerText }}>
                {candlesError}
              </Text>
            )}
            {marketPriceError && (
              <Text className="text-sm leading-5 mt-2 px-4" style={{ color: uiColors.dangerText }}>
                {marketPriceError}
              </Text>
            )}
          </View>
        )}

        {activeTab === 'trade' && (
          <View className="px-4 pt-5 pb-4" style={{ backgroundColor: uiColors.surface }}>
            <Text className="text-white text-xl font-semibold leading-7 tracking-tight mb-3">Create Order</Text>

            {lowSubmitNativeSolWarning && (
              <View
                className="rounded-xl border px-3 py-3 mb-4"
                style={{ backgroundColor: uiColors.warningBg, borderColor: uiColors.warningBorder }}
              >
                <Text className="text-sm leading-5" style={{ color: uiColors.warningText }}>
                  {lowSubmitNativeSolWarning}
                </Text>
              </View>
            )}

            <View
              className="flex-row rounded-xl p-1 mb-4"
              style={{ backgroundColor: uiColors.panelSoft, borderWidth: 1, borderColor: uiColors.border }}
            >
              <Pressable
                onPress={() => handleSideChange('buy')}
                className="flex-1 py-3.5 rounded-lg items-center"
                style={{ backgroundColor: side === 'buy' ? uiColors.buy : 'transparent' }}
              >
                <Text
                  className="text-base font-semibold leading-5"
                  style={{ color: side === 'buy' ? uiColors.textPrimary : uiColors.textSubtle }}
                >
                  Buy
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSideChange('sell')}
                className="flex-1 py-3.5 rounded-lg items-center"
                style={{ backgroundColor: side === 'sell' ? uiColors.sell : 'transparent' }}
              >
                <Text
                  className="text-base font-semibold leading-5"
                  style={{ color: side === 'sell' ? uiColors.textPrimary : uiColors.textSubtle }}
                >
                  Sell
                </Text>
              </Pressable>
            </View>

            <View className="mb-4 pb-4 border-b" style={{ borderBottomColor: uiColors.divider }}>
              <Text
                className="text-[10px] font-semibold mb-1 leading-4"
                style={[{ color: uiColors.textSubtle }, OVERLINE]}
              >
                Available
              </Text>
              {selectedAccount && availableAmountLoading ? (
                <ActivityIndicator size="small" color={uiColors.textMuted} />
              ) : (
                <Text className="text-white text-[24px] font-semibold leading-9 tracking-tight" style={TABULAR_NUMS}>
                  {formatUiAmount(availableAmountDisplay)} {amountTokenTicker}
                </Text>
              )}
            </View>

            <View className="mb-4 pb-4 border-b" style={{ borderBottomColor: uiColors.divider }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className="text-[10px] font-semibold leading-4"
                  style={[{ color: uiColors.textSubtle }, OVERLINE]}
                >
                  Order size ({amountTokenTicker})
                </Text>
                <Pressable
                  onPress={() => handleSliderChange(100)}
                  disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
                  className="px-3.5 py-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      !availableAmountAtoms || availableAmountAtoms <= 0n ? uiColors.disabledBg : uiColors.primarySoft,
                  }}
                >
                  <Text className="text-[12px] font-semibold leading-4" style={{ color: uiColors.textSecondary }}>
                    Max
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={amountInput}
                onChangeText={handleAmountChange}
                placeholder={`0.00 ${amountTokenTicker}`}
                placeholderTextColor={uiColors.textSubtle}
                keyboardType="decimal-pad"
                className="rounded-xl border px-4 py-3.5 text-white text-[22px] font-semibold leading-9"
                style={[{ borderColor: uiColors.border, backgroundColor: uiColors.panel }, TABULAR_NUMS]}
              />
              <Text className="text-sm leading-5 mt-3" style={{ color: uiColors.textSubtle }}>
                Estimated receive:{' '}
                <Text
                  className="font-semibold"
                  style={[{ color: hasAmountInput ? uiColors.textSecondary : uiColors.textMuted }, TABULAR_NUMS]}
                >
                  {estimatedConversionText}
                </Text>
              </Text>
              <Text className="text-sm leading-5 mt-1.5" style={{ color: uiColors.textSubtle }}>
                Price impact:{' '}
                <Text className="font-semibold" style={[{ color: priceImpactTextColor }, TABULAR_NUMS]}>
                  {priceImpactDisplay}
                </Text>{' '}
                <Text
                  className="font-semibold"
                  style={[
                    { color: executionPriceDisplay === '—' ? uiColors.textMuted : uiColors.textSecondary },
                    TABULAR_NUMS,
                  ]}
                >
                  ({executionPriceDisplay})
                </Text>
              </Text>
              <View className="mt-4">
                <View className="flex-row items-center justify-between mb-2.5">
                  <Text
                    className="text-[10px] font-semibold leading-4"
                    style={[{ color: uiColors.textSubtle }, OVERLINE]}
                  >
                    Use balance
                  </Text>
                  <Text className="text-sm font-medium leading-5" style={[{ color: uiColors.textMuted }, TABULAR_NUMS]}>
                    {sliderValue.toFixed(2)}%
                  </Text>
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
                      className="px-3.5 py-2 rounded-full border mr-2"
                      style={{
                        borderColor:
                          !availableAmountAtoms || availableAmountAtoms <= 0n ? uiColors.border : uiColors.primarySoft,
                        backgroundColor:
                          !availableAmountAtoms || availableAmountAtoms <= 0n
                            ? uiColors.panelSoft
                            : uiColors.primarySoft,
                      }}
                    >
                      <Text
                        className="text-sm font-medium leading-5"
                        style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                      >
                        {percent}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View className="mb-4">
              <Text
                className="text-[10px] font-semibold mb-2 leading-4"
                style={[{ color: uiColors.textSubtle }, OVERLINE]}
              >
                Duration
              </Text>
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.textMuted }}>
                Choose how long the order will stream.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row">
                  {DURATION_OPTIONS.map((option) => (
                    <Pressable
                      key={option.seconds}
                      onPress={() => {
                        setDurationSeconds(option.seconds);
                        setValidationError(null);
                      }}
                      className="px-4 py-2.5 rounded-full border mr-2"
                      style={{
                        backgroundColor: option.seconds === durationSeconds ? uiColors.primary : uiColors.panel,
                        borderColor: option.seconds === durationSeconds ? uiColors.primaryPress : uiColors.border,
                      }}
                    >
                      <Text
                        className="text-base font-medium leading-5"
                        style={{
                          color: option.seconds === durationSeconds ? uiColors.primaryText : uiColors.textMuted,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {configLoading && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.textMuted }}>
                Loading market config...
              </Text>
            )}
            {configError && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.dangerText }}>
                {configError}
              </Text>
            )}
            {amountExceedsAvailable && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.dangerText }}>
                Amount exceeds available balance.
              </Text>
            )}
            {amountBelowMinimum && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.dangerText }}>
                Minimum order size is {formatAtoms(MIN_TRADE_AMOUNT_ATOMS, amountDecimals)} {amountTokenTicker}.
              </Text>
            )}
            {priceImpactWarningText && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.warningText }}>
                {priceImpactWarningText}
              </Text>
            )}
            {validationError && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.dangerText }}>
                {validationError}
              </Text>
            )}

            {selectedAccount ? (
              <Pressable
                onPress={handleSubmitOrder}
                disabled={submitDisabled}
                className="rounded-xl py-4.5 items-center"
                style={{
                  backgroundColor: submitDisabled ? uiColors.disabledBg : side === 'buy' ? uiColors.buy : uiColors.sell,
                }}
              >
                <Text className="text-white font-semibold text-lg leading-6">{statusLabel}</Text>
              </Pressable>
            ) : (
              <ConnectButton />
            )}
          </View>
        )}

        {activeTab === 'positions' && selectedAccount && (
          <View
            className="border-t border-b px-4 py-5 mt-4"
            style={{
              backgroundColor: uiColors.surface,
              borderTopColor: uiColors.border,
              borderBottomColor: uiColors.border,
            }}
          >
            <View className="flex-row items-end border-b mb-4" style={{ borderBottomColor: uiColors.divider }}>
              {[
                { key: 'active', label: `Positions (${positions.length})` },
                { key: 'closed', label: 'Closed' },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setPositionPanelTab(tab.key as PositionPanelTab)}
                  className="px-2 pb-2.5 pt-1.5 mr-4 border-b"
                  style={{ borderBottomColor: positionPanelTab === tab.key ? uiColors.primary : 'transparent' }}
                >
                  <Text
                    className="text-[15px] font-medium leading-5"
                    style={{ color: positionPanelTab === tab.key ? uiColors.primaryText : uiColors.textMuted }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {lowMaintenanceNativeSolWarning && positionPanelTab === 'active' && (
              <View
                className="rounded-xl border px-3 py-3 mb-4"
                style={{ backgroundColor: uiColors.warningBg, borderColor: uiColors.warningBorder }}
              >
                <Text className="text-sm leading-5" style={{ color: uiColors.warningText }}>
                  {lowMaintenanceNativeSolWarning}
                </Text>
              </View>
            )}

            {positionPanelTab === 'active' && positions.length > 1 && (
              <View className="flex-row mb-4">
                <Pressable
                  onPress={() => handleBatchClosePositions(endedBatchPositions.map((position) => position.publicKey))}
                  disabled={isClosing || endedBatchPositions.length === 0}
                  className="flex-1 rounded-xl border py-3 items-center mr-2"
                  style={{
                    backgroundColor:
                      endedBatchPositions.length === 0 || isClosing ? uiColors.panelSoft : uiColors.dangerBg,
                    borderColor:
                      endedBatchPositions.length === 0 || isClosing ? uiColors.border : uiColors.dangerBorder,
                  }}
                >
                  <Text className="text-sm font-semibold leading-5" style={{ color: uiColors.dangerText }}>
                    Close ended{' '}
                    {endedBatchPositions.length > 0 ? `(${endedBatchPositions.length}/${endedPositions.length})` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleBatchClosePositions(allBatchPositions.map((position) => position.publicKey))}
                  disabled={isClosing || allBatchPositions.length === 0}
                  className="flex-1 rounded-xl border py-3 items-center ml-2"
                  style={{
                    backgroundColor:
                      allBatchPositions.length === 0 || isClosing ? uiColors.panelSoft : uiColors.dangerBg,
                    borderColor: allBatchPositions.length === 0 || isClosing ? uiColors.border : uiColors.dangerBorder,
                  }}
                >
                  <Text className="text-sm font-semibold leading-5" style={{ color: uiColors.dangerText }}>
                    Close all ({allBatchPositions.length}/{positions.length})
                  </Text>
                </Pressable>
              </View>
            )}

            {positionPanelTab === 'active' ? (
              <>
                {positionsLoading ? (
                  <ActivityIndicator size="small" color={uiColors.textMuted} />
                ) : positions.length === 0 ? (
                  <Text className="text-sm leading-5" style={{ color: uiColors.textSubtle }}>
                    No active positions.
                  </Text>
                ) : (
                  <View>
                    {activePositionsNewestFirst.map((position) => (
                      <ActivePositionCard
                        key={position.publicKey.toBase58()}
                        market={MARKET}
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

                {streamingStateError && (
                  <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
                    {streamingStateError}
                  </Text>
                )}
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
                marketHistorySeed={marketEvents}
              />
            )}
          </View>
        )}
        {activeTab === 'positions' && !selectedAccount && (
          <View
            className="mx-4 mt-4 rounded-xl border p-5"
            style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
          >
            <Text className="text-lg font-semibold leading-6" style={{ color: uiColors.textPrimary }}>
              Positions
            </Text>
            <Text className="mt-2 text-sm leading-5" style={{ color: uiColors.textSubtle }}>
              Connect your wallet to load active and closed positions.
            </Text>
            <View className="mt-4">
              <ConnectButton />
            </View>
          </View>
        )}
      </ScrollView>
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
}

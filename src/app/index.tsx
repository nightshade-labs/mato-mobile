import { useCallback, useEffect, useMemo, useState } from 'react';
// StatusBar is configured in _layout.tsx
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Modal,
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
import { useClosePositionEvents } from '../integrations/supabase/useClosePositionEvents';
import { ConnectButton } from '../components/ConnectButton';
import { PercentageSlider } from '../components/PercentageSlider';
import { ClosedPositionsList } from '../components/ClosedPositionsList';
import { ActivePositionCard } from '../components/ActivePositionCard';
import { CandleChart } from '../components/CandleChart';
import {
  TradingViewChart,
  type TradingViewCandle,
  type TradingViewDisplayMode,
  type TradingViewPositionOverlay,
} from '../components/TradingViewChart';
import { OrderBookTable } from '../components/OrderBookTable';
import { ChartCandlestickIcon, ChartLineIcon, ListOrderedIcon, RefreshIcon, XIcon } from '../components/NativeIcons';
import { clampPage, getPageCount, getPageItems, PositionPagination } from '../components/PositionPagination';
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
  SLOT_DURATION_MS,
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
const BOOKKEEPING_PRECISION_FACTOR = 1_000_000_000_000_000n;
const FLOW_PRECISION_FACTOR = 1_000_000_000n;

const ENABLE_ADVANCED_CHART = process.env.EXPO_PUBLIC_ENABLE_ADVANCED_CHART !== 'false';
const CHART_TIMEFRAME_STORAGE_KEY = 'mato_mobile_chart_timeframe';
const POSITION_PAGE_SIZE = 10;
const CHART_POSITION_CLOSED_LIMIT = 1000;

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

function clampToRange(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function computeUnitPrice(
  quoteAtoms: bigint,
  quoteDecimals: number,
  baseAtoms: bigint,
  baseDecimals: number,
): number | null {
  if (baseAtoms <= 0n) return null;
  const quoteUi = Number(quoteAtoms) / 10 ** quoteDecimals;
  const baseUi = Number(baseAtoms) / 10 ** baseDecimals;
  if (!Number.isFinite(quoteUi) || !Number.isFinite(baseUi) || baseUi <= 0) return null;
  const price = quoteUi / baseUi;
  return Number.isFinite(price) && price > 0 ? price : null;
}

function estimateTimeMsForSlot(candles: TradingViewCandle[], slot: number, intervalMs: number): number | null {
  const anchors = candles
    .flatMap((candle) => {
      const startSlot = typeof candle.startSlot === 'number' ? candle.startSlot : null;
      const endSlot = typeof candle.endSlot === 'number' ? candle.endSlot : null;
      const startTimeMs = candle.time * 1000;
      const entries: { slot: number; timeMs: number }[] = [];
      if (startSlot !== null) entries.push({ slot: startSlot, timeMs: startTimeMs });
      if (endSlot !== null) entries.push({ slot: endSlot, timeMs: startTimeMs + Math.max(0, intervalMs - 1) });
      return entries;
    })
    .filter((anchor) => Number.isFinite(anchor.slot) && Number.isFinite(anchor.timeMs) && anchor.timeMs > 0)
    .sort((left, right) => left.slot - right.slot);

  if (!Number.isFinite(slot) || anchors.length === 0) return null;
  const normalizedSlot = Math.floor(slot);
  const upperIndex = anchors.findIndex((anchor) => anchor.slot >= normalizedSlot);

  if (upperIndex >= 0 && anchors[upperIndex].slot === normalizedSlot) {
    return anchors[upperIndex].timeMs;
  }

  const estimateDuration = (left: { slot: number; timeMs: number }, right: { slot: number; timeMs: number }) => {
    const slotDelta = right.slot - left.slot;
    if (slotDelta === 0) return SLOT_DURATION_MS;
    const duration = (right.timeMs - left.timeMs) / slotDelta;
    return Number.isFinite(duration) && duration > 0 ? duration : SLOT_DURATION_MS;
  };

  if (upperIndex < 0) {
    const last = anchors[anchors.length - 1];
    const previous = anchors[anchors.length - 2];
    const duration = previous ? estimateDuration(previous, last) : SLOT_DURATION_MS;
    return last.timeMs + (normalizedSlot - last.slot) * duration;
  }

  if (upperIndex > 0) {
    const lower = anchors[upperIndex - 1];
    const upper = anchors[upperIndex];
    return lower.timeMs + (normalizedSlot - lower.slot) * estimateDuration(lower, upper);
  }

  const upper = anchors[upperIndex];
  const next = anchors[upperIndex + 1];
  const duration = next ? estimateDuration(upper, next) : SLOT_DURATION_MS;
  return upper.timeMs - (upper.slot - normalizedSlot) * duration;
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
  const { state: streamingState, error: streamingStateError } = useStreamingMarketState(MARKET);
  const nativeSolBalance = useSolBalance();
  const orderBookPositions = useMarketTradePositions(MARKET);
  const { events: marketEvents, error: marketEventsError } = useMarketUpdates({
    marketId: MARKET_ID,
    limit: DEFAULT_MARKET_UPDATES_LIMIT,
  });
  const [side, setSide] = useState<OrderSide>('buy');
  const [amountInput, setAmountInput] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(30 * 60);
  const [isMarketPanelOpen, setIsMarketPanelOpen] = useState(false);
  const [marketPanelTab, setMarketPanelTab] = useState<MarketPanelTab>('chart');
  const [positionPanelTab, setPositionPanelTab] = useState<PositionPanelTab>('active');
  const [activePositionPage, setActivePositionPage] = useState(0);
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('1h');
  const [chartDisplayMode, setChartDisplayMode] = useState<TradingViewDisplayMode>('candles');
  const [chartResetSignal, setChartResetSignal] = useState(0);
  const [isChartTimeframeReady, setIsChartTimeframeReady] = useState(false);
  const [isSwitchingTimeframe, setIsSwitchingTimeframe] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { events: closedPositionEvents } = useClosePositionEvents({
    positionAuthority,
    marketId: MARKET_ID,
    limit: CHART_POSITION_CLOSED_LIMIT,
  });

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

  const amountUiValue = useMemo(() => {
    if (!amountAtoms || amountAtoms <= 0n) return null;
    return Number(amountAtoms) / 10 ** amountDecimals;
  }, [amountAtoms, amountDecimals]);
  const hasAmountInput = amountUiValue !== null && amountUiValue > 0;
  const activePositionsNewestFirst = useMemo(() => [...positions].sort((a, b) => b.id.cmp(a.id)), [positions]);
  const activePositionPageCount = getPageCount(activePositionsNewestFirst.length, POSITION_PAGE_SIZE);
  const normalizedActivePositionPage = clampPage(
    activePositionPage,
    activePositionsNewestFirst.length,
    POSITION_PAGE_SIZE,
  );
  const paginatedActivePositions = useMemo(
    () =>
      getPageItems({
        items: activePositionsNewestFirst,
        page: normalizedActivePositionPage,
        pageSize: POSITION_PAGE_SIZE,
      }),
    [activePositionsNewestFirst, normalizedActivePositionPage],
  );
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
  const chartPositionOverlays = useMemo<TradingViewPositionOverlay[]>(() => {
    if (!config || tradingViewCandles.length === 0) return [];
    const timeframe = CHART_TIMEFRAMES.find((option) => option.label === chartTimeframe);
    const intervalMs = timeframe?.intervalMs ?? 60_000;

    const activeOverlays = activePositionsNewestFirst.flatMap((position): TradingViewPositionOverlay[] => {
      const amountAtoms = BigInt(position.amount.toString());
      if (amountAtoms <= 0n) return [];

      const isBuy = position.isBuy;
      const depositedToken = isBuy ? quoteTicker : baseTicker;
      const depositedDecimals = isBuy ? quoteDecimals : baseDecimals;
      const startSlot = toNumber(position.startSlot);
      const endSlot = toNumber(position.endSlot);
      if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) return [];

      const durationSlots = Math.max(1, endSlot - startSlot);
      const currentLineSlot = currentSlot === null ? endSlot : Math.min(Math.max(currentSlot, startSlot), endSlot);
      const startTimeMs = estimateTimeMsForSlot(tradingViewCandles, startSlot, intervalMs);
      const endTimeMs = estimateTimeMsForSlot(tradingViewCandles, currentLineSlot, intervalMs);
      if (startTimeMs === null || endTimeMs === null) return [];

      const scaledFlowAtomsPerSlot = (amountAtoms * FLOW_PRECISION_FACTOR) / BigInt(durationSlots);
      const currentProgressSlot = currentSlot === null ? startSlot : clampToRange(currentSlot, startSlot, endSlot);
      const elapsedSlots = clampToRange(currentProgressSlot - startSlot, 0, durationSlots);
      const scaledConsumedAtoms = BigInt(elapsedSlots) * scaledFlowAtomsPerSlot;
      const consumedAtoms = scaledConsumedAtoms / FLOW_PRECISION_FACTOR;

      let averagePrice = displayPrice;
      if (streamingState && consumedAtoms > 0n) {
        const bookkeepingSnapshot = BigInt(position.bookkeepingSnapshot.toString());
        const liveBookkeeping = isBuy ? streamingState.bookkeepingBasePerQuote : streamingState.bookkeepingQuotePerBase;
        const liveBookkeepingDelta = liveBookkeeping > bookkeepingSnapshot ? liveBookkeeping - bookkeepingSnapshot : 0n;
        let staleAccumulator = 0n;
        const staleSlots = Math.max(0, currentProgressSlot - streamingState.bookkeepingLastUpdateSlot);

        if (staleSlots > 0) {
          const staleSlotCount = BigInt(staleSlots);
          if (isBuy && streamingState.marketQuoteFlow > 0n) {
            staleAccumulator =
              (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketBaseFlow * staleSlotCount) /
              streamingState.marketQuoteFlow;
          } else if (!isBuy && streamingState.marketBaseFlow > 0n) {
            staleAccumulator =
              (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketQuoteFlow * staleSlotCount) /
              streamingState.marketBaseFlow;
          }
        }

        const liveAccumulatedPrice = liveBookkeepingDelta + staleAccumulator;
        const swappedEstimateAtoms =
          (scaledFlowAtomsPerSlot * liveAccumulatedPrice) / (FLOW_PRECISION_FACTOR * BOOKKEEPING_PRECISION_FACTOR);
        const computedAverage = isBuy
          ? computeUnitPrice(consumedAtoms, quoteDecimals, swappedEstimateAtoms, baseDecimals)
          : computeUnitPrice(swappedEstimateAtoms, quoteDecimals, consumedAtoms, baseDecimals);
        averagePrice = computedAverage ?? averagePrice;
      }

      if (averagePrice === null || !Number.isFinite(averagePrice) || averagePrice <= 0) return [];

      return [
        {
          averagePrice,
          endTime: Math.floor(endTimeMs / 1000),
          id: `active-${position.publicKey.toBase58()}`,
          label: `${isBuy ? 'Buy' : 'Sell'} ${formatAtoms(amountAtoms, depositedDecimals)} ${depositedToken}`,
          side: isBuy ? 'buy' : 'sell',
          startTime: Math.floor(startTimeMs / 1000),
          status: currentSlot === null || currentSlot < endSlot ? 'active' : 'closed',
        },
      ];
    });

    const closedOverlays = closedPositionEvents.flatMap((event): TradingViewPositionOverlay[] => {
      if (event.start_slot === null || event.end_slot === null) return [];

      const isBuy = event.is_buy === 1;
      const depositToken = isBuy ? quoteTicker : baseTicker;
      const depositDecimals = isBuy ? quoteDecimals : baseDecimals;
      const consumedAtoms =
        event.deposit_amount > event.remaining_amount ? event.deposit_amount - event.remaining_amount : 0n;
      if (consumedAtoms <= 0n || event.swapped_amount <= 0n) return [];

      const grossQuoteAtoms = isBuy ? consumedAtoms : event.swapped_amount;
      const grossBaseAtoms = isBuy ? event.swapped_amount : consumedAtoms;
      const averagePrice = computeUnitPrice(grossQuoteAtoms, quoteDecimals, grossBaseAtoms, baseDecimals);
      if (averagePrice === null) return [];

      const lineEndSlot = Math.min(event.end_slot, event.slot);
      const startTimeMs = estimateTimeMsForSlot(tradingViewCandles, event.start_slot, intervalMs);
      const endTimeMs = estimateTimeMsForSlot(tradingViewCandles, lineEndSlot, intervalMs);
      if (startTimeMs === null || endTimeMs === null) return [];

      return [
        {
          averagePrice,
          endTime: Math.floor(endTimeMs / 1000),
          id: `closed-${event.id}`,
          label: `${isBuy ? 'Buy' : 'Sell'} ${formatAtoms(consumedAtoms, depositDecimals)} ${depositToken}`,
          side: isBuy ? 'buy' : 'sell',
          startTime: Math.floor(startTimeMs / 1000),
          status: 'closed',
        },
      ];
    });

    return [...activeOverlays, ...closedOverlays].sort((left, right) => {
      if (left.startTime === right.startTime) return left.averagePrice - right.averagePrice;
      return left.startTime - right.startTime;
    });
  }, [
    activePositionsNewestFirst,
    baseDecimals,
    baseTicker,
    chartTimeframe,
    closedPositionEvents,
    config,
    currentSlot,
    displayPrice,
    quoteDecimals,
    quoteTicker,
    streamingState,
    tradingViewCandles,
  ]);

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
  const minimumAmountDisplay = formatAtoms(MIN_TRADE_AMOUNT_ATOMS, amountDecimals);
  const amountValidationMessage = amountExceedsAvailable
    ? 'Amount exceeds available balance.'
    : amountBelowMinimum
      ? `Minimum order size is ${minimumAmountDisplay} ${amountTokenTicker}.`
      : null;
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
    if (!isChartTimeframeReady) return;
    setIsSwitchingTimeframe(true);
    const timeout = setTimeout(() => setIsSwitchingTimeframe(false), 220);
    return () => clearTimeout(timeout);
  }, [chartTimeframe, isChartTimeframeReady]);

  useEffect(() => {
    setActivePositionPage((current) => clampPage(current, activePositionsNewestFirst.length, POSITION_PAGE_SIZE));
  }, [activePositionsNewestFirst.length]);

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
          <Image
            source={require('../../assets/mato-icon.png')}
            style={{ width: 48, height: 48 }}
            resizeMode="contain"
          />
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
            <Text className="text-[26px] font-semibold leading-8" style={[{ color: uiColors.accent }, TABULAR_NUMS]}>
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

        <View className="mt-3 flex-row justify-end">
          <Pressable
            onPress={() => setIsMarketPanelOpen(true)}
            className="rounded-full border px-2.5 py-1.5"
            style={{
              backgroundColor: uiColors.panelSoft,
              borderColor: uiColors.border,
            }}
          >
            <View className="flex-row items-center">
              {marketPanelTab === 'chart' ? (
                <ChartCandlestickIcon color={uiColors.textSecondary} size={13} />
              ) : (
                <ListOrderedIcon color={uiColors.textSecondary} size={13} />
              )}
              <Text className="ml-1 text-xs font-semibold leading-4" style={{ color: uiColors.textSecondary }}>
                {marketPanelTab === 'chart' ? 'Chart' : 'Orders'}
              </Text>
            </View>
          </Pressable>
        </View>
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 12 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Modal
          animationType="slide"
          onRequestClose={() => setIsMarketPanelOpen(false)}
          transparent
          visible={isMarketPanelOpen}
        >
          <View className="flex-1 justify-end" style={{ backgroundColor: uiColors.overlay }}>
            <Pressable className="flex-1" onPress={() => setIsMarketPanelOpen(false)} />
            <View
              className="rounded-t-xl border px-4 pt-3 pb-5"
              style={{
                backgroundColor: uiColors.drawerSurface,
                borderColor: uiColors.border,
                maxHeight: '88%',
              }}
            >
              <View className="mx-auto mb-4 h-1.5 w-12 rounded-full" style={{ backgroundColor: uiColors.textSubtle }} />
              <View className="mb-4 flex-row items-start justify-between pr-10">
                <View>
                  <Text className="text-base font-semibold leading-5" style={{ color: uiColors.textPrimary }}>
                    {baseTicker}/{quoteTicker}
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    <Text className="text-sm leading-5" style={[{ color: uiColors.accent }, TABULAR_NUMS]}>
                      {displayPrice !== null ? `$${displayPrice.toFixed(4)}` : '—'}
                    </Text>
                    {priceDelta !== null && priceDeltaPercent !== null && (
                      <View
                        className="ml-2 px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: priceDelta >= 0 ? uiColors.successBg : uiColors.dangerBg,
                          borderColor: priceDelta >= 0 ? uiColors.successBorder : uiColors.dangerBorder,
                          borderWidth: 1,
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
                <Pressable
                  onPress={() => setIsMarketPanelOpen(false)}
                  className="absolute right-0 top-0 h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: uiColors.panelSoft }}
                >
                  <XIcon color={uiColors.textSecondary} size={16} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center mb-4">
                  {[
                    { key: 'chart', label: 'Chart', Icon: ChartCandlestickIcon },
                    { key: 'orderBook', label: 'Orders', Icon: ListOrderedIcon },
                  ].map((tab) => {
                    const isActive = marketPanelTab === tab.key;
                    const iconColor = isActive ? uiColors.primaryText : uiColors.textMuted;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() => setMarketPanelTab(tab.key as MarketPanelTab)}
                        className="rounded-full border px-2.5 py-1.5 mr-2"
                        style={{
                          backgroundColor: isActive ? uiColors.primary : uiColors.panelSoft,
                          borderColor: isActive ? uiColors.primaryPress : uiColors.border,
                        }}
                      >
                        <View className="flex-row items-center">
                          <tab.Icon color={iconColor} size={13} />
                          <Text
                            className="ml-1 text-xs font-semibold leading-4"
                            style={{ color: isActive ? uiColors.primaryText : uiColors.textMuted }}
                          >
                            {tab.label}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {marketPanelTab === 'chart' && (
                  <>
                    <View className="flex-row items-center justify-between mb-3">
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 mr-3">
                        <View className="flex-row">
                          {CHART_TIMEFRAMES.map((option) => {
                            const isActive = option.label === chartTimeframe;
                            return (
                              <Pressable
                                key={option.label}
                                onPress={() => handleTimeframeChange(option.label)}
                                className="rounded-full border px-2.5 py-1.5 mr-2"
                                style={{
                                  backgroundColor: isActive ? uiColors.primary : uiColors.panelSoft,
                                  borderColor: isActive ? uiColors.primaryPress : uiColors.border,
                                }}
                              >
                                <Text
                                  className="text-sm font-semibold leading-5"
                                  style={{ color: isActive ? uiColors.primaryText : uiColors.textMuted }}
                                >
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                      {ENABLE_ADVANCED_CHART && (
                        <Pressable
                          onPress={handleResetChartView}
                          className="rounded-full border px-2.5 py-1.5"
                          style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.border }}
                        >
                          <View className="flex-row items-center">
                            <RefreshIcon color={uiColors.textSecondary} size={13} />
                            <Text
                              className="ml-1 text-xs font-semibold leading-4"
                              style={{ color: uiColors.textSecondary }}
                            >
                              Reset
                            </Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                    {ENABLE_ADVANCED_CHART && (
                      <View
                        className="self-start flex-row rounded-full border p-0.5 mb-3"
                        style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.border }}
                      >
                        {[
                          { label: 'Candles', mode: 'candles' as const, Icon: ChartCandlestickIcon },
                          { label: 'Line', mode: 'line' as const, Icon: ChartLineIcon },
                        ].map(({ label, mode, Icon }) => {
                          const isActive = chartDisplayMode === mode;
                          return (
                            <Pressable
                              key={mode}
                              onPress={() => setChartDisplayMode(mode)}
                              className="h-6 rounded-full px-2.5 items-center justify-center"
                              style={{ backgroundColor: isActive ? uiColors.primary : 'transparent' }}
                            >
                              <View className="flex-row items-center">
                                <Icon color={isActive ? uiColors.primaryText : uiColors.textMuted} size={12} />
                                <Text
                                  className="ml-1 text-xs font-medium leading-4"
                                  style={{ color: isActive ? uiColors.primaryText : uiColors.textMuted }}
                                >
                                  {label}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
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
                      <View
                        className="overflow-hidden relative rounded-xl"
                        style={{ backgroundColor: uiColors.chartBackground }}
                      >
                        {ENABLE_ADVANCED_CHART ? (
                          <TradingViewChart
                            data={tradingViewCandles}
                            displayMode={chartDisplayMode}
                            positionOverlays={chartPositionOverlays}
                            lastCandle={latestTradingViewCandle}
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
                    />
                    {orderBookPositions.error && (
                      <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
                        {orderBookPositions.error}
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
              </ScrollView>
            </View>
          </View>
        </Modal>

        {lowSubmitNativeSolWarning && (
          <View
            className="mx-4 mb-4 rounded-xl border px-3 py-3"
            style={{ backgroundColor: uiColors.warningBg, borderColor: uiColors.warningBorder }}
          >
            <Text className="text-sm leading-5" style={{ color: uiColors.warningText }}>
              {lowSubmitNativeSolWarning}
            </Text>
          </View>
        )}

        <View className="mx-4 pt-5 pb-4">
          <View
            className="rounded-xl border px-4 py-5"
            style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
          >
            <View
              className="flex-row rounded-xl border p-1 mb-5"
              style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.border }}
            >
              <Pressable
                onPress={() => handleSideChange('buy')}
                className="h-9 flex-1 rounded-lg items-center justify-center"
                style={{ backgroundColor: side === 'buy' ? uiColors.primary : 'transparent' }}
              >
                <Text
                  className="text-sm font-semibold leading-5"
                  style={{ color: side === 'buy' ? uiColors.primaryText : uiColors.textMuted }}
                >
                  Buy
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSideChange('sell')}
                className="h-9 flex-1 rounded-lg items-center justify-center"
                style={{ backgroundColor: side === 'sell' ? uiColors.primary : 'transparent' }}
              >
                <Text
                  className="text-sm font-semibold leading-5"
                  style={{ color: side === 'sell' ? uiColors.primaryText : uiColors.textMuted }}
                >
                  Sell
                </Text>
              </Pressable>
            </View>

            <View
              className="rounded-xl border p-4 mb-5"
              style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.border }}
            >
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-[11px] leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
                    Order size
                  </Text>
                  <View className="mt-1 flex-row flex-wrap">
                    <Text className="text-sm leading-5 mr-3" style={{ color: uiColors.textMuted }}>
                      Available{' '}
                      <Text style={TABULAR_NUMS}>
                        {selectedAccount && availableAmountLoading ? '...' : formatUiAmount(availableAmountDisplay)}
                      </Text>{' '}
                      {amountTokenTicker}
                    </Text>
                    <Text className="text-sm leading-5" style={{ color: uiColors.textMuted }}>
                      Minimum <Text style={TABULAR_NUMS}>{minimumAmountDisplay}</Text> {amountTokenTicker}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleSliderChange(100)}
                  disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
                  className="h-6 rounded-full border px-3 items-center justify-center"
                  style={{
                    backgroundColor: uiColors.panel,
                    borderColor:
                      !availableAmountAtoms || availableAmountAtoms <= 0n ? uiColors.border : uiColors.primarySoft,
                    opacity: !availableAmountAtoms || availableAmountAtoms <= 0n ? 0.55 : 1,
                  }}
                >
                  <Text className="text-xs font-medium leading-4" style={{ color: uiColors.textSecondary }}>
                    Use max
                  </Text>
                </Pressable>
              </View>

              <View
                className="rounded-xl border p-2"
                style={{
                  backgroundColor: amountValidationMessage ? uiColors.dangerBg : uiColors.panel,
                  borderColor: amountValidationMessage ? uiColors.dangerBorder : uiColors.border,
                }}
              >
                <View className="flex-row items-center">
                  <TextInput
                    value={amountInput}
                    onChangeText={handleAmountChange}
                    placeholder="0.00"
                    placeholderTextColor={uiColors.textSubtle}
                    keyboardType="decimal-pad"
                    className="h-14 flex-1 px-3 text-white text-2xl font-semibold leading-8"
                    style={TABULAR_NUMS}
                  />
                  <View
                    className="shrink-0 rounded-full border px-3 py-2"
                    style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.border }}
                  >
                    <Text className="text-xs font-semibold leading-4" style={[{ color: uiColors.textMuted }, OVERLINE]}>
                      {amountTokenTicker}
                    </Text>
                  </View>
                </View>
              </View>

              <Text
                className="text-sm leading-5 mt-3"
                style={{ color: amountValidationMessage ? uiColors.dangerText : uiColors.textMuted }}
              >
                {amountValidationMessage ?? `${sliderValue.toFixed(1)}% of available balance`}
              </Text>
            </View>

            <View className="mb-5">
              <PercentageSlider
                value={sliderValue}
                onChange={handleSliderChange}
                disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
              />
              <View className="flex-row flex-wrap mt-2">
                {[25, 50, 75, 100].map((percent) => {
                  const isSelected = Math.abs(sliderValue - percent) < 0.5;
                  return (
                    <Pressable
                      key={percent}
                      onPress={() => handleSliderChange(percent)}
                      disabled={!availableAmountAtoms || availableAmountAtoms <= 0n}
                      className="h-6 rounded-full border px-3 mr-2 mb-2 items-center justify-center"
                      style={{
                        borderColor: isSelected ? uiColors.primaryPress : uiColors.border,
                        backgroundColor: isSelected ? uiColors.primary : uiColors.panel,
                        opacity: !availableAmountAtoms || availableAmountAtoms <= 0n ? 0.55 : 1,
                      }}
                    >
                      <Text
                        className="text-xs font-medium leading-4"
                        style={[{ color: isSelected ? uiColors.primaryText : uiColors.textMuted }, TABULAR_NUMS]}
                      >
                        {percent}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="flex-row mb-5">
              <View
                className="flex-1 rounded-xl border p-3 mr-2"
                style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.border }}
              >
                <Text className="mb-1 text-[11px] leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
                  Estimated receive
                </Text>
                <Text
                  className="font-medium text-sm leading-5"
                  style={[{ color: hasAmountInput ? uiColors.textSecondary : uiColors.textMuted }, TABULAR_NUMS]}
                >
                  {estimatedConversionText}
                </Text>
              </View>
              <View
                className="flex-1 rounded-xl border p-3 ml-2"
                style={{
                  backgroundColor: priceImpactWarningText ? uiColors.warningBg : uiColors.panelSoft,
                  borderColor: priceImpactWarningText ? uiColors.warningBorder : uiColors.border,
                }}
              >
                <Text
                  className="mb-1 text-[11px] leading-4"
                  style={[{ color: priceImpactWarningText ? uiColors.warningText : uiColors.textSubtle }, OVERLINE]}
                >
                  Price impact
                </Text>
                <Text className="font-medium text-sm leading-5" style={[{ color: priceImpactTextColor }, TABULAR_NUMS]}>
                  {priceImpactDisplay}{' '}
                  <Text
                    style={[
                      { color: executionPriceDisplay === '—' ? uiColors.textMuted : uiColors.textSecondary },
                      TABULAR_NUMS,
                    ]}
                  >
                    ({executionPriceDisplay})
                  </Text>
                </Text>
              </View>
            </View>

            {priceImpactWarningText && (
              <View
                className="rounded-xl border px-3 py-2 mb-5"
                style={{ backgroundColor: uiColors.warningBg, borderColor: uiColors.warningBorder }}
              >
                <Text className="text-sm leading-5" style={{ color: uiColors.warningText }}>
                  {priceImpactWarningText}
                </Text>
              </View>
            )}

            <View className="mb-5">
              <Text
                className="text-[11px] font-medium mb-3 leading-4"
                style={[{ color: uiColors.textSubtle }, OVERLINE]}
              >
                Duration
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row pb-1">
                  {DURATION_OPTIONS.map((option) => (
                    <Pressable
                      key={option.seconds}
                      onPress={() => {
                        setDurationSeconds(option.seconds);
                        setValidationError(null);
                      }}
                      className="h-6 rounded-full border px-3 mr-2 items-center justify-center"
                      style={{
                        backgroundColor: option.seconds === durationSeconds ? uiColors.primary : uiColors.panel,
                        borderColor: option.seconds === durationSeconds ? uiColors.primaryPress : uiColors.border,
                      }}
                    >
                      <Text
                        className="text-xs font-medium leading-4"
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
            {validationError && (
              <Text className="text-sm leading-5 mb-3" style={{ color: uiColors.dangerText }}>
                {validationError}
              </Text>
            )}

            {selectedAccount ? (
              <Pressable
                onPress={handleSubmitOrder}
                disabled={submitDisabled}
                className="h-12 rounded-xl items-center justify-center"
                style={{
                  backgroundColor: submitDisabled ? uiColors.disabledBg : uiColors.primary,
                }}
              >
                <Text className="text-white font-semibold text-base leading-6">{statusLabel}</Text>
              </Pressable>
            ) : (
              <ConnectButton />
            )}
          </View>
        </View>

        <View className="mx-4 mt-4 pb-5">
          <View className="flex-row flex-wrap items-center justify-between">
            <View className="flex-row flex-wrap">
              {[
                { key: 'active', label: 'Active positions' },
                { key: 'closed', label: 'Closed positions' },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setPositionPanelTab(tab.key as PositionPanelTab)}
                  className="h-7 rounded-full border px-3 mr-2 mb-3 items-center justify-center"
                  style={{
                    backgroundColor: positionPanelTab === tab.key ? uiColors.primary : uiColors.panel,
                    borderColor: positionPanelTab === tab.key ? uiColors.primaryPress : uiColors.border,
                  }}
                >
                  <Text
                    className="text-xs font-medium leading-4"
                    style={{ color: positionPanelTab === tab.key ? uiColors.primaryText : uiColors.textMuted }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {selectedAccount && positionPanelTab === 'active' && positions.length > 1 && (
              <View className="flex-row flex-wrap mb-1">
                <Pressable
                  onPress={() => handleBatchClosePositions(endedBatchPositions.map((position) => position.publicKey))}
                  disabled={isClosing || endedBatchPositions.length === 0}
                  className="h-7 rounded-full border px-3 mr-2 mb-2 items-center justify-center"
                  style={{
                    backgroundColor: uiColors.panel,
                    borderColor:
                      endedBatchPositions.length === 0 || isClosing ? uiColors.border : uiColors.dangerBorder,
                    opacity: endedBatchPositions.length === 0 || isClosing ? 0.55 : 1,
                  }}
                >
                  <Text className="text-xs font-medium leading-4" style={{ color: uiColors.dangerText }}>
                    Close ended{' '}
                    {endedBatchPositions.length > 0 ? `(${endedBatchPositions.length}/${endedPositions.length})` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleBatchClosePositions(allBatchPositions.map((position) => position.publicKey))}
                  disabled={isClosing || allBatchPositions.length === 0}
                  className="h-7 rounded-full border px-3 mb-2 items-center justify-center"
                  style={{
                    backgroundColor: uiColors.panel,
                    borderColor: allBatchPositions.length === 0 || isClosing ? uiColors.border : uiColors.dangerBorder,
                    opacity: allBatchPositions.length === 0 || isClosing ? 0.55 : 1,
                  }}
                >
                  <Text className="text-xs font-medium leading-4" style={{ color: uiColors.dangerText }}>
                    Close all ({allBatchPositions.length}/{positions.length})
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {lowMaintenanceNativeSolWarning && selectedAccount && positionPanelTab === 'active' && (
            <View
              className="rounded-xl border px-3 py-3 mb-4"
              style={{ backgroundColor: uiColors.warningBg, borderColor: uiColors.warningBorder }}
            >
              <Text className="text-sm leading-5" style={{ color: uiColors.warningText }}>
                {lowMaintenanceNativeSolWarning}
              </Text>
            </View>
          )}

          {positionPanelTab === 'active' ? (
            <>
              {!selectedAccount ? (
                <View
                  className="min-h-[132px] items-center justify-center rounded-xl border px-7"
                  style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
                >
                  <Text className="text-center text-lg leading-7" style={{ color: uiColors.textMuted }}>
                    Your active positions will appear here once an order is live.
                  </Text>
                </View>
              ) : positionsLoading ? (
                <View
                  className="min-h-[132px] items-center justify-center rounded-xl border px-7"
                  style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
                >
                  <ActivityIndicator size="small" color={uiColors.textMuted} />
                </View>
              ) : positions.length === 0 ? (
                <View
                  className="min-h-[132px] items-center justify-center rounded-xl border px-7"
                  style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
                >
                  <Text className="text-center text-lg leading-7" style={{ color: uiColors.textMuted }}>
                    Your active positions will appear here once an order is live.
                  </Text>
                </View>
              ) : (
                <View>
                  {paginatedActivePositions.map((position) => (
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
                  <PositionPagination
                    itemLabel="positions"
                    onPageChange={setActivePositionPage}
                    page={normalizedActivePositionPage}
                    pageCount={activePositionPageCount}
                    pageSize={POSITION_PAGE_SIZE}
                    totalItems={activePositionsNewestFirst.length}
                  />
                </View>
              )}

              {streamingStateError && selectedAccount && (
                <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
                  {streamingStateError}
                </Text>
              )}
            </>
          ) : selectedAccount ? (
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
          ) : (
            <View
              className="min-h-[132px] items-center justify-center rounded-xl border px-7"
              style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
            >
              <Text className="text-center text-lg leading-7" style={{ color: uiColors.textMuted }}>
                Connect a wallet to load your closed positions.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

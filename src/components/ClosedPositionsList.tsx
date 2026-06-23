import { memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { CLOSED_POSITION_MINI_CHART_STALE_TIME, fetchClosedPositionMiniChart } from '../hooks/useMarketUpdateRange';
import { useClosePositionEvents } from '../integrations/tigercloud/useClosePositionEvents';
import type { ClosePositionEvent, MarketUpdateEvent } from '../integrations/tigercloud/types';
import { queryKeys } from '../query/keys';
import { uiColors } from '../theme/colors';
import { CLUSTER } from '../utils/constants';
import { clampPage, getPageCount, getPageItems, PositionPagination } from './PositionPagination';
import {
  buildClosedPositionMiniChart,
  type MarketPricePoint,
  type MiniPriceChartPoint,
  normalizeMarketPricePoints,
} from '../utils/miniPriceChart';
import { MiniPriceChart } from './MiniPriceChart';

interface ClosedPositionsListProps {
  positionAuthority: string;
  marketId: number;
  baseTicker: string;
  quoteTicker: string;
  baseDecimals: number;
  quoteDecimals: number;
  embedded?: boolean;
  limit?: number;
  marketHistorySeed?: MarketUpdateEvent[];
}

const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };
const OVERLINE: TextStyle = { textTransform: 'uppercase', letterSpacing: 0.8 };

interface ClosedPositionChartState {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  points: MiniPriceChartPoint[] | null;
  error: string | null;
}

const IDLE_CHART_STATE: ClosedPositionChartState = {
  status: 'idle',
  points: null,
  error: null,
};
const MAX_CONCURRENT_CHART_LOADS = 4;
const POSITION_PAGE_SIZE = 10;

function formatAtomsToDisplay(amountAtoms: bigint, decimals: number): string {
  if (amountAtoms <= 0n) return '0';
  if (decimals <= 0) return amountAtoms.toString();

  const divisor = 10n ** BigInt(decimals);
  const whole = amountAtoms / divisor;
  const rawFraction = (amountAtoms % divisor).toString().padStart(decimals, '0');
  const visibleDecimals = Math.min(decimals, 6);
  const fraction = rawFraction.slice(0, visibleDecimals).replace(/0+$/, '');

  if (fraction.length === 0) {
    return whole.toString();
  }

  return `${whole.toString()}.${fraction}`;
}

function subtractFloorZero(minuend: bigint, subtrahend: bigint): bigint {
  if (minuend <= subtrahend) return 0n;
  return minuend - subtrahend;
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
  if (baseUi === 0) return null;
  const price = quoteUi / baseUi;
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}

function formatPrice(value: number): string {
  if (value >= 1) return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function shortenSignature(sig: string): string {
  if (sig.length <= 12) return sig;
  return `${sig.slice(0, 6)}...${sig.slice(-4)}`;
}

function hasValidChartRange(
  event: ClosePositionEvent,
): event is ClosePositionEvent & { start_slot: number; end_slot: number } {
  return event.start_slot !== null && event.end_slot !== null && event.start_slot <= event.end_slot;
}

function buildChartStateFromMiniChartPoints(points: MiniPriceChartPoint[]): ClosedPositionChartState {
  if (points.length >= 2) {
    return {
      status: 'ready',
      points,
      error: null,
    };
  }

  return {
    status: 'unavailable',
    points: null,
    error: null,
  };
}

function hasNormalizedHistoryCoverage(
  points: MarketPricePoint[],
  startSlot: number | null,
  endSlot: number | null,
): boolean {
  if (points.length === 0 || startSlot === null || endSlot === null || startSlot > endSlot) {
    return false;
  }

  return points[0].slot <= startSlot && points[points.length - 1].slot >= endSlot;
}

function buildChartStateFromNormalizedHistory(
  normalizedHistory: MarketPricePoint[],
  event: ClosePositionEvent,
): ClosedPositionChartState | null {
  if (!hasNormalizedHistoryCoverage(normalizedHistory, event.start_slot, event.end_slot)) {
    return null;
  }

  const points = buildClosedPositionMiniChart(normalizedHistory, event.start_slot, event.end_slot);
  if (points !== null && points.length >= 2) {
    return {
      status: 'ready',
      points,
      error: null,
    };
  }

  return {
    status: 'unavailable',
    points: null,
    error: null,
  };
}

function findNextPendingChartEvents(
  events: ClosePositionEvent[],
  chartStatesByEventId: ReadonlyMap<number, ClosedPositionChartState>,
  maxCount: number,
): ClosePositionEvent[] {
  const pendingEvents: ClosePositionEvent[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!hasValidChartRange(event)) continue;
    if (chartStatesByEventId.has(event.id)) continue;
    pendingEvents.push(event);
    if (pendingEvents.length >= maxCount) break;
  }

  return pendingEvents;
}

function closedPositionMiniChartQueryKey(marketId: number, startSlot: number, endSlot: number) {
  return [...queryKeys.marketUpdates.all, 'closed-position-mini-chart', marketId, startSlot, endSlot] as const;
}

function sortClosedPositionEventsNewestFirst(left: ClosePositionEvent, right: ClosePositionEvent): number {
  if (right.slot !== left.slot) return right.slot - left.slot;
  return right.id - left.id;
}

export function ClosedPositionsList({
  positionAuthority,
  marketId,
  baseTicker,
  quoteTicker,
  baseDecimals,
  quoteDecimals,
  embedded = false,
  limit = 50,
  marketHistorySeed = [],
}: ClosedPositionsListProps) {
  const queryClient = useQueryClient();
  const { events, loading, error } = useClosePositionEvents({
    positionAuthority,
    marketId,
    limit,
  });
  const [chartStatesByEventId, setChartStatesByEventId] = useState<Map<number, ClosedPositionChartState>>(new Map());
  const [closedPositionPage, setClosedPositionPage] = useState(0);
  const chartLoadRunRef = useRef(0);
  const isMountedRef = useRef(true);
  const normalizedSeedHistory = useMemo(
    () => normalizeMarketPricePoints(marketHistorySeed, baseDecimals, quoteDecimals),
    [baseDecimals, marketHistorySeed, quoteDecimals],
  );
  const sortedEvents = useMemo(() => [...events].sort(sortClosedPositionEventsNewestFirst), [events]);
  const closedPositionPageCount = getPageCount(sortedEvents.length, POSITION_PAGE_SIZE);
  const normalizedClosedPositionPage = clampPage(closedPositionPage, sortedEvents.length, POSITION_PAGE_SIZE);
  const paginatedEvents = useMemo(
    () =>
      getPageItems({
        items: sortedEvents,
        page: normalizedClosedPositionPage,
        pageSize: POSITION_PAGE_SIZE,
      }),
    [normalizedClosedPositionPage, sortedEvents],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setClosedPositionPage((current) => clampPage(current, sortedEvents.length, POSITION_PAGE_SIZE));
  }, [sortedEvents.length]);

  useEffect(() => {
    chartLoadRunRef.current += 1;
    const cachedChartStates = new Map<number, ClosedPositionChartState>();

    for (const event of sortedEvents) {
      if (!hasValidChartRange(event)) continue;

      const cachedHistory = queryClient.getQueryData<MiniPriceChartPoint[]>(
        closedPositionMiniChartQueryKey(marketId, event.start_slot, event.end_slot),
      );
      if (!cachedHistory) continue;

      cachedChartStates.set(event.id, buildChartStateFromMiniChartPoints(cachedHistory));
    }

    setChartStatesByEventId(cachedChartStates);
  }, [marketId, queryClient, sortedEvents]);

  useEffect(() => {
    if (normalizedSeedHistory.length === 0) {
      return;
    }

    startTransition(() => {
      setChartStatesByEventId((current) => {
        let next: Map<number, ClosedPositionChartState> | null = null;

        for (const event of sortedEvents) {
          if (!hasValidChartRange(event)) continue;
          if (current.get(event.id)?.status === 'ready') continue;

          const nextState = buildChartStateFromNormalizedHistory(normalizedSeedHistory, event);
          if (nextState === null) continue;

          if (next === null) {
            next = new Map(current);
          }
          next.set(event.id, nextState);
        }

        return next ?? current;
      });
    });
  }, [normalizedSeedHistory, sortedEvents]);

  const activeChartLoadCount = useMemo(() => {
    let count = 0;

    for (const chartState of chartStatesByEventId.values()) {
      if (chartState.status === 'loading') {
        count += 1;
      }
    }

    return count;
  }, [chartStatesByEventId]);

  const pendingChartEvents = useMemo(() => {
    const remainingSlots = MAX_CONCURRENT_CHART_LOADS - activeChartLoadCount;
    if (remainingSlots <= 0) return [];

    return findNextPendingChartEvents(paginatedEvents, chartStatesByEventId, remainingSlots);
  }, [activeChartLoadCount, chartStatesByEventId, paginatedEvents]);

  useEffect(() => {
    if (pendingChartEvents.length === 0) return;

    const runVersion = chartLoadRunRef.current;
    setChartStatesByEventId((current) => {
      const next = new Map(current);

      for (const event of pendingChartEvents) {
        if (!next.has(event.id)) {
          next.set(event.id, { status: 'loading', points: null, error: null });
        }
      }

      return next;
    });

    for (const event of pendingChartEvents) {
      if (event.start_slot === null || event.end_slot === null) {
        continue;
      }

      const startSlot = event.start_slot;
      const endSlot = event.end_slot;
      queryClient
        .fetchQuery({
          queryKey: closedPositionMiniChartQueryKey(marketId, startSlot, endSlot),
          staleTime: CLOSED_POSITION_MINI_CHART_STALE_TIME,
          queryFn: () =>
            fetchClosedPositionMiniChart({
              marketId,
              startSlot,
              endSlot,
            }),
        })
        .then((points) => {
          if (!isMountedRef.current || runVersion !== chartLoadRunRef.current) return;

          startTransition(() => {
            setChartStatesByEventId((current) => {
              const next = new Map(current);
              next.set(event.id, buildChartStateFromMiniChartPoints(points));
              return next;
            });
          });
        })
        .catch((fetchError) => {
          if (!isMountedRef.current || runVersion !== chartLoadRunRef.current) return;

          const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          startTransition(() => {
            setChartStatesByEventId((current) => {
              const next = new Map(current);
              next.set(event.id, { status: 'error', points: null, error: message });
              return next;
            });
          });
        });
    }
  }, [marketId, pendingChartEvents, queryClient]);

  const historyError = useMemo(() => {
    for (const chartState of chartStatesByEventId.values()) {
      if (chartState.error) return chartState.error;
    }

    return null;
  }, [chartStatesByEventId]);

  const content = (
    <>
      {!embedded && (
        <Text className="text-white text-2xl font-semibold tracking-tight leading-8 mb-4">Closed Positions</Text>
      )}

      {loading ? (
        <ActivityIndicator size="small" color={uiColors.textMuted} />
      ) : sortedEvents.length === 0 ? (
        <Text className="text-sm leading-5" style={{ color: uiColors.textSubtle }}>
          No closed positions yet.
        </Text>
      ) : (
        <View>
          {paginatedEvents.map((event) => (
            <ClosedPositionRow
              key={event.id}
              event={event}
              chartState={chartStatesByEventId.get(event.id) ?? IDLE_CHART_STATE}
              baseTicker={baseTicker}
              quoteTicker={quoteTicker}
              baseDecimals={baseDecimals}
              quoteDecimals={quoteDecimals}
            />
          ))}
          <PositionPagination
            itemLabel="positions"
            onPageChange={setClosedPositionPage}
            page={normalizedClosedPositionPage}
            pageCount={closedPositionPageCount}
            pageSize={POSITION_PAGE_SIZE}
            totalItems={sortedEvents.length}
          />
        </View>
      )}

      {error && (
        <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
          {error}
        </Text>
      )}

      {historyError && !loading && sortedEvents.length > 0 && (
        <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
          Price history unavailable: {historyError}
        </Text>
      )}
    </>
  );

  if (embedded) {
    return <View>{content}</View>;
  }

  return (
    <View
      className="rounded-2xl border p-5 mt-6"
      style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}
    >
      {content}
    </View>
  );
}

interface ClosedPositionRowProps {
  event: ClosePositionEvent;
  chartState: ClosedPositionChartState;
  baseTicker: string;
  quoteTicker: string;
  baseDecimals: number;
  quoteDecimals: number;
}

interface ChartLegendItemProps {
  color: string;
  dashed?: boolean;
  label: string;
}

function ChartLegendItem({ color, dashed = false, label }: ChartLegendItemProps) {
  return (
    <View className="flex-row items-center">
      <View
        className="mr-1.5"
        style={{
          width: 14,
          borderTopWidth: dashed ? 1 : 2,
          borderTopColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
          opacity: 0.95,
        }}
      />
      <Text className="text-[10px] leading-4" style={{ color: uiColors.textSubtle }}>
        {label}
      </Text>
    </View>
  );
}

const ClosedPositionRow = memo(function ClosedPositionRow({
  event,
  chartState,
  baseTicker,
  quoteTicker,
  baseDecimals,
  quoteDecimals,
}: ClosedPositionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isBuy = event.is_buy === 1;
  const sideLabel = isBuy ? 'Buy' : 'Sell';
  const flowLabel = isBuy ? `${quoteTicker} → ${baseTicker}` : `${baseTicker} → ${quoteTicker}`;

  const depositToken = isBuy ? quoteTicker : baseTicker;
  const depositDecimals = isBuy ? quoteDecimals : baseDecimals;
  const swappedToken = isBuy ? baseTicker : quoteTicker;
  const swappedDecimals = isBuy ? baseDecimals : quoteDecimals;
  const feeToken = swappedToken;
  const feeDecimals = swappedDecimals;

  const depositedAtoms = event.deposit_amount;
  const remainingAtoms = event.remaining_amount;
  const consumedAtoms = subtractFloorZero(depositedAtoms, remainingAtoms);
  const swappedAtoms = event.swapped_amount;
  const feeAtoms = event.fee_amount;
  const receivedAtoms = subtractFloorZero(swappedAtoms, feeAtoms);

  const grossQuoteAtoms = isBuy ? consumedAtoms : swappedAtoms;
  const grossBaseAtoms = isBuy ? swappedAtoms : consumedAtoms;
  const averageFillPrice = computeUnitPrice(grossQuoteAtoms, quoteDecimals, grossBaseAtoms, baseDecimals);

  const netQuoteAtoms = isBuy ? consumedAtoms : receivedAtoms;
  const netBaseAtoms = isBuy ? receivedAtoms : consumedAtoms;
  const netEffectivePrice = computeUnitPrice(netQuoteAtoms, quoteDecimals, netBaseAtoms, baseDecimals);
  const averageFillPriceLabel = 'Average fill price';
  const netEffectivePriceLabel = isBuy ? 'Net price paid after fee' : 'Net price received after fee';
  const consumedLabel = isBuy ? 'Actually Spent' : 'Actually Sold';
  const chartPoints = chartState.points;
  const hasChart = chartState.status === 'ready' && chartPoints !== null && chartPoints.length >= 2;
  const showChartSection = hasChart;
  const showNetEffectivePrice =
    netEffectivePrice !== null &&
    averageFillPrice !== null &&
    Math.abs(netEffectivePrice - averageFillPrice) > Math.max(averageFillPrice, 1) * 1e-9;
  const averageLineColor = isBuy ? uiColors.buyText : uiColors.dangerText;

  const handleOpenTx = () => {
    if (event.signature) {
      const explorerCluster = CLUSTER.startsWith('solana:') ? CLUSTER.slice('solana:'.length) : 'mainnet';
      const clusterQuery = explorerCluster === 'mainnet' ? '' : `?cluster=${encodeURIComponent(explorerCluster)}`;
      Linking.openURL(`https://solscan.io/tx/${event.signature}${clusterQuery}`);
    }
  };

  return (
    <Pressable onPress={() => setExpanded((prev) => !prev)}>
      <View
        className="rounded-xl p-4 mb-3"
        style={{ borderColor: uiColors.border, backgroundColor: uiColors.surfaceAlt, borderWidth: 1 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className="px-2.5 py-1 rounded-md"
              style={{ backgroundColor: isBuy ? uiColors.successBg : uiColors.dangerBg }}
            >
              <Text
                className="text-[10px] font-semibold leading-4"
                style={{ color: isBuy ? uiColors.buyText : uiColors.dangerText }}
              >
                {sideLabel}
              </Text>
            </View>
            <Text className="text-sm leading-5 ml-2.5" style={{ color: uiColors.textMuted }}>
              {flowLabel}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Pressable onPress={handleOpenTx} hitSlop={8}>
              <Text className="text-[11px] leading-4 underline" style={{ color: uiColors.textSubtle }}>
                {shortenSignature(event.signature)}
              </Text>
            </Pressable>
            <Text className="text-[11px] leading-4 ml-2.5" style={{ color: uiColors.textSubtle }}>
              {expanded ? '▲' : '▼'}
            </Text>
          </View>
        </View>

        <View className="mt-3 pt-3 border-t" style={{ borderTopColor: uiColors.divider }}>
          {showChartSection && hasChart && (
            <View className="flex-row items-center justify-end mb-2">
              <ChartLegendItem color={uiColors.primary} label="Price" />
              <View className="w-3" />
              <ChartLegendItem color={averageLineColor} dashed label="Avg fill" />
            </View>
          )}

          {hasChart && (
            <MiniPriceChart
              points={chartPoints}
              averagePrice={averageFillPrice}
              lineColor={uiColors.primary}
              averageLineColor={averageLineColor}
              showYAxisLabels
              formatValue={formatPrice}
            />
          )}

          {!expanded && (
            <View className={`flex-row items-center justify-between ${showChartSection ? 'mt-3' : ''}`}>
              <Text
                className="text-[14px] font-semibold leading-5"
                style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
              >
                {formatAtomsToDisplay(consumedAtoms, depositDecimals)} {depositToken}
              </Text>
              <Text className="text-[11px] leading-4" style={{ color: uiColors.textSubtle }}>
                →
              </Text>
              <Text
                className="text-[14px] font-semibold leading-5"
                style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
              >
                {formatAtomsToDisplay(receivedAtoms, swappedDecimals)} {swappedToken}
              </Text>
              {averageFillPrice !== null && (
                <Text className="text-[11px] leading-4" style={[{ color: uiColors.textSubtle }, TABULAR_NUMS]}>
                  @ {formatPrice(averageFillPrice)}
                </Text>
              )}
            </View>
          )}

          {expanded && (
            <View className={showChartSection ? 'mt-3' : ''}>
              <View className="flex-row justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text
                    className="text-[10px] font-semibold leading-4"
                    style={[{ color: uiColors.textSubtle }, OVERLINE]}
                  >
                    Deposited
                  </Text>
                  <Text
                    className="text-[14px] font-semibold leading-5"
                    style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                  >
                    {formatAtomsToDisplay(depositedAtoms, depositDecimals)} {depositToken}
                  </Text>
                </View>
                <View className="flex-1 pl-2">
                  <Text
                    className="text-[10px] font-semibold leading-4"
                    style={[{ color: uiColors.textSubtle }, OVERLINE]}
                  >
                    {consumedLabel}
                  </Text>
                  <Text
                    className="text-[14px] font-semibold leading-5"
                    style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                  >
                    {formatAtomsToDisplay(consumedAtoms, depositDecimals)} {depositToken}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text
                    className="text-[10px] font-semibold leading-4"
                    style={[{ color: uiColors.textSubtle }, OVERLINE]}
                  >
                    Received
                  </Text>
                  <Text
                    className="text-[14px] font-semibold leading-5"
                    style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                  >
                    {formatAtomsToDisplay(receivedAtoms, swappedDecimals)} {swappedToken}
                  </Text>
                </View>
                <View className="flex-1 pl-2">
                  <Text
                    className="text-[10px] font-semibold leading-4"
                    style={[{ color: uiColors.textSubtle }, OVERLINE]}
                  >
                    Fee
                  </Text>
                  <Text
                    className="text-[14px] font-semibold leading-5"
                    style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                  >
                    {formatAtomsToDisplay(feeAtoms, feeDecimals)} {feeToken}
                  </Text>
                </View>
              </View>
              <View className="mt-1.5 pt-2 border-t" style={{ borderTopColor: uiColors.divider }}>
                <Text
                  className="text-[10px] font-semibold leading-4"
                  style={[{ color: uiColors.textSubtle }, OVERLINE]}
                >
                  {averageFillPriceLabel}
                </Text>
                <Text
                  className="text-[14px] font-semibold leading-5"
                  style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                >
                  {averageFillPrice === null ? '—' : `${formatPrice(averageFillPrice)} ${quoteTicker}/${baseTicker}`}
                </Text>
              </View>
              {showNetEffectivePrice && netEffectivePrice !== null && (
                <View className="mt-1.5 pt-2 border-t" style={{ borderTopColor: uiColors.divider }}>
                  <Text
                    className="text-[10px] font-semibold leading-4"
                    style={[{ color: uiColors.textSubtle }, OVERLINE]}
                  >
                    {netEffectivePriceLabel}
                  </Text>
                  <Text
                    className="text-[14px] font-semibold leading-5"
                    style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                  >
                    {`${formatPrice(netEffectivePrice)} ${quoteTicker}/${baseTicker}`}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

ClosedPositionRow.displayName = 'ClosedPositionRow';

import { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, InteractionManager, Linking, Pressable, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { MARKET_UPDATE_RANGE_STALE_TIME, fetchMarketUpdateRange } from '../hooks/useMarketUpdateRange';
import { useClosePositionEvents } from '../integrations/supabase/useClosePositionEvents';
import type { ClosePositionEvent, MarketUpdateEvent } from '../integrations/supabase/types';
import { queryKeys } from '../query/keys';
import { uiColors } from '../theme/colors';
import {
  buildClosedPositionMiniChart,
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

function hasValidChartRange(event: ClosePositionEvent): boolean {
  return event.start_slot !== null && event.end_slot !== null && event.start_slot <= event.end_slot;
}

function buildChartStateFromHistory(
  marketHistory: MarketUpdateEvent[],
  event: ClosePositionEvent,
  baseDecimals: number,
  quoteDecimals: number,
): ClosedPositionChartState {
  const normalizedHistory = normalizeMarketPricePoints(marketHistory, baseDecimals, quoteDecimals);
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

function findNextPendingChartIndex(
  events: ClosePositionEvent[],
  chartStatesByEventId: ReadonlyMap<number, ClosedPositionChartState>,
): number | null {
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!hasValidChartRange(event)) continue;
    if (chartStatesByEventId.has(event.id)) continue;
    return index;
  }

  return null;
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
}: ClosedPositionsListProps) {
  const queryClient = useQueryClient();
  const { events, loading, error } = useClosePositionEvents({
    positionAuthority,
    marketId,
    limit,
  });
  const [chartStatesByEventId, setChartStatesByEventId] = useState<Map<number, ClosedPositionChartState>>(new Map());
  const [activeChartEventId, setActiveChartEventId] = useState<number | null>(null);

  useEffect(() => {
    const cachedChartStates = new Map<number, ClosedPositionChartState>();

    for (const event of events) {
      if (!hasValidChartRange(event)) continue;

      const cachedHistory = queryClient.getQueryData<MarketUpdateEvent[]>(
        queryKeys.marketUpdates.range(marketId, event.start_slot, event.end_slot),
      );
      if (!cachedHistory) continue;

      cachedChartStates.set(event.id, buildChartStateFromHistory(cachedHistory, event, baseDecimals, quoteDecimals));
    }

    setChartStatesByEventId(cachedChartStates);
    setActiveChartEventId(null);
  }, [baseDecimals, events, marketId, queryClient, quoteDecimals]);

  const nextPendingChartIndex = useMemo(() => {
    if (activeChartEventId !== null) return null;
    return findNextPendingChartIndex(events, chartStatesByEventId);
  }, [activeChartEventId, chartStatesByEventId, events]);

  useEffect(() => {
    if (nextPendingChartIndex === null) return;

    const event = events[nextPendingChartIndex];
    if (!event || !hasValidChartRange(event) || event.start_slot === null || event.end_slot === null) {
      return;
    }
    const startSlot = event.start_slot;
    const endSlot = event.end_slot;

    let cancelled = false;
    setActiveChartEventId(event.id);
    setChartStatesByEventId((current) => {
      const next = new Map(current);
      next.set(event.id, { status: 'loading', points: null, error: null });
      return next;
    });

    const interaction = InteractionManager.runAfterInteractions(() => {
      queryClient
        .fetchQuery({
          queryKey: queryKeys.marketUpdates.range(marketId, startSlot, endSlot),
          staleTime: MARKET_UPDATE_RANGE_STALE_TIME,
          queryFn: () =>
            fetchMarketUpdateRange({
              marketId,
              startSlot,
              endSlot,
            }),
        })
        .then((marketHistory) => {
          if (cancelled) return;

          setChartStatesByEventId((current) => {
            const next = new Map(current);
            next.set(event.id, buildChartStateFromHistory(marketHistory, event, baseDecimals, quoteDecimals));
            return next;
          });
        })
        .catch((fetchError) => {
          if (cancelled) return;

          const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          setChartStatesByEventId((current) => {
            const next = new Map(current);
            next.set(event.id, { status: 'error', points: null, error: message });
            return next;
          });
        })
        .finally(() => {
          if (cancelled) return;
          setActiveChartEventId((current) => (current === event.id ? null : current));
        });
    });

    return () => {
      cancelled = true;
      interaction.cancel();
    };
  }, [baseDecimals, events, marketId, nextPendingChartIndex, queryClient, quoteDecimals]);

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
      ) : events.length === 0 ? (
        <Text className="text-sm leading-5" style={{ color: uiColors.textSubtle }}>
          No closed positions yet.
        </Text>
      ) : (
        <View>
          {events.map((event) => (
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
        </View>
      )}

      {error && (
        <Text className="text-sm leading-5 mt-2" style={{ color: uiColors.dangerText }}>
          {error}
        </Text>
      )}

      {historyError && !loading && events.length > 0 && (
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
  const showChartPlaceholder = chartState.status === 'loading';
  const showChartSection = hasChart || showChartPlaceholder;
  const showNetEffectivePrice =
    netEffectivePrice !== null &&
    averageFillPrice !== null &&
    Math.abs(netEffectivePrice - averageFillPrice) > Math.max(averageFillPrice, 1) * 1e-9;
  const averageLineColor = isBuy ? uiColors.buyText : uiColors.dangerText;

  const handleOpenTx = () => {
    if (event.signature) {
      Linking.openURL(`https://solscan.io/tx/${event.signature}?cluster=devnet`);
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

          {showChartSection &&
            (hasChart ? (
              <MiniPriceChart
                points={chartPoints}
                averagePrice={averageFillPrice}
                lineColor={uiColors.primary}
                averageLineColor={averageLineColor}
                showYAxisLabels
                formatValue={formatPrice}
              />
            ) : (
              <View
                className="w-full rounded-lg"
                style={{
                  height: 56,
                  borderWidth: 1,
                  borderColor: uiColors.border,
                  backgroundColor: uiColors.panelSoft,
                  opacity: 0.45,
                }}
              />
            ))}

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

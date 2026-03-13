import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { useMarketUpdateRange } from '../hooks/useMarketUpdateRange';
import { useClosePositionEvents } from '../integrations/supabase/useClosePositionEvents';
import type { ClosePositionEvent } from '../integrations/supabase/types';
import { uiColors } from '../theme/colors';
import { buildClosedPositionMiniChart, type MiniPriceChartPoint, normalizeMarketPricePoints } from '../utils/miniPriceChart';
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
  const { events, loading, error } = useClosePositionEvents({
    positionAuthority,
    marketId,
    limit,
  });
  const slotRange = useMemo(() => {
    let minSlot: number | null = null;
    let maxSlot: number | null = null;

    for (const event of events) {
      if (event.start_slot === null || event.end_slot === null || event.start_slot > event.end_slot) continue;
      minSlot = minSlot === null ? event.start_slot : Math.min(minSlot, event.start_slot);
      maxSlot = maxSlot === null ? event.end_slot : Math.max(maxSlot, event.end_slot);
    }

    return { minSlot, maxSlot };
  }, [events]);
  const {
    events: marketHistory,
    loading: historyLoading,
    error: historyError,
  } = useMarketUpdateRange({
    marketId,
    startSlot: slotRange.minSlot,
    endSlot: slotRange.maxSlot,
  });
  const normalizedHistory = useMemo(
    () => normalizeMarketPricePoints(marketHistory, baseDecimals, quoteDecimals),
    [baseDecimals, marketHistory, quoteDecimals],
  );
  const chartPointsByEventId = useMemo(() => {
    const chartById = new Map<number, MiniPriceChartPoint[] | null>();

    for (const event of events) {
      chartById.set(event.id, buildClosedPositionMiniChart(normalizedHistory, event.start_slot, event.end_slot));
    }

    return chartById;
  }, [events, normalizedHistory]);

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
              chartPoints={chartPointsByEventId.get(event.id) ?? null}
              chartLoading={historyLoading}
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
  chartPoints: MiniPriceChartPoint[] | null;
  chartLoading: boolean;
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

function ClosedPositionRow({
  event,
  chartPoints,
  chartLoading,
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
  const hasChart = chartPoints !== null && chartPoints.length >= 2;
  const showChartPlaceholder = !hasChart && chartLoading && event.start_slot !== null && event.end_slot !== null;
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
                points={chartPoints ?? []}
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
                <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
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
                  <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
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
}

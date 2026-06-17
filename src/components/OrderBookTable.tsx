import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import type { TradePosition } from '../hooks/useTradePositions';
import type { StreamingMarketState } from '../hooks/useStreamingMarketState';
import { uiColors } from '../theme/colors';
import { formatAtoms } from '../utils/trading';

const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };
const OVERLINE: TextStyle = { textTransform: 'uppercase', letterSpacing: 0.8 };

function toBigInt(value: { toString(): string }): bigint {
  return BigInt(value.toString());
}

function toNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function formatRemaining(position: TradePosition, currentSlot: number | null): bigint {
  const amountAtoms = toBigInt(position.amount);
  const startSlot = toNumber(position.startSlot);
  const endSlot = toNumber(position.endSlot);
  const durationSlots = Math.max(1, endSlot - startSlot);
  const activeSlot = currentSlot === null ? startSlot : Math.min(Math.max(currentSlot, startSlot), endSlot);
  const elapsedSlots = Math.max(0, activeSlot - startSlot);
  const spentAtoms = (amountAtoms * BigInt(elapsedSlots)) / BigInt(durationSlots);
  return amountAtoms > spentAtoms ? amountAtoms - spentAtoms : 0n;
}

function aggregateLevels({ currentSlot, positions }: { currentSlot: number | null; positions: TradePosition[] }) {
  let buyOpenAtoms = 0n;
  let sellOpenAtoms = 0n;
  let buyCount = 0;
  let sellCount = 0;

  for (const position of positions) {
    const endSlot = toNumber(position.endSlot);
    if (currentSlot !== null && currentSlot > endSlot) continue;

    const remaining = formatRemaining(position, currentSlot);
    if (remaining <= 0n) continue;

    if (position.isBuy) {
      buyOpenAtoms += remaining;
      buyCount += 1;
    } else {
      sellOpenAtoms += remaining;
      sellCount += 1;
    }
  }

  return { buyCount, buyOpenAtoms, sellCount, sellOpenAtoms };
}

export function OrderBookTable({
  baseDecimals,
  baseTicker,
  currentSlot,
  isLoading,
  positions,
  quoteDecimals,
  quoteTicker,
  streamingState,
}: {
  baseDecimals: number;
  baseTicker: string;
  currentSlot: number | null;
  isLoading: boolean;
  positions: TradePosition[];
  quoteDecimals: number;
  quoteTicker: string;
  streamingState: StreamingMarketState | null;
}) {
  const levels = useMemo(() => aggregateLevels({ currentSlot, positions }), [currentSlot, positions]);
  const hasRows = levels.buyCount > 0 || levels.sellCount > 0;
  const indicativePrice =
    streamingState && streamingState.marketBaseFlow > 0n
      ? Math.abs(Number(streamingState.marketQuoteFlow) / 10 ** quoteDecimals) /
        Math.abs(Number(streamingState.marketBaseFlow) / 10 ** baseDecimals)
      : null;

  return (
    <View className="rounded-xl border p-4" style={{ backgroundColor: uiColors.surface, borderColor: uiColors.border }}>
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
            Continuous Order Flow
          </Text>
          <Text className="text-lg font-semibold leading-6" style={{ color: uiColors.textPrimary }}>
            Order Book
          </Text>
        </View>
        <Text className="text-sm font-semibold leading-5" style={[{ color: uiColors.accentText }, TABULAR_NUMS]}>
          {indicativePrice === null ? '—' : `$${indicativePrice.toFixed(4)}`}
        </Text>
      </View>

      {isLoading && positions.length === 0 ? (
        <ActivityIndicator size="small" color={uiColors.textMuted} />
      ) : !hasRows ? (
        <Text className="text-sm leading-5" style={{ color: uiColors.textSubtle }}>
          No active order flow yet.
        </Text>
      ) : (
        <View>
          <OrderBookRow
            amount={`${formatAtoms(levels.sellOpenAtoms, baseDecimals)} ${baseTicker}`}
            count={levels.sellCount}
            label="Sell flow"
            tone="sell"
          />
          <View className="my-3 h-px" style={{ backgroundColor: uiColors.divider }} />
          <OrderBookRow
            amount={`${formatAtoms(levels.buyOpenAtoms, quoteDecimals)} ${quoteTicker}`}
            count={levels.buyCount}
            label="Buy flow"
            tone="buy"
          />
        </View>
      )}
    </View>
  );
}

function OrderBookRow({
  amount,
  count,
  label,
  tone,
}: {
  amount: string;
  count: number;
  label: string;
  tone: 'buy' | 'sell';
}) {
  const color = tone === 'buy' ? uiColors.buyText : uiColors.dangerText;
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        <View className="mr-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <View>
          <Text className="text-sm font-semibold leading-5" style={{ color }}>
            {label}
          </Text>
          <Text className="text-xs leading-4" style={{ color: uiColors.textSubtle }}>
            {count} active {count === 1 ? 'position' : 'positions'}
          </Text>
        </View>
      </View>
      <Text className="text-sm font-semibold leading-5" style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}>
        {amount}
      </Text>
    </View>
  );
}

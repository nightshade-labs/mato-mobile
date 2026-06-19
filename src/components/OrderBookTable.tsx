import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import type { TradePosition } from '../hooks/useTradePositions';
import { uiColors } from '../theme/colors';
import { formatAtoms } from '../utils/trading';

const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };
const OVERLINE: TextStyle = { textTransform: 'uppercase', letterSpacing: 0.8 };

type DirectionFilter = 'all' | 'buy' | 'sell';

interface OrderBookRow {
  amountAtoms: bigint;
  amountDecimals: number;
  amountToken: string;
  direction: 'Buy' | 'Sell';
  endSlot: bigint;
  flowAtomsPerSlot: bigint;
  position: TradePosition;
  startSlot: bigint;
}

const DIRECTION_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Buy', value: 'buy' },
  { label: 'Sell', value: 'sell' },
] as const satisfies { label: string; value: DirectionFilter }[];

function toBigInt(value: { toString(): string }): bigint {
  return BigInt(value.toString());
}

function shortenAddress(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function createOrderBookRow({
  baseDecimals,
  baseTicker,
  position,
  quoteDecimals,
  quoteTicker,
}: {
  baseDecimals: number;
  baseTicker: string;
  position: TradePosition;
  quoteDecimals: number;
  quoteTicker: string;
}): OrderBookRow {
  const isBuy = position.isBuy;
  const amountAtoms = toBigInt(position.amount);
  const startSlot = toBigInt(position.startSlot);
  const endSlot = toBigInt(position.endSlot);
  const durationSlots = endSlot > startSlot ? endSlot - startSlot : 1n;

  return {
    amountAtoms,
    amountDecimals: isBuy ? quoteDecimals : baseDecimals,
    amountToken: isBuy ? quoteTicker : baseTicker,
    direction: isBuy ? 'Buy' : 'Sell',
    endSlot,
    flowAtomsPerSlot: amountAtoms / durationSlots,
    position,
    startSlot,
  };
}

export function OrderBookTable({
  baseDecimals,
  baseTicker,
  currentSlot,
  isLoading,
  positions,
  quoteDecimals,
  quoteTicker,
}: {
  baseDecimals: number;
  baseTicker: string;
  currentSlot: number | null;
  isLoading: boolean;
  positions: TradePosition[];
  quoteDecimals: number;
  quoteTicker: string;
}) {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const activeOrderCount = useMemo(
    () =>
      positions.filter(
        (position) => currentSlot === null || BigInt(Math.floor(currentSlot)) <= toBigInt(position.endSlot),
      ).length,
    [currentSlot, positions],
  );
  const rows = useMemo(() => {
    return positions
      .filter((position) => currentSlot === null || BigInt(Math.floor(currentSlot)) <= toBigInt(position.endSlot))
      .map((position) => createOrderBookRow({ baseDecimals, baseTicker, position, quoteDecimals, quoteTicker }))
      .filter((row) => {
        if (directionFilter === 'all') return true;
        return directionFilter === 'buy' ? row.direction === 'Buy' : row.direction === 'Sell';
      })
      .sort((left, right) => (left.endSlot < right.endSlot ? -1 : left.endSlot > right.endSlot ? 1 : 0));
  }, [baseDecimals, baseTicker, currentSlot, directionFilter, positions, quoteDecimals, quoteTicker]);

  return (
    <View>
      <View className="flex-row mb-3">
        {DIRECTION_FILTERS.map((filter) => {
          const isActive = directionFilter === filter.value;
          return (
            <Pressable
              key={filter.value}
              onPress={() => setDirectionFilter(filter.value)}
              className="rounded-full border px-3.5 py-2 mr-2"
              style={{
                backgroundColor: isActive ? uiColors.primary : uiColors.panelSoft,
                borderColor: isActive ? uiColors.primaryPress : uiColors.border,
              }}
            >
              <Text
                className="text-sm font-semibold leading-5"
                style={{ color: isActive ? uiColors.primaryText : uiColors.textMuted }}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading && rows.length === 0 ? (
        <OrderBookState>
          <ActivityIndicator size="small" color={uiColors.textMuted} />
          <Text className="mt-2 text-sm leading-5" style={{ color: uiColors.textSubtle }}>
            Loading active orders...
          </Text>
        </OrderBookState>
      ) : rows.length === 0 ? (
        <OrderBookState>
          <Text className="text-sm leading-5 text-center" style={{ color: uiColors.textSubtle }}>
            {activeOrderCount === 0
              ? 'No active orders are open for this market.'
              : 'No active orders match the selected direction.'}
          </Text>
        </OrderBookState>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: uiColors.panel, borderColor: uiColors.divider }}
          >
            <View className="flex-row border-b" style={{ borderBottomColor: uiColors.divider }}>
              <OrderBookHeaderCell width={92}>Direction</OrderBookHeaderCell>
              <OrderBookHeaderCell width={124}>Position</OrderBookHeaderCell>
              <OrderBookHeaderCell width={136}>Size</OrderBookHeaderCell>
              <OrderBookHeaderCell width={136}>Flow</OrderBookHeaderCell>
              <OrderBookHeaderCell width={104}>Start</OrderBookHeaderCell>
              <OrderBookHeaderCell width={104}>End</OrderBookHeaderCell>
            </View>
            <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
              {rows.map((row) => (
                <View
                  key={row.position.publicKey.toBase58()}
                  className="flex-row border-b"
                  style={{ borderBottomColor: uiColors.divider }}
                >
                  <OrderBookCell width={92}>
                    <View
                      className="self-start rounded-full border px-2.5 py-1"
                      style={{
                        backgroundColor: row.direction === 'Buy' ? uiColors.buySoft : uiColors.dangerBg,
                        borderColor: row.direction === 'Buy' ? uiColors.successBorder : uiColors.dangerBorder,
                      }}
                    >
                      <Text
                        className="text-[11px] font-semibold leading-4"
                        style={{ color: row.direction === 'Buy' ? uiColors.buyText : uiColors.dangerText }}
                      >
                        {row.direction}
                      </Text>
                    </View>
                  </OrderBookCell>
                  <OrderBookCell width={124}>
                    <Text className="text-xs leading-5" style={[{ color: uiColors.textMuted }, TABULAR_NUMS]}>
                      {shortenAddress(row.position.publicKey.toBase58())}
                    </Text>
                  </OrderBookCell>
                  <OrderBookCell width={136}>
                    <Text
                      className="text-sm font-medium leading-5"
                      style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                    >
                      {formatAtoms(row.amountAtoms, row.amountDecimals)} {row.amountToken}
                    </Text>
                  </OrderBookCell>
                  <OrderBookCell width={136}>
                    <Text className="text-sm leading-5" style={[{ color: uiColors.textMuted }, TABULAR_NUMS]}>
                      {formatAtoms(row.flowAtomsPerSlot, row.amountDecimals)} {row.amountToken}/slot
                    </Text>
                  </OrderBookCell>
                  <OrderBookCell width={104}>
                    <Text className="text-sm leading-5" style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}>
                      {row.startSlot.toString()}
                    </Text>
                  </OrderBookCell>
                  <OrderBookCell width={104}>
                    <Text className="text-sm leading-5" style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}>
                      {row.endSlot.toString()}
                    </Text>
                  </OrderBookCell>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function OrderBookHeaderCell({ children, width }: { children: string; width: number }) {
  return (
    <View className="px-3 py-3" style={{ width }}>
      <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
        {children}
      </Text>
    </View>
  );
}

function OrderBookCell({ children, width }: { children: ReactNode; width: number }) {
  return (
    <View className="px-3 py-3 justify-center" style={{ width }}>
      {children}
    </View>
  );
}

function OrderBookState({ children }: { children: ReactNode }) {
  return (
    <View
      className="min-h-[260px] items-center justify-center rounded-xl border px-6"
      style={{ backgroundColor: uiColors.panelSoft, borderColor: uiColors.divider }}
    >
      {children}
    </View>
  );
}

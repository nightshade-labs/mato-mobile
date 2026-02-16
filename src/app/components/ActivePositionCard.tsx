import { Pressable, Text, View } from 'react-native';
import type { TradePosition } from '../hooks/useTradePositions';
import type { StreamingMarketState } from '../hooks/useStreamingMarketState';

interface ActivePositionCardProps {
  position: TradePosition;
  baseTicker: string;
  quoteTicker: string;
  baseDecimals: number;
  quoteDecimals: number;
  isClosing: boolean;
  closeButtonLabel: string;
  onClose: () => void;
  streamingState: StreamingMarketState | null;
}

const BOOKKEEPING_PRECISION_FACTOR = 1_000_000_000_000_000n;

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

function clampToRange(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toSlotNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export function ActivePositionCard({
  position,
  baseTicker,
  quoteTicker,
  baseDecimals,
  quoteDecimals,
  isClosing,
  closeButtonLabel,
  onClose,
  streamingState,
}: ActivePositionCardProps) {
  const isBuy = position.isBuy;
  const depositedToken = isBuy ? quoteTicker : baseTicker;
  const depositedDecimals = isBuy ? quoteDecimals : baseDecimals;
  const swappedToken = isBuy ? baseTicker : quoteTicker;
  const swappedDecimals = isBuy ? baseDecimals : quoteDecimals;
  const sideLabel = isBuy ? 'Buy' : 'Sell';
  const flowLabel = isBuy ? `${quoteTicker} -> ${baseTicker}` : `${baseTicker} -> ${quoteTicker}`;

  const amountAtoms = BigInt(position.amount.toString());
  const startSlot = toSlotNumber(position.startSlot);
  const endSlot = toSlotNumber(position.endSlot);
  const durationSlots = Math.max(1, endSlot - startSlot);
  const flowAtomsPerSlot = amountAtoms / BigInt(durationSlots);

  const currentSlot = streamingState ? clampToRange(streamingState.currentSlot, startSlot, endSlot) : startSlot;
  const elapsedSlots = Math.max(0, currentSlot - startSlot);
  const spentAtomsUncapped = flowAtomsPerSlot * BigInt(elapsedSlots);
  const spentAtoms = spentAtomsUncapped > amountAtoms ? amountAtoms : spentAtomsUncapped;
  const remainingAtoms = amountAtoms > spentAtoms ? amountAtoms - spentAtoms : 0n;
  const remainingPercent = amountAtoms > 0n ? Number((remainingAtoms * 10000n) / amountAtoms) / 100 : 0;

  let swappedEstimateAtoms: bigint | null = null;
  if (streamingState) {
    const bookkeepingSnapshot = BigInt(position.bookkeepingSnapshot.toString());
    const liveBookkeeping = isBuy ? streamingState.bookkeepingBasePerQuote : streamingState.bookkeepingQuotePerBase;
    const bookkeepingDelta = liveBookkeeping > bookkeepingSnapshot ? liveBookkeeping - bookkeepingSnapshot : 0n;

    const staleSlots = Math.max(0, currentSlot - streamingState.bookkeepingLastUpdateSlot);
    let staleAccumulator = 0n;

    if (staleSlots > 0) {
      const staleSlotCount = BigInt(staleSlots);
      if (isBuy) {
        if (streamingState.marketQuoteFlow > 0n) {
          staleAccumulator =
            (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketBaseFlow * staleSlotCount) /
            streamingState.marketQuoteFlow;
        }
      } else if (streamingState.marketBaseFlow > 0n) {
        staleAccumulator =
          (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketQuoteFlow * staleSlotCount) / streamingState.marketBaseFlow;
      }
    }

    const accumulatedPrice = bookkeepingDelta + staleAccumulator;
    swappedEstimateAtoms = (flowAtomsPerSlot * accumulatedPrice) / BOOKKEEPING_PRECISION_FACTOR;
  }

  return (
    <View className="rounded-xl border border-[#323a64] bg-[#10142a] p-4 mb-3">
      <Text className="text-white text-base font-semibold">
        {sideLabel} ({flowLabel})
      </Text>

      <Text className="text-[#b6bee3] text-sm mt-1">
        Deposited: {formatAtomsToDisplay(amountAtoms, depositedDecimals)} {depositedToken}
      </Text>
      <Text className="text-[#b6bee3] text-sm mt-1">
        Flow: {formatAtomsToDisplay(flowAtomsPerSlot, depositedDecimals)} {depositedToken}/slot
      </Text>
      <Text className="text-[#b6bee3] text-sm mt-1">
        Remaining: {formatAtomsToDisplay(remainingAtoms, depositedDecimals)} {depositedToken}
      </Text>
      <View className="mt-2 h-2 rounded-full bg-[#2a3258]">
        <View className="h-2 rounded-full bg-[#27b46e]" style={{ width: `${Math.max(0, 100 - remainingPercent)}%` }} />
      </View>
      <Text className="text-[#8b93bd] text-xs mt-1">{remainingPercent.toFixed(2)}% remaining</Text>

      <Text className="text-[#b6bee3] text-sm mt-2">
        Swapped estimate:{' '}
        {swappedEstimateAtoms === null
          ? '—'
          : `${formatAtomsToDisplay(swappedEstimateAtoms, swappedDecimals)} ${swappedToken}`}
      </Text>

      <Text className="text-[#8b93bd] text-xs mt-2">
        Position: {position.publicKey.toBase58().slice(0, 6)}...
        {position.publicKey.toBase58().slice(-6)}
      </Text>
      {streamingState && <Text className="text-[#8b93bd] text-xs mt-1">Current slot: {currentSlot}</Text>}

      <Pressable
        onPress={onClose}
        disabled={isClosing}
        className={`rounded-xl py-3 items-center mt-3 ${isClosing ? 'bg-[#4a2d30]' : 'bg-[#d4525d]'}`}
      >
        <Text className="text-white font-semibold text-sm">{closeButtonLabel}</Text>
      </Pressable>
    </View>
  );
}

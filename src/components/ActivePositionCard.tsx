import { useState } from 'react';
import type { PublicKey } from '@solana/web3.js';
import { Pressable, Text, View } from 'react-native';
import { useEndSlotBookkeepingSnapshot } from '../hooks/useEndSlotBookkeepingSnapshot';
import type { TradePosition } from '../hooks/useTradePositions';
import type { StreamingMarketState } from '../hooks/useStreamingMarketState';
import { uiColors } from '../theme/colors';

interface ActivePositionCardProps {
  market: PublicKey;
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
  market,
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
  const [expanded, setExpanded] = useState(false);
  const isBuy = position.isBuy;
  const depositedToken = isBuy ? quoteTicker : baseTicker;
  const depositedDecimals = isBuy ? quoteDecimals : baseDecimals;
  const swappedToken = isBuy ? baseTicker : quoteTicker;
  const swappedDecimals = isBuy ? baseDecimals : quoteDecimals;
  const sideLabel = isBuy ? 'Buy' : 'Sell';
  const flowLabel = isBuy ? `${quoteTicker} → ${baseTicker}` : `${baseTicker} → ${quoteTicker}`;

  const amountAtoms = BigInt(position.amount.toString());
  const startSlot = toSlotNumber(position.startSlot);
  const endSlot = toSlotNumber(position.endSlot);
  const durationSlots = Math.max(1, endSlot - startSlot);
  const durationSlotsBigInt = BigInt(durationSlots);
  const flowAtomsPerSlot = amountAtoms / durationSlotsBigInt;

  const currentSlot = streamingState ? clampToRange(streamingState.currentSlot, startSlot, endSlot) : startSlot;
  const hasPositionEnded = streamingState ? streamingState.currentSlot > endSlot : false;
  const elapsedSlots = clampToRange(currentSlot - startSlot, 0, durationSlots);
  const elapsedSlotsBigInt = BigInt(elapsedSlots);
  const spentAtomsUncapped = (amountAtoms * elapsedSlotsBigInt) / durationSlotsBigInt;
  const spentAtoms = spentAtomsUncapped > amountAtoms ? amountAtoms : spentAtomsUncapped;
  const remainingAtoms = amountAtoms > spentAtoms ? amountAtoms - spentAtoms : 0n;
  const remainingPercent = amountAtoms > 0n ? Number((remainingAtoms * 10000n) / amountAtoms) / 100 : 0;
  const progressPercent = Math.max(0, 100 - remainingPercent);
  const { snapshot: endSlotBookkeepingSnapshot } = useEndSlotBookkeepingSnapshot({
    market,
    endSlot,
    endSlotInterval: streamingState?.endSlotInterval ?? null,
    isBuy,
    enabled: hasPositionEnded,
  });

  let swappedEstimateAtoms: bigint | null = null;
  if (streamingState) {
    const bookkeepingSnapshot = BigInt(position.bookkeepingSnapshot.toString());
    const liveBookkeeping = isBuy ? streamingState.bookkeepingBasePerQuote : streamingState.bookkeepingQuotePerBase;
    const effectiveBookkeeping = hasPositionEnded ? endSlotBookkeepingSnapshot : liveBookkeeping;

    if (effectiveBookkeeping !== null) {
      const bookkeepingDelta = effectiveBookkeeping > bookkeepingSnapshot ? effectiveBookkeeping - bookkeepingSnapshot : 0n;

      let staleAccumulator = 0n;
      if (!hasPositionEnded) {
        const staleSlots = Math.max(0, currentSlot - streamingState.bookkeepingLastUpdateSlot);
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
              (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketQuoteFlow * staleSlotCount) /
              streamingState.marketBaseFlow;
          }
        }
      }

      const accumulatedPrice = bookkeepingDelta + staleAccumulator;
      swappedEstimateAtoms = (amountAtoms * accumulatedPrice) / (durationSlotsBigInt * BOOKKEEPING_PRECISION_FACTOR);
    }
  }

  return (
    <View
      className="rounded-xl p-3 mb-2.5"
      style={{ borderColor: uiColors.border, backgroundColor: uiColors.surfaceAlt, borderWidth: 1 }}
    >
      <Pressable onPress={() => setExpanded((prev) => !prev)}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View
              className="px-2 py-0.5 rounded-md"
              style={{ backgroundColor: isBuy ? uiColors.successBg : uiColors.dangerBg }}
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: isBuy ? uiColors.accentText : uiColors.dangerText }}
              >
                {sideLabel}
              </Text>
            </View>
            <Text className="text-[#9ea8d6] text-xs ml-2">{flowLabel}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[#d7defa] text-xs font-medium mr-2">
              {formatAtomsToDisplay(amountAtoms, depositedDecimals)} {depositedToken}
            </Text>
            <Text className="text-[#7d88b8] text-[10px]">{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>

        {!expanded && (
          <View className="mt-2">
            <View className="h-1.5 rounded-full bg-[#2a3258]">
              <View
                className="h-1.5 rounded-full"
                style={{ backgroundColor: uiColors.accent, width: `${progressPercent}%` }}
              />
            </View>
            <Text className="text-[#8b93bd] text-[10px] mt-1">{remainingPercent.toFixed(1)}% remaining</Text>
          </View>
        )}
      </Pressable>

      {expanded && (
        <>
          <View className="mt-2 pt-2 border-t" style={{ borderTopColor: uiColors.divider }}>
            <View className="flex-row justify-between mb-1">
              <View className="flex-1 pr-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Deposited</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(amountAtoms, depositedDecimals)} {depositedToken}
                </Text>
              </View>
              <View className="flex-1 pl-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Remaining</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(remainingAtoms, depositedDecimals)} {depositedToken}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between mb-1">
              <View className="flex-1 pr-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Flow</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(flowAtomsPerSlot, depositedDecimals)} {depositedToken}/Slot
                </Text>
              </View>
              <View className="flex-1 pl-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Swapped</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {swappedEstimateAtoms === null
                    ? '—'
                    : `${formatAtomsToDisplay(swappedEstimateAtoms, swappedDecimals)} ${swappedToken}`}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-2 h-1.5 rounded-full bg-[#2a3258]">
            <View
              className="h-1.5 rounded-full"
              style={{ backgroundColor: uiColors.accent, width: `${progressPercent}%` }}
            />
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-[#8b93bd] text-[10px]">{remainingPercent.toFixed(2)}% remaining</Text>
            <Text className="text-[#8b93bd] text-[10px]">
              {position.publicKey.toBase58().slice(0, 6)}...{position.publicKey.toBase58().slice(-6)}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            disabled={isClosing}
            className="rounded-lg py-2.5 items-center mt-2"
            style={{ backgroundColor: isClosing ? '#4a2d30' : uiColors.danger }}
          >
            <Text className="text-white font-semibold text-xs">{closeButtonLabel}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

import { useRef, useState } from 'react';
import type { PublicKey } from '@solana/web3.js';
import { Pressable, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
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
const FLOW_PRECISION_FACTOR = 1_000_000_000n;
const TABULAR_NUMS: TextStyle = { fontVariant: ['tabular-nums'] };
const OVERLINE: TextStyle = { textTransform: 'uppercase', letterSpacing: 0.8 };
type CachedSwappedEstimate = { amount: bigint; consumedAtoms: bigint; source: 'active' | 'fallback' | 'snapshot' };
const lastSwappedEstimateByPosition = new Map<string, CachedSwappedEstimate>();
type CachedTerminalEstimate = { amount: bigint; consumedAtoms: bigint };
const projectedEndEstimateByPosition = new Map<string, CachedTerminalEstimate>();

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

function computeAveragePrice(
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
  const lastActiveSwappedEstimateRef = useRef<bigint | null>(null);
  const lastActiveConsumedAtomsRef = useRef<bigint | null>(null);
  const isBuy = position.isBuy;
  const depositedToken = isBuy ? quoteTicker : baseTicker;
  const depositedDecimals = isBuy ? quoteDecimals : baseDecimals;
  const swappedToken = isBuy ? baseTicker : quoteTicker;
  const swappedDecimals = isBuy ? baseDecimals : quoteDecimals;
  const sideLabel = isBuy ? 'Buy' : 'Sell';
  const flowLabel = isBuy ? `${quoteTicker} → ${baseTicker}` : `${baseTicker} → ${quoteTicker}`;
  const positionKey = position.publicKey.toBase58();

  const amountAtoms = BigInt(position.amount.toString());
  const startSlot = toSlotNumber(position.startSlot);
  const endSlot = toSlotNumber(position.endSlot);
  const durationSlots = Math.max(1, endSlot - startSlot);
  const durationSlotsBigInt = BigInt(durationSlots);
  const scaledFlowAtomsPerSlot = (amountAtoms * FLOW_PRECISION_FACTOR) / durationSlotsBigInt;
  const flowAtomsPerSlot = scaledFlowAtomsPerSlot / FLOW_PRECISION_FACTOR;

  const currentSlot = streamingState ? clampToRange(streamingState.currentSlot, startSlot, endSlot) : startSlot;
  const hasPositionEnded = streamingState ? streamingState.currentSlot > endSlot : false;
  const elapsedSlots = clampToRange(currentSlot - startSlot, 0, durationSlots);
  const elapsedSlotsBigInt = BigInt(elapsedSlots);
  const scaledDepositAtoms = amountAtoms * FLOW_PRECISION_FACTOR;
  const scaledSpentAtomsUncapped = elapsedSlotsBigInt * scaledFlowAtomsPerSlot;
  const scaledSpentAtoms = scaledSpentAtomsUncapped > scaledDepositAtoms ? scaledDepositAtoms : scaledSpentAtomsUncapped;
  const scaledRemainingAtoms = scaledDepositAtoms > scaledSpentAtoms ? scaledDepositAtoms - scaledSpentAtoms : 0n;
  const remainingAtoms = scaledRemainingAtoms / FLOW_PRECISION_FACTOR;
  const consumedAtoms = amountAtoms > remainingAtoms ? amountAtoms - remainingAtoms : 0n;
  const scaledSpentAtEndUncapped = durationSlotsBigInt * scaledFlowAtomsPerSlot;
  const scaledSpentAtEnd = scaledSpentAtEndUncapped > scaledDepositAtoms ? scaledDepositAtoms : scaledSpentAtEndUncapped;
  const scaledRemainingAtEnd = scaledDepositAtoms > scaledSpentAtEnd ? scaledDepositAtoms - scaledSpentAtEnd : 0n;
  const remainingAtomsAtEnd = scaledRemainingAtEnd / FLOW_PRECISION_FACTOR;
  const consumedAtomsAtEnd = amountAtoms > remainingAtomsAtEnd ? amountAtoms - remainingAtomsAtEnd : 0n;
  const remainingPercent = amountAtoms > 0n ? Number((remainingAtoms * 10000n) / amountAtoms) / 100 : 0;
  const progressPercent = Math.max(0, 100 - remainingPercent);
  const { snapshot: endSlotBookkeepingSnapshot } = useEndSlotBookkeepingSnapshot({
    market,
    endSlot,
    endSlotInterval: streamingState?.endSlotInterval ?? null,
    currentSlot: streamingState?.currentSlot ?? null,
    isBuy,
    enabled: hasPositionEnded,
  });

  let swappedEstimateAtoms: bigint | null = null;
  let consumedAtomsForAverage = consumedAtoms;
  if (streamingState) {
    const bookkeepingSnapshot = BigInt(position.bookkeepingSnapshot.toString());
    const liveBookkeeping = isBuy ? streamingState.bookkeepingBasePerQuote : streamingState.bookkeepingQuotePerBase;
    const liveBookkeepingDelta = liveBookkeeping > bookkeepingSnapshot ? liveBookkeeping - bookkeepingSnapshot : 0n;

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

    const liveAccumulatedPrice = liveBookkeepingDelta + staleAccumulator;
    const liveSwappedEstimate =
      (scaledFlowAtomsPerSlot * liveAccumulatedPrice) / (FLOW_PRECISION_FACTOR * BOOKKEEPING_PRECISION_FACTOR);

    let perSlotBookkeepingAccumulator = 0n;
    if (isBuy) {
      if (streamingState.marketQuoteFlow > 0n) {
        perSlotBookkeepingAccumulator =
          (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketBaseFlow) / streamingState.marketQuoteFlow;
      }
    } else if (streamingState.marketBaseFlow > 0n) {
      perSlotBookkeepingAccumulator =
        (BOOKKEEPING_PRECISION_FACTOR * streamingState.marketQuoteFlow) / streamingState.marketBaseFlow;
    }
    const slotsToEnd = Math.max(0, endSlot - currentSlot);
    const projectedAccumulatedAtEnd = liveAccumulatedPrice + perSlotBookkeepingAccumulator * BigInt(slotsToEnd);
    const projectedEndSwappedEstimate =
      (scaledFlowAtomsPerSlot * projectedAccumulatedAtEnd) / (FLOW_PRECISION_FACTOR * BOOKKEEPING_PRECISION_FACTOR);

    if (!hasPositionEnded) {
      swappedEstimateAtoms = liveSwappedEstimate;
      consumedAtomsForAverage = consumedAtoms;
      lastActiveSwappedEstimateRef.current = liveSwappedEstimate;
      lastActiveConsumedAtomsRef.current = consumedAtoms;
      lastSwappedEstimateByPosition.set(positionKey, { amount: liveSwappedEstimate, consumedAtoms, source: 'active' });
      projectedEndEstimateByPosition.set(positionKey, {
        amount: projectedEndSwappedEstimate,
        consumedAtoms: consumedAtomsAtEnd,
      });
    } else {
      const cachedEstimate = lastSwappedEstimateByPosition.get(positionKey) ?? null;
      const projectedTerminalEstimate = projectedEndEstimateByPosition.get(positionKey) ?? null;
      const snapshotDelta =
        endSlotBookkeepingSnapshot !== null && endSlotBookkeepingSnapshot > bookkeepingSnapshot
          ? endSlotBookkeepingSnapshot - bookkeepingSnapshot
          : null;
      const snapshotSwappedEstimate =
        snapshotDelta === null
          ? null
          : (scaledFlowAtomsPerSlot * snapshotDelta) / (FLOW_PRECISION_FACTOR * BOOKKEEPING_PRECISION_FACTOR);

      const frozenAtEnd = lastActiveSwappedEstimateRef.current ?? cachedEstimate?.amount ?? null;
      const frozenConsumedAtEnd = lastActiveConsumedAtomsRef.current ?? cachedEstimate?.consumedAtoms ?? null;
      let terminalFallbackAmount = frozenAtEnd;
      let terminalFallbackConsumed = frozenConsumedAtEnd ?? consumedAtoms;
      if (
        projectedTerminalEstimate !== null &&
        (terminalFallbackAmount === null || projectedTerminalEstimate.amount > terminalFallbackAmount)
      ) {
        terminalFallbackAmount = projectedTerminalEstimate.amount;
        terminalFallbackConsumed = projectedTerminalEstimate.consumedAtoms;
      }

      if (snapshotSwappedEstimate === null) {
        if (terminalFallbackAmount !== null) {
          swappedEstimateAtoms = terminalFallbackAmount;
          consumedAtomsForAverage = terminalFallbackConsumed;
        } else {
          // Snapshot can lag by ~ARRAY_LENGTH*endSlotInterval slots; keep a stable fallback meanwhile.
          swappedEstimateAtoms = liveSwappedEstimate;
          consumedAtomsForAverage = consumedAtoms;
          lastSwappedEstimateByPosition.set(positionKey, {
            amount: liveSwappedEstimate,
            consumedAtoms,
            source: 'fallback',
          });
        }
      } else {
        const shouldClampDrop =
          terminalFallbackAmount !== null &&
          (lastActiveSwappedEstimateRef.current !== null ||
            cachedEstimate?.source === 'active' ||
            projectedTerminalEstimate !== null);
        if (shouldClampDrop && terminalFallbackAmount !== null && snapshotSwappedEstimate <= terminalFallbackAmount) {
          swappedEstimateAtoms = terminalFallbackAmount;
          consumedAtomsForAverage = terminalFallbackConsumed;
          lastSwappedEstimateByPosition.set(positionKey, {
            amount: terminalFallbackAmount,
            consumedAtoms: consumedAtomsForAverage,
            source: projectedTerminalEstimate !== null ? 'fallback' : cachedEstimate?.source ?? 'active',
          });
        } else {
          swappedEstimateAtoms = snapshotSwappedEstimate;
          consumedAtomsForAverage = consumedAtoms;
          lastSwappedEstimateByPosition.set(positionKey, {
            amount: swappedEstimateAtoms,
            consumedAtoms,
            source: 'snapshot',
          });
        }
      }
    }

    const cachedMetrics = lastSwappedEstimateByPosition.get(positionKey) ?? null;
    if (swappedEstimateAtoms !== null && cachedMetrics !== null && swappedEstimateAtoms < cachedMetrics.amount) {
      swappedEstimateAtoms = cachedMetrics.amount;
      consumedAtomsForAverage = cachedMetrics.consumedAtoms;
    }
    if (swappedEstimateAtoms !== null) {
      const cachedSource = lastSwappedEstimateByPosition.get(positionKey)?.source;
      lastSwappedEstimateByPosition.set(positionKey, {
        amount: swappedEstimateAtoms,
        consumedAtoms: consumedAtomsForAverage,
        source: cachedSource ?? (hasPositionEnded ? 'snapshot' : 'active'),
      });
    }
  }

  const averagePrice = (() => {
    if (swappedEstimateAtoms === null) return null;
    const quoteAtoms = isBuy ? consumedAtomsForAverage : swappedEstimateAtoms;
    const baseAtoms = isBuy ? swappedEstimateAtoms : consumedAtomsForAverage;
    return computeAveragePrice(quoteAtoms, quoteDecimals, baseAtoms, baseDecimals);
  })();
  const averagePriceLabel = isBuy ? 'Average Price' : 'Average Price';

  return (
    <View
      className="rounded-xl p-4 mb-3"
      style={{ borderColor: uiColors.border, backgroundColor: uiColors.surfaceAlt, borderWidth: 1 }}
    >
      <Pressable onPress={() => setExpanded((prev) => !prev)}>
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
            <Text
              className="text-[14px] font-semibold leading-5 mr-2.5"
              style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
            >
              {formatAtomsToDisplay(amountAtoms, depositedDecimals)} {depositedToken}
            </Text>
            <Text className="text-[11px] leading-4" style={{ color: uiColors.textSubtle }}>
              {expanded ? '▲' : '▼'}
            </Text>
          </View>
        </View>

        {!expanded && (
          <View className="mt-3">
            <View className="h-1.5 rounded-full" style={{ backgroundColor: uiColors.divider }}>
              <View
                className="h-1.5 rounded-full"
                style={{ backgroundColor: uiColors.accent, width: `${progressPercent}%` }}
              />
            </View>
            <Text className="text-[11px] mt-1.5 leading-4" style={[{ color: uiColors.textSubtle }, TABULAR_NUMS]}>
              {remainingPercent.toFixed(1)}% remaining
            </Text>
          </View>
        )}
      </Pressable>

      {expanded && (
        <>
          <View className="mt-3 pt-3 border-t" style={{ borderTopColor: uiColors.divider }}>
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
                  {formatAtomsToDisplay(amountAtoms, depositedDecimals)} {depositedToken}
                </Text>
              </View>
              <View className="flex-1 pl-2">
                <Text
                  className="text-[10px] font-semibold leading-4"
                  style={[{ color: uiColors.textSubtle }, OVERLINE]}
                >
                  Remaining
                </Text>
                <Text
                  className="text-[14px] font-semibold leading-5"
                  style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                >
                  {formatAtomsToDisplay(remainingAtoms, depositedDecimals)} {depositedToken}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between">
              <View className="flex-1 pr-2">
                <Text
                  className="text-[10px] font-semibold leading-4"
                  style={[{ color: uiColors.textSubtle }, OVERLINE]}
                >
                  Flow
                </Text>
                <Text
                  className="text-[14px] font-semibold leading-5"
                  style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                >
                  {formatAtomsToDisplay(flowAtomsPerSlot, depositedDecimals)} {depositedToken}/Slot
                </Text>
              </View>
              <View className="flex-1 pl-2">
                <Text
                  className="text-[10px] font-semibold leading-4"
                  style={[{ color: uiColors.textSubtle }, OVERLINE]}
                >
                  Swapped
                </Text>
                <Text
                  className="text-[14px] font-semibold leading-5"
                  style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
                >
                  {swappedEstimateAtoms === null
                    ? '—'
                    : `${formatAtomsToDisplay(swappedEstimateAtoms, swappedDecimals)} ${swappedToken}`}
                </Text>
              </View>
            </View>
            <View className="mt-2 pt-2 border-t" style={{ borderTopColor: uiColors.divider }}>
              <Text className="text-[10px] font-semibold leading-4" style={[{ color: uiColors.textSubtle }, OVERLINE]}>
                {averagePriceLabel}
              </Text>
              <Text
                className="text-[14px] font-semibold leading-5"
                style={[{ color: uiColors.textSecondary }, TABULAR_NUMS]}
              >
                {averagePrice === null ? '—' : `${formatPrice(averagePrice)} ${quoteTicker}/${baseTicker}`}
              </Text>
            </View>
          </View>

          <View className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: uiColors.divider }}>
            <View
              className="h-1.5 rounded-full"
              style={{ backgroundColor: uiColors.accent, width: `${progressPercent}%` }}
            />
          </View>
          <View className="flex-row justify-between mt-1.5">
            <Text className="text-[11px] leading-4" style={[{ color: uiColors.textSubtle }, TABULAR_NUMS]}>
              {remainingPercent.toFixed(2)}% remaining
            </Text>
            <Text className="text-[11px] leading-4" style={{ color: uiColors.textSubtle }}>
              {position.publicKey.toBase58().slice(0, 6)}...{position.publicKey.toBase58().slice(-6)}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            disabled={isClosing}
            className="rounded-lg py-3 items-center mt-3"
            style={{ backgroundColor: isClosing ? uiColors.dangerBg : uiColors.danger }}
          >
            <Text className="text-white font-semibold text-sm leading-5">{closeButtonLabel}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

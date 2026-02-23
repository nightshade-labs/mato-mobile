import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useClosePositionEvents } from '../integrations/supabase/useClosePositionEvents';
import { uiColors } from '../theme/colors';

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

function computeEffectivePrice(
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

  const content = (
    <>
      {!embedded && <Text className="text-white text-xl font-bold mb-4">Closed Positions</Text>}

      {loading ? (
        <ActivityIndicator size="small" color="#c5cbe8" />
      ) : events.length === 0 ? (
        <Text className="text-[#8b93bd] text-sm">No closed positions yet.</Text>
      ) : (
        <View>
          {events.map((event) => (
            <ClosedPositionRow
              key={event.id}
              event={event}
              baseTicker={baseTicker}
              quoteTicker={quoteTicker}
              baseDecimals={baseDecimals}
              quoteDecimals={quoteDecimals}
            />
          ))}
        </View>
      )}

      {error && <Text className="text-[#f48993] text-sm mt-2">{error}</Text>}
    </>
  );

  if (embedded) {
    return <View>{content}</View>;
  }

  return <View className="rounded-2xl bg-[#171b34] border border-[#2a2f53] p-5 mt-5">{content}</View>;
}

interface ClosedPositionRowProps {
  event: {
    id: number;
    signature: string;
    slot: number;
    is_buy: number;
    deposit_amount: bigint;
    swapped_amount: bigint;
    remaining_amount: bigint;
    fee_amount: bigint;
  };
  baseTicker: string;
  quoteTicker: string;
  baseDecimals: number;
  quoteDecimals: number;
}

function ClosedPositionRow({ event, baseTicker, quoteTicker, baseDecimals, quoteDecimals }: ClosedPositionRowProps) {
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

  const quoteNumeratorAtoms = isBuy ? consumedAtoms : receivedAtoms;
  const baseDenominatorAtoms = isBuy ? receivedAtoms : consumedAtoms;
  const effectivePrice = computeEffectivePrice(quoteNumeratorAtoms, quoteDecimals, baseDenominatorAtoms, baseDecimals);
  const effectivePriceLabel = isBuy ? 'Effective price paid' : 'Effective price received';
  const consumedLabel = isBuy ? 'Actually Spent' : 'Actually Sold';

  const handleOpenTx = () => {
    if (event.signature) {
      Linking.openURL(`https://solscan.io/tx/${event.signature}?cluster=testnet`);
    }
  };

  return (
    <Pressable onPress={() => setExpanded((prev) => !prev)}>
      <View
        className="rounded-xl p-3 mb-2.5"
        style={{ borderColor: uiColors.border, backgroundColor: uiColors.surfaceAlt, borderWidth: 1 }}
      >
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
            <Pressable onPress={handleOpenTx} hitSlop={8}>
              <Text className="text-[#7d88b8] text-[10px] underline">{shortenSignature(event.signature)}</Text>
            </Pressable>
            <Text className="text-[#7d88b8] text-[10px] ml-2">{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>

        {!expanded && (
          <View
            className="flex-row items-center justify-between mt-2 pt-2 border-t"
            style={{ borderTopColor: uiColors.divider }}
          >
            <Text className="text-[#d7defa] text-xs font-medium">
              {formatAtomsToDisplay(consumedAtoms, depositDecimals)} {depositToken}
            </Text>
            <Text className="text-[#7380b4] text-[10px]">→</Text>
            <Text className="text-[#d7defa] text-xs font-medium">
              {formatAtomsToDisplay(receivedAtoms, swappedDecimals)} {swappedToken}
            </Text>
            {effectivePrice !== null && (
              <Text className="text-[#8b93bd] text-[10px]">@ {formatPrice(effectivePrice)}</Text>
            )}
          </View>
        )}

        {expanded && (
          <View className="mt-2 pt-2 border-t" style={{ borderTopColor: uiColors.divider }}>
            <View className="flex-row justify-between mb-1">
              <View className="flex-1 pr-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Deposited</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(depositedAtoms, depositDecimals)} {depositToken}
                </Text>
              </View>
              <View className="flex-1 pl-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">{consumedLabel}</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(consumedAtoms, depositDecimals)} {depositToken}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between mb-1">
              <View className="flex-1 pr-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Received</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(receivedAtoms, swappedDecimals)} {swappedToken}
                </Text>
              </View>
              <View className="flex-1 pl-2">
                <Text className="text-[#7380b4] text-[10px] uppercase">Fee</Text>
                <Text className="text-[#d7defa] text-xs font-medium">
                  {formatAtomsToDisplay(feeAtoms, feeDecimals)} {feeToken}
                </Text>
              </View>
            </View>
            <View className="mt-1 pt-1 border-t" style={{ borderTopColor: uiColors.divider }}>
              <Text className="text-[#7380b4] text-[10px] uppercase">{effectivePriceLabel}</Text>
              <Text className="text-[#d7defa] text-xs font-medium">
                {effectivePrice === null ? '—' : `${formatPrice(effectivePrice)} ${quoteTicker}/${baseTicker}`}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

import { ActivityIndicator, Text, View } from 'react-native';
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

function formatQuotePerBasePrice(
  quoteAtoms: bigint,
  quoteDecimals: number,
  baseAtoms: bigint,
  baseDecimals: number,
  precision: number = 6,
): string | null {
  if (quoteAtoms < 0n || baseAtoms <= 0n) return null;

  const scale = 10n ** BigInt(precision);
  const scaledQuote = quoteAtoms * scale * 10n ** BigInt(baseDecimals);
  const scaledBase = baseAtoms * 10n ** BigInt(quoteDecimals);
  if (scaledBase <= 0n) return null;

  const scaledPrice = scaledQuote / scaledBase;
  const whole = scaledPrice / scale;
  const fraction = (scaledPrice % scale).toString().padStart(precision, '0').replace(/0+$/, '');

  if (fraction.length === 0) return whole.toString();
  return `${whole.toString()}.${fraction}`;
}

export function ClosedPositionsList({
  positionAuthority,
  marketId,
  baseTicker,
  quoteTicker,
  baseDecimals,
  quoteDecimals,
  embedded = false,
}: ClosedPositionsListProps) {
  const { events, loading, error } = useClosePositionEvents({
    positionAuthority,
    marketId,
    limit: 50,
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
          {events.map((event) => {
            const isBuy = event.is_buy === 1;
            const sideLabel = isBuy ? 'Buy' : 'Sell';
            const flowLabel = isBuy ? `${quoteTicker} -> ${baseTicker}` : `${baseTicker} -> ${quoteTicker}`;

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

            const quoteNumeratorAtoms = isBuy ? consumedAtoms : swappedAtoms;
            const baseDenominatorAtoms = isBuy ? swappedAtoms : consumedAtoms;
            const effectivePrice = formatQuotePerBasePrice(
              quoteNumeratorAtoms,
              quoteDecimals,
              baseDenominatorAtoms,
              baseDecimals,
            );
            const effectivePriceLabel = isBuy ? 'Effective price paid' : 'Effective price received';

            return (
              <View
                key={event.id}
                className="rounded-xl p-3 mb-2.5"
                style={{ borderColor: uiColors.border, backgroundColor: uiColors.surfaceAlt, borderWidth: 1 }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
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
                  <Text className="text-[#7d88b8] text-[10px]">Slot {event.slot}</Text>
                </View>

                <View className="mt-2 pt-2 border-t" style={{ borderTopColor: uiColors.divider }}>
                  <View className="flex-row justify-between mb-1">
                    <View className="flex-1 pr-2">
                      <Text className="text-[#7380b4] text-[10px] uppercase">Deposited</Text>
                      <Text className="text-[#d7defa] text-xs font-medium">
                        {formatAtomsToDisplay(depositedAtoms, depositDecimals)} {depositToken}
                      </Text>
                    </View>
                    <View className="flex-1 pl-2">
                      <Text className="text-[#7380b4] text-[10px] uppercase">Actually Swapped</Text>
                      <Text className="text-[#d7defa] text-xs font-medium">
                        {formatAtomsToDisplay(consumedAtoms, depositDecimals)} {depositToken}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <View className="flex-1 pr-2">
                      <Text className="text-[#7380b4] text-[10px] uppercase">Received</Text>
                      <Text className="text-[#d7defa] text-xs font-medium">
                        {formatAtomsToDisplay(swappedAtoms, swappedDecimals)} {swappedToken}
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
                      {effectivePrice === null ? '—' : `${effectivePrice} ${quoteTicker}/${baseTicker}`}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
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

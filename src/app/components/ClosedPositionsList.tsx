import { ActivityIndicator, Text, View } from 'react-native';
import { useClosePositionEvents } from '../../integrations/supabase/useClosePositionEvents';

interface ClosedPositionsListProps {
  positionAuthority: string;
  marketId: number;
  baseTicker: string;
  quoteTicker: string;
  baseDecimals: number;
  quoteDecimals: number;
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
}: ClosedPositionsListProps) {
  const { events, loading, error } = useClosePositionEvents({
    positionAuthority,
    marketId,
    limit: 50,
  });

  return (
    <View className="rounded-2xl bg-[#171b34] border border-[#2a2f53] p-5 mt-5">
      <Text className="text-white text-xl font-bold mb-4">Closed Positions</Text>

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
              <View key={event.id} className="rounded-xl border border-[#323a64] bg-[#10142a] p-4 mb-3">
                <Text className="text-white text-base font-semibold">
                  {sideLabel} ({flowLabel})
                </Text>
                <Text className="text-[#b6bee3] text-sm mt-1">
                  Deposited: {formatAtomsToDisplay(depositedAtoms, depositDecimals)} {depositToken}
                </Text>
                <Text className="text-[#b6bee3] text-sm mt-1">
                  Actually swapped: {formatAtomsToDisplay(consumedAtoms, depositDecimals)} {depositToken}
                </Text>
                <Text className="text-[#b6bee3] text-sm mt-1">
                  Swapped amount: {formatAtomsToDisplay(swappedAtoms, swappedDecimals)} {swappedToken}
                </Text>
                <Text className="text-[#b6bee3] text-sm mt-1">
                  Fees paid: {formatAtomsToDisplay(feeAtoms, feeDecimals)} {feeToken}
                </Text>
                <Text className="text-[#b6bee3] text-sm mt-1">
                  {effectivePriceLabel}:{' '}
                  {effectivePrice === null ? '—' : `${effectivePrice} ${quoteTicker}/${baseTicker}`}
                </Text>
                <Text className="text-[#8b93bd] text-xs mt-2">Slot: {event.slot}</Text>
              </View>
            );
          })}
        </View>
      )}

      {error && <Text className="text-[#f48993] text-sm mt-2">{error}</Text>}
    </View>
  );
}

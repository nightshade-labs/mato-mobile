import { Pressable, Text, View } from 'react-native';
import type { TradePosition } from '../hooks/useTradePositions';

interface ActivePositionCardProps {
  position: TradePosition;
  baseTicker: string;
  quoteTicker: string;
  baseDecimals: number;
  quoteDecimals: number;
  isClosing: boolean;
  closeButtonLabel: string;
  onClose: () => void;
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

export function ActivePositionCard({
  position,
  baseTicker,
  quoteTicker,
  baseDecimals,
  quoteDecimals,
  isClosing,
  closeButtonLabel,
  onClose,
}: ActivePositionCardProps) {
  const isBuy = position.isBuy;
  const depositedToken = isBuy ? quoteTicker : baseTicker;
  const depositedDecimals = isBuy ? quoteDecimals : baseDecimals;
  const depositedAmount = formatAtomsToDisplay(BigInt(position.amount.toString()), depositedDecimals);
  const sideLabel = isBuy ? 'Buy' : 'Sell';
  const flowLabel = isBuy ? `${quoteTicker} -> ${baseTicker}` : `${baseTicker} -> ${quoteTicker}`;

  return (
    <View className="rounded-xl border border-[#323a64] bg-[#10142a] p-4 mb-3">
      <Text className="text-white text-base font-semibold">
        {sideLabel} ({flowLabel})
      </Text>
      <Text className="text-[#b6bee3] text-sm mt-1">
        Deposited: {depositedAmount} {depositedToken}
      </Text>
      <Text className="text-[#8b93bd] text-xs mt-2">
        Position: {position.publicKey.toBase58().slice(0, 6)}...
        {position.publicKey.toBase58().slice(-6)}
      </Text>
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

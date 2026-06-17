import type BN from 'bn.js';
import type { TradePosition } from '../hooks/useTradePositions';

export type BatchCloseMode = 'ended' | 'all';

export function formatAtoms(amountAtoms: bigint, decimals: number): string {
  if (amountAtoms <= 0n) return '0';
  if (decimals <= 0) return amountAtoms.toString();

  const divisor = 10n ** BigInt(decimals);
  const whole = amountAtoms / divisor;
  const rawFraction = (amountAtoms % divisor).toString().padStart(decimals, '0');
  const visibleDecimals = Math.min(decimals, 6);
  const fraction = rawFraction.slice(0, visibleDecimals).replace(/0+$/, '');

  if (fraction.length === 0) return whole.toString();
  return `${whole.toString()}.${fraction}`;
}

export function formatSol(lamports: bigint | null): string | null {
  if (lamports === null) return null;
  return formatAtoms(lamports, 9);
}

export function isNativeBalanceBelowTransactionMinimum(lamports: bigint | null, minimumAtoms: bigint): boolean {
  return lamports !== null && lamports < minimumAtoms;
}

function toBigInt(value: BN | bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  return BigInt(value.toString());
}

function compareByEndSlotThenAddress(left: TradePosition, right: TradePosition): number {
  const leftEndSlot = toBigInt(left.endSlot);
  const rightEndSlot = toBigInt(right.endSlot);
  if (leftEndSlot < rightEndSlot) return -1;
  if (leftEndSlot > rightEndSlot) return 1;
  return left.publicKey.toBase58().localeCompare(right.publicKey.toBase58());
}

export function isEndedPosition(position: TradePosition, currentSlot: number | null): boolean {
  if (currentSlot === null) return false;
  return BigInt(Math.floor(currentSlot)) > toBigInt(position.endSlot);
}

export function selectBatchClosePositions({
  currentSlot,
  maxPositions,
  mode,
  positions,
}: {
  currentSlot: number | null;
  maxPositions: number;
  mode: BatchCloseMode;
  positions: TradePosition[];
}): TradePosition[] {
  const limit = Math.max(0, Math.floor(maxPositions));
  const candidates =
    mode === 'ended' ? positions.filter((position) => isEndedPosition(position, currentSlot)) : positions;
  return [...candidates].sort(compareByEndSlotThenAddress).slice(0, limit);
}

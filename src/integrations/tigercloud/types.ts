export interface ClosePositionEvent {
  id: number;
  event_key: string;
  event_index: number | null;
  signature: string;
  slot: number;
  position_authority: string;
  market_id: number;
  deposit_amount: bigint;
  swapped_amount: bigint;
  remaining_amount: bigint;
  fee_amount: bigint;
  is_buy: number;
  created_at: string;
  start_slot: number | null;
  end_slot: number | null;
}

export interface MarketUpdateEvent {
  id: number;
  signature: string;
  slot: number;
  market_id: number;
  base_flow: bigint;
  quote_flow: bigint;
  created_at: string;
}

export interface MarketConfig {
  id: number;
  market_id: number;
  base_ticker: string | null;
  quote_ticker: string | null;
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  created_at: string | null;
}

export interface ClosePositionEventRow {
  id?: number | string;
  event_uid?: string;
  event_index?: number | string | null;
  signature: string;
  slot: number;
  position_authority: string;
  market_id: number;
  deposit_amount: string | number;
  swapped_amount: string | number;
  remaining_amount: string | number;
  fee_amount: string | number;
  is_buy: number | boolean;
  created_at: string;
  start_slot: number | null;
  end_slot: number | null;
}

export interface MarketUpdateEventRow {
  id?: number | string;
  event_uid?: string;
  signature: string;
  slot: number;
  market_id: number;
  base_flow: string | number;
  quote_flow: string | number;
  created_at: string;
}

export interface MarketConfigRow {
  id?: number | string;
  market_id: number;
  base_ticker?: string | null;
  quote_ticker?: string | null;
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  created_at?: string | null;
  updated_at?: string | null;
}

const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const FNV64_MASK = 0xffffffffffffffffn;
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export function stableNumericId(value: string) {
  let hash = FNV64_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV64_PRIME) & FNV64_MASK;
  }

  const normalized = hash % MAX_SAFE_INTEGER_BIGINT;
  return Number(normalized === 0n ? 1n : normalized);
}

function parseId(id: number | string | undefined, fallback: string) {
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
    return id;
  }

  if (typeof id === 'string' && /^\d+$/.test(id)) {
    const parsed = Number(id);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return stableNumericId(typeof id === 'string' && id.length > 0 ? id : fallback);
}

function parseOptionalNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function closePositionEventKey(row: ClosePositionEventRow, fallbackIndex?: number) {
  const eventUid = row.event_uid?.trim();
  if (eventUid) {
    return eventUid;
  }

  if (typeof row.id === 'string' && !/^\d+$/.test(row.id)) {
    return row.id;
  }

  const eventIndex = parseOptionalNumber(row.event_index);
  const indexPart = eventIndex === null ? `response:${fallbackIndex ?? 'none'}` : `event:${eventIndex}`;

  return [
    'close_position',
    row.signature,
    indexPart,
    row.position_authority,
    row.market_id,
    row.slot,
    row.start_slot ?? 'none',
    row.end_slot ?? 'none',
    row.deposit_amount,
    row.swapped_amount,
    row.remaining_amount,
    row.fee_amount,
    row.is_buy,
    row.created_at,
  ].join(':');
}

export function parseClosePositionEvent(row: ClosePositionEventRow, fallbackIndex?: number): ClosePositionEvent {
  const event_key = closePositionEventKey(row, fallbackIndex);

  return {
    ...row,
    id: stableNumericId(event_key),
    event_key,
    event_index: parseOptionalNumber(row.event_index),
    deposit_amount: BigInt(String(row.deposit_amount)),
    swapped_amount: BigInt(String(row.swapped_amount)),
    remaining_amount: BigInt(String(row.remaining_amount)),
    fee_amount: BigInt(String(row.fee_amount)),
    is_buy: typeof row.is_buy === 'boolean' ? (row.is_buy ? 1 : 0) : row.is_buy,
  };
}

export function parseMarketUpdateEvent(row: MarketUpdateEventRow): MarketUpdateEvent {
  return {
    ...row,
    id: parseId(row.id ?? row.event_uid, `market_update:${row.signature}:${row.market_id}:${row.slot}`),
    base_flow: BigInt(String(row.base_flow)),
    quote_flow: BigInt(String(row.quote_flow)),
  };
}

export function parseMarketConfig(row: MarketConfigRow): MarketConfig {
  return {
    id: parseId(row.id, `market_config:${row.market_id}`),
    market_id: row.market_id,
    base_ticker: row.base_ticker ?? null,
    quote_ticker: row.quote_ticker ?? null,
    base_mint: row.base_mint,
    quote_mint: row.quote_mint,
    base_decimals: row.base_decimals,
    quote_decimals: row.quote_decimals,
    created_at: row.created_at ?? row.updated_at ?? null,
  };
}

import { readApiUrl } from '../../api/readApi';
import type { ClosePositionEvent, ClosePositionEventRow, MarketConfig, MarketConfigRow } from './types';
import { parseClosePositionEvent, parseMarketConfig } from './types';

interface ClosedPositionsResponse {
  items: ClosePositionEventRow[];
}

export class TigerCloudApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TigerCloudApiError';
  }
}

async function fetchJson<T>(path: string, label: string): Promise<T> {
  const response = await fetch(readApiUrl(path), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TigerCloudApiError(
      response.status,
      `Failed to fetch ${label} (${response.status}): ${body || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export async function fetchMarketConfig(marketId: number): Promise<MarketConfig> {
  const row = await fetchJson<MarketConfigRow>(`/v1/markets/${marketId}/config`, 'market config');
  return parseMarketConfig(row);
}

export async function fetchClosePositionEvents({
  limit,
  marketId,
  positionAuthority,
}: {
  limit: number;
  marketId?: number;
  positionAuthority: string;
}): Promise<ClosePositionEvent[]> {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (marketId !== undefined) {
    params.set('market_id', String(marketId));
  }

  const payload = await fetchJson<ClosedPositionsResponse>(
    `/v1/authorities/${encodeURIComponent(positionAuthority)}/closed-positions?${params.toString()}`,
    'closed positions',
  );
  return payload.items.map(parseClosePositionEvent);
}

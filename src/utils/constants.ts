// src/utils/constants.ts

export const APP_IDENTITY = {
  name: 'Mato',
  uri: 'https://github.com/nightshade-labs/mato-mobile',
  icon: 'favicon.ico', // Relative to uri
};

export const AUTH_TOKEN_KEY = 'mwa_auth_token';

export const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
export const MAINNET_CLUSTER = 'solana:mainnet' as const;
export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const DEVNET_CLUSTER = 'solana:devnet' as const;

const configuredSolanaCluster = process.env.EXPO_PUBLIC_SOLANA_CLUSTER?.trim().toLowerCase();
const configuredSolanaRpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL?.trim();

export const SOLANA_NETWORK = configuredSolanaCluster === 'devnet' ? 'devnet' : 'mainnet';
export const RPC_ENDPOINT = configuredSolanaRpcUrl || (SOLANA_NETWORK === 'devnet' ? DEVNET_RPC : MAINNET_RPC);
export const CLUSTER = SOLANA_NETWORK === 'devnet' ? DEVNET_CLUSTER : MAINNET_CLUSTER;

// TWOB PROGRAM CONSTANTS
export const ARRAY_LENGTH = 10;

export const MARKET_ID = 1;
export const SLOT_DURATION_MS = 400;
export const SLOT_DURATION_SECONDS = SLOT_DURATION_MS / 1000;
export const NATIVE_SOL_DECIMALS = 9;
export const NATIVE_FEE_BUFFER_ATOMS = 20_000_000n;
export const MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS = 1_000_000n;
export const MIN_TRADE_AMOUNT_ATOMS = 1_000_000n;
export const DEFAULT_MARKET_UPDATES_LIMIT = 200;
export const MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION = 8;
export const HIGH_PRICE_IMPACT_WARNING_THRESHOLD_PERCENT = 1;

export const DURATION_OPTIONS = [
  { label: '1m', seconds: 1 * 60 },
  { label: '5m', seconds: 5 * 60 },
  { label: '10m', seconds: 10 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '1h', seconds: 60 * 60 },
  { label: '2h', seconds: 2 * 60 * 60 },
  { label: '4h', seconds: 4 * 60 * 60 },
  { label: '12h', seconds: 12 * 60 * 60 },
  { label: '1d', seconds: 24 * 60 * 60 },
  { label: '3d', seconds: 3 * 24 * 60 * 60 },
  { label: '1w', seconds: 7 * 24 * 60 * 60 },
  { label: '1mo', seconds: 30 * 24 * 60 * 60 },
  { label: '3mo', seconds: 90 * 24 * 60 * 60 },
  { label: '6mo', seconds: 180 * 24 * 60 * 60 },
  { label: '1y', seconds: 365 * 24 * 60 * 60 },
] as const;

export const CHART_TIMEFRAMES = [
  { label: '1m', intervalMs: 1 * 60 * 1000 },
  { label: '5m', intervalMs: 5 * 60 * 1000 },
  { label: '1h', intervalMs: 60 * 60 * 1000 },
] as const;

export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number]['label'];
export type OrderSide = 'buy' | 'sell';
export type MarketPanelTab = 'chart' | 'orderBook' | 'trades';
export type PositionPanelTab = 'active' | 'closed';

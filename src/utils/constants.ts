// src/utils/constants.ts

export const APP_IDENTITY = {
  name: 'Mato',
  uri: 'https://github.com/nightshade-labs/mato-mobile',
  icon: 'favicon.ico', // Relative to uri
};

export const AUTH_TOKEN_KEY = 'mwa_auth_token';

export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

export const CLUSTER = 'solana:devnet' as const;

// Alternative endpoints for production
export const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
export const MAINNET_CLUSTER = 'solana:mainnet' as const;

// TWOB PROGRAM CONSTANTS
export const ARRAY_LENGTH = 20;

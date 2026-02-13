// src/providers/types.ts
import { PublicKey } from '@solana/web3.js';
import { AuthorizeAPI, DeauthorizeAPI, Base64EncodedAddress } from '@solana-mobile/mobile-wallet-adapter-protocol';

export interface Account {
  address: Base64EncodedAddress; // base64, as returned by MWA
  label?: string;
  publicKey: PublicKey; // Converted for convenience
}

export interface Authorization {
  accounts: Account[];
  authToken: string;
  selectedAccount: Account;
}

export interface AuthorizationContextValue {
  // State
  accounts: Account[] | null;
  selectedAccount: Account | null;

  // Actions
  authorizeSession: (wallet: AuthorizeAPI) => Promise<Account>;
  deauthorizeSession: (wallet: DeauthorizeAPI) => Promise<void>;
  onChangeAccount: (account: Account) => void;
}

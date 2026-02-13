// src/providers/ConnectionProvider.tsx
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINT } from '../../utils/constants';

interface ConnectionContextValue {
  connection: Connection;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  connection: new Connection(RPC_ENDPOINT),
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);

  return <ConnectionContext.Provider value={{ connection }}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  return useContext(ConnectionContext);
}

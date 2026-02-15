import { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useProgram } from './useProgram';

interface TradePosition {
  publicKey: PublicKey;
  id: BN;
  amount: BN;
  startSlot: BN;
  endSlot: BN;
  isBuy: boolean;
}

export function useTradePositions(authority: PublicKey | null) {
  const program = useProgram();
  const [positions, setPositions] = useState<TradePosition[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!authority) {
      setPositions([]);
      return;
    }

    setLoading(true);
    try {
      const accounts = await program.account.tradePosition.all([
        { memcmp: { offset: 8, bytes: authority.toBase58() } },
      ]);

      setPositions(
        accounts.map((a) => ({
          publicKey: a.publicKey,
          id: a.account.id as BN,
          amount: a.account.amount as BN,
          startSlot: a.account.startSlot as BN,
          endSlot: a.account.endSlot as BN,
          isBuy: a.account.isBuy === 1,
        })),
      );
    } catch (error) {
      console.error('Failed to fetch trade positions:', error);
    } finally {
      setLoading(false);
    }
  }, [authority, program]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { positions, loading, refetch: fetch };
}

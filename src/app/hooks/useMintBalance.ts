import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAssociatedTokenAddressSync, getAccount, NATIVE_MINT } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { queryKeys } from '../query/keys';
import { getTokenProgram } from '../../utils/token';

function toUiAmount(balanceAtoms: bigint, decimals: number): number {
  return Number(balanceAtoms) / 10 ** decimals;
}

export function useMintBalance(mintAddress: string | null | undefined, decimals: number | null | undefined) {
  const { connection } = useConnection();
  const { selectedAccount } = useAuthorization();
  const decimalsValue = useMemo(() => Math.max(0, decimals ?? 0), [decimals]);
  const isEnabled = !!selectedAccount && !!mintAddress;

  const query = useQuery({
    queryKey: queryKeys.balance.byAuthorityMint(selectedAccount?.publicKey, mintAddress),
    enabled: isEnabled,
    queryFn: async () => {
      if (!selectedAccount || !mintAddress) return null;

      const mint = new PublicKey(mintAddress);
      if (mint.equals(NATIVE_MINT)) {
        const lamports = await connection.getBalance(selectedAccount.publicKey, 'confirmed');
        return BigInt(lamports);
      }

      const tokenProgram = await getTokenProgram(connection, mint);
      const ata = getAssociatedTokenAddressSync(mint, selectedAccount.publicKey, false, tokenProgram);
      const ataInfo = await connection.getAccountInfo(ata, 'confirmed');

      if (!ataInfo) {
        return 0n;
      }

      const tokenAccount = await getAccount(connection, ata, 'confirmed', tokenProgram);
      return tokenAccount.amount;
    },
  });

  return {
    balanceAtoms: query.data ?? null,
    balanceUi: query.data === null || query.data === undefined ? null : toUiAmount(query.data, decimalsValue),
    loading: isEnabled && (query.isPending || query.isFetching),
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
  };
}

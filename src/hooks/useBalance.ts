import { useQuery } from '@tanstack/react-query';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection } from '../providers/ConnectionProvider';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { queryKeys } from '../query/keys';

export function useBalance() {
  const { connection } = useConnection();
  const { selectedAccount } = useAuthorization();

  const query = useQuery({
    queryKey: queryKeys.balance.byAuthority(selectedAccount?.publicKey),
    enabled: !!selectedAccount,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!selectedAccount) return null;
      const lamports = await connection.getBalance(selectedAccount.publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
  });

  return { balance: query.data ?? null, loading: query.isPending || query.isFetching, refresh: query.refetch };
}

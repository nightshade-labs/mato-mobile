import { useQuery } from '@tanstack/react-query';
import { useAuthorization } from '../providers/AuthorizationProvider';
import { useConnection } from '../providers/ConnectionProvider';
import { queryKeys } from '../query/keys';

export function useSolBalance() {
  const { connection } = useConnection();
  const { selectedAccount } = useAuthorization();

  const query = useQuery({
    enabled: !!selectedAccount,
    queryKey: queryKeys.balance.byAuthorityMint(selectedAccount?.publicKey, 'native-sol'),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!selectedAccount) return null;
      return BigInt(await connection.getBalance(selectedAccount.publicKey, 'confirmed'));
    },
  });

  return {
    lamports: query.data ?? null,
    loading: !!selectedAccount && (query.isPending || query.isFetching),
    refresh: query.refetch,
  };
}

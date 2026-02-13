import { useMemo } from 'react';
import { Program, AnchorProvider } from '@anchor-lang/core';
import { useConnection } from '../providers/ConnectionProvider';
import idl from '../../idl/twob_anchor.json';

export function useProgram() {
  const { connection } = useConnection();

  return useMemo(() => {
    const provider = new AnchorProvider(connection, {} as any, {
      commitment: 'confirmed',
    });
    return new Program(idl as any, provider);
  }, [connection]);
}

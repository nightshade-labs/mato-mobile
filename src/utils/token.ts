import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

export async function getTokenProgram(connection: Connection, mintAddress: PublicKey): Promise<PublicKey> {
  const mintInfo = await connection.getAccountInfo(mintAddress);

  if (!mintInfo) {
    throw new Error('Mint not found');
  }

  // Check which program owns the mint
  if (mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    return TOKEN_2022_PROGRAM_ID;
  }

  return TOKEN_PROGRAM_ID;
}

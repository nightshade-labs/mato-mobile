import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
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

export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  mintAddress: PublicKey,
): Promise<number> {
  // Derive the Associated Token Account address
  const ata = await getAssociatedTokenAddress(mintAddress, walletAddress);

  try {
    const accountInfo = await connection.getTokenAccountBalance(ata);
    return parseFloat(accountInfo.value.uiAmountString || '0');
  } catch (error) {
    // Account doesn't exist = zero balance
    return 0;
  }
}

export function parseTokenAmount(input: string, decimals: number): bigint | null {
  // Remove anything except digits and decimal
  const cleaned = input.replace(/[^\d.]/g, '');

  // Validate format
  const parts = cleaned.split('.');
  if (parts.length > 2) return null;

  const wholePart = parts[0] || '0';
  const decimalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);

  try {
    return BigInt(wholePart + decimalPart);
  } catch {
    return null;
  }
}

export function getMaxTransferAmount(
  balanceAtoms: number,
  estimatedFeeAtoms: number = 10_000_000, // Conservative transaction fee + rent
): number {
  // Leave a small buffer for fees
  // Note: token transfers don't cost tokens, but the user needs SOL for gas
  return Math.max(0, balanceAtoms - estimatedFeeAtoms);
}

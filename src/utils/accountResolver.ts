import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import idl from '../idl/twob_anchor.json';

const SEEDS = {
  PROGRAM_CONFIG: Buffer.from('program_config'),
  MARKET: Buffer.from('market'),
  BOOKKEEPING: Buffer.from('bookkeeping'),
  LIQUIDITY_POSITION: Buffer.from('liquidity_position'),
  TRADE_POSITION: Buffer.from('trade_position'),
  EXITS: Buffer.from('exits'),
  PRICES: Buffer.from('prices'),
} as const;

export class AccountResolver {
  constructor(private readonly programId: PublicKey) {}

  programConfigPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([SEEDS.PROGRAM_CONFIG], this.programId);
    return pda;
  }

  marketPda(marketId: BN): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [SEEDS.MARKET, marketId.toArrayLike(Buffer, 'le', 8)],
      this.programId,
    );
    return pda;
  }

  bookkeepingPda(market: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [SEEDS.BOOKKEEPING, market.toBuffer()],
      this.programId,
    );
    return pda;
  }

  liquidityPositionPda(market: PublicKey, authority: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [SEEDS.LIQUIDITY_POSITION, market.toBuffer(), authority.toBuffer()],
      this.programId,
    );
    return pda;
  }

  tradePositionPda(market: PublicKey, authority: PublicKey, positionId: BN): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        SEEDS.TRADE_POSITION,
        market.toBuffer(),
        authority.toBuffer(),
        positionId.toArrayLike(Buffer, 'le', 8),
      ],
      this.programId,
    );
    return pda;
  }

  exitsPda(market: PublicKey, index: BN): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [SEEDS.EXITS, market.toBuffer(), index.toArrayLike(Buffer, 'le', 8)],
      this.programId,
    );
    return pda;
  }

  pricesPda(market: PublicKey, index: BN): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [SEEDS.PRICES, market.toBuffer(), index.toArrayLike(Buffer, 'le', 8)],
      this.programId,
    );
    return pda;
  }
}

export const resolver = new AccountResolver(new PublicKey(idl.address));

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/twob_anchor.json`.
 */
export type TwobAnchor = {
  address: 'twobmF9NrRYUA6AN1yTdnWYfEpCr9UXWpESTRPG1KJj';
  metadata: {
    name: 'twobAnchor';
    version: '0.1.0';
    spec: '0.1.0';
    description: 'Created with Anchor';
  };
  instructions: [
    {
      name: 'addLiquidity';
      discriminator: [181, 157, 89, 67, 143, 182, 52, 72];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'authorityBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'authorityQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'baseLamports';
          type: 'u64';
        },
        {
          name: 'quoteLamports';
          type: 'u64';
        },
      ];
    },
    {
      name: 'authorityCloseLiquidityPosition';
      discriminator: [169, 197, 227, 231, 81, 124, 125, 1];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'authorityBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'authorityQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'authorityClosePosition';
      discriminator: [198, 43, 155, 228, 243, 10, 227, 45];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'authorityBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'authorityQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'tradePosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [116, 114, 97, 100, 101, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'trade_position.id';
                account: 'tradePosition';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'futureExits';
          writable: true;
        },
        {
          name: 'futurePrices';
          writable: true;
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'closeExitsAccount';
      discriminator: [241, 198, 24, 114, 18, 89, 131, 244];
      accounts: [
        {
          name: 'owner';
          writable: true;
          signer: true;
          relations: ['exits'];
        },
        {
          name: 'exits';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [101, 120, 105, 116, 115];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'exits.index';
                account: 'exits';
              },
            ];
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'closeMarket';
      discriminator: [88, 154, 248, 186, 48, 14, 123, 244];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['programConfig'];
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'programConfig';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 111, 103, 114, 97, 109, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'closePricesAccount';
      discriminator: [244, 43, 217, 128, 151, 50, 171, 17];
      accounts: [
        {
          name: 'owner';
          writable: true;
          signer: true;
          relations: ['prices'];
        },
        {
          name: 'prices';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 105, 99, 101, 115];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'prices.index';
                account: 'prices';
              },
            ];
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'initializeMarket';
      discriminator: [35, 35, 189, 193, 155, 48, 170, 203];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['programConfig'];
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'programConfig';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 111, 103, 114, 97, 109, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: 'baseMint';
        },
        {
          name: 'quoteMint';
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'arg';
                path: 'id';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'id';
          type: 'u64';
        },
        {
          name: 'startSlot';
          type: 'u64';
        },
        {
          name: 'endSlotInterval';
          type: 'u64';
        },
        {
          name: 'feeBps';
          type: 'u8';
        },
        {
          name: 'unhealthyLiquidityFeeBps';
          type: 'u8';
        },
      ];
    },
    {
      name: 'initializeProgramConfig';
      discriminator: [6, 131, 61, 237, 40, 110, 83, 124];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'programConfig';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 111, 103, 114, 97, 109, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'pauseMarket';
      discriminator: [216, 238, 4, 164, 65, 11, 162, 91];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['programConfig'];
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'programConfig';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 111, 103, 114, 97, 109, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'provideLiquidity';
      discriminator: [40, 110, 107, 116, 174, 127, 97, 204];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'authorityBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'authorityQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'baseDepositLamports';
          type: 'u64';
        },
        {
          name: 'quoteDepositLamports';
          type: 'u64';
        },
        {
          name: 'baseFlowU64';
          type: 'u64';
        },
        {
          name: 'quoteFlowU64';
          type: 'u64';
        },
      ];
    },
    {
      name: 'publicClosePosition';
      discriminator: [42, 36, 239, 26, 46, 226, 194, 200];
      accounts: [
        {
          name: 'signer';
          writable: true;
          signer: true;
        },
        {
          name: 'positionAuthority';
          writable: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'authorityBaseTokenAccount';
          writable: true;
        },
        {
          name: 'authorityQuoteTokenAccount';
          writable: true;
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'tradePosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [116, 114, 97, 100, 101, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'positionAuthority';
              },
              {
                kind: 'account';
                path: 'trade_position.id';
                account: 'tradePosition';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'futureExits';
          writable: true;
        },
        {
          name: 'futurePrices';
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'publicCompensateDebt';
      discriminator: [244, 213, 26, 253, 142, 158, 25, 31];
      accounts: [
        {
          name: 'signer';
          writable: true;
          signer: true;
        },
        {
          name: 'positionAuthority';
          writable: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'signerBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'signer';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'signerQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'signer';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'positionAuthority';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'minAmountOutAtoms';
          type: 'u64';
        },
      ];
    },
    {
      name: 'publicStopLiquidityPosition';
      discriminator: [202, 106, 27, 254, 67, 103, 203, 189];
      accounts: [
        {
          name: 'signer';
          writable: true;
          signer: true;
        },
        {
          name: 'positionAuthority';
          writable: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'signerBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'signer';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'signerQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'signer';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'positionAuthority';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
      ];
    },
    {
      name: 'submitOrder';
      discriminator: [230, 150, 200, 53, 92, 208, 109, 108];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'authorityAta';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'tokenProgram';
              },
              {
                kind: 'account';
                path: 'mint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'mint';
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'tradePosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [116, 114, 97, 100, 101, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'arg';
                path: 'id';
              },
            ];
          };
        },
        {
          name: 'vault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'tokenProgram';
              },
              {
                kind: 'account';
                path: 'mint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'futureExits';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [101, 120, 105, 116, 115];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'arg';
                path: 'futureIndex';
              },
            ];
          };
        },
        {
          name: 'futurePrices';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 105, 99, 101, 115];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'arg';
                path: 'futureIndex';
              },
            ];
          };
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'id';
          type: 'u64';
        },
        {
          name: 'futureIndex';
          type: 'u64';
        },
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'endSlot';
          type: 'u64';
        },
      ];
    },
    {
      name: 'updateBooks';
      discriminator: [186, 132, 107, 163, 37, 130, 212, 113];
      accounts: [
        {
          name: 'signer';
          writable: true;
          signer: true;
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'referenceExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'referencePrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'slot';
          type: 'u64';
        },
      ];
    },
    {
      name: 'updateFees';
      discriminator: [225, 27, 13, 6, 69, 84, 172, 191];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['programConfig'];
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'programConfig';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 111, 103, 114, 97, 109, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'tradingFee';
          type: 'u8';
        },
        {
          name: 'unhealthyLiquidityFee';
          type: 'u8';
        },
      ];
    },
    {
      name: 'updateLiquidityFlows';
      discriminator: [59, 94, 163, 206, 138, 237, 163, 178];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'baseFlowU64';
          type: 'u64';
        },
        {
          name: 'quoteFlowU64';
          type: 'u64';
        },
      ];
    },
    {
      name: 'withdrawFees';
      discriminator: [198, 212, 171, 109, 144, 215, 174, 89];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['programConfig'];
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'programConfig';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [112, 114, 111, 103, 114, 97, 109, 95, 99, 111, 110, 102, 105, 103];
              },
            ];
          };
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'baseDestinationTokenAccount';
        },
        {
          name: 'quoteDestinationTokenAccount';
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'withdrawLiquidity';
      discriminator: [149, 158, 33, 185, 47, 243, 253, 31];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'baseMint';
          relations: ['market'];
        },
        {
          name: 'quoteMint';
          relations: ['market'];
        },
        {
          name: 'authorityBaseTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'authorityQuoteTokenAccount';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'market';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [109, 97, 114, 107, 101, 116];
              },
              {
                kind: 'account';
                path: 'market.id';
                account: 'market';
              },
            ];
          };
        },
        {
          name: 'liquidityPosition';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 115, 105, 116, 105, 111, 110];
              },
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'baseVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'baseTokenProgram';
              },
              {
                kind: 'account';
                path: 'baseMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'quoteVault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'market';
              },
              {
                kind: 'account';
                path: 'quoteTokenProgram';
              },
              {
                kind: 'account';
                path: 'quoteMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'bookkeeping';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [98, 111, 111, 107, 107, 101, 101, 112, 105, 110, 103];
              },
              {
                kind: 'account';
                path: 'market';
              },
            ];
          };
        },
        {
          name: 'currentExits';
        },
        {
          name: 'previousExits';
        },
        {
          name: 'currentPrices';
          writable: true;
        },
        {
          name: 'previousPrices';
          writable: true;
        },
        {
          name: 'baseTokenProgram';
        },
        {
          name: 'quoteTokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'referenceIndex';
          type: 'u64';
        },
        {
          name: 'baseLamports';
          type: 'u64';
        },
        {
          name: 'quoteLamports';
          type: 'u64';
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'bookkeeping';
      discriminator: [222, 183, 70, 70, 180, 109, 184, 251];
    },
    {
      name: 'exits';
      discriminator: [240, 175, 85, 167, 2, 200, 2, 180];
    },
    {
      name: 'liquidityPosition';
      discriminator: [153, 56, 106, 34, 55, 42, 113, 176];
    },
    {
      name: 'market';
      discriminator: [219, 190, 213, 55, 0, 227, 198, 154];
    },
    {
      name: 'prices';
      discriminator: [74, 25, 25, 70, 56, 98, 39, 21];
    },
    {
      name: 'programConfig';
      discriminator: [196, 210, 90, 231, 144, 149, 140, 63];
    },
    {
      name: 'tradePosition';
      discriminator: [37, 143, 119, 76, 200, 164, 122, 202];
    },
  ];
  events: [
    {
      name: 'closePositionEvent';
      discriminator: [198, 217, 115, 95, 191, 120, 142, 137];
    },
    {
      name: 'marketUpdateEvent';
      discriminator: [114, 70, 57, 176, 187, 142, 113, 145];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'durationTooShort';
      msg: 'Duration is too short';
    },
    {
      code: 6001;
      name: 'durationTooLong';
      msg: 'Duration is too long';
    },
    {
      code: 6002;
      name: 'endSlotAlreadyPassed';
      msg: 'End slot has already passed';
    },
    {
      code: 6003;
      name: 'flowTooSmall';
      msg: 'Increase order size or reduce order duration';
    },
    {
      code: 6004;
      name: 'invalidMint';
      msg: 'Invalid mint account';
    },
    {
      code: 6005;
      name: 'wrongExitsAccount';
      msg: 'Wrong exits account';
    },
    {
      code: 6006;
      name: 'wrongPricesAccount';
      msg: 'Wrong prices account';
    },
    {
      code: 6007;
      name: 'wrongTokenAccount';
      msg: 'Wrong token account';
    },
    {
      code: 6008;
      name: 'invalidOrder';
      msg: 'Invalid order submission';
    },
    {
      code: 6009;
      name: 'bookNotUpToDate';
      msg: 'Book not up to date';
    },
    {
      code: 6010;
      name: 'positionNotEnded';
      msg: 'Cannot close open position.';
    },
    {
      code: 6011;
      name: 'notEnoughDeposits';
      msg: 'Deposits are too low for specified flow.';
    },
    {
      code: 6012;
      name: 'minAmountOutNotReached';
      msg: 'Minimum amount out is not reached.';
    },
    {
      code: 6013;
      name: 'liquidityPositionUnhealthy';
      msg: 'Liquidity position is unhealthy.';
    },
    {
      code: 6014;
      name: 'liquidityPositionStillActive';
      msg: 'Liquidity position still active.';
    },
    {
      code: 6015;
      name: 'liquidityPositionNotActive';
      msg: 'Liquidity position not active anymore.';
    },
    {
      code: 6016;
      name: 'noDebt';
      msg: 'Liquidity position has no debt.';
    },
    {
      code: 6017;
      name: 'mustCoverDebt';
      msg: 'Deposits must cover debt.';
    },
    {
      code: 6018;
      name: 'marketIsPaused';
      msg: 'Market is paused.';
    },
    {
      code: 6019;
      name: 'remainingOrders';
      msg: 'Market still has orders.';
    },
    {
      code: 6020;
      name: 'accountStillUsed';
      msg: 'Too early to close account.';
    },
    {
      code: 6021;
      name: 'tradePositionExpired';
      msg: 'Too late to close position.';
    },
  ];
  types: [
    {
      name: 'bookkeeping';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'basePerQuote';
            docs: [
              'Defines how many base token atoms are exchanged per quote token atom',
              'per slot multiplied by BOOKKEEPING_PRECISION_FACTOR',
            ];
            type: 'u128';
          },
          {
            name: 'previousBasePerQuote';
            docs: ['Older snapshot to calculate average price'];
            type: 'u128';
          },
          {
            name: 'quotePerBase';
            docs: [
              'Defines how many quote token atoms are exchanged per base token atom',
              'per slot multiplied by BOOKKEEPING_PRECISION_FACTOR',
            ];
            type: 'u128';
          },
          {
            name: 'previousQuotePerBase';
            docs: ['Older snapshot to calculate average price'];
            type: 'u128';
          },
          {
            name: 'slotsWithoutTrade';
            docs: ['Slots without trades since market start and last_update_slot'];
            type: 'u64';
          },
          {
            name: 'lastUpdateSlot';
            docs: ['Slot when Bookkeeping was last updated'];
            type: 'u64';
          },
          {
            name: 'previousUpdateSlot';
            docs: ['Slot when previous base/quote ratio was determined'];
            type: 'u64';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'closePositionEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'positionAuthority';
            type: 'pubkey';
          },
          {
            name: 'marketId';
            type: 'u64';
          },
          {
            name: 'depositAmount';
            type: 'u64';
          },
          {
            name: 'swappedAmount';
            type: 'u64';
          },
          {
            name: 'remainingAmount';
            type: 'u64';
          },
          {
            name: 'feeAmount';
            type: 'u64';
          },
          {
            name: 'isBuy';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'exits';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'owner';
            docs: ['Address which created this account, used to determine where the rent goes if account is closed'];
            type: 'pubkey';
          },
          {
            name: 'baseExits';
            docs: ['Stores the base flow that is removed from the market at a given slot because an order ended'];
            type: {
              array: ['u128', 20];
            };
          },
          {
            name: 'quoteExits';
            docs: ['Stores the quote flow that is removed from the market at a given slot because an order ended'];
            type: {
              array: ['u128', 20];
            };
          },
          {
            name: 'index';
            type: 'u64';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'liquidityPosition';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            docs: ['Creator of this position who can close it'];
            type: 'pubkey';
          },
          {
            name: 'baseBalance';
            docs: ['Base balance at last update slot with bookkeeping precision'];
            type: 'u128';
          },
          {
            name: 'quoteBalance';
            docs: ['Quote balance at last update slot with bookkeeping precision'];
            type: 'u128';
          },
          {
            name: 'basePerQuoteSnapshot';
            docs: ['Bookkeeping snapshot at last update slot'];
            type: 'u128';
          },
          {
            name: 'quotePerBaseSnapshot';
            docs: ['Bookkeeping snapshot at last update slot'];
            type: 'u128';
          },
          {
            name: 'slotsWithoutTradeSnapshot';
            docs: ['Snapshot of slots without trades in this market when this order was created'];
            type: 'u64';
          },
          {
            name: 'baseFlowU64';
            docs: ['Base flow, no extra flow precision needed, since flow are set manually'];
            type: 'u64';
          },
          {
            name: 'quoteFlowU64';
            docs: ['Quote flow, no extra flow precision needed, since flow are set manually'];
            type: 'u64';
          },
          {
            name: 'baseDebt';
            docs: ['Base debt, can arise if position is not liquidated in time'];
            type: 'u64';
          },
          {
            name: 'quoteDebt';
            docs: ['Quote debt, can arise if position is not liquidated in time'];
            type: 'u64';
          },
          {
            name: 'lastUpdateSlot';
            docs: ['Slot when position was last updated'];
            type: 'u64';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'market';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            docs: ['Market id, every trading pair has its own id'];
            type: 'u64';
          },
          {
            name: 'baseMint';
            docs: ['Since mints are not included in market seeds, we store them in the account'];
            type: 'pubkey';
          },
          {
            name: 'quoteMint';
            type: 'pubkey';
          },
          {
            name: 'startSlot';
            docs: ['Slot at which market is active'];
            type: 'u64';
          },
          {
            name: 'baseFlow';
            docs: ['Current flow of base token'];
            type: 'u128';
          },
          {
            name: 'quoteFlow';
            docs: ['Current flow of quote token'];
            type: 'u128';
          },
          {
            name: 'endSlotInterval';
            docs: ['Order can only and at a slot that is a multiple of end_slot_interval'];
            type: 'u64';
          },
          {
            name: 'openPositions';
            docs: [
              'Stores the number of open positions (trade and liquidity) in this market, rethink if this is needed',
            ];
            type: 'u64';
          },
          {
            name: 'accumulatedBaseFees';
            docs: ['Stores accumulated and not yet withdrawn fees'];
            type: 'u64';
          },
          {
            name: 'accumulatedQuoteFees';
            type: 'u64';
          },
          {
            name: 'feeBps';
            docs: ['Trading fee in basis points'];
            type: 'u8';
          },
          {
            name: 'unhealthyLiquidityFeeBps';
            docs: ['Penalty fee for unhealthy liquidity position'];
            type: 'u8';
          },
          {
            name: 'isPaused';
            type: 'u8';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'marketUpdateEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'marketId';
            type: 'u64';
          },
          {
            name: 'baseFlow';
            type: 'u64';
          },
          {
            name: 'quoteFlow';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'prices';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'owner';
            docs: ['Address which created this account, used to determine where the rent goes if account is closed'];
            type: 'pubkey';
          },
          {
            name: 'basePerQuoteSnapshot';
            docs: ['Takes a snapshot of the bookkeeping account for given slot'];
            type: {
              array: ['u128', 20];
            };
          },
          {
            name: 'quotePerBaseSnapshot';
            docs: ['Takes a snapshot of the bookkeeping account for given slot'];
            type: {
              array: ['u128', 20];
            };
          },
          {
            name: 'slotsWithoutTradesSnapshot';
            docs: ['Takes a snapshot of the bookkeeping account for given slot'];
            type: {
              array: ['u64', 20];
            };
          },
          {
            name: 'openPositions';
            docs: ['Number of open trade positions that end in this reference interval'];
            type: 'u64';
          },
          {
            name: 'index';
            type: 'u64';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'programConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            docs: ['The authority which can create and close market and use special instructions'];
            type: 'pubkey';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'tradePosition';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            docs: ['Creator of this position who can close it'];
            type: 'pubkey';
          },
          {
            name: 'id';
            type: 'u64';
          },
          {
            name: 'amount';
            docs: ['The amount to spend'];
            type: 'u64';
          },
          {
            name: 'startSlot';
            docs: ['The slot when this position starts trading'];
            type: 'u64';
          },
          {
            name: 'endSlot';
            docs: ['The slot when this position ends'];
            type: 'u64';
          },
          {
            name: 'bookkeepingSnapshot';
            docs: [
              'Snapshot of base_per_quote for buy order or quote_per_base for sell orders when this order was created',
            ];
            type: 'u128';
          },
          {
            name: 'slotsWithoutTradesSnapshot';
            docs: ['Snapshot of slots without trades in this market when this order was created'];
            type: 'u64';
          },
          {
            name: 'isBuy';
            docs: ['0 means sell order, 1 means buy order'];
            type: 'u8';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
  ];
};

# Mato

Mato is a Solana mobile trading app, where users choose an amount and a duration and let orders stream into the market over time.

## Continuous Clearing Auctions

It uses a continuous clearing auction: the market clears continuously as buy and sell flow changes. That is cool because it can reduce instantaneous price impact, make execution fairer, and weaken toxic flow such as sandwiching.

![Continuous Clearing Auction](assets/cca.png)

## Environment

Create a local Expo environment file before starting the app:

```bash
cp .env.example .env
```

Fill these values from the matching TigerCloud-backed API deployment and Solana RPC settings:

```bash
EXPO_PUBLIC_TIGERCLOUD_API_URL=https://read-api-production-f8ea.up.railway.app
EXPO_PUBLIC_SOLANA_CLUSTER=mainnet
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the app bundle.
Restart `npm run android` or `npm run dev` after changing `.env`.
Use `EXPO_PUBLIC_SOLANA_CLUSTER=devnet` only when intentionally testing against devnet data and wallets.
`EXPO_PUBLIC_TIGERCLOUD_API_URL` should be the HTTPS base URL for the API that serves `/v1/markets/...` and `/v1/authorities/{authority}/closed-positions`.

## Android Device

With Android platform tools installed and USB debugging enabled on the phone:

```bash
npm ci
adb devices
npm run android
```

## Worktrees

To create a new worktree and install repo-local tools like `expo`, `tsc`, `eslint`, and `prettier` in that worktree:

```bash
npm run worktree:new -- codex/my-feature
```

This creates a worktree under `/tmp/` by default and runs the lockfile-based dependency install there. You can also pass a custom path and base ref:

```bash
npm run worktree:new -- codex/my-feature /tmp/mato-mobile-my-feature main
```

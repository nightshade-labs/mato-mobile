# Mato

Mato is a Solana mobile trading app, where users choose an amount and a duration and let orders stream into the market over time.

## Continuous Clearing Auctions

It uses a continuous clearing auction: the market clears continuously as buy and sell flow changes. That is cool because it can reduce instantaneous price impact, make execution fairer, and weaken toxic flow such as sandwiching.

![Continuous Clearing Auction](assets/cca.png)

## Worktrees

To create a new worktree and install repo-local tools like `expo`, `tsc`, `eslint`, and `prettier` in that worktree:

```bash
npm run worktree:new -- codex/my-feature
```

This creates a worktree under `/tmp/` by default and runs the lockfile-based dependency install there. You can also pass a custom path and base ref:

```bash
npm run worktree:new -- codex/my-feature /tmp/mato-mobile-my-feature main
```

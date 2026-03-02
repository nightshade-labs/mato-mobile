---
marp: true
paginate: false
size: 16:9
style: |
  @import url('https://fonts.cdnfonts.com/css/pixeloid-sans');
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

  :root {
    --text: #f3f8ff;
    --accent: #14f1b2;
    --muted: #9bb0cd;
    --panel-border: #38537e;
  }

  section {
    font-family: 'Inter', sans-serif;
    color: var(--text);
    padding: 52px 62px;
    background:
      url('./assets/figma-template-bg-attached.png') top center / 100% auto no-repeat,
      url('./assets/figma-template-bg.svg') center center / cover no-repeat,
      radial-gradient(
        161.19% 161.19% at 50% -44.68%,
        #c5fff8 3.85%,
        #8dfff0 20.19%,
        #00b49f 37.02%,
        #134156 61.06%,
        #0e151a 82.79%,
        #0f0f0f 100%
      );
  }

  section::before {
    content: "";
    position: absolute;
    left: 56px;
    right: 56px;
    top: 40px;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(90deg, #14f1b2 0%, #14f1b2 42%, rgba(20, 241, 178, 0.35) 100%);
  }

  /* Hard reset to avoid Marp/theme artifacts that render white heading panels. */
  section h1,
  section h2,
  section h3,
  section p,
  section ul,
  section ol,
  section li,
  section blockquote {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    filter: none !important;
  }

  section h1::before,
  section h1::after,
  section h2::before,
  section h2::after,
  section h3::before,
  section h3::after {
    content: none !important;
  }

  h1,
  h2 {
    font-family: 'Pixeloid Sans', 'Press Start 2P', monospace;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.08;
    color: #ffffff;
    margin: 0 0 22px 0;
    text-shadow: none;
  }

  h1 {
    font-size: 64px;
  }

  h2 {
    font-size: 48px;
  }

  h3 {
    font-family: 'Inter', sans-serif;
    color: #b5ffe6;
    font-size: 28px;
    margin: 0 0 16px 0;
  }

  strong {
    color: var(--accent);
  }

  ul,
  ol {
    font-size: 28px;
    line-height: 1.42;
    margin-top: 8px;
  }

  li {
    margin-bottom: 10px;
  }

  code {
    background: rgba(255, 255, 255, 0.1) !important;
    border-radius: 8px;
    padding: 4px 8px;
    font-size: 0.9em;
  }

  .muted {
    color: var(--muted);
    font-size: 0.84em;
  }

  .kicker {
    color: #b5ffe6;
    font-weight: 700;
    letter-spacing: 0.2px;
    margin-bottom: 14px;
  }

  .mini {
    font-size: 22px;
    line-height: 1.35;
  }

  img {
    border-radius: 14px;
    border: 1px solid var(--panel-border);
  }

  section.title-slide {
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 18px;
  }

  section.title-slide::before {
    display: none;
  }

  section.title-slide h1 {
    font-size: 72px;
    line-height: 1;
    margin: 0;
    max-width: 1500px;
    text-shadow: none;
  }

  section.title-slide h2 {
    font-size: 48px;
    line-height: 1.04;
    margin: 0;
    max-width: 1500px;
    text-shadow: none;
  }

  section.title-slide .title-tagline {
    max-width: 1280px;
    font-size: 32px;
    line-height: 1.26;
    font-weight: 600;
    color: #e8f5ff;
    margin: 8px 0 0 0;
  }

  section.title-slide .title-kicker {
    font-family: 'Inter', sans-serif;
    font-size: 20px;
    line-height: 1.2;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #b5ffe6;
    font-weight: 700;
    margin: 6px 0 0 0;
  }

  .team-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    margin-top: 10px;
  }

  .team-card {
    border: 1px solid #38537e;
    border-radius: 16px;
    background: rgba(12, 20, 39, 0.72);
    padding: 22px;
  }

  .team-avatar {
    width: 96px;
    height: 96px;
    border-radius: 999px;
    object-fit: cover;
    border: 2px solid #14f1b2;
    margin-bottom: 12px;
  }

  .team-name {
    font-family: 'Pixeloid Sans', 'Press Start 2P', monospace;
    font-size: 32px;
    line-height: 1;
    color: #ffffff;
    margin: 0 0 8px 0;
    text-transform: uppercase;
  }

  .team-role {
    font-size: 20px;
    line-height: 1.35;
    color: #c9d8f7;
    margin: 0 0 10px 0;
  }

  .team-bullets {
    font-size: 20px;
    line-height: 1.35;
    margin: 0 0 0 20px;
  }

  .team-bullets li {
    margin-bottom: 8px;
  }
---

<!-- _class: title-slide -->

# MATO

## Streaming the Internet Capital Markets

<p class="title-tagline">Continuous orders. Uniform clearing. Deeper liquidity.
</p>

<p class="title-kicker">SOLANA MOBILE HACKATHON March 2026</p>

---

## What Internet Capital Markets Need

- Less toxic flow and timing games
- Deep liquidity
- Fast, credible price discovery
- Fair execution quality across participants

---

## Time-weighted order book

- Orders stream continuously over user-chosen duration
- Uniform clearing price per time unit
  → no sandwich attacks

---

## Time-weighted order book

- Price impact depends on time + size
  → deeper liquidity via time dimension
- Makers update quotes anytime; users exit anytime
- Fully onchain, no oracles

---

## How it works

<p class="kicker">Order = Quantity + Limit* + Duration</p>

- Choose amount + duration (e.g., sell 25 SOL over 10s)
- Every incoming or outgoing order updates market price
- All active orders stream at current market price

<p class="mini">*Limit orders are not implemented yet</p>

---

## SMS Integration

<p class="kicker">What We Implemented In Mato</p>

- `MobileWalletProvider` + `createSolanaDevnet` for Solana Mobile wallet discovery/session context.
- Mobile Wallet Adapter `transact(...)` flow for connect/disconnect and signed actions.
- MWA `authorize` / `deauthorize` with app identity; auth token caching for fast reconnect.
- Wallet-signed v0 transactions via `signAndSendTransactions` for submit order and close position.

---

## What we built

---

## Market Opportunity

<p class="kicker">Capturing the MEV tax</p>

- 82k SOL extracted from Solana users via sandwich attacks in the past 30 days
  -> tax on billions in monthly DEX volume
- Pain is real and widespread
- Most retail is already patient

<p class="kicker">Mato fixes it</p>

- Uniform clearing, zero sandwiches
- Native Dollar-cost-averaging, smoother avg prices

---

## Team

<p class="kicker">Two builders, one wedge: Internet Capital Markets</p>

<div class="team-grid">
  <div class="team-card">
    <img class="team-avatar" src="./assets/froots.png" alt="Thomas avatar placeholder" />
    <p class="team-name">Thomas</p>
    <p class="team-role">Product, protocol design, and engineering.</p>
    <ul class="team-bullets">
      <li>Superteam Germany member.</li>
      <li>Software Engineer @StakingFacilities.</li>
      <li>Background in physics and economics.</li>
    </ul>
  </div>
  <div class="team-card">
    <img class="team-avatar" src="./assets/gopi.jpg" alt="Gopi avatar placeholder" />
    <p class="team-name">Gopi</p>
    <p class="team-role">Engineering and partnerships.</p>
    <ul class="team-bullets">
      <li>President of TUM Blockchain Club.</li>
      <li>Software Engineer @SolanaBeach.</li>
      <li>Background in Computer Science.</li>
    </ul>
  </div>
</div>

<p class="mini muted">Combined edge: protocol insight + production execution.</p>

---

## Ask + Roadmap

- Pilot partners for TWOB market-quality testing
- Liquidity collaborators and benchmark reviewers
- Mainnet hardening toward production rollouts

**Mato is a market structure bet.**

<p class="muted">TWOB can help Solana deliver deeper, fairer, less toxic markets.</p>

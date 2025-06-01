# Development Log - RMSP Technical Deep Dive

## How We Built RMSP: The Nitty-Gritty Technical Details

### The Architecture Journey

We started with a simple question: "How can traders bet on ETH vs BTC dominance without complex multi-leg trades?" This led us down a fascinating technical rabbit hole.

### Smart Contract Layer (Foundry + Solidity)

**The Core Innovation**: We built `SimplePerpV2.sol` which tracks positions using a novel "entry share" mechanism. Instead of storing USD prices, we store the market share ratio at entry (e.g., 2.37%). This enables perfect P&L symmetry - longs and shorts are exact opposites.

**Key Technical Decisions**:
- Used a two-step deposit flow (deposit USDC → open position) for better capital efficiency
- Implemented position structs that store baseToken/quoteToken as strings for flexibility
- 30% initial margin requirement hardcoded for hackathon simplicity

**The Oracle Challenge**: `RatioOracle.sol` was the trickiest part. We needed real-time ETH/BTC ratios, so we:
1. Integrated Pyth Network oracles for institutional-grade price feeds
2. Calculated ratios on-chain as `ETH_price / (ETH_price + BTC_price)`
3. Added 5-minute staleness protection to prevent stale price exploits
4. Built a dual-mode system: mock prices for testing, Pyth for production

### Pyth Network Integration (The Game Changer)

**Why Pyth**: We needed sub-second price updates from reliable sources. Pyth aggregates data from 40+ exchanges and trading firms, giving us the same data used by Binance, OKX, and other major platforms.

**The Integration**:
```solidity
// Fetch prices with cryptographic proofs
IPyth.Price memory ethPrice = pyth.getPriceUnsafe(ETH_PRICE_ID);
IPyth.Price memory btcPrice = pyth.getPriceUnsafe(BTC_PRICE_ID);

// Calculate ratio with 18 decimal precision
uint256 ratio = (ethPrice * 1e18) / (ethPrice + btcPrice);
```

**The Hack**: Pyth prices need periodic updates. Instead of running a keeper, we added an "Update Oracle Prices" button that lets users update prices themselves before trading. This saved us from running infrastructure while keeping the UX smooth.

### Frontend (Next.js + wagmi + TradingView)

**Real-time Position Tracking**: We used wagmi's `useContractRead` with 5-second polling to show live P&L updates. The trick was calculating everything client-side to reduce RPC calls:

```typescript
const entryRatioPercent = (Number(position.entryShare) / 1e18) * 100;
const pnlPercent = ((currentRatio - entryRatio) / entryRatio) * 100;
```

**TradingView Integration**: We embedded TradingView's lightweight charts and overlaid position data. The hacky part: we draw position entry lines by injecting custom series data into their chart instance.

**The 0.02% Bug**: Initially showed entry share as 0.02% instead of 2.37%. The issue? We were dividing by 1e18 twice - once in the contract and once in the UI. Classic decimal precision bug that made profits look 100x bigger!

### GraphQL Indexer (Ponder)

**Why Ponder**: We needed historical position data and couldn't query logs efficiently. Ponder let us index events into a PostgreSQL database with GraphQL API in under 100 lines of code.

**The Schema**:
```graphql
type Position {
  id: ID!
  user: String!
  openedAt: BigInt!
  closedAt: BigInt
  entryShare: BigInt!
  pnl: BigInt
}
```

**The Hack**: Instead of indexing price updates (too many), we only index position events and fetch current prices client-side. This kept our indexer lightweight and query times under 50ms.

### Deployment Strategy

**Arbitrum Mainnet**: We deployed directly to mainnet (not testnet) because:
1. Pyth oracle only works on mainnet
2. Sepolia testnet was unreliable during the hackathon
3. Gas costs on Arbitrum are negligible (~$0.01 per transaction)

**Contract Verification**: Used Foundry's `--verify` flag with Arbiscan API. Had to flatten contracts first because Arbiscan couldn't handle our import structure.

### Notable Hacks & Workarounds

1. **Price Update Flow**: Instead of running a keeper bot, we made price updates user-triggered. When someone gets "Price too stale" error, they click a button that fetches from Pyth and updates on-chain.

2. **Mock Mode Toggle**: Built a dual-mode oracle that can switch between mock prices (for demos) and real Pyth prices (for production) with a single transaction.

3. **Position Card Decimal Bug**: The UI was showing profits 100x too high due to decimal conversion issues. Fixed by carefully tracking where percentages vs decimals were used.

4. **Dropdown Styling**: Dark theme dropdowns were invisible. Had to override Radix UI's CSS variables and add explicit dark mode classes.

5. **Gas Optimization**: Store token symbols as strings instead of addresses. Unconventional but saves gas and makes the UI cleaner.

### Technology Stack

**Smart Contracts**:
- Solidity 0.8.19 + Foundry
- OpenZeppelin for ERC20
- Pyth Network Oracle

**Frontend**:
- Next.js 14 + TypeScript
- wagmi + viem for Web3
- TradingView Lightweight Charts
- Tailwind CSS + shadcn/ui
- RainbowKit for wallets

**Backend**:
- Ponder for GraphQL indexing
- PostgreSQL for historical data
- Arbitrum RPC for real-time data

**Developer Tools**:
- Foundry for testing/deployment
- TypeScript for all scripts
- GitHub Actions (planned)

### The Result

A fully functional perpetual DEX for relative value trading, built in 3 days, with real money on mainnet, integrated with institutional-grade oracles, and a professional trading interface. The zero-sum architecture means it's self-sustaining - no LP incentives needed, no external funding required. Just pure relative value speculation.
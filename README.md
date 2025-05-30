# Relative-Market-Share Perpetuals (RMSP)

A decentralized perpetual trading protocol on Arbitrum that enables users to take long/short positions on the relative market share between tokens (starting with ETH vs BTC).

## 🚀 ETH Prague Hackathon - Milestone 1 (Proof of Concept)

### Features
- **Relative Share Trading**: Trade the relative market dominance between ETH and BTC
- **Perpetual Positions**: No expiry dates on positions
- **Zero-Sum PnL**: Perfect symmetry between long and short positions
- **Pyth Oracle Integration**: Real-time price feeds with staleness protection
- **Simple Margin System**: 30% initial margin requirement

### Smart Contracts
- `RatioOracle.sol`: Calculates relative market share using Pyth price feeds
- `SimplePerp.sol`: Core perpetual trading logic with deposit/withdraw/trade functions
- `MockUSDC.sol`: Test collateral token for development

## 📋 Prerequisites

- Node.js v18+
- Foundry (forge, cast, anvil)
- Git

## 🛠 Installation

1. Clone the repository:
```bash
git clone https://github.com/your-repo/ethPragueHack-RelativeShareMarkets.git
cd ethPragueHack-RelativeShareMarkets
```

2. Install dependencies:
```bash
npm install
cd contracts && forge install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your private key and RPC URL
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
cd contracts
forge test
```

Run with coverage:
```bash
forge coverage
```

Run specific test:
```bash
forge test --match-contract IntegrationTest -vvv
```

## 🚀 Deployment

### Local Development

1. Start local Anvil node:
```bash
anvil --fork-url https://arb1.arbitrum.io/rpc
```

2. Deploy contracts:
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Arbitrum Mainnet

⚠️ **Note**: We deploy directly to Arbitrum mainnet for testing due to Sepolia testnet reliability issues.

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_RPC_URL --broadcast --verify
```

## 💻 CLI Demo

Run the interactive demo showing PnL symmetry:

```bash
npm run demo
```

The demo will:
1. Deploy mock USDC and fund test wallets
2. Open opposite positions (Alice long, Bob short)
3. Simulate ETH price increase
4. Close positions and show symmetric PnL

## 🏗 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    User     │────▶│  SimplePerp  │────▶│ RatioOracle │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            ▼                     ▼
                      ┌──────────┐         ┌───────────┐
                      │   USDC   │         │   Pyth    │
                      └──────────┘         └───────────┘
```

### Key Concepts

1. **Relative Share**: ETH/(ETH+BTC) market cap ratio
2. **PnL Calculation**: (currentShare - entryShare) × notional × direction
3. **Margin Requirements**: 30% initial margin, no maintenance margin (yet)

## 📊 Contract Addresses (Arbitrum)

After deployment, addresses are saved to `contracts/deployments/arbitrum.json`

## 🔐 Security Considerations

- This is a hackathon PoC - not audited for production use
- Mock USDC allows unlimited minting for testing
- No liquidation mechanism implemented yet
- Oracle price staleness protection (5 min max age)

## 🛣 Roadmap

- [x] Milestone 1: Basic perpetual mechanics (PoC)
- [ ] Milestone 2: Funding rates & liquidations
- [ ] Milestone 3: Multi-token baskets & portfolio margin
- [ ] Milestone 4: LP vault & keeper network
- [ ] Milestone 5: Full web application

## 📝 License

MIT

## 👥 Team

Built for ETH Prague 2025
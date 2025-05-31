# Relative-Market-Share Perpetuals (RMSP)

A decentralized perpetual trading protocol on Arbitrum that enables users to take long/short positions on the relative market share between tokens (starting with ETH vs BTC).

## 🚀 ETH Prague Hackathon - Milestone 1 (Proof of Concept)

### Features
- **Relative Share Trading**: Trade the relative market dominance between ETH and BTC
- **Perpetual Positions**: No expiry dates on positions
- **Zero-Sum PnL**: Perfect symmetry between long and short positions
- **Live Pyth Oracle Integration**: Real-time price feeds from institutional data sources
- **Dynamic Ratios**: ETH/BTC market share updates with live market movements
- **Simple Margin System**: 30% initial margin requirement

## 🏆 Pyth Network Integration

This project demonstrates production-ready integration with Pyth Network's decentralized oracle system:

### **Real-Time Price Feeds**
- **Live Market Data**: ETH ~$2,542, BTC ~$104,710 (real prices from Pyth)
- **Dynamic Ratios**: ETH 2.37%, BTC 97.63% (updates with market movements)
- **Institutional Sources**: 40+ first-party data providers including major exchanges

### **On-Chain Integration**
- **Pyth Contract**: `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` on Arbitrum
- **Price Feed IDs**: ETH/USD and BTC/USD feeds configured for live trading
- **Automatic Updates**: Prices updated by ecosystem (GMX, Gains Network, MEV bots)

### **Smart Contract Usage**
```solidity
// Get real-time ETH/BTC relative shares
uint256 ethShare = ratioOracle.getRatioShare("ETH", "BTC");
// ethShare = 2.37% (real market data)
```

📖 **[Full Pyth Integration Documentation](./PYTH_INTEGRATION.md)**

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

## 💻 Live Demo Scripts

### Pyth Oracle Live Demo
```bash
# Update prices with real Pyth data and test integration
npx ts-node scripts/pyth-live-demo.ts
```

### Live Trading Simulation
```bash
# Simulate real trading with live market prices
npx ts-node scripts/live-trading-simulation.ts
```

### Quick Price Updates
```bash
# Update Pyth prices for immediate demo
npx ts-node scripts/live-trading-simulation.ts --quick-update
```

The live demo shows:
1. **Real-time price updates** from Pyth Network
2. **Dynamic ETH/BTC ratios** changing with market movements  
3. **Live trading simulation** with actual market data
4. **Position P&L** calculated using real prices

### Traditional CLI Demo
```bash
npm run demo
```

The static demo shows:
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
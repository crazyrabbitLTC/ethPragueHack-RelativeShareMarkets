import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Live price display component
function LivePriceDisplay() {
  const [prices, setPrices] = useState({ eth: 0, btc: 0, ratio: 0 });
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Fetch live prices from Pyth API (no gas cost)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        // Fetch from Pyth Hermes API
        const response = await fetch(
          'https://hermes.pyth.network/api/latest_price_feeds?' +
          'ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace&' + // ETH
          'ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'     // BTC
        );
        
        const data = await response.json();
        
        if (data.parsed) {
          const ethPrice = data.parsed[0]?.price?.price / 1e8; // Convert from 1e8 to USD
          const btcPrice = data.parsed[1]?.price?.price / 1e8;
          const ratio = ethPrice / (ethPrice + btcPrice) * 100; // ETH share %
          
          setPrices({ eth: ethPrice, btc: btcPrice, ratio });
          setLastUpdate(Date.now());
        }
      } catch (error) {
        console.error('Failed to fetch live prices:', error);
      }
    };

    // Update every 5 seconds for live feel
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="live-prices">
      <h3>Live Market Prices</h3>
      <div className="price-grid">
        <div className="price-item">
          <span className="label">ETH</span>
          <span className="price">${prices.eth.toFixed(2)}</span>
          <span className="share">{prices.ratio.toFixed(2)}%</span>
        </div>
        <div className="price-item">
          <span className="label">BTC</span>
          <span className="price">${prices.btc.toFixed(2)}</span>
          <span className="share">{(100 - prices.ratio).toFixed(2)}%</span>
        </div>
      </div>
      <div className="last-update">
        Last update: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
}

// Trading component with price updates
function TradingInterface() {
  const [isTrading, setIsTrading] = useState(false);
  const [position, setPosition] = useState({
    baseToken: 'ETH',
    quoteToken: 'BTC', 
    notional: 1000,
    isLong: true
  });

  const executeTrade = async () => {
    setIsTrading(true);
    
    try {
      // Step 1: Fetch fresh price update data from Pyth
      console.log('📡 Fetching fresh price data...');
      const priceUpdateResponse = await fetch(
        'https://hermes.pyth.network/api/latest_vaas?' +
        'ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace&' +
        'ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
      );
      
      const priceData = await priceUpdateResponse.json();
      const priceUpdateData = priceData.map((vaa: string) => 
        '0x' + Buffer.from(vaa, 'base64').toString('hex')
      );
      
      // Step 2: Get update fee
      const updateFee = await contract.getUpdateFee(priceUpdateData);
      console.log('💰 Update fee:', ethers.formatEther(updateFee), 'ETH');
      
      // Step 3: Execute trade with fresh prices
      console.log('🚀 Executing trade with fresh prices...');
      const tx = await contract.openPositionWithPriceUpdate(
        priceUpdateData,
        position.baseToken,
        position.quoteToken,
        ethers.parseEther(position.notional.toString()),
        position.isLong,
        { 
          value: updateFee,
          gasLimit: 500000 
        }
      );
      
      console.log('📋 Transaction:', tx.hash);
      await tx.wait();
      
      console.log('✅ Trade executed with fresh prices!');
      
    } catch (error) {
      console.error('❌ Trade failed:', error);
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div className="trading-interface">
      <h3>Execute Trade</h3>
      
      <div className="trade-form">
        <div className="form-group">
          <label>Position Size (USDC)</label>
          <input 
            type="number"
            value={position.notional}
            onChange={(e) => setPosition({...position, notional: Number(e.target.value)})}
          />
        </div>
        
        <div className="form-group">
          <label>Direction</label>
          <select 
            value={position.isLong ? 'long' : 'short'}
            onChange={(e) => setPosition({...position, isLong: e.target.value === 'long'})}
          >
            <option value="long">Long ETH (bet ETH share increases)</option>
            <option value="short">Short ETH (bet BTC share increases)</option>
          </select>
        </div>
        
        <button 
          onClick={executeTrade}
          disabled={isTrading}
          className="trade-button"
        >
          {isTrading ? '⏳ Updating prices & executing...' : '🚀 Execute Trade'}
        </button>
      </div>
      
      <div className="trade-info">
        <p>💡 <strong>How it works:</strong></p>
        <ol>
          <li>Fetch fresh prices from Pyth Network (off-chain)</li>
          <li>Submit price update + trade in single transaction</li>
          <li>Pay small ETH fee for price update (~$0.01)</li>
          <li>Trade executes with guaranteed fresh prices</li>
        </ol>
      </div>
    </div>
  );
}

// Price chart with live + historical data
function PriceChart() {
  const [chartData, setChartData] = useState([]);
  const [livePrice, setLivePrice] = useState(null);

  useEffect(() => {
    // Fetch historical data from your indexer
    const fetchHistoricalData = async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetHistoricalPrices($from: Int!) {
              historicalPrices(
                where: { timestamp_gte: $from },
                orderBy: "timestamp"
              ) {
                items {
                  timestamp
                  ethShare
                  btcShare
                  ethPrice
                  btcPrice
                }
              }
            }
          `,
          variables: {
            from: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
          }
        })
      });
      
      const result = await response.json();
      setChartData(result.data.historicalPrices.items);
    };

    // Fetch live price from Pyth API
    const fetchLivePrice = async () => {
      // ... fetch logic similar to LivePriceDisplay
    };

    fetchHistoricalData();
    fetchLivePrice();
    
    const interval = setInterval(fetchLivePrice, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="price-chart">
      <h3>ETH/BTC Market Share</h3>
      
      {/* Live price indicator */}
      {livePrice && (
        <div className="live-indicator">
          🔴 LIVE: ETH {livePrice.ethShare.toFixed(2)}% | BTC {livePrice.btcShare.toFixed(2)}%
        </div>
      )}
      
      {/* Chart component would go here */}
      <div className="chart-container">
        {/* Use your preferred chart library (Recharts, Chart.js, etc.) */}
        {/* Historical data from indexer + live data from Pyth API */}
      </div>
      
      <div className="chart-legend">
        <span>🔵 Historical (on-chain data)</span>
        <span>🔴 Live (Pyth API)</span>
      </div>
    </div>
  );
}

export { LivePriceDisplay, TradingInterface, PriceChart };
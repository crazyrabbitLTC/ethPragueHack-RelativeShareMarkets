// Service to fetch Pyth price updates
const HERMES_BASE_URL = 'https://hermes.pyth.network';

// Pyth price IDs for tokens (Arbitrum mainnet)
const PRICE_IDS = {
  'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'AVAX': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7'
};

export interface PythPriceUpdate {
  updateData: string[];
  updateFee: bigint;
}

export async function fetchPythPriceUpdates(tokens: string[]): Promise<PythPriceUpdate> {
  try {
    // Get unique price IDs for the requested tokens
    const priceIds = [...new Set(tokens.map(token => PRICE_IDS[token] || PRICE_IDS['ETH']))];
    
    // Fetch latest price updates from Pyth
    const response = await fetch(`${HERMES_BASE_URL}/api/latest_vaas?${priceIds.map(id => `ids%5B%5D=${id}`).join('&')}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch price updates: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract the base64 encoded VAAs
    const updateData = data.map((item: any) => '0x' + Buffer.from(item.vaa, 'base64').toString('hex'));
    
    // Pyth update fee is typically 1 wei per price update
    const updateFee = BigInt(updateData.length);
    
    return {
      updateData,
      updateFee
    };
  } catch (error) {
    console.error('Error fetching Pyth price updates:', error);
    throw error;
  }
}

// Helper to determine which tokens need updating based on the trading pair
export function getTokensForUpdate(baseToken: string, quoteTokens: string): string[] {
  const tokens = [baseToken];
  
  // Parse quote tokens (can be comma-separated)
  const quoteTokenList = quoteTokens.split(',').map(t => t.trim());
  tokens.push(...quoteTokenList);
  
  // Return unique tokens
  return [...new Set(tokens)];
}
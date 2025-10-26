// Price API Utility
// Easy switching between different price providers

const PriceAPI = {
    // Current provider (change this to switch APIs)
    provider: 'jupiter', // Options: 'jupiter', 'birdeye', 'coingecko', 'manual'
    
    // API keys (add your keys here)
    keys: {
        birdeye: '', // Add your Birdeye API key
        coingecko: '' // CoinGecko Pro key (optional)
    },
    
    // Cache to prevent excessive API calls
    cache: {},
    cacheTimeout: 30000, // 30 seconds
    
    // Get SOL price
    async getSolPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            const data = await response.json();
            return data.solana.usd;
        } catch (error) {
            console.error('Error fetching SOL price:', error);
            return 0;
        }
    },
    
    // Get token price based on provider
    async getTokenPrice(tokenAddress) {
        // Check cache first
        if (this.cache[tokenAddress] && Date.now() - this.cache[tokenAddress].timestamp < this.cacheTimeout) {
            return this.cache[tokenAddress].price;
        }
        
        let price = 0;
        
        switch(this.provider) {
            case 'jupiter':
                price = await this.jupiterPrice(tokenAddress);
                break;
            case 'birdeye':
                price = await this.birdeyePrice(tokenAddress);
                break;
            case 'coingecko':
                price = await this.coingeckoPrice(tokenAddress);
                break;
            case 'manual':
                // Return cached price or 0 (prices set manually via admin panel)
                price = this.cache[tokenAddress]?.price || 0;
                break;
            default:
                price = await this.jupiterPrice(tokenAddress);
        }
        
        // Update cache
        this.cache[tokenAddress] = {
            price: price,
            timestamp: Date.now()
        };
        
        return price;
    },
    
    // Jupiter Price API (Free, no key needed)
    async jupiterPrice(tokenAddress) {
        try {
            const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
            const data = await response.json();
            
            if (data.data && data.data[tokenAddress]) {
                return data.data[tokenAddress].price;
            }
            return 0;
        } catch (error) {
            console.error('Jupiter API error:', error);
            return 0;
        }
    },
    
    // Birdeye API (Requires API key, more accurate)
    async birdeyePrice(tokenAddress) {
        if (!this.keys.birdeye) {
            console.warn('Birdeye API key not set');
            return 0;
        }
        
        try {
            const response = await fetch(`https://public-api.birdeye.so/public/price?address=${tokenAddress}`, {
                headers: {
                    'X-API-KEY': this.keys.birdeye
                }
            });
            const data = await response.json();
            
            if (data.data && data.data.value) {
                return data.data.value;
            }
            return 0;
        } catch (error) {
            console.error('Birdeye API error:', error);
            return 0;
        }
    },
    
    // CoinGecko API (Limited for Solana tokens without Pro)
    async coingeckoPrice(tokenAddress) {
        try {
            const headers = {};
            if (this.keys.coingecko) {
                headers['x-cg-pro-api-key'] = this.keys.coingecko;
            }
            
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${tokenAddress}&vs_currencies=usd`,
                { headers }
            );
            const data = await response.json();
            
            if (data[tokenAddress] && data[tokenAddress].usd) {
                return data[tokenAddress].usd;
            }
            return 0;
        } catch (error) {
            console.error('CoinGecko API error:', error);
            return 0;
        }
    },
    
    // Manually set a price (useful for testing or when APIs fail)
    setManualPrice(tokenAddress, price) {
        this.cache[tokenAddress] = {
            price: price,
            timestamp: Date.now()
        };
    },
    
    // Get multiple token prices at once (batch request)
    async getMultiplePrices(tokenAddresses) {
        const prices = {};
        
        if (this.provider === 'jupiter') {
            // Jupiter supports batch requests
            try {
                const ids = tokenAddresses.join(',');
                const response = await fetch(`https://price.jup.ag/v4/price?ids=${ids}`);
                const data = await response.json();
                
                tokenAddresses.forEach(address => {
                    if (data.data && data.data[address]) {
                        prices[address] = data.data[address].price;
                        this.cache[address] = {
                            price: data.data[address].price,
                            timestamp: Date.now()
                        };
                    }
                });
            } catch (error) {
                console.error('Batch price fetch error:', error);
            }
        } else {
            // For other providers, fetch individually
            for (const address of tokenAddresses) {
                prices[address] = await this.getTokenPrice(address);
            }
        }
        
        return prices;
    },
    
    // Clear cache
    clearCache() {
        this.cache = {};
    },
    
    // Get cache status
    getCacheStatus() {
        const now = Date.now();
        const status = {};
        
        Object.keys(this.cache).forEach(address => {
            const age = now - this.cache[address].timestamp;
            status[address] = {
                price: this.cache[address].price,
                age: age,
                fresh: age < this.cacheTimeout
            };
        });
        
        return status;
    }
};

// Export for use in app.js
export default PriceAPI;

/* 
USAGE EXAMPLES:

// In app.js, import this:
import PriceAPI from './priceAPI.js';

// Set provider (do this once at init)
PriceAPI.provider = 'jupiter'; // or 'birdeye', 'coingecko', 'manual'

// Add API keys if needed
PriceAPI.keys.birdeye = 'your-key-here';

// Get SOL price
const solPrice = await PriceAPI.getSolPrice();

// Get single token price
const price = await PriceAPI.getTokenPrice('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Get multiple prices at once (more efficient)
const prices = await PriceAPI.getMultiplePrices([
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
]);

// Set manual price (useful for testing)
PriceAPI.setManualPrice('token-address', 0.0123);

// Switch provider on the fly
PriceAPI.provider = 'birdeye';

// Clear cache to force fresh fetch
PriceAPI.clearCache();

// Check cache status
const cacheStatus = PriceAPI.getCacheStatus();
console.log(cacheStatus);
*/

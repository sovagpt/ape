// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize Firebase (You'll need to add your config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State
let trades = [];
let positions = {};
let tokenPrices = {};
let solPrice = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    startTimer();
    loadData();
    updatePricesLoop();
});

function initializeApp() {
    console.log('APE Trading Bot Initialized');
}

function setupEventListeners() {
    // Settings button opens admin panel
    document.getElementById('settingsBtn').addEventListener('click', openAdminPanel);
    document.getElementById('closeModal').addEventListener('click', closeAdminPanel);
    
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadData();
        updatePrices();
    });
    
    // Trade form submission
    document.getElementById('tradeForm').addEventListener('submit', handleTradeSubmit);
    
    // Close modal on outside click
    document.getElementById('adminModal').addEventListener('click', (e) => {
        if (e.target.id === 'adminModal') {
            closeAdminPanel();
        }
    });
}

// Timer
function startTimer() {
    const startTime = Date.now();
    setInterval(() => {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('timer').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

// Admin Panel
function openAdminPanel() {
    document.getElementById('adminModal').classList.add('active');
}

function closeAdminPanel() {
    document.getElementById('adminModal').classList.remove('active');
    document.getElementById('tradeForm').reset();
}

async function handleTradeSubmit(e) {
    e.preventDefault();
    
    const trade = {
        type: document.getElementById('tradeType').value,
        symbol: document.getElementById('tokenSymbol').value.toUpperCase(),
        tokenAddress: document.getElementById('tokenAddress').value,
        amount: parseFloat(document.getElementById('amount').value),
        pricePerToken: parseFloat(document.getElementById('pricePerToken').value),
        txHash: document.getElementById('txHash').value,
        timestamp: Date.now(),
        value: parseFloat(document.getElementById('amount').value) * parseFloat(document.getElementById('pricePerToken').value)
    };
    
    try {
        await addDoc(collection(db, 'trades'), trade);
        console.log('Trade added successfully');
        closeAdminPanel();
        loadData();
    } catch (error) {
        console.error('Error adding trade:', error);
        alert('Error adding trade: ' + error.message);
    }
}

// Load Data from Firebase
async function loadData() {
    try {
        const tradesQuery = query(collection(db, 'trades'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(tradesQuery);
        
        trades = [];
        snapshot.forEach((doc) => {
            trades.push({ id: doc.id, ...doc.data() });
        });
        
        calculatePositions();
        updateUI();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Calculate current positions from trades
function calculatePositions() {
    positions = {};
    
    trades.forEach(trade => {
        if (!positions[trade.symbol]) {
            positions[trade.symbol] = {
                symbol: trade.symbol,
                tokenAddress: trade.tokenAddress,
                amount: 0,
                totalCost: 0,
                avgBuyPrice: 0
            };
        }
        
        if (trade.type === 'BUY') {
            positions[trade.symbol].amount += trade.amount;
            positions[trade.symbol].totalCost += trade.value;
        } else if (trade.type === 'SELL') {
            positions[trade.symbol].amount -= trade.amount;
            positions[trade.symbol].totalCost -= trade.value;
        }
        
        if (positions[trade.symbol].amount > 0) {
            positions[trade.symbol].avgBuyPrice = positions[trade.symbol].totalCost / positions[trade.symbol].amount;
        }
    });
    
    // Remove positions with 0 or negative amounts
    Object.keys(positions).forEach(symbol => {
        if (positions[symbol].amount <= 0) {
            delete positions[symbol];
        }
    });
}

// Update UI
function updateUI() {
    updateStats();
    updatePositionsTable();
    updateTransactionsTable();
    updateTicker();
    updateLastUpdate();
}

function updateStats() {
    // Calculate portfolio value
    let portfolioValue = 0;
    Object.values(positions).forEach(pos => {
        const price = tokenPrices[pos.tokenAddress] || pos.avgBuyPrice;
        portfolioValue += pos.amount * price;
    });
    
    // Calculate win rate
    const completedTrades = calculateCompletedTrades();
    const wins = completedTrades.filter(t => t.profit > 0).length;
    const winRate = completedTrades.length > 0 ? (wins / completedTrades.length * 100).toFixed(0) : 0;
    
    // Calculate 24h volume
    const oneDayAgo = Date.now() - 86400000;
    const trades24h = trades.filter(t => t.timestamp > oneDayAgo);
    const volume24h = trades24h.reduce((sum, t) => sum + t.value, 0);
    
    // Calculate SOL balance (this would come from actual wallet in production)
    const solBalance = 100; // Placeholder
    
    // Update DOM
    document.getElementById('portfolioValue').textContent = `$${portfolioValue.toFixed(2)}`;
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('winRateText').textContent = `${completedTrades.length} Total Trades`;
    document.getElementById('volume24h').textContent = `$${volume24h.toFixed(2)}`;
    document.getElementById('trades24h').textContent = `${trades24h.length} Trades Today`;
    document.getElementById('solBalance').textContent = `${solBalance.toFixed(2)} SOL`;
    
    document.getElementById('totalTrades').textContent = `${trades.length} Trades`;
    document.getElementById('activePositions').textContent = Object.keys(positions).length;
}

function calculateCompletedTrades() {
    // Group trades by symbol and calculate P&L for completed positions
    const completed = [];
    const symbolTrades = {};
    
    trades.forEach(trade => {
        if (!symbolTrades[trade.symbol]) {
            symbolTrades[trade.symbol] = [];
        }
        symbolTrades[trade.symbol].push(trade);
    });
    
    Object.values(symbolTrades).forEach(symTrades => {
        let holding = 0;
        let totalCost = 0;
        
        symTrades.forEach(trade => {
            if (trade.type === 'BUY') {
                holding += trade.amount;
                totalCost += trade.value;
            } else if (trade.type === 'SELL' && holding > 0) {
                const avgPrice = totalCost / holding;
                const profit = (trade.pricePerToken - avgPrice) * trade.amount;
                completed.push({ ...trade, profit });
                holding -= trade.amount;
                totalCost -= avgPrice * trade.amount;
            }
        });
    });
    
    return completed;
}

function updatePositionsTable() {
    const tbody = document.getElementById('positionsBody');
    const posArray = Object.values(positions);
    
    document.getElementById('holdingsCount').textContent = `${posArray.length} Holdings`;
    
    if (posArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">No active positions</td></tr>';
        return;
    }
    
    tbody.innerHTML = posArray.map(pos => {
        const currentPrice = tokenPrices[pos.tokenAddress] || pos.avgBuyPrice;
        const liveValue = pos.amount * currentPrice;
        const pnl = liveValue - pos.totalCost;
        const pnlPercent = (pnl / pos.totalCost * 100).toFixed(2);
        const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
        
        return `
            <tr>
                <td><strong>${pos.symbol}</strong></td>
                <td>${formatNumber(pos.amount)}</td>
                <td>$${liveValue.toFixed(2)}</td>
                <td class="${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent}%)</td>
            </tr>
        `;
    }).join('');
}

function updateTransactionsTable() {
    const tbody = document.getElementById('transactionsBody');
    
    document.getElementById('totalTransactions').textContent = `${trades.length} Total`;
    
    if (trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No transactions yet</td></tr>';
        return;
    }
    
    const recentTrades = trades.slice(0, 20);
    
    tbody.innerHTML = recentTrades.map(trade => {
        const date = new Date(trade.timestamp);
        const time = date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        return `
            <tr>
                <td>${time}</td>
                <td><span class="type-badge ${trade.type.toLowerCase()}">${trade.type}</span></td>
                <td>${formatNumber(trade.amount)} SOL</td>
                <td>${trade.symbol}</td>
                <td>$${trade.value.toFixed(2)}</td>
                <td><a href="https://solscan.io/tx/${trade.txHash}" target="_blank" class="tx-link">View</a></td>
            </tr>
        `;
    }).join('');
}

function updateTicker() {
    const tickerContent = document.getElementById('tickerContent');
    
    // Create ticker items for SOL and active positions
    let tickerHTML = `
        <span class="ticker-item ${solPrice > 0 ? 'positive' : 'negative'}">
            SOL/USD $${solPrice.toFixed(2)} ${solPrice > 0 ? '▲' : '▼'}
        </span>
    `;
    
    Object.values(positions).forEach(pos => {
        const price = tokenPrices[pos.tokenAddress] || pos.avgBuyPrice;
        const change = ((price - pos.avgBuyPrice) / pos.avgBuyPrice * 100).toFixed(2);
        const isPositive = change >= 0;
        
        tickerHTML += `
            <span class="ticker-item ${isPositive ? 'positive' : 'negative'}">
                ${pos.symbol}/USD $${price.toFixed(6)} ${isPositive ? '+' : ''}${change}%
            </span>
        `;
    });
    
    // Duplicate for infinite scroll
    tickerContent.innerHTML = tickerHTML + tickerHTML;
}

function updateLastUpdate() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = time;
}

// Price Fetching
async function updatePrices() {
    try {
        // Fetch SOL price from CoinGecko
        const solResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solData = await solResponse.json();
        solPrice = solData.solana.usd;
        
        // Fetch token prices (you'll need Jupiter API or similar)
        // For now using placeholder logic
        Object.values(positions).forEach(async pos => {
            try {
                // This is where you'd integrate Jupiter API or Birdeye API
                // For now, using a random fluctuation for demo
                if (!tokenPrices[pos.tokenAddress]) {
                    tokenPrices[pos.tokenAddress] = pos.avgBuyPrice;
                }
                // Simulate price movement
                tokenPrices[pos.tokenAddress] *= (1 + (Math.random() - 0.5) * 0.02);
            } catch (error) {
                console.error('Error fetching token price:', error);
            }
        });
        
        updateUI();
    } catch (error) {
        console.error('Error updating prices:', error);
    }
}

function updatePricesLoop() {
    updatePrices();
    setInterval(updatePrices, 30000); // Update every 30 seconds
}

// Utility Functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Real-time listeners
function setupRealtimeListeners() {
    const tradesQuery = query(collection(db, 'trades'), orderBy('timestamp', 'desc'), limit(50));
    
    onSnapshot(tradesQuery, (snapshot) => {
        trades = [];
        snapshot.forEach((doc) => {
            trades.push({ id: doc.id, ...doc.data() });
        });
        calculatePositions();
        updateUI();
    });
}

// Call this after Firebase is initialized
setTimeout(setupRealtimeListeners, 1000);

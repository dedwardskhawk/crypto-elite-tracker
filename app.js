const API_KEY = 'CG-fSBt6uw24Fvnzkqz6HoBfZT2';
const API_BASE = 'https://api.coingecko.com/api/v3';

// Fallback demo data
const DEMO_PRICES = {
    bitcoin: { current: 65420.50, previous: 64850.25, change24h: 2.34 },
    ethereum: { current: 3245.75, previous: 3180.90, change24h: 1.87 },
    solana: { current: 142.30, previous: 138.75, change24h: 2.56 }
};

let prices = {
    bitcoin: { current: 0, previous: 0, change24h: 0 },
    ethereum: { current: 0, previous: 0, change24h: 0 },
    solana: { current: 0, previous: 0, change24h: 0 }
};

let isUsingDemoData = false;

let portfolio = {
    bitcoin: { amount: 0, avgPrice: 0 },
    ethereum: { amount: 0, avgPrice: 0 },
    solana: { amount: 0, avgPrice: 0 }
};

let priceChart = null;
let priceHistory = [];

async function fetchPrices() {
    try {
        // Try public API first (no auth required)
        let response;
        let data;
        
        try {
            response = await fetch(
                `${API_BASE}/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            data = await response.json();
            
            // Validate data structure
            if (!data.bitcoin || !data.ethereum || !data.solana) {
                throw new Error('Invalid data structure received');
            }
            
            // Update prices with live data
            Object.keys(data).forEach(coin => {
                if (prices[coin]) {
                    prices[coin].previous = prices[coin].current;
                    prices[coin].current = data[coin].usd;
                    prices[coin].change24h = data[coin].usd_24h_change || 0;
                }
            });
            
            isUsingDemoData = false;
            updateStatusIndicator('Live');
            
        } catch (apiError) {
            console.warn('Live API failed, using demo data:', apiError);
            
            // Use demo data as fallback
            Object.keys(DEMO_PRICES).forEach(coin => {
                prices[coin].previous = prices[coin].current;
                prices[coin].current = DEMO_PRICES[coin].current;
                prices[coin].change24h = DEMO_PRICES[coin].change24h;
            });
            
            isUsingDemoData = true;
            updateStatusIndicator('Demo');
        }
        
        updatePrices();
        updatePortfolio();
        animatePriceUpdate();
        
    } catch (error) {
        console.error('Critical error in fetchPrices:', error);
        
        // Last resort: use demo data
        if (!isUsingDemoData) {
            Object.keys(DEMO_PRICES).forEach(coin => {
                prices[coin] = { ...DEMO_PRICES[coin] };
            });
            isUsingDemoData = true;
            updateStatusIndicator('Demo');
            updatePrices();
            updatePortfolio();
        }
    }
}

async function fetchPriceHistory(days = 1) {
    try {
        const response = await fetch(
            `${API_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.prices && Array.isArray(data.prices)) {
                priceHistory = data.prices;
                updateChart();
                return;
            }
        }
        
        throw new Error('Invalid response');
        
    } catch (error) {
        console.warn('Price history API failed, using demo data:', error);
        
        // Generate demo price history
        const now = Date.now();
        const interval = (days * 24 * 60 * 60 * 1000) / 100; // 100 data points
        const basePrice = DEMO_PRICES.bitcoin.current;
        
        priceHistory = Array.from({ length: 100 }, (_, i) => {
            const timestamp = now - (99 - i) * interval;
            const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
            const price = basePrice * (1 + variation);
            return [timestamp, price];
        });
        
        updateChart();
    }
}

function updatePrices() {
    document.getElementById('btc-price').textContent = formatPrice(prices.bitcoin.current);
    document.getElementById('eth-price').textContent = formatPrice(prices.ethereum.current);
    document.getElementById('sol-price').textContent = formatPrice(prices.solana.current);
    
    updatePriceChange('btc', prices.bitcoin.change24h);
    updatePriceChange('eth', prices.ethereum.change24h);
    updatePriceChange('sol', prices.solana.change24h);
}

function updatePriceChange(coin, change) {
    const changeEl = document.getElementById(`${coin}-change`);
    const arrow = changeEl.nextElementSibling;
    
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.className = `change-24h ${change >= 0 ? 'positive' : 'negative'}`;
    arrow.className = `change-arrow ${change >= 0 ? 'up' : 'down'}`;
}

function animatePriceUpdate() {
    document.querySelectorAll('.price-pulse').forEach(pulse => {
        pulse.style.animation = 'none';
        setTimeout(() => {
            pulse.style.animation = 'pricePulse 2s infinite';
        }, 10);
    });
}

function updatePortfolio() {
    const btcAmount = parseFloat(document.getElementById('btc-amount').value) || 0;
    const ethAmount = parseFloat(document.getElementById('eth-amount').value) || 0;
    const solAmount = parseFloat(document.getElementById('sol-amount').value) || 0;
    
    portfolio.bitcoin.amount = btcAmount;
    portfolio.ethereum.amount = ethAmount;
    portfolio.solana.amount = solAmount;
    
    const btcValue = btcAmount * prices.bitcoin.current;
    const ethValue = ethAmount * prices.ethereum.current;
    const solValue = solAmount * prices.solana.current;
    
    document.getElementById('btc-value').textContent = `$${formatNumber(btcValue)}`;
    document.getElementById('eth-value').textContent = `$${formatNumber(ethValue)}`;
    document.getElementById('sol-value').textContent = `$${formatNumber(solValue)}`;
    
    const btcPnl = btcValue * (prices.bitcoin.change24h / 100);
    const ethPnl = ethValue * (prices.ethereum.change24h / 100);
    const solPnl = solValue * (prices.solana.change24h / 100);
    
    updatePnL('btc', btcPnl);
    updatePnL('eth', ethPnl);
    updatePnL('sol', solPnl);
    
    const totalValue = btcValue + ethValue + solValue;
    const totalPnl = btcPnl + ethPnl + solPnl;
    const totalChangePercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0;
    
    animateCounter('total-value', totalValue);
    animateCounter('daily-pnl', totalPnl);
    
    document.getElementById('total-change').textContent = `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`;
    document.getElementById('total-change').className = `change-amount ${totalPnl >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('total-change-percent').textContent = `(${totalPnl >= 0 ? '+' : ''}${totalChangePercent.toFixed(2)}%)`;
    document.getElementById('daily-pnl-percent').textContent = `${totalChangePercent >= 0 ? '+' : ''}${totalChangePercent.toFixed(2)}%`;
    document.getElementById('daily-pnl-percent').style.color = totalChangePercent >= 0 ? 'var(--success)' : 'var(--danger)';
}

function updatePnL(coin, pnl) {
    const pnlEl = document.getElementById(`${coin}-pnl`);
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`;
    pnlEl.className = `portfolio-stat-value pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startValue + (targetValue - startValue) * easeOutQuart;
        
        element.textContent = formatNumber(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

function initChart() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 102, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 102, 255, 0)');
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Bitcoin Price',
                data: [],
                borderColor: '#0066ff',
                backgroundColor: gradient,
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#0066ff',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1a1b23',
                    bodyColor: '#6b7280',
                    borderColor: 'rgba(0, 102, 255, 0.15)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280',
                        maxTicksLimit: 6
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280',
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function updateChart() {
    if (!priceChart || !priceHistory.length) return;
    
    const labels = priceHistory.map(point => {
        const date = new Date(point[0]);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
    
    const data = priceHistory.map(point => point[1]);
    
    priceChart.data.labels = labels;
    priceChart.data.datasets[0].data = data;
    priceChart.update('none');
}

function formatPrice(price) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(num) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function saveToLocalStorage() {
    const portfolioData = {
        bitcoin: document.getElementById('btc-amount').value,
        ethereum: document.getElementById('eth-amount').value,
        solana: document.getElementById('sol-amount').value
    };
    localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolioData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('cryptoPortfolio');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('btc-amount').value = data.bitcoin || '';
        document.getElementById('eth-amount').value = data.ethereum || '';
        document.getElementById('sol-amount').value = data.solana || '';
    }
}

function updateStatusIndicator(status) {
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    const statusIndicator = document.querySelector('.status-indicator');
    
    if (statusText) statusText.textContent = status;
    
    if (status === 'Live') {
        statusIndicator.style.background = 'rgba(16, 185, 129, 0.1)';
        statusIndicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        statusDot.style.background = 'var(--success)';
    } else {
        statusIndicator.style.background = 'rgba(249, 115, 22, 0.1)';
        statusIndicator.style.borderColor = 'rgba(249, 115, 22, 0.2)';
        statusDot.style.background = '#f97316';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    loadFromLocalStorage();
    fetchPrices();
    fetchPriceHistory();
    
    setInterval(fetchPrices, 30000);
    
    document.querySelectorAll('.portfolio-input').forEach(input => {
        input.addEventListener('input', () => {
            updatePortfolio();
            saveToLocalStorage();
        });
    });
    
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const range = e.target.dataset.range;
            const days = range === '24h' ? 1 : range === '7d' ? 7 : 30;
            fetchPriceHistory(days);
        });
    });
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = entry.target.style.animation || 'fadeInUp 0.6s ease-out';
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.glass-card').forEach(card => {
        observer.observe(card);
    });
});
# Yahoo Finance Rate Limit Debugging Guide

## Problem Identified

Your app is hitting Yahoo Finance rate limits because:

1. **Real-time price updates** - Every 60 seconds, fetches prices for ALL companies
2. **Treasury rate fetch** - Every app restart fetches 10-year treasury
3. **Company imports** - Each ticker import makes 5+ API calls
4. **No caching** - Same data fetched repeatedly

---

## Quick Diagnosis

### Check Current API Call Rate

Run this in your terminal:

```bash
cd "/Users/subhankarshukla/Desktop/aryan proj/valuation_app"

# Count how many companies have tickers
python3 -c "
import psycopg2
conn = psycopg2.connect('postgresql://subhankarshukla@localhost:5432/valuations_institutional')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM companies WHERE ticker IS NOT NULL AND ticker != \'\'')
count = cursor.fetchone()[0]
print(f'Companies with tickers: {count}')
print(f'API calls per minute: {count} (prices)')
print(f'API calls per hour: {count * 60}')
print(f'Yahoo limit: ~2000 requests/hour from same IP')
if count * 60 > 2000:
    print('⚠️  YOU WILL HIT RATE LIMIT!')
"
```

---

## Immediate Fixes (Apply These Now)

### FIX 1: Disable Real-Time Updates Temporarily

**File:** `static/js/macro_controls.js` line 63-65

**Change:**
```javascript
// BEFORE (updates every 60 seconds)
priceUpdateInterval = setInterval(() => {
    updatePortfolioPrices();
}, 60000); // 60 seconds

// AFTER (updates every 10 minutes)
priceUpdateInterval = setInterval(() => {
    updatePortfolioPrices();
}, 600000); // 10 minutes = 600 seconds
```

This reduces API calls by 10x.

---

### FIX 2: Cache Treasury Rate

**File:** `data_integrator.py` line 58

**Add caching:**
```python
import time

class DataIntegrator:
    _treasury_cache = None
    _treasury_cache_time = 0
    _TREASURY_CACHE_DURATION = 3600  # 1 hour

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': 'Mozilla/5.0'})

        # Use cached treasury rate if available
        if (DataIntegrator._treasury_cache is not None and
            time.time() - DataIntegrator._treasury_cache_time < DataIntegrator._TREASURY_CACHE_DURATION):
            self.treasury_rate = DataIntegrator._treasury_cache
        else:
            self.treasury_rate = self._fetch_treasury_rate()
            DataIntegrator._treasury_cache = self.treasury_rate
            DataIntegrator._treasury_cache_time = time.time()
```

This fetches treasury rate only once per hour instead of every app restart.

---

### FIX 3: Add Request Delays

**File:** `realtime_price_service.py` line 24

**Add delay between requests:**
```python
import time

def get_current_price(self, ticker: str) -> Optional[float]:
    """Fetch current stock price from Yahoo Finance"""
    try:
        # ADD DELAY to avoid rate limiting
        time.sleep(2)  # Wait 2 seconds between requests

        stock = yf.Ticker(ticker)
        data = stock.history(period='1d', interval='1m')
        # ... rest of code
```

This adds 2-second delays between each price fetch.

---

### FIX 4: Use Session with User-Agent

**File:** `realtime_price_service.py`

**Modify to use session:**
```python
import yfinance as yf
import requests

class RealtimePriceService:
    def __init__(self):
        self.conn = None
        # Create persistent session
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def get_current_price(self, ticker: str) -> Optional[float]:
        try:
            # Use session for requests
            stock = yf.Ticker(ticker, session=self.session)
            # ... rest of code
```

Better user-agent can help avoid blocks.

---

## Complete Solution (Implement All At Once)

I'll create a fixed version that implements ALL fixes above. Want me to:

1. ✅ Reduce update frequency to 10 minutes
2. ✅ Add treasury rate caching
3. ✅ Add 2-second delays between price requests
4. ✅ Implement exponential backoff on errors
5. ✅ Add request logging to see what's happening

Type "yes" and I'll implement all fixes automatically.

---

## Alternative: Use Alpha Vantage or Finnhub

Yahoo Finance is free but has strict limits. Consider:

**Alpha Vantage** (500 requests/day free):
```python
import requests

def get_price_alphavantage(ticker, api_key):
    url = f'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}'
    response = requests.get(url)
    data = response.json()
    return float(data['Global Quote']['05. price'])
```

**Finnhub** (60 requests/minute free):
```python
import finnhub

finnhub_client = finnhub.Client(api_key="YOUR_API_KEY")
price = finnhub_client.quote(ticker)['c']  # Current price
```

---

## Debug Commands

### See all API calls in real-time:

```bash
# Add logging to see every request
export YFINANCE_LOG_LEVEL=DEBUG
python3 app.py
```

### Check if you're blocked:

```python
import yfinance as yf
test = yf.Ticker("AAPL")
try:
    print(test.info['currentPrice'])
    print("✅ Not blocked")
except Exception as e:
    print(f"❌ Blocked: {e}")
```

---

## Recommended Action Plan

1. **Immediate** (now):
   - Change update interval to 10 minutes (FIX 1)
   - Wait 1 hour for rate limit to reset

2. **Short term** (today):
   - Implement FIX 2, 3, 4 (caching + delays)
   - Test with 1-2 companies first

3. **Long term** (this week):
   - Consider switching to Alpha Vantage or Finnhub
   - Add database caching for prices (store last fetched time)
   - Only fetch if price is >5 minutes old

---

## Want Me to Fix This Now?

Reply with what you want:
- **"fix it"** - I'll implement all fixes automatically
- **"show me the changes"** - I'll show you each fix to review
- **"just the critical ones"** - I'll do FIX 1 & 2 only (fastest)

# 📊 Valuation App - Complete Logic & Data Source Guide

## Overview

This guide explains **exactly** where every number on your portfolio page comes from, what assumptions are used, and how to modify them.

---

## 🎯 The Big Picture: Data Flow

```
Yahoo Finance → data_integrator.py → PostgreSQL Database → valuation_service.py → valuation_professional.py → API → Frontend
```

1. **Yahoo Finance API** provides raw financial data (revenue, debt, prices, etc.)
2. **data_integrator.py** fetches and transforms this data into valuation inputs
3. **PostgreSQL** stores company financials and valuation assumptions
4. **valuation_professional.py** runs DCF calculations and comparable analysis
5. **app.py** serves results via API to the frontend
6. **Frontend (index.html)** displays cards with fair value, P/E, ROE, etc.

---

## 📍 What You See on the Portfolio Page

Each company card shows these metrics:

| **Metric** | **What It Means** | **Data Source** | **Calculation Method** |
|------------|-------------------|-----------------|------------------------|
| **Fair Value** | Estimated true worth of the company | **Calculated** | Weighted average: 50% DCF + 25% EV/EBITDA + 25% P/E |
| **Recommendation** | BUY/HOLD/SELL rating | **Calculated** | Based on upside % vs thresholds in config.py |
| **Upside %** | Potential gain from current price | **Calculated** | `(Fair Value - Market Cap) / Market Cap × 100` |
| **Current Price** | Real-time stock price | **Yahoo Finance** | `market_cap / shares_outstanding` |
| **Market Cap** | Current company valuation by market | **Yahoo Finance** | Direct from Yahoo Finance API |
| **P/E Ratio** | Price-to-earnings multiple | **Calculated** | `Equity Value / Profit` |
| **ROE** | Return on equity | **Calculated** | `(Profit / Equity Value) × 100` |
| **ROIC** | Return on invested capital | **Calculated** | `(Profit × 0.8) / (Debt + Equity) × 100` |
| **WACC** | Weighted average cost of capital | **Calculated** | CAPM formula (see below) |
| **EV/EBITDA** | Enterprise value multiple | **Calculated** | `(Equity + Debt - Cash) / EBITDA` |
| **FCF Yield** | Free cash flow as % of value | **Calculated** | `(FCF / Equity Value) × 100` |
| **Debt/Equity** | Leverage ratio | **Calculated** | `Total Debt / Equity Value` |
| **Z-Score** | Bankruptcy risk indicator | **Calculated** | Altman Z-Score formula |

---

## 📥 Data Sources: Where Raw Data Comes From

### 1. Yahoo Finance (via `data_integrator.py`)

All financial data is fetched from **Yahoo Finance** using the `yfinance` Python library.

**File:** [data_integrator.py](data_integrator.py)

#### Key Functions:

**`get_company_data(ticker)`** - Main function that fetches everything:

```python
stock = yf.Ticker("AAPL")
info = stock.info               # Company metadata
financials = stock.financials   # Income statement
balance_sheet = stock.balance_sheet  # Assets, debt, cash
cashflow = stock.cashflow       # CapEx, depreciation
hist = stock.history(period="5y")  # Price history for beta
```

#### Data Extracted:

| **Field** | **Yahoo Finance Source** | **Line in Code** |
|-----------|-------------------------|------------------|
| **Revenue** | `financials['Total Revenue']` | [data_integrator.py:87](data_integrator.py#L87) |
| **EBITDA** | `financials['EBITDA']` | [data_integrator.py:88](data_integrator.py#L88) |
| **Net Income** | `financials['Net Income']` | [data_integrator.py:91](data_integrator.py#L91) |
| **Debt** | `balance_sheet['Total Debt']` | [data_integrator.py:103](data_integrator.py#L103) |
| **Cash** | `balance_sheet['Cash And Cash Equivalents']` | [data_integrator.py:104](data_integrator.py#L104) |
| **Depreciation** | `cashflow['Depreciation And Amortization']` | [data_integrator.py:113](data_integrator.py#L113) |
| **CapEx** | `cashflow['Capital Expenditure']` | [data_integrator.py:114](data_integrator.py#L114) |
| **Shares Outstanding** | `info['sharesOutstanding']` | [data_integrator.py:123](data_integrator.py#L123) |
| **Current Price** | `info['currentPrice']` | [data_integrator.py:79](data_integrator.py#L79) |
| **Market Cap** | `info['marketCap']` | [data_integrator.py:80](data_integrator.py#L80) |
| **Sector** | `info['sector']` | [data_integrator.py:77](data_integrator.py#L77) |

---

### 2. Risk-Free Rate (10-Year Treasury Yield)

**Source:** Yahoo Finance ticker `^TNX` (10-year US Treasury Note)

**File:** [data_integrator.py:26-41](data_integrator.py#L26-L41)

**Code:**
```python
def _get_risk_free_rate(self) -> float:
    tnx = yf.Ticker("^TNX")
    hist = tnx.history(period="5d")
    rate = hist['Close'].iloc[-1] / 100  # Convert from percentage
    return rate  # Example: 0.045 = 4.5%
```

**How It's Used:**
- Cost of equity calculation (CAPM formula)
- WACC calculation
- DCF discount rate

**Current Default:** 4.5% if API fails

---

### 3. Market Risk Premium (Equity Risk Premium)

**Source:** **Hardcoded** based on historical US equity returns

**File:** [data_integrator.py:24](data_integrator.py#L24)

**Code:**
```python
self.market_risk_premium = 0.065  # 6.5%
```

**How It's Used:**
- CAPM formula: `Cost of Equity = Risk-Free Rate + Beta × Market Risk Premium`

**Where to Change:** [data_integrator.py:24](data_integrator.py#L24) or set in [config.py](config.py) (future improvement)

---

### 4. Beta (Stock Volatility vs Market)

**Source:** **Calculated** using 5-year regression against S&P 500 (SPY)

**File:** [data_integrator.py:210-250](data_integrator.py#L210-L250)

**Method:**
1. Fetch 5 years of daily prices for the stock
2. Fetch 5 years of daily prices for SPY (S&P 500 ETF)
3. Calculate daily returns for both
4. Run linear regression: `Stock Returns = α + β × Market Returns`
5. Beta = `Covariance(Stock, Market) / Variance(Market)`

**Code:**
```python
# Calculate beta (covariance / variance)
covariance = merged['stock_ret'].cov(merged['spy_ret'])
variance = merged['spy_ret'].var()
beta = covariance / variance
```

**Interpretation:**
- Beta = 1.0 → Stock moves with the market
- Beta > 1.0 → Stock is more volatile than market (e.g., Tesla = 2.0)
- Beta < 1.0 → Stock is less volatile (e.g., utilities = 0.6)

**Default:** 1.0 if calculation fails

---

### 5. Growth Rates (Revenue Growth Projections)

**Source:** Yahoo Finance analyst estimates + historical trends

**File:** [data_integrator.py:159-191](data_integrator.py#L159-L191)

**Method:**
1. Try to get analyst growth estimate: `info.get('revenueGrowth')`
2. If not available, calculate from historical financials:
   ```python
   y1_growth = (recent_revenue / prior_revenue - 1)
   ```
3. Apply multi-stage step-down:
   - **Y1:** Analyst estimate or historical (capped at 50%)
   - **Y2:** Y1 × 85% (moderate decline)
   - **Y3:** Y1 × 70% (further decline)
   - **Terminal:** 2.5% (long-term GDP growth)

**Code:**
```python
y1_growth = max(0, min(y1_growth, 0.50))  # Between 0% and 50%
y2_growth = y1_growth * 0.85
y3_growth = y1_growth * 0.70
terminal_growth = 0.025  # 2.5%
```

**Where to Change:** [data_integrator.py:177-187](data_integrator.py#L177-L187)

---

### 6. Tax Rate

**Source:** Calculated from financial statements

**File:** [data_integrator.py:193-208](data_integrator.py#L193-L208)

**Method:**
```python
effective_rate = tax_provision / pretax_income
```

**Bounds:** Between 0% and 35%

**Default:** 21% (US federal corporate tax rate)

---

### 7. Size Premium (Small Cap Risk Premium)

**Source:** **Market cap-based lookup table**

**File:** [data_integrator.py:252-264](data_integrator.py#L252-L264)

**Code:**
```python
if market_cap < 1e9:        # < $1B  → +3.0%
elif market_cap < 5e9:      # < $5B  → +2.0%
elif market_cap < 25e9:     # < $25B → +1.0%
else:                       # Large cap → 0%
```

**Rationale:** Smaller companies are riskier, so investors demand higher returns.

---

### 8. Comparable Multiples (EV/EBITDA, P/E, PEG)

**Source:** Sector averages from [data_integrator.py:291-309](data_integrator.py#L291-L309)

**Method:**
1. Try to get company's own multiples from Yahoo Finance
2. Compare against sector averages
3. Cap at 0.5× to 1.5× sector average (prevent outliers)

**Sector Average Table:**

| **Sector** | **EV/EBITDA** | **P/E** |
|------------|---------------|---------|
| Technology | 15.0× | 25.0× |
| Healthcare | 14.0× | 22.0× |
| Financials | 10.0× | 15.0× |
| Energy | 8.0× | 12.0× |
| Utilities | 9.0× | 16.0× |
| Real Estate | 12.0× | 25.0× |
| Default | 12.0× | 20.0× |

**Where to Change:** [data_integrator.py:296-309](data_integrator.py#L296-L309)

---

## 🧮 Calculations: How Fair Value is Computed

### Step 1: Calculate WACC (Weighted Average Cost of Capital)

**File:** [valuation_professional.py:17-44](valuation_professional.py#L17-L44)

**Formula:**
```
Cost of Equity = Risk-Free Rate + Beta × Market Risk Premium + Country Risk + Size Premium

Cost of Debt = Risk-Free Rate + Credit Spread × (1 - Tax Rate)

WACC = (Equity / (Equity + Debt)) × Cost of Equity
     + (Debt / (Equity + Debt)) × Cost of Debt
```

**Credit Spread Logic:**
```python
if debt > equity:
    credit_spread = 0.025  # 2.5% for high leverage
else:
    credit_spread = 0.015  # 1.5% for investment grade
```

**Where to Change:**
- Credit spreads: [valuation_professional.py:25](valuation_professional.py#L25)
- Add to [config.py](config.py) for configurability

---

### Step 2: Project 10-Year Free Cash Flows

**File:** [valuation_professional.py:187-221](valuation_professional.py#L187-L221)

**Growth Schedule (10 years):**
```python
growth_schedule = [
    growth_y1, growth_y1,        # Years 1-2: High growth
    growth_y2, growth_y2,        # Years 3-4: Moderate
    growth_y3, growth_y3,        # Years 5-6: Maturing
    (growth_y3 + terminal)/2,    # Year 7: Transition
    terminal + 0.01,             # Year 8: Near-terminal
    terminal + 0.005,            # Year 9: Close to terminal
    terminal                     # Year 10: Terminal rate
]
```

**Free Cash Flow Formula (each year):**
```
Revenue[t] = Revenue[t-1] × (1 + Growth Rate)
EBITDA[t] = Revenue[t] × (EBITDA / Revenue)
EBIT[t] = EBITDA[t] - Depreciation[t]
NOPAT[t] = EBIT[t] × (1 - Tax Rate)
CapEx[t] = Revenue[t] × CapEx %
FCF[t] = NOPAT[t] + Depreciation[t] - CapEx[t] - Working Capital Change
```

**Present Value:**
```
PV[FCF[t]] = FCF[t] / (1 + WACC)^t
```

**Where to Change:** [valuation_professional.py:196-221](valuation_professional.py#L196-L221)

---

### Step 3: Calculate Terminal Value

**File:** [valuation_professional.py:223-237](valuation_professional.py#L223-L237)

**Perpetuity Growth Method:**
```
Terminal FCF = FCF[Year 10] × (1 + Terminal Growth Rate)

Terminal Value = Terminal FCF / (WACC - Terminal Growth Rate)

PV of Terminal Value = Terminal Value / (1 + WACC)^10
```

**Where to Change:**
- Terminal growth rate: [config.py:74](config.py#L74) (`TERMINAL_MARGIN`)
- Default: 2.5%

---

### Step 4: Calculate DCF Equity Value

**File:** [valuation_professional.py:239-252](valuation_professional.py#L239-L252)

**Formula:**
```
Enterprise Value = Sum of PV(FCFs) + PV(Terminal Value)

Equity Value = Enterprise Value + Cash - Debt

Price per Share = Equity Value / Shares Outstanding
```

---

### Step 5: Comparable Company Valuation

**File:** [valuation_professional.py:254-275](valuation_professional.py#L254-L275)

**EV/EBITDA Method:**
```
Implied EV = EBITDA × Sector EV/EBITDA Multiple
Implied Equity Value = Implied EV - Debt + Cash
```

**P/E Method:**
```
Profit = Revenue × Profit Margin
Implied Equity Value = Profit × Sector P/E Multiple
```

---

### Step 6: Weighted Average Fair Value

**File:** [valuation_professional.py:277-288](valuation_professional.py#L277-L288)

**Default Weights (from [config.py:59-63](config.py#L59-L63)):**
```python
VALUATION_WEIGHTS = {
    'dcf': 0.5,        # 50% DCF
    'ev_ebitda': 0.25, # 25% EV/EBITDA comps
    'pe': 0.25         # 25% P/E comps
}
```

**Formula:**
```
Fair Value = (DCF Value × 50%) + (EV/EBITDA Value × 25%) + (P/E Value × 25%)

Fair Price per Share = Fair Value / Shares Outstanding
```

**Where to Change:** [config.py:59-63](config.py#L59-L63)

---

### Step 7: Calculate Financial Ratios

**File:** [valuation_professional.py:47-91](valuation_professional.py#L47-L91)

| **Ratio** | **Formula** | **Line in Code** |
|-----------|-------------|------------------|
| **EV/EBITDA** | `(Equity + Debt - Cash) / EBITDA` | [valuation_professional.py:52](valuation_professional.py#L52) |
| **P/E** | `Equity Value / Profit` | [valuation_professional.py:55](valuation_professional.py#L55) |
| **ROE** | `(Profit / Equity Value) × 100` | [valuation_professional.py:65](valuation_professional.py#L65) |
| **ROIC** | `(Profit × 0.8) / (Debt + Equity) × 100` | [valuation_professional.py:67](valuation_professional.py#L67) |
| **FCF Yield** | `(FCF / Equity Value) × 100` | [valuation_professional.py:71](valuation_professional.py#L71) |
| **Debt/Equity** | `Debt / Equity Value` | [valuation_professional.py:59](valuation_professional.py#L59) |

---

### Step 8: Altman Z-Score (Bankruptcy Risk)

**File:** [valuation_professional.py:94-127](valuation_professional.py#L94-L127)

**Formula (for public companies):**
```
Z = 1.2 × (Working Capital / Total Assets)
  + 1.4 × (Retained Earnings / Total Assets)
  + 3.3 × (EBIT / Total Assets)
  + 0.6 × (Market Value / Total Liabilities)
  + 1.0 × (Revenue / Total Assets)
```

**Interpretation:**
- **Z > 2.99:** Safe Zone (low bankruptcy risk)
- **1.81 < Z < 2.99:** Grey Zone (moderate risk)
- **Z < 1.81:** Distress Zone (high bankruptcy risk)

**Where to Change:** [config.py:75](config.py#L75) (`ALT_ZSCORE_SELL_THRESHOLD = 1.81`)

---

### Step 9: Investment Recommendation

**File:** [valuation_professional.py:366-408](valuation_professional.py#L366-L408)

**Upside Calculation:**
```
Upside % = ((Fair Value - Market Cap) / Market Cap) × 100
```

**Recommendation Thresholds (from [config.py:51-56](config.py#L51-L56)):**
```python
RECOMMENDATION_THRESHOLDS = {
    'strong_buy': 20,      # ≥ +20% upside → STRONG BUY
    'buy': 10,             # ≥ +10% upside → BUY
    'hold': -10,           # > -10% upside → HOLD
    'underweight': -20     # > -20% upside → UNDERWEIGHT
}
# < -20% → SELL
```

**Safety Overrides:**

1. **Low Z-Score → Downgrade:**
   ```python
   if z_score < 1.81:
       # Downgrade by one notch (STRONG BUY → BUY, BUY → HOLD, etc.)
   ```

2. **High Debt/Equity → Downgrade:**
   ```python
   if debt_to_equity > 2.0:
       # Downgrade by one notch
   ```

**Where to Change:**
- Thresholds: [config.py:51-56](config.py#L51-L56)
- Z-score cutoff: [config.py:75](config.py#L75)
- Debt/equity cutoff: [config.py:76](config.py#L76)

---

### Step 10: Monte Carlo Simulation (Valuation Range)

**File:** [valuation_professional.py:130-147](valuation_professional.py#L130-L147)

**Method:**
1. Run 1,000 simulations
2. Each simulation randomly perturbs:
   - Growth rates (±15% volatility)
   - Discount rate (±10% volatility)
3. Calculate fair value for each scenario
4. Report 10th percentile (bear case) and 90th percentile (bull case)

**Default Volatilities (from [config.py:70-71](config.py#L70-L71)):**
```python
MONTE_CARLO_GROWTH_VOL = 0.15    # 15% growth volatility
MONTE_CARLO_DISCOUNT_VOL = 0.10  # 10% discount rate volatility
```

**Where to Change:** [config.py:70-71](config.py#L70-L71)

---

## 🎛️ Configuration: Where to Adjust Assumptions

All configurable parameters are in **[config.py](config.py)**:

### Recommendation Thresholds
```python
# config.py lines 51-56
RECOMMENDATION_THRESHOLDS = {
    'strong_buy': 20,      # Change to 25 for stricter BUY ratings
    'buy': 10,
    'hold': -10,
    'underweight': -20
}
```

### Valuation Method Weights
```python
# config.py lines 59-63
VALUATION_WEIGHTS = {
    'dcf': 0.5,            # Change to 0.7 to prioritize DCF over comps
    'ev_ebitda': 0.25,
    'pe': 0.25
}
```

### Bear/Bull Multipliers
```python
# config.py lines 66-67
BEAR_MULTIPLIER = 0.75   # Bear case = 75% of base case (25% haircut)
BULL_MULTIPLIER = 1.25   # Bull case = 125% of base case (25% premium)
```

### Monte Carlo Volatility
```python
# config.py lines 70-71
MONTE_CARLO_GROWTH_VOL = 0.15    # 15% volatility in growth rates
MONTE_CARLO_DISCOUNT_VOL = 0.10  # 10% volatility in discount rate
```

### Risk Parameters
```python
# config.py lines 74-76
TERMINAL_MARGIN = 0.01              # Terminal growth safety margin
ALT_ZSCORE_SELL_THRESHOLD = 1.81   # Z-score bankruptcy threshold
DEBT_EQUITY_DOWNGRADE = 2.0        # Debt/equity downgrade trigger
```

---

## 🛠️ How to Modify Specific Assumptions

### 1. Change Market Risk Premium

**Current:** 6.5% (hardcoded in [data_integrator.py:24](data_integrator.py#L24))

**To Change:**
1. Open [data_integrator.py](data_integrator.py)
2. Line 24: Change `self.market_risk_premium = 0.065` to your desired value (e.g., `0.070` for 7%)
3. Restart the app

**Better Approach (for Phase 1):**
- Move this to [config.py](config.py) as `MARKET_RISK_PREMIUM`
- Read from config in [data_integrator.py](data_integrator.py)

---

### 2. Change Terminal Growth Rate

**Current:** 2.5% (hardcoded in [data_integrator.py:181](data_integrator.py#L181))

**To Change:**
1. Open [data_integrator.py](data_integrator.py)
2. Line 181: Change `terminal_growth = 0.025` to your desired value (e.g., `0.030` for 3%)
3. Restart the app

---

### 3. Change Credit Spreads (Debt Pricing)

**Current:** 2.5% for high leverage, 1.5% for investment grade

**To Change:**
1. Open [valuation_professional.py](valuation_professional.py)
2. Line 25: Change credit spread values:
   ```python
   credit_spread = 0.030 if debt > equity else 0.020  # 3% / 2%
   ```
3. Restart the app

---

### 4. Change Sector Multiples

**Current:** Sector averages in [data_integrator.py:296-309](data_integrator.py#L296-L309)

**To Change:**
1. Open [data_integrator.py](data_integrator.py)
2. Modify the `sector_data` dictionary at lines 296-309
3. Example:
   ```python
   'Technology': {'ev_ebitda': 18.0, 'pe': 30.0},  # Increase Tech multiples
   ```

---

### 5. Override Growth Rates for a Specific Company

**Current:** All growth rates are auto-calculated from Yahoo Finance

**To Override Manually:**
1. Open PostgreSQL database: `psql -d valuations_institutional`
2. Update company_financials table:
   ```sql
   UPDATE company_financials
   SET growth_rate_y1 = 0.15,   -- 15% Year 1
       growth_rate_y2 = 0.12,   -- 12% Year 2
       growth_rate_y3 = 0.08    -- 8% Year 3
   WHERE company_id = (SELECT id FROM companies WHERE ticker = 'AAPL');
   ```
3. Re-run valuation via API or UI

---

### 6. Change Valuation Weights (DCF vs Comps)

**Current:** 50% DCF, 25% EV/EBITDA, 25% P/E

**To Change:**
1. Open [config.py](config.py)
2. Lines 59-63: Modify weights:
   ```python
   VALUATION_WEIGHTS = {
       'dcf': 0.70,        # 70% DCF (increase confidence in DCF)
       'ev_ebitda': 0.20,  # 20% EV/EBITDA
       'pe': 0.10          # 10% P/E
   }
   ```
3. Restart the app

---

## 🔍 Deep Dive: DCF Model Details

### Growth Stage Structure (10 Years)

**Current Schedule:**
```
Year 1-2:  High growth (Y1 growth rate from analyst estimates)
Year 3-4:  Moderate growth (85% of Y1)
Year 5-6:  Maturing growth (70% of Y1)
Year 7:    Transition ((Y3 + Terminal) / 2)
Year 8:    Near-terminal (Terminal + 0.01)
Year 9:    Close to terminal (Terminal + 0.005)
Year 10:   Terminal rate (2.5%)
```

**Why This Structure?**
- High-growth companies don't sustain 30%+ growth forever
- Gradual step-down mimics real-world business lifecycle
- Avoids "hockey stick" unrealistic projections

**To Change to 3-Stage Model:**
Open [valuation_professional.py:196-201](valuation_professional.py#L196-L201) and modify:
```python
growth_schedule = [
    growth_y1, growth_y1, growth_y1, growth_y1,  # Years 1-4: High growth
    growth_y2, growth_y2, growth_y2,              # Years 5-7: Moderate
    terminal, terminal, terminal                  # Years 8-10: Terminal
]
```

---

### WACC Components Breakdown

**Example Calculation (Apple-like company):**

```
Risk-Free Rate:        4.5%  (10-year Treasury from ^TNX)
Beta:                  1.2   (5-year regression vs SPY)
Market Risk Premium:   6.5%  (Historical equity premium)
Size Premium:          0%    (Large cap > $25B)
Country Risk Premium:  0%    (US company)

Cost of Equity = 4.5% + 1.2 × 6.5% + 0% + 0% = 12.3%

Debt:                  $100B
Equity:                $3,000B
Tax Rate:              21%
Credit Spread:         1.5%  (Low leverage: debt < equity)

Cost of Debt = (4.5% + 1.5%) × (1 - 0.21) = 4.74%

WACC = (3,000 / 3,100) × 12.3% + (100 / 3,100) × 4.74%
     = 0.968 × 12.3% + 0.032 × 4.74%
     = 11.9% + 0.15%
     = 12.05%
```

---

## 🎓 Understanding the Metrics

### ROE (Return on Equity)
**Formula:** `(Profit / Equity Value) × 100`

**Interpretation:**
- ROE > 20%: Excellent (e.g., Apple, Microsoft)
- ROE 10-20%: Good
- ROE < 10%: Poor capital efficiency

**Example:**
- Profit: $100B
- Equity Value: $3,000B
- ROE = ($100B / $3,000B) × 100 = 3.33% (low for big tech)

---

### ROIC (Return on Invested Capital)
**Formula:** `(Profit × 0.8) / (Debt + Equity) × 100`

**Why × 0.8?** Approximates after-tax NOPAT (Net Operating Profit After Tax)

**Interpretation:**
- ROIC > 15%: Excellent capital allocation
- ROIC > WACC: Value creation
- ROIC < WACC: Value destruction

---

### FCF Yield (Free Cash Flow Yield)
**Formula:** `(FCF / Equity Value) × 100`

**Interpretation:**
- FCF Yield > 8%: Strong cash generation
- FCF Yield 3-8%: Moderate
- FCF Yield < 3%: Capital intensive or growth reinvestment

**Similar to:** Dividend yield, but measures cash available (not just paid out)

---

### Altman Z-Score (Bankruptcy Risk)
**Formula:** Weighted combination of 5 ratios (working capital, retained earnings, EBIT, market value, revenue)

**Interpretation:**
- Z > 2.99: **Safe Zone** - Low bankruptcy risk within 2 years
- 1.81 < Z < 2.99: **Grey Zone** - Moderate risk
- Z < 1.81: **Distress Zone** - High risk (>80% chance of bankruptcy)

**Real Example:**
- Healthy tech company: Z = 5.0 (very safe)
- Struggling retailer: Z = 1.2 (high risk)

**Action:** Z < 1.81 automatically downgrades recommendation by one notch

---

## 📊 Sensitivity Analysis Explained

The sensitivity table in the valuation output shows how **terminal value changes** with different assumptions:

```
Discount Rate →    10.0%     11.0%     12.0%     13.0%     14.0%
TG 1.5%        $3,200M   $2,900M   $2,650M   $2,450M   $2,280M
TG 2.0%        $3,450M   $3,100M   $2,820M   $2,590M   $2,400M
TG 2.5%        $3,750M   $3,350M   $3,020M   $2,750M   $2,530M
TG 3.0%        $4,100M   $3,650M   $3,260M   $2,950M   $2,700M
```

**How to Read:**
- **Rows:** Different terminal growth rates (1.5% to 3.0%)
- **Columns:** Different discount rates (WACC ± 2%)
- **Values:** Resulting equity value

**Example Insight:**
- If WACC increases from 12% to 13%, equity value drops from $3,020M to $2,750M (~9% decrease)
- Terminal growth has HUGE impact: 2.5% vs 3.0% = ~$200M difference

---

## 🚨 Common Pitfalls & Warnings

### 1. **WACC < Terminal Growth** → Model Breaks

**Error:** `"Warning: WACC (4.5%) must be greater than terminal growth (2.5%)"`

**Cause:** Low beta + low risk-free rate → very low WACC

**Fix:** Model automatically adjusts terminal growth down:
```python
if wacc <= terminal_growth:
    terminal_growth = min(terminal_growth, wacc - 0.01)
```

---

### 2. **Missing Financial Data** → Defaults Kick In

If Yahoo Finance doesn't return revenue, EBITDA, etc.:
- Revenue: Uses `info['totalRevenue']` or 0
- EBITDA: Defaults to 10% of revenue
- Depreciation: 5% of EBITDA
- Growth rate: 10%

**Warning:** Defaults may be inaccurate - verify data quality!

---

### 3. **High Leverage** → Credit Spread Increases Cost of Capital

**Logic:**
```python
if debt > equity:
    credit_spread = 2.5%  # Junk bond pricing
else:
    credit_spread = 1.5%  # Investment grade
```

**Impact:** High debt → higher WACC → lower valuation

---

### 4. **Negative Free Cash Flow** → Valuation Becomes Unreliable

**Cause:**
- CapEx > NOPAT (heavy investment phase)
- Large working capital swings

**Fix:** Model still runs, but DCF value may be negative or nonsensical
- Comps (EV/EBITDA, P/E) become more important
- Consider adjusting weights: 30% DCF, 40% EV/EBITDA, 30% P/E

---

## 🔮 Future Enhancements (Phase 1+)

### 1. Scenario Manager
- Create Bear/Base/Bull scenarios with different assumptions
- Apply scenarios to entire portfolio
- Compare side-by-side

### 2. Macro Framework
- Auto-update risk-free rate daily from FRED API
- Link market risk premium to VIX volatility
- Country risk premiums for international stocks

### 3. Industry Templates
- Pre-configured assumption sets by sector
- Tech: High growth, high margins, low CapEx
- Utilities: Low growth, high CapEx, low beta

### 4. Assumption Audit Trail
- Track who changed which assumption and when
- Rollback to prior assumptions
- Approval workflow for assumption changes

---

## 📖 Summary: The 3-Step Valuation Process

### Step 1: Fetch Data
**[data_integrator.py](data_integrator.py)** → Fetch from Yahoo Finance
- Revenue, EBITDA, debt, cash (financial statements)
- Beta (5-year regression vs SPY)
- Risk-free rate (^TNX Treasury yield)
- Growth estimates (analysts or historical)

### Step 2: Calculate Fair Value
**[valuation_professional.py](valuation_professional.py)** → Run DCF + Comps
1. Calculate WACC (cost of capital)
2. Project 10 years of free cash flows
3. Calculate terminal value (perpetuity growth)
4. Discount everything to present value → **DCF Value**
5. Calculate EV/EBITDA and P/E comparable values
6. Weighted average: 50% DCF + 25% EV/EBITDA + 25% P/E → **Fair Value**

### Step 3: Display Results
**[app.py](app.py) → [index.html](templates/index.html)** → Show on portfolio page
- Fair value per share
- Upside % vs current price
- Recommendation (BUY/HOLD/SELL)
- Financial ratios (P/E, ROE, ROIC, Z-score)

---

## 🎯 Quick Reference: File Map

| **File** | **Purpose** | **Key Functions** |
|----------|-------------|-------------------|
| [data_integrator.py](data_integrator.py) | Fetch data from Yahoo Finance | `get_company_data()`, `_calculate_beta()`, `_get_risk_free_rate()` |
| [valuation_professional.py](valuation_professional.py) | DCF calculations | `enhanced_dcf_valuation()`, `calculate_wacc()`, `altman_z_score()` |
| [valuation_service.py](valuation_service.py) | Orchestrates valuation | `run_valuation()`, `fetch_company_data()` |
| [app.py](app.py) | API endpoints | `/api/ticker/import-and-value`, `/api/companies` |
| [config.py](config.py) | Configuration | Thresholds, weights, volatilities |
| [templates/index.html](templates/index.html) | Frontend UI | Displays portfolio cards |

---

## 🎓 Want to Learn More?

**Recommended Reading:**
- **DCF Valuation:** "Investment Valuation" by Aswath Damodaran
- **Comparable Analysis:** "Valuation: Measuring and Managing the Value of Companies" (McKinsey)
- **WACC Calculation:** "Corporate Finance" by Ross, Westerfield, Jaffe
- **Altman Z-Score:** Original paper by Edward Altman (1968)

**Online Resources:**
- Damodaran Online: http://pages.stern.nyu.edu/~adamodar/
- FRED Economic Data: https://fred.stlouisfed.org/
- Yahoo Finance API: https://github.com/ranaroussi/yfinance

---

## ✅ Checklist: Verify Your Understanding

Can you answer these questions?

- [ ] Where does revenue come from? *(Yahoo Finance financials)*
- [ ] How is beta calculated? *(5-year regression vs SPY)*
- [ ] What's the current risk-free rate? *(Check ^TNX ticker)*
- [ ] What are the DCF weights? *(50% DCF, 25% EV/EBITDA, 25% P/E)*
- [ ] How do I change the market risk premium? *(Edit data_integrator.py:24)*
- [ ] What triggers a SELL recommendation? *(Upside < -20%)*
- [ ] What does Z-Score < 1.81 mean? *(High bankruptcy risk)*
- [ ] How many years does the DCF project? *(10 years + terminal value)*
- [ ] Where are recommendation thresholds defined? *(config.py:51-56)*
- [ ] How is fair value calculated? *(Weighted avg of DCF, EV/EBITDA, P/E)*

If you can answer all of these, you understand the valuation logic! 🎉

---

**Last Updated:** December 2024
**Version:** Phase 0 (Foundation Complete)
**Next:** Phase 1 will add scenario management and macro framework

For questions or modifications, refer to this guide and the linked source files.

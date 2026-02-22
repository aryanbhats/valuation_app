"""
Institutional-Grade Data Integration Module
Auto-populates company financials from Alpha Vantage and FRED APIs
"""

from alpha_vantage.timeseries import TimeSeries
from alpha_vantage.fundamentaldata import FundamentalData
import pandas as pd
import numpy as np
import requests
import random
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import logging
import time
from functools import lru_cache
from config import Config

logger = logging.getLogger(__name__)


class DataIntegrator:
    """
    Fetches real-time and historical data from Alpha Vantage and FRED APIs.
    Automatically populates all required fields for DCF valuation.
    """
    
    # Class-level cache for Treasury rate (shared across instances)
    _cached_risk_free_rate = None
    _cache_timestamp = None
    _cache_duration = Config.TREASURY_RATE_CACHE_DURATION  # 24 hours
    
    # Class-level cache for company data (shared across instances)
    _company_data_cache = {}  # {ticker: (data, timestamp)}
    _company_cache_duration = Config.COMPANY_DATA_CACHE_DURATION  # 6 hours
    
    # Circuit breaker for rate limiting (shared across instances)
    _consecutive_429_errors = 0
    _circuit_breaker_until = None
    _max_429_errors = Config.CIRCUIT_BREAKER_THRESHOLD
    _circuit_breaker_duration = Config.CIRCUIT_BREAKER_DURATION

    def __init__(self):
        # Initialize Alpha Vantage clients
        self.api_key = Config.ALPHA_VANTAGE_API_KEY
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY not found in configuration")
        
        self.ts = TimeSeries(key=self.api_key, output_format='pandas')
        self.fd = FundamentalData(key=self.api_key, output_format='pandas')
        
        self.risk_free_rate = self._get_risk_free_rate()
        self.market_risk_premium = 0.065  # Historical US equity risk premium
        self._request_delay = Config.API_REQUEST_DELAY  # 12 seconds for Alpha Vantage (5 calls/min)
    
    def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker is active. Returns True if requests should be blocked."""
        if DataIntegrator._circuit_breaker_until is not None:
            if datetime.now() < DataIntegrator._circuit_breaker_until:
                remaining = (DataIntegrator._circuit_breaker_until - datetime.now()).total_seconds()
                logger.warning(f"⚠️ Circuit breaker active. Requests blocked for {remaining:.0f} more seconds.")
                return True
            else:
                # Circuit breaker expired, reset
                logger.info("✅ Circuit breaker expired. Resuming requests.")
                DataIntegrator._circuit_breaker_until = None
                DataIntegrator._consecutive_429_errors = 0
        return False
    
    def _trigger_circuit_breaker(self):
        """Trigger circuit breaker after too many 429 errors"""
        DataIntegrator._consecutive_429_errors += 1
        if DataIntegrator._consecutive_429_errors >= DataIntegrator._max_429_errors:
            DataIntegrator._circuit_breaker_until = datetime.now() + timedelta(seconds=DataIntegrator._circuit_breaker_duration)
            logger.error(f"🚨 Circuit breaker triggered! Too many rate limit errors. Pausing requests for {DataIntegrator._circuit_breaker_duration}s.")
    
    def _reset_circuit_breaker(self):
        """Reset circuit breaker after successful request"""
        if DataIntegrator._consecutive_429_errors > 0:
            DataIntegrator._consecutive_429_errors = 0
            logger.debug("Circuit breaker error count reset.")
    
    def _get_delay_with_jitter(self) -> float:
        """Get request delay with random jitter to avoid predictable patterns"""
        jitter = random.uniform(-0.5, 0.5)
        return max(0.5, self._request_delay + jitter)  # Ensure minimum 0.5s delay

    def _get_risk_free_rate(self) -> float:
        """Get current 10-year Treasury rate from FRED API (with caching)"""
        # Check cache first
        now = datetime.now()
        if (DataIntegrator._cached_risk_free_rate is not None and 
            DataIntegrator._cache_timestamp is not None):
            elapsed = (now - DataIntegrator._cache_timestamp).total_seconds()
            if elapsed < DataIntegrator._cache_duration:
                logger.debug(f"Using cached risk-free rate: {DataIntegrator._cached_risk_free_rate*100:.2f}%")
                return DataIntegrator._cached_risk_free_rate
        
        # Fetch new rate from FRED API
        try:
            logger.info("Fetching Treasury rate from FRED API...")
            rate = self._fetch_treasury_rate_from_fred()
            
            # Update cache
            DataIntegrator._cached_risk_free_rate = rate
            DataIntegrator._cache_timestamp = now
            
            logger.info(f"Risk-free rate (10Y Treasury): {rate*100:.2f}%")
            return rate
        except Exception as e:
            logger.error(f"Error fetching risk-free rate from FRED: {e}")
            # Use cached value if available, otherwise default
            if DataIntegrator._cached_risk_free_rate is not None:
                logger.warning(f"Using stale cached rate: {DataIntegrator._cached_risk_free_rate*100:.2f}%")
                return DataIntegrator._cached_risk_free_rate
            return 0.045  # Default fallback
    
    def _fetch_treasury_rate_from_fred(self) -> float:
        """Fetch 10-Year Treasury rate from FRED API"""
        try:
            fred_api_key = Config.FRED_API_KEY
            if not fred_api_key:
                logger.warning("FRED_API_KEY not configured, using default 4.5%")
                return 0.045
            
            url = f"{Config.FRED_BASE_URL}/series/observations"
            params = {
                'series_id': 'DGS10',  # 10-Year Treasury Constant Maturity Rate
                'api_key': fred_api_key,
                'limit': 1,
                'sort_order': 'desc',
                'file_type': 'json'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'observations' in data and len(data['observations']) > 0:
                rate_str = data['observations'][0]['value']
                if rate_str != '.':  # FRED returns '.' for missing data
                    rate = float(rate_str) / 100  # Convert from percentage
                    self._reset_circuit_breaker()
                    return rate
            
            logger.warning("Could not fetch Treasury rate from FRED, using default 4.5%")
            return 0.045
            
        except Exception as e:
            logger.error(f"Error fetching from FRED API: {e}")
            return 0.045

    def get_company_data(self, ticker: str, max_retries=3) -> Optional[Dict]:
        """
        Fetch comprehensive company data from Alpha Vantage with retry logic.
        Returns all data needed for DCF valuation.

        Args:
            ticker: Stock ticker symbol (e.g., 'AAPL', 'MSFT')
            max_retries: Number of retry attempts for rate-limited requests

        Returns:
            Dictionary with complete financial data, or None if ticker not found
        """
        # Check cache first (critical with 25 API calls/day limit!)
        if ticker in DataIntegrator._company_data_cache:
            cached_data, cached_time = DataIntegrator._company_data_cache[ticker]
            elapsed = (datetime.now() - cached_time).total_seconds()
            if elapsed < DataIntegrator._company_cache_duration:
                logger.info(f"✅ Using cached data for {ticker} (cached {int(elapsed)}s ago)")
                return cached_data
        
        # Check circuit breaker
        if self._check_circuit_breaker():
            logger.error(f"Cannot fetch {ticker} - circuit breaker active")
            return None
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Fetching data for ticker: {ticker} from Alpha Vantage (attempt {attempt + 1}/{max_retries})")
                
                # Add delay to respect rate limits (except first attempt)
                if attempt > 0:
                    wait_time = (2 ** attempt) * self._get_delay_with_jitter()
                    logger.info(f"Waiting {wait_time:.1f}s before retry...")
                    time.sleep(wait_time)

                # API Call 1: Company Overview
                logger.debug(f"Fetching overview for {ticker}...")
                overview, meta = self.fd.get_company_overview(symbol=ticker)
                
                # Verify ticker is valid
                if overview.empty or 'Symbol' not in overview.columns:
                    logger.error(f"Invalid ticker: {ticker}")
                    return None
                
                overview_data = overview.iloc[0]
                time.sleep(self._get_delay_with_jitter())  # 12s delay between calls
                
                # API Call 2: Income Statement
                logger.debug(f"Fetching income statement for {ticker}...")
                income_annual, meta = self.fd.get_income_statement_annual(symbol=ticker)
                time.sleep(self._get_delay_with_jitter())
                
                # API Call 3: Balance Sheet
                logger.debug(f"Fetching balance sheet for {ticker}...")
                balance_annual, meta = self.fd.get_balance_sheet_annual(symbol=ticker)
                time.sleep(self._get_delay_with_jitter())
                
                # API Call 4: Cash Flow Statement
                logger.debug(f"Fetching cash flow for {ticker}...")
                cashflow_annual, meta = self.fd.get_cash_flow_annual(symbol=ticker)
                time.sleep(self._get_delay_with_jitter())
                
                # API Call 5: Historical Prices for Beta (using free tier endpoint)
                logger.debug(f"Fetching historical prices for {ticker}...")
                # Use get_daily instead of get_daily_adjusted (free tier)
                # outputsize='compact' gives ~100 days (free), 'full' requires premium for adjusted data
                hist, meta = self.ts.get_daily(symbol=ticker, outputsize='compact')
                # We'll use what we can get (~100 days for free tier)

                # Extract key data from overview
                data = {
                    'ticker': ticker.upper(),
                    'name': overview_data.get('Name', ticker.upper()),
                    'sector': overview_data.get('Sector', 'Unknown'),
                    'industry': overview_data.get('Industry', 'Unknown'),
                    'current_price': self._safe_float(overview_data.get('50DayMovingAverage', 0)),
                    'market_cap': self._safe_float(overview_data.get('MarketCapitalization', 0)),
                }

                # Extract financials (most recent year)
                if not income_annual.empty:
                    latest_income = income_annual.iloc[0]

                    data['revenue'] = self._safe_float(latest_income.get('totalRevenue', 0))
                    data['ebitda'] = self._safe_float(latest_income.get('ebitda', 0))

                    # Calculate net income / profit margin
                    net_income = self._safe_float(latest_income.get('netIncome', 0))
                    data['profit_margin'] = net_income / data['revenue'] if data['revenue'] > 0 else 0.10

                else:
                    logger.warning(f"No income statement found for {ticker}")
                    data['revenue'] = self._safe_float(overview_data.get('RevenueTTM', 0))
                    data['ebitda'] = self._safe_float(overview_data.get('EBITDA', 0))
                    data['profit_margin'] = 0.10

                # Balance sheet items
                if not balance_annual.empty:
                    latest_bs = balance_annual.iloc[0]
                    # Alpha Vantage uses different field names
                    debt = self._safe_float(latest_bs.get('longTermDebt', 0))
                    if debt == 0:
                        debt = self._safe_float(latest_bs.get('shortLongTermDebtTotal', 0))
                    data['debt'] = debt
                    data['cash'] = self._safe_float(latest_bs.get('cashAndCashEquivalentsAtCarryingValue', 0))
                else:
                    data['debt'] = 0
                    data['cash'] = 0

                # Cash flow items
                if not cashflow_annual.empty:
                    latest_cf = cashflow_annual.iloc[0]

                    data['depreciation'] = abs(self._safe_float(latest_cf.get('depreciationDepletionAndAmortization', 0)))
                    capex = abs(self._safe_float(latest_cf.get('capitalExpenditures', 0)))
                    data['capex_pct'] = capex / data['revenue'] if data['revenue'] > 0 else 0.05
                    
                    # Working capital change (sum of operating assets and liabilities changes)
                    wc_assets = self._safe_float(latest_cf.get('changeInOperatingAssets', 0))
                    wc_liab = self._safe_float(latest_cf.get('changeInOperatingLiabilities', 0))
                    data['working_capital_change'] = wc_assets + wc_liab
                else:
                    data['depreciation'] = data['ebitda'] * 0.05 if data['ebitda'] > 0 else 0
                    data['capex_pct'] = 0.05
                    data['working_capital_change'] = 0

                # Shares outstanding
                data['shares_outstanding'] = self._safe_float(overview_data.get('SharesOutstanding', 1_000_000))

                # Growth rates from historical data
                growth_estimates = self._get_growth_estimates_av(overview_data, income_annual)
                data['growth_rate_y1'] = growth_estimates['y1']
                data['growth_rate_y2'] = growth_estimates['y2']
                data['growth_rate_y3'] = growth_estimates['y3']
                data['terminal_growth'] = growth_estimates['terminal']

                # Tax rate
                data['tax_rate'] = self._estimate_tax_rate_av(income_annual)

                # Risk parameters
                data['beta'] = self._calculate_beta_av(hist, ticker)
                data['risk_free_rate'] = self.risk_free_rate
                data['market_risk_premium'] = self.market_risk_premium
                data['country_risk_premium'] = 0.0  # US = 0, adjust for international
                data['size_premium'] = self._estimate_size_premium(data['market_cap'])

                # Comparable company multiples
                comp_multiples = self._get_comparable_multiples_av(overview_data, data)
                data['comparable_ev_ebitda'] = comp_multiples['ev_ebitda']
                data['comparable_pe'] = comp_multiples['pe']
                data['comparable_peg'] = comp_multiples['peg']

                # Additional metadata
                data['data_source'] = 'Alpha Vantage'
                data['last_updated'] = datetime.now().isoformat()
                
                # Cache the successfully fetched data
                DataIntegrator._company_data_cache[ticker] = (data, datetime.now())
                logger.info(f"✅ Successfully cached data for {ticker}")
                
                # Reset circuit breaker on success
                self._reset_circuit_breaker()
                
                # Successfully fetched data, return it
                return data
                
            except Exception as e:
                error_msg = str(e)
                # Check if it's a rate limiting error (429)
                if '429' in error_msg or 'Too Many Requests' in error_msg or 'limit' in error_msg.lower():
                    logger.error(f"⚠️ Rate limit error for {ticker}")
                    self._trigger_circuit_breaker()
                    
                    if attempt < max_retries - 1:
                        wait_time = (2 ** (attempt + 1)) * self._get_delay_with_jitter()
                        logger.warning(f"Retrying in {wait_time:.1f}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"🚨 Rate limit exceeded for {ticker} after {max_retries} attempts")
                        return None
                else:
                    # Other errors, log and potentially retry
                    logger.error(f"Error fetching data for {ticker}: {error_msg}", exc_info=True)
                    if attempt < max_retries - 1:
                        wait_time = self._get_delay_with_jitter()
                        logger.info(f"Retrying in {wait_time:.1f}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        return None
        
        # If we exhausted all retries
        return None
    
    def _safe_float(self, value, default=0.0) -> float:
        """Safely convert value to float"""
        try:
            if value is None or value == 'None' or value == '':
                return default
            return float(value)
        except (ValueError, TypeError):
            return default

    def _get_growth_estimates_av(self, overview: pd.Series, income_annual: pd.DataFrame) -> Dict[str, float]:
        """
        Estimate revenue growth rates with aggressive normalization for high-growth companies.
        Applies S-curve fade-out so extreme growth rates (40%+) don't create inflated valuations.
        """
        try:
            # Try to get quarterly growth from overview
            quarterly_growth = self._safe_float(overview.get('QuarterlyRevenueGrowthYOY'))
            if quarterly_growth and quarterly_growth > 0:
                y1_growth = min(quarterly_growth, 0.50)  # Cap at 50%
            else:
                # Calculate historical growth from income statements
                if not income_annual.empty and len(income_annual) >= 2:
                    recent_revenue = self._safe_float(income_annual.iloc[0].get('totalRevenue', 0))
                    prior_revenue = self._safe_float(income_annual.iloc[1].get('totalRevenue', 1))
                    y1_growth = (recent_revenue / prior_revenue - 1) if prior_revenue > 0 else 0.10
                else:
                    y1_growth = 0.10  # Default 10%

            y1_growth = max(0, min(y1_growth, 0.50))  # Between 0% and 50%
            
            # *** KEY FIX: Aggressive fade-out for high-growth companies ***
            # High growth rates are unsustainable - apply market saturation curve
            if y1_growth >= 0.40:
                # Tech/AI companies (e.g., NVIDIA 50%) - steep decline
                y2_growth = y1_growth * 0.60  # Drop to 30% (from 50%)
                y3_growth = y1_growth * 0.30  # Drop to 15% (from 50%)
            elif y1_growth >= 0.25:
                # Fast-growth (25-40%) - moderate decline
                y2_growth = y1_growth * 0.70
                y3_growth = y1_growth * 0.50
            else:
                # Stable growth <25% - gentle decline
                y2_growth = y1_growth * 0.85
                y3_growth = y1_growth * 0.70
            
            terminal_growth = 0.025  # GDP growth rate

            return {
                'y1': y1_growth,
                'y2': y2_growth,
                'y3': y3_growth,
                'terminal': terminal_growth
            }
        except Exception as e:
            logger.warning(f"Could not estimate growth rates: {e}")
            return {'y1': 0.10, 'y2': 0.08, 'y3': 0.06, 'terminal': 0.025}

    def _estimate_tax_rate_av(self, income_annual: pd.DataFrame) -> float:
        """Calculate effective tax rate from Alpha Vantage income statement"""
        try:
            if not income_annual.empty:
                latest = income_annual.iloc[0]
                pretax_income = self._safe_float(latest.get('incomeBeforeTax', 0))
                tax_provision = self._safe_float(latest.get('incomeTaxExpense', 0))

                if pretax_income > 0:
                    effective_rate = tax_provision / pretax_income
                    return max(0, min(effective_rate, 0.35))  # Between 0% and 35%

            # Fallback to standard corporate rate
            return 0.21  # US federal corporate tax rate
        except:
            return 0.21

    def _calculate_beta_av(self, hist: pd.DataFrame, ticker: str) -> float:
        """
        Calculate beta using available historical data from Alpha Vantage.
        Note: Free tier provides ~100 days of data, so beta will be less accurate than 5-year calculation.
        """
        try:
            if hist.empty or len(hist) < 20:  # Need at least 20 days
                logger.warning(f"Insufficient price history for beta calculation (need 20+ days)")
                return 1.0

            # Get S&P 500 returns from Alpha Vantage (free tier)
            spy_hist, meta = self.ts.get_daily(symbol='SPY', outputsize='compact')

            # Alpha Vantage returns columns with '4. close' for non-adjusted data
            stock_col = '4. close'
            
            # Align dates
            merged = pd.merge(
                hist[[stock_col]].rename(columns={stock_col: 'stock'}),
                spy_hist[[stock_col]].rename(columns={stock_col: 'spy'}),
                left_index=True,
                right_index=True,
                how='inner'
            )

            # Calculate returns
            merged['stock_ret'] = merged['stock'].pct_change()
            merged['spy_ret'] = merged['spy'].pct_change()
            merged = merged.dropna()
            
            if len(merged) < 20:
                logger.warning(f"Insufficient overlapping data for beta calculation")
                return 1.0

            # Calculate beta (covariance / variance)
            covariance = merged['stock_ret'].cov(merged['spy_ret'])
            variance = merged['spy_ret'].var()
            beta = covariance / variance if variance > 0 else 1.0

            # Reasonable bounds
            beta = max(-2.0, min(beta, 5.0))

            logger.info(f"Calculated beta for {ticker}: {beta:.2f} (using {len(merged)} days of data)")
            return beta

        except Exception as e:
            logger.warning(f"Could not calculate beta: {e}")
            return 1.0  # Market beta as default

    def _estimate_size_premium(self, market_cap: float) -> float:
        """
        Estimate size premium based on market capitalization.
        Smaller companies have higher cost of equity.
        """
        if market_cap < 1e9:  # < $1B
            return 0.03
        elif market_cap < 5e9:  # < $5B
            return 0.02
        elif market_cap < 25e9:  # < $25B
            return 0.01
        else:  # Large cap
            return 0.0

    def _get_comparable_multiples_av(self, overview: pd.Series, data: dict) -> Dict[str, float]:
        """
        Extract or estimate comparable company multiples from Alpha Vantage data.
        """
        try:
            # Try to get from overview
            trailing_pe = self._safe_float(overview.get('TrailingPE', 20.0))
            forward_pe = self._safe_float(overview.get('ForwardPE', 18.0))
            peg_ratio = self._safe_float(overview.get('PEGRatio', 1.5))

            # Calculate EV/EBITDA
            enterprise_value = data['market_cap'] + data['debt'] - data['cash']
            ev_ebitda = enterprise_value / data['ebitda'] if data['ebitda'] > 0 else 12.0

            # Use sector averages as bounds
            sector_multiples = self._get_sector_multiples(data['sector'])

            return {
                'ev_ebitda': min(max(ev_ebitda, sector_multiples['ev_ebitda'] * 0.5), sector_multiples['ev_ebitda'] * 1.5),
                'pe': min(max(trailing_pe, sector_multiples['pe'] * 0.5), sector_multiples['pe'] * 1.5),
                'peg': max(0.5, min(peg_ratio, 3.0))
            }
        except:
            return {'ev_ebitda': 12.0, 'pe': 20.0, 'peg': 1.5}

    def _get_sector_multiples(self, sector: str) -> Dict[str, float]:
        """
        Industry-average multiples for different sectors.
        Based on typical market valuations.
        """
        sector_data = {
            'Technology': {'ev_ebitda': 15.0, 'pe': 25.0},
            'Healthcare': {'ev_ebitda': 14.0, 'pe': 22.0},
            'Financial Services': {'ev_ebitda': 10.0, 'pe': 15.0},
            'Consumer Cyclical': {'ev_ebitda': 10.0, 'pe': 18.0},
            'Consumer Defensive': {'ev_ebitda': 11.0, 'pe': 20.0},
            'Industrials': {'ev_ebitda': 10.0, 'pe': 18.0},
            'Energy': {'ev_ebitda': 8.0, 'pe': 12.0},
            'Utilities': {'ev_ebitda': 9.0, 'pe': 16.0},
            'Real Estate': {'ev_ebitda': 12.0, 'pe': 25.0},
            'Communication Services': {'ev_ebitda': 12.0, 'pe': 20.0},
        }

        return sector_data.get(sector, {'ev_ebitda': 12.0, 'pe': 20.0})

    def get_peer_companies(self, ticker: str, limit: int = 10) -> List[Dict]:
        """
        Auto-select peer companies based on sector and market cap.

        Args:
            ticker: Primary company ticker
            limit: Number of peers to return

        Returns:
            List of peer company data dictionaries
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info

            sector = info.get('sector', '')
            industry = info.get('industry', '')
            market_cap = info.get('marketCap', 0)

            # This is a simplified version - in production, you'd query a database
            # of all stocks filtered by sector/industry/market cap

            logger.info(f"Found peers for {ticker} in {sector} sector")

            # For now, return empty list (implement comprehensive peer search later)
            return []

        except Exception as e:
            logger.error(f"Error finding peers for {ticker}: {e}")
            return []

    def get_real_time_price(self, ticker: str) -> Optional[float]:
        """Get current real-time stock price"""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            return info.get('currentPrice', info.get('regularMarketPrice'))
        except:
            return None

    def validate_ticker(self, ticker: str) -> bool:
        """Check if ticker is valid"""
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            return 'symbol' in info and info.get('regularMarketPrice') is not None
        except:
            return False


# Convenience function for API endpoint
def fetch_company_by_ticker(ticker: str) -> Optional[Dict]:
    """
    Quick function to fetch company data by ticker.
    Used by API endpoints.
    """
    integrator = DataIntegrator()
    return integrator.get_company_data(ticker)


if __name__ == "__main__":
    # Test the data integrator
    logging.basicConfig(level=logging.INFO)

    print("=" * 80)
    print("INSTITUTIONAL DATA INTEGRATOR - TEST")
    print("=" * 80)

    ticker = input("\nEnter ticker symbol (e.g., AAPL, MSFT, GOOGL): ").strip().upper()

    integrator = DataIntegrator()
    data = integrator.get_company_data(ticker)

    if data:
        print(f"\n✓ Successfully fetched data for {data['name']}")
        print(f"\n{'=' * 80}")
        print("COMPANY OVERVIEW")
        print(f"{'=' * 80}")
        print(f"Name:           {data['name']}")
        print(f"Ticker:         {data['ticker']}")
        print(f"Sector:         {data['sector']}")
        print(f"Industry:       {data['industry']}")
        print(f"Current Price:  ${data['current_price']:,.2f}")
        print(f"Market Cap:     ${data['market_cap']:,.0f}")

        print(f"\n{'=' * 80}")
        print("FINANCIALS (Most Recent Year)")
        print(f"{'=' * 80}")
        print(f"Revenue:        ${data['revenue']:,.0f}")
        print(f"EBITDA:         ${data['ebitda']:,.0f}")
        print(f"Depreciation:   ${data['depreciation']:,.0f}")
        print(f"Debt:           ${data['debt']:,.0f}")
        print(f"Cash:           ${data['cash']:,.0f}")
        print(f"Shares Out:     {data['shares_outstanding']:,.0f}")

        print(f"\n{'=' * 80}")
        print("ASSUMPTIONS")
        print(f"{'=' * 80}")
        print(f"Growth Y1:      {data['growth_rate_y1']*100:.1f}%")
        print(f"Growth Y2:      {data['growth_rate_y2']*100:.1f}%")
        print(f"Growth Y3:      {data['growth_rate_y3']*100:.1f}%")
        print(f"Terminal:       {data['terminal_growth']*100:.1f}%")
        print(f"Tax Rate:       {data['tax_rate']*100:.1f}%")
        print(f"Beta:           {data['beta']:.2f}")
        print(f"Risk-Free:      {data['risk_free_rate']*100:.2f}%")

        print(f"\n{'=' * 80}")
        print("COMPARABLE MULTIPLES")
        print(f"{'=' * 80}")
        print(f"EV/EBITDA:      {data['comparable_ev_ebitda']:.1f}x")
        print(f"P/E:            {data['comparable_pe']:.1f}x")
        print(f"PEG:            {data['comparable_peg']:.2f}")

        print(f"\n✓ Data ready for valuation!")
    else:
        print(f"\n✗ Could not fetch data for {ticker}")

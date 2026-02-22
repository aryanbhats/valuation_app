"""
Test Alpha Vantage Integration
Quick test to verify Alpha Vantage API is working with our configuration
"""

from data_integrator import DataIntegrator
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_treasury_rate():
    """Test FRED Treasury rate fetching"""
    print("\n=== Testing FRED Treasury Rate ===")
    integrator = DataIntegrator()
    rate = integrator.risk_free_rate
    print(f"Risk-free rate: {rate*100:.2f}%")
    print(f"Source: {'FRED API' if rate != 0.045 else 'Default fallback'}")

def test_company_data():
    """Test Alpha Vantage company data fetching"""
    print("\n=== Testing Alpha Vantage Company Data ===")
    integrator = DataIntegrator()
    
    # Test with a well-known company
    ticker = "AAPL"
    print(f"\nFetching data for {ticker}...")
    
    data = integrator.get_company_data(ticker)
    
    if data:
        print(f"✅ Successfully fetched data for {ticker}")
        print(f"\nCompany: {data['name']}")
        print(f"Sector: {data['sector']}")
        print(f"Industry: {data['industry']}")
        print(f"Current Price: ${data['current_price']:,.2f}")
        print(f"Market Cap: ${data['market_cap']:,.0f}")
        print(f"Revenue: ${data['revenue']:,.0f}")
        print(f"EBITDA: ${data['ebitda']:,.0f}")
        print(f"Beta: {data['beta']:.2f}")
        print(f"Data Source: {data['data_source']}")
    else:
        print(f"❌ Failed to fetch data for {ticker}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("ALPHA VANTAGE INTEGRATION TEST")
    print("="*60)
    
    try:
        test_treasury_rate()
        test_company_data()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED")
        print("="*60)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

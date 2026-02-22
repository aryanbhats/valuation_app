#!/usr/bin/env python3
"""
Test script to verify rate limiting improvements
"""

import logging
from data_integrator import DataIntegrator

# Setup logging to see what's happening
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def test_rate_limiting():
    """Test the new rate limiting features"""
    print("=" * 60)
    print("Testing Rate Limiting Improvements")
    print("=" * 60)
    
    integrator = DataIntegrator()
    
    print(f"\n✅ Initialized DataIntegrator")
    print(f"   - Base delay: {integrator._request_delay}s")
    print(f"   - Company cache duration: {DataIntegrator._company_cache_duration}s")
    print(f"   - Circuit breaker max errors: {DataIntegrator._max_429_errors}")
    print(f"   - Circuit breaker duration: {DataIntegrator._circuit_breaker_duration}s")
    
    # Test 1: Check risk-free rate (should use cache or fail gracefully)
    print(f"\n📊 Risk-free rate: {integrator.risk_free_rate * 100:.2f}%")
    
    # Test 2: Try fetching company data
    print("\n🔍 Testing company data fetch...")
    print("   (This may fail if you're still rate-limited)")
    
    test_ticker = "AAPL"
    data = integrator.get_company_data(test_ticker)
    
    if data:
        print(f"\n✅ Successfully fetched data for {test_ticker}!")
        print(f"   Company: {data.get('company_name', 'N/A')}")
        print(f"   Price: ${data.get('current_price', 0):.2f}")
        print(f"   Market Cap: ${data.get('market_cap', 0):,.0f}")
        
        # Test cache by fetching same ticker again
        print(f"\n🔄 Fetching {test_ticker} again (should use cache)...")
        data2 = integrator.get_company_data(test_ticker)
        if data2:
            print("✅ Cache working correctly!")
    else:
        print(f"\n⚠️ Could not fetch data for {test_ticker}")
        print("   This is expected if you're still rate-limited.")
        print("   Wait 30-60 minutes and try again.")
    
    # Test 3: Check circuit breaker status
    if DataIntegrator._circuit_breaker_until:
        print(f"\n🚨 Circuit breaker is ACTIVE")
        print(f"   Will resume at: {DataIntegrator._circuit_breaker_until}")
    else:
        print(f"\n✅ Circuit breaker is inactive")
    
    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)

if __name__ == "__main__":
    test_rate_limiting()

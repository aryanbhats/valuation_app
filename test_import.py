#!/usr/bin/env python3
"""
Test script to verify DCF fixes by importing NVDA and AMZN
"""
import requests
import json
import time

BASE_URL = "http://localhost:5001/api"

print("\n" + "="*80)
print("TESTING DCF FIXES WITH FRESH IMPORTS")
print("="*80)

# Test 1: Import NVDA
print("\n▶ Importing NVDA...")
response = requests.post(f"{BASE_URL}/ticker/import-and-value", json={"ticker": "NVDA"})
if response.status_code == 200:
    data = response.json()
    nvda_fair_value = data.get('dcf_price_per_share', 0)
    nvda_upside = data.get('upside_downside', 0)
    print(f"  ✓ NVDA DCF Fair Value: ${nvda_fair_value:.2f}/share")
    print(f"  ✓ Upside/(Downside): {nvda_upside:.1%}")
    print(f"  ✓ Y1 Growth: {data.get('growth_rate_y1', 0):.1%}")
    print(f"  ✓ Y2 Growth: {data.get('growth_rate_y2', 0):.1%}")
    print(f"  ✓ Y3 Growth: {data.get('growth_rate_y3', 0):.1%}")
else:
    print(f"  ✗ Error: {response.status_code}")
    print(f"  Response: {response.text}")

time.sleep(2)

# Test 2: Import AMZN
print("\n▶ Importing AMZN...")
response = requests.post(f"{BASE_URL}/ticker/import-and-value", json={"ticker": "AMZN"})
if response.status_code == 200:
    data = response.json()
    amzn_fair_value = data.get('dcf_price_per_share', 0)
    amzn_upside = data.get('upside_downside', 0)
    print(f"  ✓ AMZN DCF Fair Value: ${amzn_fair_value:.2f}/share")
    print(f"  ✓ Upside/(Downside): {amzn_upside:.1%}")
    print(f"  ✓ Y1 Growth: {data.get('growth_rate_y1', 0):.1%}")
    print(f"  ✓ Y2 Growth: {data.get('growth_rate_y2', 0):.1%}")
    print(f"  ✓ Y3 Growth: {data.get('growth_rate_y3', 0):.1%}")
else:
    print(f"  ✗ Error: {response.status_code}")
    print(f"  Response: {response.text}")

print("\n" + "="*80)
print("VERIFICATION COMPLETE")
print("="*80)
print("\nExpected Results:")
print("  ✓ NVDA upside should be LOWER (was 66%, now ~20-35% with fixes)")
print("  ✓ AMZN upside should be REASONABLE (was -71%, now ~5-15% with fixes)")
print("  ✓ Growth rates should follow the new fade-out pattern")
print("="*80)

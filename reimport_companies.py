#!/usr/bin/env python3
"""
Re-import NVDA and AMZN with corrected DCF calculation logic
to verify the fixes normalize valuations properly.
"""

import os
import sys
from dotenv import load_dotenv

# Make sure we're in the right directory
os.chdir('/Users/aryanbhatia/Documents/0DevProjects/valuation_app')
sys.path.insert(0, '/Users/aryanbhatia/Documents/0DevProjects/valuation_app')

load_dotenv()

from app import db, Company
from data_integrator import DataIntegrator
from valuation_professional import enhanced_dcf_valuation
from flask import Flask

# Create Flask app context
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///valuations.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    integrator = DataIntegrator()
    
    print("\n" + "="*80)
    print("RE-IMPORTING COMPANIES WITH CORRECTED DCF LOGIC")
    print("="*80)
    
    for ticker in ['NVDA', 'AMZN']:
        print(f"\n▶ Importing {ticker}...")
        try:
            # Import company data
            result = integrator.get_company_data(ticker)
            
            if result:
                # Create or update company record
                company = Company.query.filter_by(symbol=ticker).first()
                if not company:
                    company = Company(
                        symbol=ticker,
                        name=result.get('name', ticker),
                        sector=result.get('sector', 'Unknown')
                    )
                    db.session.add(company)
                    db.session.flush()
                    print(f"  ✓ Created company record: {ticker}")
                
                # Run valuation with corrected logic
                valuation = enhanced_dcf_valuation(ticker, result, company)
                
                if valuation:
                    print(f"  ✓ DCF Fair Value: ${valuation.get('dcf_price_per_share', 0):.2f}/share")
                    print(f"  ✓ Comparable EV/EBITDA Value: ${valuation.get('comparable_ev_ebitda', 0):.2f}/share")
                    print(f"  ✓ Comparable P/E Value: ${valuation.get('comparable_pe', 0):.2f}/share")
                    print(f"  ✓ Upside/(Downside): {valuation.get('upside_downside', 0):.1%}")
                else:
                    print(f"  ✗ Valuation failed for {ticker}")
            else:
                print(f"  ✗ Could not fetch data for {ticker}")
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
    
    db.session.commit()
    print("\n" + "="*80)
    print("RE-IMPORT COMPLETE")
    print("="*80)

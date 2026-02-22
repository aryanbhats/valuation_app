# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Professional-grade company valuation web application implementing CFA-level DCF analysis, comparable company analysis, and Monte Carlo simulation. Supports both SQLite (development) and PostgreSQL (production) databases.

## Commands

### Development
```bash
# Install dependencies
pip3 install -r requirements.txt

# Run the web application (uses port 5001 to avoid macOS AirPlay conflict)
python3 app.py

# Import companies from CSV
python3 import_csv.py companies_enhanced.csv

# Run batch valuations for all companies
python3 run_valuations.py

# Run tests
pytest test_phase1.py
pytest test_validation.py
```

### Database
```bash
# Use PostgreSQL (production)
export DATABASE_TYPE=postgresql

# Use SQLite (development default)
export DATABASE_TYPE=sqlite
```

## Architecture

### Core Valuation Pipeline

```
Data Sources → DataIntegrator → ValuationService → ValuationEngine → Database
(Alpha Vantage,   (data_integrator.py)  (valuation_service.py)  (valuation_professional.py)
 FRED APIs)
```

**Key data flow:**
1. `DataIntegrator` fetches company financials from Alpha Vantage with rate limiting (12s delay, circuit breaker)
2. `ValuationService` orchestrates the valuation workflow (fetch → compute → save)
3. `enhanced_dcf_valuation()` in `valuation_professional.py` runs 10-year DCF with Monte Carlo
4. `ib_valuation_framework.py` classifies companies by archetype (HYPER_GROWTH, DISTRESSED, etc.) and applies IB-grade assumptions

### Flask Application Structure

**Main entry:** `app.py`
- Registers Phase 1 routes from `phase1_api_endpoints.py` (31 endpoints for scenarios, macros, audit)
- Supports dual database backends via `Config.DATABASE_TYPE`
- Auto-revaluation on company PUT endpoint

**Key endpoints:**
- `POST /api/ticker/import-and-value` - One-click import from ticker + valuation
- `POST /api/valuation/<id>` - Run DCF valuation
- `POST /api/company/<id>/scenario/apply` - Apply bear/base/bull scenarios

### Service Layer

| Service | Purpose |
|---------|---------|
| `valuation_service.py` | Single source of truth for valuation operations |
| `data_integrator.py` | Alpha Vantage/FRED API integration with caching |
| `realtime_price_service.py` | Daily price updates with rate limiting |
| `scenario_service.py` | Per-company scenario management |
| `audit_service.py` | Change tracking and audit trail |
| `macro_service.py` | Macroeconomic data integration |

### Configuration

All settings in `config.py`, overridable via environment variables:
- `ALPHA_VANTAGE_API_KEY` - Required for data fetching
- `FRED_API_KEY` - For Treasury rate lookups
- `DATABASE_TYPE` - `sqlite` or `postgresql`
- `API_REQUEST_DELAY` - Rate limiting (default 12s for Alpha Vantage)

### Validation

Pydantic models in `models.py` enforce business rules:
- Revenue must be positive
- EBITDA margin between -300% and 200%
- Growth rates: -50% to 200%
- Terminal growth must be lower than short-term growth
- Cost of equity must exceed terminal growth for valid DCF

## Database Schema

Three core tables: `companies`, `company_financials`, `valuation_results`

Phase 1 additions: `scenarios`, `scenario_assumptions`, `audit_trail`, `macro_indicators`

## API Rate Limiting

Alpha Vantage free tier: 5 calls/minute, 25 calls/day
- 12-second delay between requests
- Circuit breaker triggers after 3 consecutive 429 errors
- Company data cached for 6 hours
- Treasury rates cached for 24 hours

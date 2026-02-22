# Company Valuation Web Application

A professional-grade web application for performing CFA-level company valuations using DCF analysis, comparable company analysis, and advanced financial modeling.

## Features

- **Comprehensive Valuation Models**
  - 10-year DCF projections with multi-stage growth
  - WACC calculation using CAPM
  - Comparable company analysis (EV/EBITDA, P/E multiples)
  - Monte Carlo simulation for risk assessment
  - Altman Z-Score credit analysis

- **Interactive Dashboard**
  - Portfolio-level statistics
  - Investment recommendations (Buy/Hold/Sell)
  - Sector analysis and breakdown
  - Real-time valuation updates

- **Company Management**
  - Add, edit, and delete companies
  - Store detailed financial data
  - Track historical valuations
  - Export results to CSV

- **Professional Metrics**
  - ROE, ROIC, FCF Yield
  - EV/EBITDA, P/E, PEG ratios
  - Debt coverage ratios
  - Sensitivity analysis

## Setup

1. Clone the repo and install dependencies:
```bash
git clone https://github.com/aryanbhats/valuation_app.git
cd valuation_app
pip3 install -r requirements.txt
```

2. Copy the example environment file and add your API keys:
```bash
cp .env.example .env
```

3. Get free API keys:
   - **Alpha Vantage** (market data): https://www.alphavantage.co/support/#api-key
   - **FRED** (Treasury rates): https://fred.stlouisfed.org/docs/api/api_key.html

## Complete Workflow (End-to-End)

### Step 1: Import Companies from CSV
```bash
python3 import_csv.py companies_enhanced.csv
```

This will:
- Read your CSV file with company financial data
- Create/initialize the SQLite database (`valuations.db`)
- Import all companies and their financials

### Step 2: Run Batch Valuations
```bash
python3 run_valuations.py
```

This will:
- Run comprehensive valuations for all imported companies
- Calculate DCF, comparable multiples, risk metrics
- Save all results to the database
- Takes ~1-2 minutes for 6 companies

### Step 3: Start Web Application
```bash
python3 app.py
```

Open your browser and navigate to: **http://localhost:5000**

You'll see:
- Interactive dashboard with portfolio statistics
- All companies with their valuations
- Investment recommendations
- Beautiful UI with real-time updates

## Usage

### Adding a Company

1. Click "Add Company" button
2. Fill in company details:
   - Basic information (name, sector)
   - Financial data (revenue, EBITDA, etc.)
   - Growth rates (multi-stage projections)
   - Capital structure (shares, debt, cash)
   - Risk parameters (beta, cost of capital)
   - Comparable multiples

3. Click "Save Company"

### Running a Valuation

1. Navigate to the Companies page
2. Click "Value" button on any company card
3. View comprehensive valuation results including:
   - Investment recommendation
   - Fair value and target price
   - Multiple valuation methods
   - Key financial ratios
   - Monte Carlo simulation results

### Dashboard

View portfolio-level statistics:
- Total companies analyzed
- Average upside/downside
- Investment recommendations distribution
- Sector performance breakdown

### Export Results

Click "Export" in the navigation to download a CSV file with all valuation results.

## Database

The application uses SQLite for data persistence with three main tables:
- `companies` - Company basic information
- `company_financials` - Detailed financial data
- `valuation_results` - Historical valuation outputs

## Technology Stack

- **Backend**: Flask, Python 3
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Frontend**: HTML, CSS, JavaScript
- **Data Sources**: Alpha Vantage (financials, prices), FRED (Treasury rates)
- **Valuation Engine**: Custom Python — DCF, comps, Monte Carlo, Altman Z-Score

## File Structure

```
├── app.py                          # Flask web application & REST API
├── import_csv.py                   # Import companies from CSV to SQLite
├── run_valuations.py               # Batch valuation script
├── valuation_professional.py       # Core valuation engine
├── requirements.txt                # Python dependencies
├── companies_enhanced.csv          # Sample input data
├── valuations.db                   # SQLite database (auto-created)
├── templates/
│   └── index.html                  # Main HTML template
├── static/
│   ├── css/
│   │   └── styles.css             # Application styles
│   └── js/
│       └── app.js                 # Frontend JavaScript
└── archive/                        # Old/unused files
```

## API Endpoints

- `GET /api/companies` - List all companies
- `GET /api/company/<id>` - Get company details
- `POST /api/company` - Create new company
- `PUT /api/company/<id>` - Update company
- `DELETE /api/company/<id>` - Delete company
- `POST /api/valuation/<id>` - Run valuation
- `GET /api/dashboard/stats` - Get portfolio statistics
- `GET /api/export/csv` - Export results to CSV

## License

[MIT](LICENSE)

## Author

[Aryan Bhatia](https://linkedin.com/in/aryanbhats)

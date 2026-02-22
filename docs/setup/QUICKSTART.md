# 🚀 QUICK START GUIDE

## Complete End-to-End Workflow

### ✅ Step 1: Import Data
```bash
python3 import_csv.py companies_enhanced.csv
```
**What it does:**
- Creates SQLite database if it doesn't exist
- Imports all company financial data from CSV
- Stores companies and their financials in the database

**Output:** "✅ Successfully imported 6 companies!"

---

### ✅ Step 2: Run Valuations
```bash
python3 run_valuations.py
```
**What it does:**
- Runs comprehensive DCF analysis for each company
- Calculates WACC using CAPM
- Performs comparable company analysis
- Runs Monte Carlo simulations
- Calculates financial ratios and credit scores
- Saves all results to database

**Time:** ~1-2 minutes for 6 companies

**Output:** "✨ Valuations complete! View results at: http://localhost:5000"

---

### ✅ Step 3: Launch Web App
```bash
python3 app.py
```
**What it does:**
- Starts Flask web server
- Serves interactive dashboard
- Provides REST API endpoints

**Access:** Open browser to **http://localhost:5000**

---

## What You'll See in the Web App

### 📊 Dashboard
- Total companies analyzed
- Average upside/downside across portfolio
- Investment recommendation breakdown (Buy/Hold/Sell)
- Sector analysis with performance metrics
- Average P/E and ROE

### 🏢 Companies View
- All imported companies in card format
- Current valuation status
- Recommendation badges (color-coded)
- Quick actions: Revalue, Edit, Delete

### 📈 Valuation Results (Click on any company)
- **Investment Recommendation** with upside %
- **Fair Value** calculations
- **Multiple valuation methods** (DCF, EV/EBITDA, P/E)
- **Key metrics** (WACC, ROE, ROIC, Z-Score)
- **Monte Carlo** risk analysis

### 💾 Export
- Download all results as CSV
- Includes all companies and their valuations

---

## File Workflow

```
CSV File (companies_enhanced.csv)
    ↓
import_csv.py → SQLite Database (valuations.db)
    ↓
run_valuations.py → Calculates valuations → Saves to database
    ↓
app.py → Flask Web App → Beautiful UI at localhost:5000
```

---

## Database Tables

1. **companies** - Basic info (id, name, sector)
2. **company_financials** - All financial inputs
3. **valuation_results** - All calculated outputs

---

## Tips

- **Adding new companies:** Use the "+ Add Company" button in the web UI
- **Updating data:** Edit companies directly in the web interface
- **Re-running valuations:** Click "Revalue" button on any company
- **Clearing database:** Run `python3 import_csv.py` and answer 'y' when prompted
- **Viewing database:** Use any SQLite browser or `sqlite3 valuations.db`

---

## Current Data Status

✅ **6 companies imported:**
1. TechStartup Inc (Software)
2. GreenEnergy Corp (Utilities)
3. RetailCo (Retail)
4. FinTech Solutions (Financial Tech)
5. Manufacturing Ltd (Industrial)
6. BioTech Innovations (Biotechnology)

✅ **All valuations completed**

✅ **Web app running at http://localhost:5000**

---

## Troubleshooting

**Problem:** Database is empty
**Solution:** Run `python3 import_csv.py companies_enhanced.csv`

**Problem:** No valuations showing
**Solution:** Run `python3 run_valuations.py`

**Problem:** Port 5000 already in use
**Solution:** Edit `app.py` and change `port=5000` to another port

**Problem:** Missing Flask
**Solution:** Run `pip3 install flask`

---

## Next Steps

1. ✅ Import your own companies via CSV
2. ✅ Run valuations automatically
3. ✅ View results in beautiful web interface
4. 📊 Export results to CSV for reports
5. 🔄 Update company data and revalue as needed

**Everything is working end-to-end!** 🎉

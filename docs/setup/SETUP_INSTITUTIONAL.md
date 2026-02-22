# Institutional-Grade Valuation Platform - Setup Guide

## Phase 0: Foundation Setup

This guide will transform your valuation app from a basic Flask/SQLite app into a Goldman Sachs-grade institutional platform.

---

## Prerequisites Installation

### 1. Install PostgreSQL

**macOS (via Homebrew):**
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version  # Should show PostgreSQL 15.x

# Create database
createdb valuations_institutional
```

**Alternative: Using Postgres.app**
- Download from https://postgresapp.com/
- Double-click to install
- Click "Initialize" to create default database

---

### 2. Install Redis (for task queue & caching)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping  # Should return PONG
```

---

### 3. Install Python Dependencies

```bash
cd /Users/subhankarshukla/Desktop/"aryan proj"/valuation_app

# Install all required packages
pip3 install -r requirements.txt

# Verify key installations
python3 -c "import psycopg2; print('PostgreSQL driver: OK')"
python3 -c "import flask_login; print('Flask-Login: OK')"
python3 -c "import celery; print('Celery: OK')"
python3 -c "import fredapi; print('FRED API: OK')"
```

---

## Database Migration: SQLite → PostgreSQL

### Step 1: Export Current SQLite Data

```bash
# Navigate to app directory
cd /Users/subhankarshukla/Desktop/"aryan proj"/valuation_app

# Create backup
cp valuations.db valuations_backup_$(date +%Y%m%d).db

# Export to SQL dump
sqlite3 valuations.db .dump > sqlite_dump.sql
```

### Step 2: Convert to PostgreSQL Format

```bash
# Install pgloader (SQLite → PostgreSQL migration tool)
brew install pgloader

# Run migration
pgloader valuations.db postgresql://localhost/valuations_institutional
```

**If pgloader fails, use manual Python migration script (see below)**

### Step 3: Verify Migration

```bash
# Connect to PostgreSQL
psql valuations_institutional

# Check tables
\dt

# Should see:
# - companies
# - company_financials
# - valuation_results

# Count records
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM company_financials;
SELECT COUNT(*) FROM valuation_results;

# Exit
\q
```

---

## Configuration Files

### 1. Create `.env` file for secrets

```bash
cat > .env <<'EOF'
# Database Configuration
DATABASE_URL=postgresql://localhost/valuations_institutional

# Flask Configuration
FLASK_SECRET_KEY=your-super-secret-key-change-this-in-production
FLASK_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# FRED API Key (get from https://fred.stlouisfed.org/docs/api/api_key.html)
FRED_API_KEY=your_fred_api_key_here

# Email Configuration (for approval workflow notifications)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@example.com
MAIL_PASSWORD=your_app_password

# Security
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax
EOF
```

### 2. Update `.gitignore`

```bash
cat >> .gitignore <<'EOF'
# Environment
.env
.env.local

# Database
*.db
*.db-journal
postgresql_data/

# Python
__pycache__/
*.pyc
*.pyo
venv/
.pytest_cache/

# Logs
logs/
*.log

# IDE
.vscode/
.idea/
*.swp

# Backups
*_backup_*.db
sqlite_dump.sql

# Reports
reports/generated/*.pdf
EOF
```

---

## Starting the Enhanced Platform

### 1. Run Database Migrations

```bash
# Create institutional schema (scenarios, macro_assumptions, etc.)
python3 manage.py migrate

# Backfill: Create "Base Case" scenario for existing companies
python3 manage.py backfill_scenarios
```

### 2. Start Redis & Celery Workers

```bash
# Terminal 1: Start Redis (if not using brew services)
redis-server

# Terminal 2: Start Celery worker for async batch revaluation
celery -A celery_app worker --loglevel=info --concurrency=8

# Terminal 3: Start Celery beat for scheduled tasks (macro data updates)
celery -A celery_app beat --loglevel=info
```

### 3. Start Flask App

```bash
# Terminal 4: Start Flask app
python3 app.py

# Or with Gunicorn (production)
gunicorn -w 4 -b 127.0.0.1:5001 app:app
```

### 4. Access the Platform

Open browser: http://127.0.0.1:5001

**Default Admin Login:**
- Username: `admin`
- Password: `change_me_immediately`

---

## Feature Overview

### Phase 0 (Foundation) - NOW AVAILABLE
- ✅ PostgreSQL multi-user database
- ✅ User authentication & RBAC (Analyst, Senior Analyst, Admin)
- ✅ Optimistic locking (prevents concurrent edit conflicts)
- ✅ Security hardening (HTTPS, rate limiting, CSRF protection)
- ✅ Structured logging

### Phase 1 (Scenario Management) - COMING SOON
- Scenario system (Bear/Base/Bull cases)
- Custom assumptions per scenario
- Scenario comparison UI
- API v2 endpoints

### Phase 2 (Advanced Features) - COMING SOON
- FRED macro data integration
- Configurable DCF models (3/5/10 stage growth)
- Enhanced sensitivity analysis
- Peer benchmarking

### Phase 3 (Institutional Capabilities) - COMING SOON
- Batch portfolio revaluation
- PDF Investment Committee memos
- Approval workflow for assumption changes
- Temporal versioning (time-travel queries)
- Regulatory compliance (audit trails, immutable valuations)

### Phase 4 (Production) - COMING SOON
- Prometheus + Grafana monitoring
- Automated backups to S3
- High availability setup
- Load testing & optimization

---

## Quick Start Command Summary

```bash
# 1. Install dependencies
brew install postgresql@15 redis
pip3 install -r requirements.txt

# 2. Setup databases
brew services start postgresql@15 redis
createdb valuations_institutional

# 3. Migrate data
pgloader valuations.db postgresql://localhost/valuations_institutional

# 4. Configure
cp .env.example .env
# Edit .env with your settings

# 5. Run migrations
python3 manage.py migrate
python3 manage.py backfill_scenarios

# 6. Start services (4 separate terminals)
redis-server                                      # Terminal 1
celery -A celery_app worker --concurrency=8       # Terminal 2
celery -A celery_app beat                         # Terminal 3
python3 app.py                                    # Terminal 4

# 7. Access platform
open http://127.0.0.1:5001
```

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@15

# Check logs
tail -f /opt/homebrew/var/log/postgresql@15.log
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping  # Should return PONG

# Restart Redis
brew services restart redis
```

### Migration Issues

If pgloader fails, use the Python migration script:

```bash
python3 migrate_sqlite_to_postgres.py
```

### Permission Issues

```bash
# Grant permissions on PostgreSQL database
psql valuations_institutional -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $USER;"
```

---

## Performance Testing

### Test Batch Revaluation Speed

```bash
# Add 100 test companies
python3 scripts/seed_test_data.py --count=100

# Run batch revaluation across 3 scenarios (300 valuations)
time python3 -c "
from scenario_manager import ScenarioManager
sm = ScenarioManager()
sm.batch_revalue_portfolio([1, 2, 3])  # Bear, Base, Bull
"

# Target: <30 minutes for 100 companies × 3 scenarios
```

---

## Next Steps

1. Review this setup guide
2. Install PostgreSQL and Redis
3. Run the migration
4. Test the enhanced platform
5. Let me know if you hit any issues!

After Phase 0 is working, we'll proceed with:
- **Phase 1**: Scenario management system
- **Phase 2**: Macro framework & advanced DCF
- **Phase 3**: PDF reports & compliance features
- **Phase 4**: Production hardening

---

## Support

If you encounter issues:
1. Check logs in `logs/app.log`
2. Verify all services are running: PostgreSQL, Redis, Celery
3. Check database connectivity: `psql valuations_institutional`
4. Review error messages in Flask console

**Timeline:** 17-22 weeks for full institutional-grade platform

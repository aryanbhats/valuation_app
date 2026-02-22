# Phase 0: Foundation Setup Guide

**Goal:** Transform from single-user SQLite to multi-user PostgreSQL with authentication and security.

---

## Step 1: Install PostgreSQL (Required)

```bash
# Install PostgreSQL via Homebrew
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Verify installation
psql --version  # Should show: psql (PostgreSQL) 15.x

# Check if service is running
brew services list | grep postgresql
```

**Expected output:** `postgresql@15 started`

---

## Step 2: Create Database

```bash
# Create the institutional database
createdb valuations_institutional

# Verify it was created
psql -l | grep valuations_institutional
```

---

## Step 3: Install Required Python Packages

```bash
cd "/Users/subhankarshukla/Desktop/aryan proj/valuation_app"

# Install Phase 0 packages
pip3 install psycopg2-binary flask-login flask-wtf
```

---

## Step 4: Run Migration Script

I'll create a Python script that will:
1. Export all data from SQLite
2. Import into PostgreSQL
3. Update app.py to use PostgreSQL
4. Add authentication tables
5. Add logging framework

```bash
# Run the migration (I'll create this next)
python3 migrate_to_postgres.py
```

---

## Quick Command Summary

```bash
# Run these commands in order:
brew install postgresql@15
brew services start postgresql@15
createdb valuations_institutional
cd "/Users/subhankarshukla/Desktop/aryan proj/valuation_app"
pip3 install psycopg2-binary flask-login flask-wtf
python3 migrate_to_postgres.py
```

---

## After Setup

Once PostgreSQL is installed and running, I'll build:
- ✅ Database migration (SQLite → PostgreSQL)
- ✅ User authentication system
- ✅ Login/logout pages
- ✅ Optimistic locking
- ✅ Security hardening
- ✅ Logging framework

**Estimated time:** 30-45 minutes for full Phase 0

---

## Troubleshooting

### If PostgreSQL won't start:
```bash
brew services restart postgresql@15
tail -f /opt/homebrew/var/log/postgresql@15.log
```

### If createdb fails:
```bash
# Initialize database cluster if needed
initdb /opt/homebrew/var/postgresql@15
```

---

Let me know when PostgreSQL is installed and I'll continue with the migration!

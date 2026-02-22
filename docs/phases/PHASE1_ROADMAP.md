# Phase 1: Scenario Management & Macro Framework

## Overview

Phase 1 transforms the valuation app from a single-point-estimate tool into a **scenario-based institutional framework** with full audit trails and macro assumption management.

**Duration:** 3-4 weeks
**Status:** 🚀 Starting Implementation
**Prerequisites:** Phase 0 Complete ✅

---

## 🎯 Core Features

### 1. Scenario Management System
**Goal:** Support Bear/Base/Bull scenarios for each company

**Features:**
- Create multiple scenarios per company
- Each scenario has its own assumptions (growth rates, margins, risk parameters)
- Default scenarios: Bear (-25% from base), Base (current), Bull (+25% from base)
- Custom scenarios with user-defined names and multipliers
- Scenario comparison side-by-side

**Use Cases:**
- "What if revenue growth is 5% instead of 15%?"
- "Show me pessimistic case with 8% WACC instead of 6%"
- "Compare my three scenarios for Tesla"

---

### 2. Macro Assumptions Framework
**Goal:** Centralized macro variables that affect all valuations

**Macro Variables:**
- **Risk-Free Rate:** Currently from ^TNX, but allow manual override
- **Market Risk Premium:** Currently 6.5%, configurable
- **GDP Growth Rate:** Affects terminal growth assumptions
- **Inflation Rate:** Affects nominal growth rates
- **Credit Spread:** Default spreads by credit rating
- **Tax Rate:** Default corporate tax rate (21% US)
- **Industry Multiples:** Default P/E and EV/EBITDA by sector

**Three Macro Environments:**
1. **Bear Market:** High rates, low growth, wide spreads, low multiples
2. **Base Case:** Current market conditions
3. **Bull Market:** Low rates, high growth, tight spreads, high multiples

**Use Cases:**
- "Apply recession macro assumptions to entire portfolio"
- "What happens if Fed raises rates 2% across all companies?"
- "Show valuations under 2019 bull market conditions"

---

### 3. Assumption Audit Trail
**Goal:** Track every assumption change with full history

**Tracked Changes:**
- What changed (field name, old value, new value)
- Who changed it (user ID, username)
- When it changed (timestamp)
- Why it changed (optional comment)
- Rollback capability to prior assumptions

**Audit Trail Features:**
- View full history for a company
- Filter by user, date range, field type
- Compare assumptions across time
- Export audit log to CSV
- Alerts for material assumption changes (e.g., WACC change > 1%)

**Use Cases:**
- "Who changed Apple's growth rate last week?"
- "Show me all assumption changes in Q1 2024"
- "Revert Tesla to assumptions from December 1st"
- "Audit trail for compliance review"

---

### 4. Scenario Comparison UI
**Goal:** Visual side-by-side comparison of scenarios

**Comparison Views:**
1. **Table View:** 3-column comparison (Bear | Base | Bull)
2. **Chart View:** Bar charts for key metrics
3. **Tornado Diagram:** Sensitivity to each assumption
4. **Waterfall Chart:** Bridge from Bear → Base → Bull

**Compared Metrics:**
- Fair value per share
- Upside %
- Recommendation
- WACC
- Terminal value
- P/E, ROE, ROIC ratios

**Use Cases:**
- "Show me Apple valuation in all three scenarios"
- "Which assumption drives the most variance?"
- "Create pitch book with scenario comparison"

---

## 🗄️ Database Schema Changes

### New Tables

#### 1. `scenarios` Table
```sql
CREATE TABLE scenarios (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,  -- 'Bear', 'Base', 'Bull', 'Custom: Recession', etc.
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,  -- One default scenario per company
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_scenarios_company ON scenarios(company_id);
CREATE INDEX idx_scenarios_default ON scenarios(company_id, is_default);
```

#### 2. `scenario_assumptions` Table
```sql
CREATE TABLE scenario_assumptions (
    id SERIAL PRIMARY KEY,
    scenario_id INTEGER REFERENCES scenarios(id) ON DELETE CASCADE,

    -- Growth rates
    growth_rate_y1 REAL,
    growth_rate_y2 REAL,
    growth_rate_y3 REAL,
    terminal_growth REAL,

    -- Margins & efficiency
    profit_margin REAL,
    ebitda_margin REAL,
    capex_pct REAL,

    -- Risk parameters
    beta REAL,
    risk_free_rate REAL,
    market_risk_premium REAL,
    size_premium REAL,
    country_risk_premium REAL,

    -- Capital structure
    target_debt_ratio REAL,
    credit_spread REAL,
    tax_rate REAL,

    -- Comparable multiples
    comparable_ev_ebitda REAL,
    comparable_pe REAL,
    comparable_peg REAL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_scenario_assumptions_scenario ON scenario_assumptions(scenario_id);
```

#### 3. `macro_assumptions` Table
```sql
CREATE TABLE macro_assumptions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,  -- 'Bear Market', 'Base Case', 'Bull Market', 'Custom'
    description TEXT,

    -- Macro variables
    risk_free_rate REAL NOT NULL,
    market_risk_premium REAL NOT NULL,
    gdp_growth REAL NOT NULL,
    inflation_rate REAL NOT NULL,

    -- Credit spreads by rating
    credit_spread_aaa REAL,
    credit_spread_aa REAL,
    credit_spread_a REAL,
    credit_spread_bbb REAL,
    credit_spread_bb REAL,
    credit_spread_b REAL,

    -- Default tax rates
    corporate_tax_rate REAL,

    -- Market sentiment
    equity_risk_appetite REAL,  -- Multiplier for beta (0.8 = less risky, 1.2 = more risky)

    -- Metadata
    is_active BOOLEAN DEFAULT FALSE,  -- One active macro environment
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_macro_assumptions_active ON macro_assumptions(is_active);
```

#### 4. `sector_multiples` Table
```sql
CREATE TABLE sector_multiples (
    id SERIAL PRIMARY KEY,
    macro_assumption_id INTEGER REFERENCES macro_assumptions(id) ON DELETE CASCADE,
    sector VARCHAR(100) NOT NULL,

    -- Multiples
    ev_ebitda_avg REAL,
    ev_ebitda_median REAL,
    pe_avg REAL,
    pe_median REAL,
    peg_avg REAL,

    -- Metadata
    data_source VARCHAR(200),  -- 'Bloomberg', 'Capital IQ', 'Manual', etc.
    as_of_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sector_multiples_macro ON sector_multiples(macro_assumption_id);
CREATE INDEX idx_sector_multiples_sector ON sector_multiples(sector);
```

#### 5. `assumption_audit_log` Table
```sql
CREATE TABLE assumption_audit_log (
    id SERIAL PRIMARY KEY,

    -- What changed
    entity_type VARCHAR(50) NOT NULL,  -- 'company_financials', 'scenario_assumptions', 'macro_assumptions'
    entity_id INTEGER NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,

    -- Who changed it
    changed_by INTEGER REFERENCES users(id),
    user_role VARCHAR(50),

    -- When changed
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Why changed (optional)
    change_reason TEXT,
    change_type VARCHAR(50),  -- 'manual_edit', 'scenario_switch', 'macro_update', 'data_refresh'

    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Impact assessment
    is_material BOOLEAN DEFAULT FALSE,  -- Flag for material changes (e.g., WACC > 1%)

    CONSTRAINT chk_entity_type CHECK (entity_type IN ('company_financials', 'scenario_assumptions', 'macro_assumptions', 'sector_multiples'))
);

CREATE INDEX idx_audit_entity ON assumption_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON assumption_audit_log(changed_by);
CREATE INDEX idx_audit_date ON assumption_audit_log(changed_at);
CREATE INDEX idx_audit_material ON assumption_audit_log(is_material);
```

#### 6. Update `valuation_results` Table
```sql
-- Add scenario reference to existing valuation_results
ALTER TABLE valuation_results
ADD COLUMN scenario_id INTEGER REFERENCES scenarios(id) ON DELETE SET NULL;

CREATE INDEX idx_valuations_scenario ON valuation_results(scenario_id);
```

---

## 📁 New Files to Create

### Backend

#### 1. `scenario_service.py` (New)
**Purpose:** Core scenario management logic

**Functions:**
- `create_scenario(company_id, name, description, created_by)` → scenario_id
- `get_scenarios_for_company(company_id)` → List[Scenario]
- `get_default_scenario(company_id)` → Scenario
- `update_scenario_assumptions(scenario_id, assumptions, changed_by)` → Success
- `clone_scenario(scenario_id, new_name)` → new_scenario_id
- `delete_scenario(scenario_id)` → Success
- `set_default_scenario(company_id, scenario_id)` → Success
- `compare_scenarios(company_id, scenario_ids)` → Comparison dict

#### 2. `macro_service.py` (New)
**Purpose:** Macro assumption management

**Functions:**
- `create_macro_environment(name, assumptions, created_by)` → macro_id
- `get_all_macro_environments()` → List[MacroEnv]
- `get_active_macro_environment()` → MacroEnv
- `activate_macro_environment(macro_id)` → Success
- `update_macro_assumptions(macro_id, assumptions, changed_by)` → Success
- `apply_macro_to_company(company_id, macro_id)` → Updated assumptions
- `apply_macro_to_portfolio(macro_id)` → List[company_id]
- `get_sector_multiples(sector, macro_id)` → Multiples dict

#### 3. `audit_service.py` (New)
**Purpose:** Assumption audit trail

**Functions:**
- `log_assumption_change(entity_type, entity_id, field_name, old_value, new_value, changed_by, reason)` → audit_id
- `get_audit_trail(entity_type, entity_id, start_date, end_date)` → List[AuditEntry]
- `get_material_changes(start_date, end_date, threshold)` → List[MaterialChange]
- `get_user_changes(user_id, start_date, end_date)` → List[AuditEntry]
- `rollback_to_date(entity_type, entity_id, rollback_date)` → Success
- `export_audit_log(filters)` → CSV file
- `get_change_summary(company_id)` → Summary dict

#### 4. `scenario_generator.py` (New)
**Purpose:** Auto-generate Bear/Base/Bull scenarios

**Functions:**
- `generate_default_scenarios(company_id)` → List[scenario_id]
- `create_bear_scenario(base_assumptions, bear_multiplier=0.75)` → Assumptions
- `create_bull_scenario(base_assumptions, bull_multiplier=1.25)` → Assumptions
- `stress_test_scenario(base_assumptions, stress_params)` → Assumptions
- `sensitivity_scenarios(company_id, variable, range)` → List[Scenario]

### Frontend

#### 5. `templates/scenarios.html` (New)
**Purpose:** Scenario management UI

**Sections:**
- Scenario list (tabs: Bear | Base | Bull | Custom)
- Assumption editor (grouped by category)
- Quick toggle switches for common adjustments
- Clone scenario button
- Delete scenario button

#### 6. `templates/scenario_comparison.html` (New)
**Purpose:** Side-by-side scenario comparison

**Sections:**
- Scenario selector (multi-select dropdown)
- Comparison table (3-5 columns)
- Key metrics comparison
- Charts: Bar chart, tornado diagram, waterfall
- Export to PDF button

#### 7. `templates/macro_settings.html` (New)
**Purpose:** Macro assumption management

**Sections:**
- Macro environment selector (Bear | Base | Bull)
- Macro variable editor
- Sector multiples table
- Apply to portfolio button
- Active environment indicator

#### 8. `templates/audit_trail.html` (New)
**Purpose:** View assumption change history

**Sections:**
- Filter panel (user, date range, entity type, field)
- Audit log table (sortable, paginated)
- Change details modal
- Export to CSV button
- Rollback capability (admin only)

#### 9. `static/js/scenario_manager.js` (New)
**Purpose:** Frontend logic for scenario management

**Functions:**
- `loadScenarios(companyId)`
- `createScenario(companyId, name, description)`
- `updateAssumptions(scenarioId, assumptions)`
- `compareScenarios(scenarioIds)`
- `generateDefaultScenarios(companyId)`
- `renderComparisonTable(data)`
- `renderTornadoDiagram(sensitivity)`

#### 10. `static/js/macro_manager.js` (New)
**Purpose:** Macro environment management

**Functions:**
- `loadMacroEnvironments()`
- `activateMacroEnvironment(macroId)`
- `updateMacroAssumptions(macroId, assumptions)`
- `applyMacroToPortfolio(macroId)`
- `getSectorMultiples(sector, macroId)`

---

## 🔌 New API Endpoints

### Scenario Management

```
POST   /api/scenarios                          # Create scenario
GET    /api/scenarios/<company_id>             # Get all scenarios for company
GET    /api/scenario/<scenario_id>             # Get scenario details
PUT    /api/scenario/<scenario_id>             # Update scenario
DELETE /api/scenario/<scenario_id>             # Delete scenario
POST   /api/scenario/<scenario_id>/clone       # Clone scenario
POST   /api/scenario/<scenario_id>/set-default # Set as default
GET    /api/scenario/compare                   # Compare scenarios (query: ids=[1,2,3])
POST   /api/scenario/generate-defaults         # Auto-generate Bear/Base/Bull
```

### Macro Assumptions

```
GET    /api/macro-environments                 # List all macro environments
GET    /api/macro-environment/<macro_id>       # Get macro details
POST   /api/macro-environment                  # Create macro environment
PUT    /api/macro-environment/<macro_id>       # Update macro environment
POST   /api/macro-environment/<macro_id>/activate  # Set as active
POST   /api/macro-environment/<macro_id>/apply-to-portfolio  # Apply to all companies
GET    /api/sector-multiples/<sector>          # Get sector multiples for active macro
```

### Audit Trail

```
GET    /api/audit-trail/<entity_type>/<entity_id>  # Get audit log for entity
GET    /api/audit-trail/user/<user_id>             # Get all changes by user
GET    /api/audit-trail/material                   # Get material changes
POST   /api/audit-trail/rollback                   # Rollback to previous state
GET    /api/audit-trail/export                     # Export audit log to CSV
```

---

## 🎨 UI Mockups (Conceptual)

### Scenario Comparison View

```
┌─────────────────────────────────────────────────────────────┐
│ Company: Apple Inc. (AAPL)                                  │
│ Compare Scenarios: [Bear ▼] [Base ▼] [Bull ▼]              │
├─────────────────────────────────────────────────────────────┤
│                    │    Bear    │    Base    │    Bull      │
│────────────────────┼────────────┼────────────┼──────────────│
│ Fair Value/Share   │  $120.50   │  $160.00   │  $200.00     │
│ Current Price      │  $175.00   │  $175.00   │  $175.00     │
│ Upside %           │   -31.1%   │   -8.6%    │   +14.3%     │
│ Recommendation     │    SELL    │    HOLD    │    BUY       │
│────────────────────┼────────────┼────────────┼──────────────│
│ Growth Y1          │    8.0%    │   12.0%    │   15.0%      │
│ Terminal Growth    │    2.0%    │    2.5%    │    3.0%      │
│ WACC               │    9.5%    │    8.0%    │    6.5%      │
│ Tax Rate           │   25.0%    │   21.0%    │   18.0%      │
│────────────────────┼────────────┼────────────┼──────────────│
│ P/E Ratio          │   18.5×    │   24.0×    │   30.0×      │
│ ROE                │   35.2%    │   45.1%    │   55.8%      │
│ Z-Score            │    3.2     │    4.5     │    5.8       │
└─────────────────────────────────────────────────────────────┘

         [Bar Chart]  [Tornado Diagram]  [Export to PDF]
```

### Macro Settings Panel

```
┌─────────────────────────────────────────────────────────────┐
│ Active Macro Environment: Base Case ●                       │
│ [Switch to: Bear Market ▼] [Apply to Portfolio]            │
├─────────────────────────────────────────────────────────────┤
│ Risk-Free Rate:          4.50%  [─────●─────]  (0% - 8%)   │
│ Market Risk Premium:     6.50%  [─────●─────]  (4% - 10%)  │
│ GDP Growth:              2.50%  [─────●─────]  (0% - 5%)   │
│ Inflation:               3.00%  [─────●─────]  (0% - 8%)   │
│────────────────────────────────────────────────────────────│
│ Credit Spreads:                                             │
│   AAA:  0.50%    AA:  0.75%    A:  1.25%                   │
│   BBB:  2.00%    BB:  3.50%    B:  5.00%                   │
│────────────────────────────────────────────────────────────│
│ Corporate Tax Rate:      21.0%  [─────●─────]  (15% - 35%) │
│ Equity Risk Appetite:    1.0×   [─────●─────]  (0.5× - 2×) │
└─────────────────────────────────────────────────────────────┘

         [Save Changes]  [Reset to Default]  [Create New]
```

---

## 🔄 Implementation Workflow

### Week 1: Database & Backend Core
- [ ] Create migration script for new tables
- [ ] Implement `scenario_service.py`
- [ ] Implement `macro_service.py`
- [ ] Implement `audit_service.py`
- [ ] Write unit tests for services
- [ ] Update `valuation_professional.py` to accept scenario assumptions

### Week 2: API Layer & Scenario Generator
- [ ] Create all API endpoints for scenarios
- [ ] Create all API endpoints for macro assumptions
- [ ] Create all API endpoints for audit trail
- [ ] Implement `scenario_generator.py` (auto-generate Bear/Base/Bull)
- [ ] Add API authentication & authorization
- [ ] Write API integration tests

### Week 3: Frontend UI
- [ ] Create `scenarios.html` with assumption editor
- [ ] Create `scenario_comparison.html` with comparison table
- [ ] Create `macro_settings.html` with macro editor
- [ ] Create `audit_trail.html` with history view
- [ ] Implement `scenario_manager.js` and `macro_manager.js`
- [ ] Add scenario tabs to company detail page

### Week 4: Polish & Testing
- [ ] Add charts (bar chart, tornado diagram, waterfall)
- [ ] Implement rollback functionality
- [ ] Add export to PDF for scenario comparison
- [ ] Comprehensive end-to-end testing
- [ ] Performance testing (bulk scenario generation)
- [ ] Documentation update
- [ ] Git commit & push to dev branch

---

## 🧪 Testing Strategy

### Unit Tests
- `test_scenario_service.py` - Scenario CRUD operations
- `test_macro_service.py` - Macro environment management
- `test_audit_service.py` - Audit logging and retrieval
- `test_scenario_generator.py` - Bear/Base/Bull generation

### Integration Tests
- Create company → Generate scenarios → Run valuations → Compare
- Update macro assumptions → Apply to portfolio → Verify valuations updated
- Make assumption changes → Verify audit log → Rollback → Verify restored

### End-to-End Tests
- Full user workflow: Login → Select company → Create custom scenario → Adjust assumptions → Compare to base → Export
- Macro workflow: Create bear market environment → Apply to portfolio → Review impact on all companies

---

## 📊 Success Metrics

Phase 1 is complete when:

1. ✅ User can create custom scenarios for any company
2. ✅ User can auto-generate Bear/Base/Bull scenarios with one click
3. ✅ User can compare 3+ scenarios side-by-side in a table
4. ✅ User can create and switch between macro environments
5. ✅ User can apply macro assumptions to entire portfolio
6. ✅ Every assumption change is logged with user, timestamp, and reason
7. ✅ User can view full audit trail for any company
8. ✅ User can rollback to previous assumptions (admin only)
9. ✅ UI displays scenario comparison with charts
10. ✅ All features have >90% test coverage

---

## 🎁 Bonus Features (If Time Permits)

### 1. Scenario Templates
Pre-configured scenarios:
- "Tech Bubble Burst" (low multiples, high WACC)
- "2008 Financial Crisis" (high credit spreads, negative growth)
- "COVID Recovery" (high growth, low rates)
- "Stagflation" (high inflation, low growth)

### 2. Sensitivity Analysis
- Tornado diagram showing impact of each assumption
- One-way sensitivity tables (vary one assumption at a time)
- Two-way sensitivity grids (vary two assumptions)

### 3. Scenario Scheduling
- Auto-switch macro environment on date trigger
- Periodic revaluation with scheduled scenarios
- Email alerts when scenario divergence exceeds threshold

### 4. Collaborative Features
- Share scenarios with other users
- Scenario approval workflow
- Comment threads on assumptions

---

## 📖 Documentation Deliverables

1. **PHASE1_SETUP.md** - Installation and migration guide
2. **SCENARIO_GUIDE.md** - User guide for scenario management
3. **MACRO_GUIDE.md** - User guide for macro assumptions
4. **AUDIT_GUIDE.md** - User guide for audit trail
5. **API_REFERENCE.md** - Complete API documentation
6. **PHASE1_COMPLETE.md** - Summary of Phase 1 achievements

---

## 🚀 Quick Start (After Phase 1)

```bash
# 1. Run migration to add Phase 1 tables
python3 migrate_phase1.py

# 2. Generate default scenarios for all companies
python3 scripts/generate_default_scenarios.py

# 3. Create default macro environments
python3 scripts/create_macro_environments.py

# 4. Start app
python3 app.py

# 5. Navigate to scenario management
# http://localhost:5001/company/<id>/scenarios
```

---

## 🔮 Looking Ahead: Phase 2 Preview

After Phase 1, Phase 2 will add:
- Configurable DCF models (1/2/3/5-stage)
- Enhanced sensitivity analysis (3D heatmaps)
- Peer benchmarking with auto-fetch
- Industry template library
- Real-time data refresh from Yahoo Finance

---

## 📝 Change Log

**2024-12-02:** Phase 1 roadmap created
**Status:** Ready to begin implementation

---

# Phase 1 Implementation Roadmap

## Objectives
- Enhance the valuation app with scenario management and macro assumptions.
- Provide a robust backend and user interface for managing and comparing scenarios.
- Ensure all features are thoroughly tested and functional.

## Tasks

### 1. Design Database Schema
- Define tables for scenarios and macro assumptions.
- Include fields for scenario types (Bear, Base, Bull) and related data.
- Ensure compatibility with PostgreSQL.

### 2. Run Database Migration
- Create migration scripts for the new schema.
- Test migration on a development database.

### 3. Implement Backend Services
- **Scenario Service**: Manage scenario creation, updates, and retrieval.
- **Macro Service**: Handle macro assumptions logic.
- **Audit Service**: Track changes and maintain an audit trail.
- **Scenario Generator**: Generate Bear, Base, and Bull scenarios based on input data.

### 4. Add API Endpoints
- Create endpoints for managing scenarios (CRUD operations).
- Ensure endpoints are secure and well-documented.

### 5. Develop Frontend Features
- **Scenario Comparison UI**: Design and implement a user-friendly interface for comparing scenarios.
- Integrate frontend with the new API endpoints.

### 6. Testing
- Conduct end-to-end testing of all Phase 1 features.
- Write unit tests for backend services and API endpoints.
- Perform user acceptance testing (UAT).

## Timeline
- **Week 1**: Design database schema and run migration.
- **Week 2**: Implement backend services.
- **Week 3**: Add API endpoints and develop frontend features.
- **Week 4**: Conduct testing and finalize Phase 1.

## Deliverables
- Updated database schema and migration scripts.
- Backend services for scenarios, macros, and audits.
- API endpoints for scenario management.
- Scenario comparison UI.
- Test reports and documentation.

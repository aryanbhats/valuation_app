// ============================================
// PROFESSIONAL INVESTMENT PLATFORM - JAVASCRIPT
// Enhanced with investor-focused features
// ============================================

// Global state
let currentCompanyId = null;
let allCompanies = [];
let filteredCompanies = [];
let currentFilter = 'all';
let currentSort = 'name';
let dashboardStats = null;
let appSettings = {};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    loadCompanies();
    // Load settings at startup so UI behavior (like recompute-on-save) is available
    loadSettings();
    // Form submission
    document.getElementById('company-form').addEventListener('submit', saveCompany);
    // Settings form submission
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
    
    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

// ============================================
// THEME TOGGLE
// ============================================

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function handleKeyboardShortcuts(e) {
    // Cmd/Ctrl + K: Focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('company-search');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // Cmd/Ctrl + N: New company
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        showAddCompanyModal();
    }
    
    // Escape: Close modals
    if (e.key === 'Escape') {
        closeModal();
        closeValuationModal();
    }
    
    // Cmd/Ctrl + 1/2: Switch views
    if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        showView('dashboard');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        showView('companies');
    }
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function showView(viewName) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`${viewName}-view`).classList.add('active');
    const navLink = document.querySelector(`[data-view="${viewName}"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    if (viewName === 'dashboard') {
        loadDashboard();
    } else if (viewName === 'companies') {
        loadCompanies();
    }
}

// ============================================
// DASHBOARD FUNCTIONS - ENHANCED
// ============================================

async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const stats = await response.json();
        dashboardStats = stats;
        
        // Update main stats with enhanced display
        document.getElementById('total-companies').textContent = stats.total_companies;
        document.getElementById('avg-upside').textContent = `${stats.avg_upside.toFixed(1)}%`;
        document.getElementById('avg-pe').textContent = `${stats.avg_pe.toFixed(1)}x`;
        document.getElementById('avg-roe').textContent = `${stats.avg_roe.toFixed(1)}%`;
        
        // Add WACC if available
        const avgWacc = stats.avg_wacc || 0;
        const waccElement = document.getElementById('avg-wacc');
        if (waccElement) {
            waccElement.textContent = `${avgWacc.toFixed(2)}%`;
        }
        
        // Update trend indicators
        updateTrendIndicators(stats);
        
        // Update recommendation counts with percentages
        const total = stats.total_companies || 1;
        document.getElementById('buy-count').textContent = stats.buy_count;
        document.getElementById('hold-count').textContent = stats.hold_count;
        document.getElementById('sell-count').textContent = stats.sell_count;
        
        const buyPct = document.getElementById('buy-pct');
        const holdPct = document.getElementById('hold-pct');
        const sellPct = document.getElementById('sell-pct');
        
        if (buyPct) buyPct.textContent = `${((stats.buy_count / total) * 100).toFixed(0)}% of portfolio`;
        if (holdPct) holdPct.textContent = `${((stats.hold_count / total) * 100).toFixed(0)}% of portfolio`;
        if (sellPct) sellPct.textContent = `${((stats.sell_count / total) * 100).toFixed(0)}% of portfolio`;
        
        // Enhanced sector breakdown with table format
        renderSectorTable(stats.sectors);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function updateTrendIndicators(stats) {
    // These would be calculated from historical data in a real app
    // For now, using positive indicators for demonstration
    const trends = [
        { id: 'total-trend', value: 5 },
        { id: 'upside-trend', value: stats.avg_upside > 10 ? 2 : -1 },
        { id: 'pe-trend', value: 0 },
        { id: 'roe-trend', value: stats.avg_roe > 15 ? 3 : -2 },
        { id: 'wacc-trend', value: 0 }
    ];
    
    trends.forEach(trend => {
        const element = document.getElementById(trend.id);
        if (element) {
            const isPositive = trend.value > 0;
            const isNeutral = trend.value === 0;
            
            element.className = `stat-trend ${isPositive ? 'positive' : isNeutral ? '' : 'negative'}`;
            element.innerHTML = `
                <span>${isPositive ? '↑' : isNeutral ? '—' : '↓'}</span>
                <span>${Math.abs(trend.value)}%</span>
            `;
        }
    });
}

function renderSectorTable(sectors) {
    if (!sectors || sectors.length === 0) {
        document.getElementById('sector-breakdown').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">
                    No sector data available. Add companies to see sector analysis.
                </td>
            </tr>
        `;
        return;
    }
    
    const maxUpside = Math.max(...sectors.map(s => Math.abs(s.avg_upside)));
    
    const sectorHtml = sectors.map(sector => {
        const upsideClass = sector.avg_upside >= 0 ? 'positive' : 'negative';
        const barWidth = maxUpside > 0 ? (Math.abs(sector.avg_upside) / maxUpside) * 100 : 0;
        
        return `
            <tr>
                <td><span class="sector-name">${sector.name}</span></td>
                <td><span class="sector-count">${sector.count} companies</span></td>
                <td><span class="sector-metric ${upsideClass}">${sector.avg_upside >= 0 ? '+' : ''}${sector.avg_upside.toFixed(1)}%</span></td>
                <td><span class="sector-metric">${sector.avg_roe.toFixed(1)}%</span></td>
                <td><span class="sector-metric">${sector.avg_pe ? sector.avg_pe.toFixed(1) + 'x' : 'N/A'}</span></td>
                <td style="text-align: right;">
                    <div class="sector-bar">
                        <div class="sector-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('sector-breakdown').innerHTML = sectorHtml;
}

// Sector sorting functions
let currentSectorSort = 'name';
function sortSectorBy(type) {
    if (!dashboardStats || !dashboardStats.sectors) return;
    
    currentSectorSort = type;
    const sectors = [...dashboardStats.sectors];
    
    if (type === 'upside') {
        sectors.sort((a, b) => b.avg_upside - a.avg_upside);
    } else if (type === 'count') {
        sectors.sort((a, b) => b.count - a.count);
    } else if (type === 'roe') {
        sectors.sort((a, b) => b.avg_roe - a.avg_roe);
    } else {
        sectors.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    renderSectorTable(sectors);
}

// ============================================
// COMPANIES FUNCTIONS - ENHANCED
// ============================================

async function loadCompanies() {
    try {
        const response = await fetch('/api/companies');
        const companies = await response.json();
        allCompanies = companies;
        
        // Apply current filters and sort
        applyFiltersAndSort();
        
    } catch (error) {
        console.error('Error loading companies:', error);
    }
}

function applyFiltersAndSort() {
    // Filter
    filteredCompanies = allCompanies.filter(company => {
        // Search filter
        const searchTerm = document.getElementById('company-search')?.value.toLowerCase() || '';
        const matchesSearch = !searchTerm || 
            company.name.toLowerCase().includes(searchTerm) ||
            (company.sector && company.sector.toLowerCase().includes(searchTerm));
        
        // Recommendation filter
        const matchesRec = currentFilter === 'all' || 
            getRecommendationClass(company.recommendation) === currentFilter;
        
        return matchesSearch && matchesRec;
    });
    
    // Sort
    filteredCompanies.sort((a, b) => {
        switch(currentSort) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'upside-desc':
                return (b.upside || 0) - (a.upside || 0);
            case 'upside-asc':
                return (a.upside || 0) - (b.upside || 0);
            case 'roe-desc':
                return (b.roe || 0) - (a.roe || 0);
            case 'pe-asc':
                return (a.pe_ratio || 999) - (b.pe_ratio || 999);
            case 'sector':
                return (a.sector || '').localeCompare(b.sector || '');
            default:
                return 0;
        }
    });
    
    renderCompanies();
}

function renderCompanies() {
    const countElement = document.getElementById('companies-count');
    if (countElement) {
        countElement.textContent = filteredCompanies.length;
    }
    
    if (filteredCompanies.length === 0) {
        document.getElementById('companies-grid').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                <h3 style="color: var(--text-secondary); margin-bottom: 1rem;">No companies found</h3>
                <p style="color: var(--text-tertiary);">
                    ${allCompanies.length === 0 
                        ? 'Add your first company to get started with valuations.' 
                        : 'Try adjusting your filters or search terms.'}
                </p>
                ${allCompanies.length === 0 
                    ? '<button class="btn-primary" onclick="showAddCompanyModal()" style="margin-top: 1.5rem;">+ Add Company</button>' 
                    : ''}
            </div>
        `;
        return;
    }
    
    const companiesHtml = filteredCompanies.map(company => {
        const recClass = getRecommendationClass(company.recommendation);
        const upsideValue = company.upside || 0;
        const upsideClass = upsideValue >= 0 ? 'positive' : 'negative';
        const upsideBarWidth = Math.min(Math.abs(upsideValue), 100);
        
        return `
            <div class="company-card" data-company-id="${company.id}">
                <div class="company-header">
                    <div class="company-name">${company.name}</div>
                    <div class="company-meta">
                        <span class="company-sector">${company.sector || 'N/A'}</span>
                        ${company.ticker ? `<span class="company-ticker">${company.ticker}</span>` : ''}
                    </div>
                </div>
                
                ${company.fair_value ? `
                    <!-- Main Metrics -->
                    <div class="company-metrics">
                        <div class="metric">
                            <div class="metric-label">DCF Fair Price</div>
                            <div class="metric-value clickable" onclick="showFairValueBreakdown(${company.id})">$${formatNumber(company.fair_value)}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Current Price</div>
                            <div class="metric-value company-current-price">$${company.current_price ? company.current_price.toFixed(2) : 'N/A'}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Market Cap</div>
                            <div class="metric-value company-market-cap">$${formatNumber(company.market_cap)}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Upside</div>
                            <div class="metric-value ${upsideClass}">
                                ${upsideValue >= 0 ? '+' : ''}${upsideValue.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quality Scores -->
                    <div class="quality-scores">
                        <div class="quality-item">
                            <div class="quality-label">P/E</div>
                            <div class="quality-value">${company.pe_ratio ? company.pe_ratio.toFixed(1) + 'x' : 'N/A'}</div>
                        </div>
                        <div class="quality-item">
                            <div class="quality-label">ROE</div>
                            <div class="quality-value ${company.roe >= 15 ? 'text-positive' : ''}">${company.roe ? company.roe.toFixed(1) + '%' : 'N/A'}</div>
                        </div>
                        <div class="quality-item">
                            <div class="quality-label">Z-Score</div>
                            <div class="quality-value ${company.z_score >= 2.99 ? 'text-positive' : company.z_score < 1.81 ? 'text-negative' : ''}">${company.z_score ? company.z_score.toFixed(2) : 'N/A'}</div>
                        </div>
                    </div>
                    
                    <!-- Upside Visualization -->
                    <div class="upside-bar">
                        <div class="upside-label">
                            <span>Target vs Current</span>
                            <span class="upside-value ${upsideClass}">${upsideValue >= 0 ? '+' : ''}${upsideValue.toFixed(1)}%</span>
                        </div>
                        <div class="upside-visual">
                            <div class="upside-fill ${upsideClass}" style="width: ${upsideBarWidth}%"></div>
                        </div>
                    </div>
                    
                    <!-- Recommendation Badge -->
                    <div class="recommendation-badge ${recClass}">
                        ${company.recommendation || 'N/A'}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">
                        <p style="margin-bottom: 1rem;">📊 No valuation data yet</p>
                        <p style="font-size: 0.875rem;">Run a valuation to see detailed analysis</p>
                    </div>
                `}

                <!-- Scenario Selector (Bear/Base/Bull) -->
                <div class="scenario-selector">
                    <button class="scenario-btn bear" data-scenario="bear" onclick="applyScenarioToCompany(${company.id}, 'bear')" title="Pessimistic scenario">
                        Bear
                    </button>
                    <button class="scenario-btn base active" data-scenario="base" onclick="applyScenarioToCompany(${company.id}, 'base')" title="Balanced scenario">
                        Base
                    </button>
                    <button class="scenario-btn bull" data-scenario="bull" onclick="applyScenarioToCompany(${company.id}, 'bull')" title="Optimistic scenario">
                        Bull
                    </button>
                </div>

                <!-- Action Buttons -->
                <div class="company-actions">
                    <button class="btn btn-primary" onclick="runValuation(${company.id})" title="${company.fair_value ? 'Re-run valuation' : 'Run initial valuation'}">
                        ${company.fair_value ? 'Revalue' : 'Value'}
                    </button>
                    <button class="btn btn-secondary" onclick="editCompany(${company.id})" title="Edit company details">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-icon" onclick="deleteCompany(${company.id})" title="Delete company">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    <button class="btn btn-secondary btn-icon" onclick="toggleWatchlist(${company.id})" title="Add to watchlist">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('companies-grid').innerHTML = companiesHtml;
}

// Show fair value breakdown modal (fetch latest stored valuation and show detailed methods)
async function showFairValueBreakdown(companyId) {
    try {
        showLoadingState('Loading valuation breakdown...');
        const res = await fetch(`/api/company/${companyId}`);
        if (!res.ok) throw new Error('Failed to load company valuation');
        const data = await res.json();

        // If the endpoint returns an object with `valuation`, map it into the shape expected by showValuationResults
        const val = data.valuation || data;

        const result = {
            company_id: data.id,
            name: data.name,
            recommendation: val.recommendation || val.recommendation,
            upside_pct: val.upside_pct || val.upside_pct || 0,
            final_equity_value: val.final_equity_value || val.final_equity_value,
            final_price_per_share: val.final_price_per_share || val.final_price_per_share || 0,
            market_cap: val.market_cap || val.market_cap || 0,
            current_price: val.current_price || val.current_price || 0,
            dcf_equity_value: val.dcf_equity_value || val.dcf_equity_value,
            dcf_price_per_share: val.dcf_price_per_share || val.dcf_price_per_share || 0,
            comp_ev_value: val.comp_ev_value || val.comp_ev_value || 0,
            comp_pe_value: val.comp_pe_value || val.comp_pe_value || 0,
            mc_p10: val.mc_p10 || val.mc_p10 || 0,
            mc_p90: val.mc_p90 || val.mc_p90 || 0,
            wacc: val.wacc || 0,
            ev_ebitda: val.ev_ebitda || 0,
            pe_ratio: val.pe_ratio || 0,
            fcf_yield: val.fcf_yield || 0,
            roe: val.roe || 0,
            roic: val.roic || 0,
            debt_to_equity: val.debt_to_equity || 0,
            z_score: val.z_score || 0
        };

        hideLoadingState();
        showValuationResults(result);
    } catch (err) {
        hideLoadingState();
        console.error('Error loading valuation breakdown:', err);
        alert('Could not load valuation breakdown');
    }
}

// ============================================
// FILTERING & SORTING
// ============================================

function filterCompanies() {
    applyFiltersAndSort();
}

function filterByRecommendation(rec) {
    currentFilter = rec;
    
    // Update button states
    document.querySelectorAll('.toolbar .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`filter-${rec}`).classList.add('active');
    
    applyFiltersAndSort();
}

function sortCompanies() {
    currentSort = document.getElementById('company-sort').value;
    applyFiltersAndSort();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getRecommendationClass(recommendation) {
    if (!recommendation) return '';
    const rec = recommendation.toLowerCase();
    if (rec.includes('buy')) return 'buy';
    if (rec.includes('hold')) return 'hold';
    return 'sell';
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Watchlist functionality (localStorage based)
function toggleWatchlist(companyId) {
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const index = watchlist.indexOf(companyId);
    
    if (index > -1) {
        watchlist.splice(index, 1);
        alert('Removed from watchlist');
    } else {
        watchlist.push(companyId);
        alert('Added to watchlist');
    }
    
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    renderCompanies(); // Refresh to update watchlist star
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function showAddCompanyModal() {
    currentCompanyId = null;
    document.getElementById('modal-title').textContent = 'Add New Company';
    document.getElementById('company-form').reset();
    document.getElementById('company-id').value = '';
    
    // Set defaults
    document.getElementById('risk_free_rate').value = 4.5;
    document.getElementById('market_risk_premium').value = 6.5;
    document.getElementById('country_risk_premium').value = 0;
    
    document.getElementById('company-modal').classList.add('active');
}

async function editCompany(companyId) {
    try {
        const response = await fetch(`/api/company/${companyId}`);
        const company = await response.json();
        
        currentCompanyId = companyId;
        document.getElementById('modal-title').textContent = 'Edit Company';
        document.getElementById('company-id').value = companyId;
        
        // Fill form
        document.getElementById('name').value = company.name;
        document.getElementById('sector').value = company.sector;
        
        if (company.financials) {
            // Fields that are stored as decimals but displayed as percentages
            const percentageFields = [
                'capex_pct', 'profit_margin', 'growth_rate_y1', 'growth_rate_y2', 'growth_rate_y3',
                'terminal_growth', 'tax_rate', 'risk_free_rate', 'market_risk_premium',
                'country_risk_premium', 'size_premium'
            ];
            
            const fields = [
                'revenue', 'ebitda', 'depreciation', 'capex_pct', 'working_capital_change',
                'profit_margin', 'growth_rate_y1', 'growth_rate_y2', 'growth_rate_y3',
                'terminal_growth', 'tax_rate', 'shares_outstanding', 'debt', 'cash',
                'market_cap_estimate', 'beta', 'risk_free_rate', 'market_risk_premium',
                'country_risk_premium', 'size_premium', 'comparable_ev_ebitda',
                'comparable_pe', 'comparable_peg'
            ];
            
            fields.forEach(field => {
                const element = document.getElementById(field);
                if (element && company.financials[field] != null) {
                    // Convert decimals to percentages for display
                    const value = percentageFields.includes(field) 
                        ? (company.financials[field] * 100)
                        : company.financials[field];
                    element.value = value;
                }
            });
        }
        
        document.getElementById('company-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading company:', error);
        alert('Error loading company data');
    }
}

function closeModal() {
    document.getElementById('company-modal').classList.remove('active');
}

function closeValuationModal() {
    document.getElementById('valuation-modal').classList.remove('active');
}

// ============================================
// SETTINGS MODAL + API
// ============================================

function showSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
    loadSettings();
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const s = await res.json();
        appSettings = s || {};

        document.getElementById('th-strong-buy').value = s.recommendation_thresholds.strong_buy;
        document.getElementById('th-buy').value = s.recommendation_thresholds.buy;
        document.getElementById('th-hold').value = s.recommendation_thresholds.hold;
        document.getElementById('th-underweight').value = s.recommendation_thresholds.underweight;

        document.getElementById('w-dcf').value = s.valuation_weights.dcf;
        document.getElementById('w-ev-ebitda').value = s.valuation_weights.ev_ebitda;
        document.getElementById('w-pe').value = s.valuation_weights.pe;
        // Recompute on save checkbox (defaults to false)
        const recomputeEl = document.getElementById('recompute-on-save');
        if (recomputeEl) recomputeEl.checked = !!s.recompute_on_save;

    } catch (err) {
        console.error('Error loading settings:', err);
        alert('Could not load settings');
    }
}

async function saveSettings(e) {
    e.preventDefault();
    try {
        const payload = {
            recommendation_thresholds: {
                strong_buy: parseFloat(document.getElementById('th-strong-buy').value),
                buy: parseFloat(document.getElementById('th-buy').value),
                hold: parseFloat(document.getElementById('th-hold').value),
                underweight: parseFloat(document.getElementById('th-underweight').value)
            },
            valuation_weights: {
                dcf: parseFloat(document.getElementById('w-dcf').value),
                ev_ebitda: parseFloat(document.getElementById('w-ev-ebitda').value),
                pe: parseFloat(document.getElementById('w-pe').value)
            }
        };

        // Add recompute on save flag
        const recomputeEl = document.getElementById('recompute-on-save');
        payload.recompute_on_save = recomputeEl ? !!recomputeEl.checked : false;

        // Basic validation: weights sum to ~1
        const sum = payload.valuation_weights.dcf + payload.valuation_weights.ev_ebitda + payload.valuation_weights.pe;
        if (Math.abs(sum - 1.0) > 0.01) {
            if (!confirm('Weights do not sum to 1.0. Save anyway?')) return;
        }

        showLoadingState('Saving settings...');
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        hideLoadingState();

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save settings');
        }

        const result = await res.json();
        // Update local cached settings
        appSettings = result.settings || payload;
        closeSettingsModal();
        loadDashboard();
        loadCompanies();
        alert('Settings saved');

    } catch (err) {
        hideLoadingState();
        console.error('Error saving settings:', err);
        alert('Error saving settings');
    }
}

// ============================================
// SAVE COMPANY
// ============================================

async function saveCompany(e) {
    e.preventDefault();
    
    const companyId = document.getElementById('company-id').value;
    
    // Helper to convert percentage to decimal
    const pct = (val, defaultVal = 0) => {
        const num = parseFloat(val) || defaultVal;
        return num / 100;
    };
    
    const data = {
        name: document.getElementById('name').value,
        sector: document.getElementById('sector').value,
        revenue: parseFloat(document.getElementById('revenue').value) || 0,
        ebitda: parseFloat(document.getElementById('ebitda').value) || 0,
        depreciation: parseFloat(document.getElementById('depreciation').value) || 0,
        capex_pct: pct(document.getElementById('capex_pct').value, 5),
        working_capital_change: parseFloat(document.getElementById('working_capital_change').value) || 0,
        profit_margin: pct(document.getElementById('profit_margin').value, 15),
        growth_rate_y1: pct(document.getElementById('growth_rate_y1').value, 20),
        growth_rate_y2: pct(document.getElementById('growth_rate_y2').value, 15),
        growth_rate_y3: pct(document.getElementById('growth_rate_y3').value, 10),
        terminal_growth: pct(document.getElementById('terminal_growth').value, 3),
        tax_rate: pct(document.getElementById('tax_rate').value, 25),
        shares_outstanding: parseFloat(document.getElementById('shares_outstanding').value) || 1000000,
        debt: parseFloat(document.getElementById('debt').value) || 0,
        cash: parseFloat(document.getElementById('cash').value) || 0,
        market_cap_estimate: parseFloat(document.getElementById('market_cap_estimate').value) || 1000000,
        beta: parseFloat(document.getElementById('beta').value) || 1.0,
        risk_free_rate: pct(document.getElementById('risk_free_rate').value, 4.5),
        market_risk_premium: pct(document.getElementById('market_risk_premium').value, 6.5),
        country_risk_premium: pct(document.getElementById('country_risk_premium').value, 0),
        size_premium: pct(document.getElementById('size_premium').value, 0),
        comparable_ev_ebitda: parseFloat(document.getElementById('comparable_ev_ebitda').value) || 10,
        comparable_pe: parseFloat(document.getElementById('comparable_pe').value) || 15,
        comparable_peg: parseFloat(document.getElementById('comparable_peg').value) || 1.5
    };
    
    try {
        showLoadingState('Saving company data...');
        
        const url = companyId ? `/api/company/${companyId}` : '/api/company';
        const method = companyId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            hideLoadingState();
            if (error.details) {
                let errorMsg = 'Validation errors:\n\n';
                error.details.forEach(err => {
                    const field = err.loc[err.loc.length - 1];
                    errorMsg += `• ${field}: ${err.msg}\n`;
                });
                alert(errorMsg);
            } else {
                alert(error.error || 'Error saving company');
            }
            return;
        }
        
        const result = await response.json();
        closeModal();
        
        // For edits, automatically run valuation
        if (companyId) {
            try {
                const valResponse = await fetch(`/api/valuation/${companyId}`, { method: 'POST' });
                const valResult = await valResponse.json();
                hideLoadingState();
                showValuationResults(valResult);
            } catch (error) {
                hideLoadingState();
                console.error('Error running valuation:', error);
            }
        } else {
            // If user enabled recompute-on-save, run valuation immediately for newly created company
            if (appSettings && appSettings.recompute_on_save) {
                try {
                    const valResponse = await fetch(`/api/valuation/${result.id}`, { method: 'POST' });
                    if (!valResponse.ok) {
                        const err = await valResponse.json();
                        throw new Error(err.error || 'Valuation failed');
                    }
                    const valResult = await valResponse.json();
                    hideLoadingState();
                    showValuationResults(valResult);
                } catch (err) {
                    hideLoadingState();
                    console.error('Error running valuation after create:', err);
                    alert('Company created. Valuation failed to run automatically.');
                }
            } else {
                hideLoadingState();
                alert('✅ Company created successfully! Click "Value" to generate valuation.');
            }
        }
        
        loadCompanies();
        loadDashboard();
    } catch (error) {
        hideLoadingState();
        console.error('Error saving company:', error);
        alert('Error saving company');
    }
}

// ============================================
// DELETE COMPANY
// ============================================

async function deleteCompany(companyId) {
    if (!confirm('⚠️ Are you sure you want to delete this company? This action cannot be undone.')) return;
    
    try {
        showLoadingState('Deleting company...');
        const response = await fetch(`/api/company/${companyId}`, {
            method: 'DELETE'
        });
        
        hideLoadingState();
        
        if (response.ok) {
            loadCompanies();
            loadDashboard();
        } else {
            alert('Error deleting company');
        }
    } catch (error) {
        hideLoadingState();
        console.error('Error deleting company:', error);
        alert('Error deleting company');
    }
}

// ============================================
// VALUATION FUNCTIONS - ENHANCED
// ============================================

async function runValuation(companyId) {
    try {
        showLoadingState('Running comprehensive CFA-level valuation...');
        
        const response = await fetch(`/api/valuation/${companyId}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Valuation failed');
        }
        
        const result = await response.json();
        hideLoadingState();
        
        showValuationResults(result);
        loadCompanies();
        loadDashboard();
    } catch (error) {
        hideLoadingState();
        console.error('Error running valuation:', error);
        alert(`❌ Valuation failed: ${error.message}`);
    }
}

function showValuationResults(result) {
    document.getElementById('valuation-modal').classList.add('active');
    document.getElementById('valuation-company-name').textContent = `${result.name} - Detailed Valuation`;
    
    const recClass = getRecommendationClass(result.recommendation);
    const upsideColor = result.upside_pct >= 0 ? 'var(--positive)' : 'var(--negative)';
    
    const html = `
        <!-- Valuation Header -->
        <div class="valuation-header">
            <div class="recommendation">${result.recommendation || 'N/A'}</div>
            <div class="upside" style="color: rgba(255,255,255,0.95);">
                ${result.upside_pct >= 0 ? '↑' : '↓'} ${result.upside_pct >= 0 ? '+' : ''}${result.upside_pct.toFixed(1)}% ${result.upside_pct >= 0 ? 'Upside' : 'Downside'}
            </div>
        </div>
        
        <!-- Summary Metrics -->
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-label">Fair Value (Equity)</div>
                <div class="summary-value">$${formatNumber(result.final_equity_value)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Fair Price/Share</div>
                <div class="summary-value">$${result.final_price_per_share.toFixed(2)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Current Market Cap</div>
                <div class="summary-value">$${formatNumber(result.market_cap)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Current Price</div>
                <div class="summary-value">$${result.current_price.toFixed(2)}</div>
            </div>
        </div>
        
        <!-- Valuation Methods -->
        <div class="valuation-section">
            <h3>Valuation Methods Comparison</h3>
            <div class="chart-container">
                <canvas id="valuationChart"></canvas>
            </div>
        </div>
        
        <!-- Key Financial Metrics -->
        <div class="metrics-grid">
            <div class="metric-item">
                <div class="summary-label">WACC</div>
                <div class="summary-value">${result.wacc.toFixed(2)}%</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">EV/EBITDA</div>
                <div class="summary-value">${result.ev_ebitda.toFixed(1)}x</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">P/E Ratio</div>
                <div class="summary-value">${result.pe_ratio.toFixed(1)}x</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">FCF Yield</div>
                <div class="summary-value">${result.fcf_yield.toFixed(2)}%</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">ROE</div>
                <div class="summary-value">${result.roe.toFixed(1)}%</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">ROIC</div>
                <div class="summary-value">${result.roic.toFixed(1)}%</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">Debt/Equity</div>
                <div class="summary-value">${result.debt_to_equity.toFixed(2)}x</div>
            </div>
            <div class="metric-item">
                <div class="summary-label">Altman Z-Score</div>
                <div class="summary-value ${result.z_score >= 2.99 ? 'text-positive' : result.z_score < 1.81 ? 'text-negative' : ''}">${result.z_score.toFixed(2)}</div>
            </div>
        </div>
        
        <!-- Monte Carlo Risk Analysis -->
        <div class="valuation-section">
            <h3>Monte Carlo Risk Analysis</h3>
            <div class="chart-container">
                <canvas id="monteCarloChart"></canvas>
            </div>
            <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; font-size: 0.875rem;">
                    <div>
                        <span style="color: var(--text-tertiary);">P10 (Pessimistic):</span>
                        <strong style="color: var(--text-primary); margin-left: 0.5rem;">$${formatNumber(result.mc_p10)}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-tertiary);">P50 (Base Case):</span>
                        <strong style="color: var(--text-primary); margin-left: 0.5rem;">$${formatNumber((result.mc_p10 + result.mc_p90) / 2)}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-tertiary);">P90 (Optimistic):</span>
                        <strong style="color: var(--text-primary); margin-left: 0.5rem;">$${formatNumber(result.mc_p90)}</strong>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid var(--border-primary); display: flex; gap: 1rem;">
            <button class="btn-submit" onclick="closeValuationModal()">Close</button>
            <button class="btn-secondary" onclick="exportValuationPDF(${result.company_id})">📄 Export PDF</button>
        </div>
    `;
    
    document.getElementById('valuation-results').innerHTML = html;
    
    // Render charts
    setTimeout(() => {
        renderValuationChart(result);
        renderMonteCarloChart(result);
    }, 100);
}

// ============================================
// CHART RENDERING - ENHANCED
// ============================================

function renderValuationChart(result) {
    const ctx = document.getElementById('valuationChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['DCF Method', 'EV/EBITDA Comp', 'P/E Comp', 'Current Market Cap'],
            datasets: [{
                label: 'Valuation ($M)',
                data: [
                    (result.dcf_equity_value / 1000000).toFixed(2),
                    (result.comp_ev_value / 1000000).toFixed(2),
                    (result.comp_pe_value / 1000000).toFixed(2),
                    (result.market_cap / 1000000).toFixed(2)
                ],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ],
                borderColor: [
                    'rgb(59, 130, 246)',
                    'rgb(139, 92, 246)',
                    'rgb(236, 72, 153)',
                    'rgb(245, 158, 11)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y + 'M';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value + 'M';
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderMonteCarloChart(result) {
    const ctx = document.getElementById('monteCarloChart');
    if (!ctx) return;
    
    const mean = (result.mc_p10 + result.mc_p90) / 2;
    const p25 = result.mc_p10 + (mean - result.mc_p10) * 0.5;
    const p75 = result.mc_p90 - (result.mc_p90 - mean) * 0.5;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['P10', 'P25', 'Mean', 'P75', 'P90'],
            datasets: [{
                label: 'Valuation Range',
                data: [
                    (result.mc_p10 / 1000000).toFixed(2),
                    (p25 / 1000000).toFixed(2),
                    (mean / 1000000).toFixed(2),
                    (p75 / 1000000).toFixed(2),
                    (result.mc_p90 / 1000000).toFixed(2)
                ],
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y + 'M';
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return '$' + value + 'M';
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ============================================
// LOADING STATES
// ============================================

function showLoadingState(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
        text.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoadingState() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

async function exportCSV() {
    try {
        showLoadingState('Generating CSV export...');
        window.location.href = '/api/export/csv';
        setTimeout(hideLoadingState, 1000);
    } catch (error) {
        hideLoadingState();
        console.error('Error exporting CSV:', error);
        alert('Error exporting data');
    }
}

function exportValuationPDF(companyId) {
    alert('📄 PDF export feature coming soon!\n\nThis will generate a comprehensive valuation report including all metrics, charts, and analysis.');
}

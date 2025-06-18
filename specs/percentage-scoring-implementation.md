# Percentage-Based Scoring Implementation Plan (Simplified)

## Executive Summary

This document outlines the transition from absolute price-based rankings to a percentage-based scoring system for the Closing Price Derby. The new approach scores cities based on how much their highest sale exceeds the local 90-day median, creating a fairer competition across different market conditions.

**Philosophy**: Iterate, don't reinvent. Enhance the existing system with percentage scoring while keeping the proven architecture.

### New Scoring Formula
```
Score % = (SalePrice - BaselineMedian) ÷ BaselineMedian × 100
```

**Display Format**: `×{(scorePct/100 + 1).toFixed(1)}` (e.g., ×1.5 instead of +47.4%)

---

## Current System Analysis

### Existing Architecture (Keep As-Is)
- **Frontend**: React + TypeScript with SWR data fetching
- **Data Source**: RapidAPI (Redfin) scraping every 4 hours
- **Data Storage**: Static JSON files (`/public/leaderboard.json`, `/public/sales-data.json`)
- **Update Frequency**: 60-second frontend polling
- **Cities**: 12 NFL cities with friend assignments

### Strengths to Preserve
- ✅ Robust data fetching pipeline
- ✅ Real-time UI updates
- ✅ Mobile-responsive design
- ✅ Detailed sales modals
- ✅ Live event ticker system
- ✅ Proven stability and performance

### Simple Enhancement Needed
- Add percentage scoring calculation to existing scraper
- Collect baseline medians for the 12 cities
- Update frontend to display multipliers instead of absolute prices

---

## Simplified Scoring System Design

### Core Requirements

**Tie-Breaking Logic**:
- Primary: Higher score percentage
- Secondary: Earlier closing date
- Tertiary: Earlier data timestamp

**Manual Review Process**:
- Commissioner reviews results after first few days
- Manual adjustments for any obvious data errors
- Build automation later only if needed

---

## Data Structure Changes

### Baseline Data (`/public/baselines.json`) - New File
```json
{
  "lastUpdated": "2025-06-15T00:00:00Z",
  "calculationPeriod": "90-day median (Mar 17 - Jun 15, 2025)",
  "baselines": {
    "Kansas City": {
      "median": 850000,
      "sampleSize": 47,
      "dateRange": "2025-03-17 to 2025-06-15"
    },
    "New Orleans": {
      "median": 720000,
      "sampleSize": 32,
      "dateRange": "2025-03-17 to 2025-06-15"
    }
    // ... all 12 NFL cities
  }
}
```

### Enhanced Leaderboard Data (`/public/leaderboard.json`) - Modified
```json
[
  {
    "zip": "KansasCity",
    "city": "Kansas City", 
    "state": "MO",
    "teamName": "Alice",
    "price": 1275000,              // Keep for compatibility
    "baseline": 850000,            // NEW: Baseline median
    "scorePct": 50.0,              // NEW: Percentage score
    "multiplier": "×1.5",          // NEW: Display format
    "ts": 1750196971026,
    "lastSoldDate": "Jun 16, 2025",
    "topSaleAddress": "123 Main St" // NEW: Top sale details
  }
]
```

### Sales Data (No Changes Needed)
Keep existing `/public/sales-data.json` structure unchanged for compatibility.

---

## Implementation Plan

### Phase 0: Testing with Mock Data (Day 1)

#### 0.1 Create Mock Baselines
- [ ] Create `/public/baselines.json` with estimated medians
- [ ] Use reasonable market estimates for all 12 NFL cities:
  ```json
  {
    "lastUpdated": "2025-06-15T00:00:00Z",
    "calculationPeriod": "Mock data for testing",
    "baselines": {
      "Kansas City": {"median": 850000, "sampleSize": 50, "dateRange": "estimated"},
      "New Orleans": {"median": 720000, "sampleSize": 45, "dateRange": "estimated"},
      "Green Bay": {"median": 450000, "sampleSize": 35, "dateRange": "estimated"},
      "Nashville": {"median": 950000, "sampleSize": 55, "dateRange": "estimated"},
      "Buffalo": {"median": 420000, "sampleSize": 40, "dateRange": "estimated"},
      "Pittsburgh": {"median": 380000, "sampleSize": 50, "dateRange": "estimated"},
      "Cincinnati": {"median": 400000, "sampleSize": 45, "dateRange": "estimated"},
      "Cleveland": {"median": 350000, "sampleSize": 40, "dateRange": "estimated"},
      "Jacksonville": {"median": 650000, "sampleSize": 50, "dateRange": "estimated"},
      "Indianapolis": {"median": 480000, "sampleSize": 55, "dateRange": "estimated"},
      "Baltimore": {"median": 750000, "sampleSize": 45, "dateRange": "estimated"},
      "Carolina": {"median": 820000, "sampleSize": 50, "dateRange": "estimated"}
    }
  }
  ```

#### 0.2 Enhance Scraper for Testing
- [ ] Modify `scripts/scrape-rapidapi.js` to load mock baselines
- [ ] Add percentage scoring calculations
- [ ] Generate test leaderboard with current sales data
- [ ] Verify scoring makes intuitive sense

#### 0.3 Quick Frontend Test
- [ ] Update `PriceDisplay.tsx` to show multipliers
- [ ] Test with mock data to see how scores look
- [ ] Validate competitive balance feels right
- [ ] Get initial feedback on multiplier display

#### 0.4 Validation & Feedback
- [ ] Review mock scoring results
- [ ] Adjust baseline estimates if needed
- [ ] Confirm approach before collecting real data
- [ ] Share with friends for initial reactions

### Phase 1: Real Baseline Collection (Day 2 Morning)

#### 1.1 Create Baseline Collection Script
- [ ] Create `scripts/collect-baselines.js`
- [ ] Fetch 90-day historical data for each city via RapidAPI
- [ ] Calculate median prices per city
- [ ] Generate `/public/baselines.json`

**Script Logic**:
```javascript
// For each NFL city in CITY_REGIONS:
// 1. Fetch sales from 90 days ago to today
// 2. Calculate median price from all sales
// 3. Store with metadata
```

#### 1.2 Run Baseline Collection
- [ ] Execute script once to generate baseline data
- [ ] Verify data quality and sample sizes
- [ ] Commit baselines.json to repository

### Phase 2: Enhanced Scraper (Day 2 Afternoon)

#### 2.1 Modify Existing Scraper
File: `scripts/scrape-rapidapi.js`

**New Functions to Add**:
- [ ] `loadBaselines()` - Read baselines.json
- [ ] `calculateScore(price, baseline)` - Percentage formula
- [ ] `formatMultiplier(scorePct)` - Display format
- [ ] Enhanced leaderboard data structure

**Modified Data Flow**:
1. Load baseline data at script start
2. Fetch recent sales (existing logic)
3. **NEW**: Calculate percentage scores for each city
4. **NEW**: Add baseline, scorePct, multiplier to output
5. Sort by score percentage instead of absolute price
6. Generate enhanced leaderboard.json

#### 2.2 Update Data Generation
- [ ] Modify `saveResults()` function for new data structure
- [ ] Ensure backward compatibility with existing fields
- [ ] Test with current frontend before UI changes

### Phase 3: Frontend Updates (Day 3)

#### 3.1 Update Core Components

**PriceDisplay.tsx** - Show multipliers
- [ ] Display `×1.5` instead of `$4.2M` as primary
- [ ] Add tooltip showing actual price and calculation
- [ ] Color coding based on score ranges (green >20%, yellow 10-20%, etc.)

**ZipCodeCard.tsx** - Enhanced data display  
- [ ] Use `multiplier` field for main display
- [ ] Show baseline in smaller text
- [ ] Add visual indicators for score ranges

**ZipDetailModal.tsx** - Score breakdown
- [ ] Add "Score Breakdown" section
- [ ] Show: "Price: $4.2M | Baseline: $2.85M | Score: ×1.5 (+47%)"
- [ ] Visual comparison chart or bar

#### 3.2 Update Data Fetching
File: `src/pages/Index.tsx`

- [ ] No changes to SWR logic (keep JSON polling)
- [ ] Update data processing for new fields
- [ ] Ensure ranking by `scorePct` instead of `price`
- [ ] Update price delta calculation to use percentages

#### 3.3 Live Event Ticker Updates
- [ ] Modify event text to use multipliers
- [ ] "🔥 Kansas City leads with ×1.5!" instead of price
- [ ] Update relative time and ranking change logic

---

## Testing & Validation

### Baseline Validation
- [ ] Verify baseline calculations are reasonable
- [ ] Check sample sizes are adequate (>20 sales preferred)
- [ ] Compare against known market data if available

### Score Calculation Testing
- [ ] Manual verification of percentage formula
- [ ] Edge case testing (price = baseline, very high/low scores)
- [ ] Tie-breaking logic verification

### Frontend Compatibility
- [ ] Ensure existing features work with new data structure
- [ ] Mobile responsiveness maintained
- [ ] Performance impact assessment

---

## Manual Review Process

### Initial Review (After Day 2)
1. **Data Quality Check**
   - Review baseline calculations for reasonableness
   - Check for any obvious data anomalies
   - Verify score calculations manually for top 3 cities

2. **Competitive Balance**
   - Ensure no single city dominates due to baseline issues
   - Check that different market types can compete fairly
   - Adjust baselines manually if needed

3. **User Experience**
   - Test with friends/league members
   - Gather feedback on score display clarity
   - Iterate on UI based on feedback

### Ongoing Monitoring
- Weekly review of results
- Manual correction of obvious data errors
- Consider automation only if manual process becomes burdensome

---

## Timeline

### Day 1: Testing Phase
- **Morning**: Create mock baselines with estimated medians
- **Afternoon**: Test scoring with existing sales data + basic frontend updates

### Day 2: Real Data Collection
- **Morning**: Real baseline collection script and data generation
- **Afternoon**: Enhanced scraper with percentage scoring

### Day 3: Frontend Polish
- **Morning**: Complete component updates for multiplier display
- **Afternoon**: Testing and refinement

**Total Estimated Time**: 2-3 days

---

## Rollback Plan

### Safety Measures
- [ ] Keep original scraper as backup (`scrape-rapidapi-v1.js`)
- [ ] Preserve existing JSON data structure fields
- [ ] Frontend can fall back to price-based display if needed

### Rollback Steps
1. Revert scraper to original version
2. Frontend automatically uses `price` field if score fields missing
3. Remove baselines.json
4. Return to absolute price rankings

---

## Future Iteration Opportunities

### If Manual Review Becomes Burdensome
- Add simple sale submission form
- Basic commissioner override interface
- Automated data quality checks

### If Competition Grows
- Add more cities/participants
- Historical score tracking
- Advanced analytics and trends

### If Data Quality Issues Arise
- Multiple data source validation
- Automated outlier detection
- Community-driven fact-checking

---

## Success Metrics

### Technical Success
- [ ] Baseline data collected successfully for all 12 NFL cities
- [ ] Score calculations working correctly
- [ ] Frontend displays multipliers clearly
- [ ] No performance degradation

### Competitive Success
- [ ] More balanced competition across markets
- [ ] Increased engagement with percentage-based scoring
- [ ] Clear score calculation transparency
- [ ] Easy manual review process

### User Experience Success
- [ ] Intuitive multiplier display (×1.5 is clearer than +47%)
- [ ] Score breakdown helps understanding
- [ ] Mobile experience remains excellent
- [ ] Fast loading and updates maintained

---

## Risk Mitigation

### Data Quality Risks
- **Risk**: Inaccurate baselines skewing competition
- **Mitigation**: Manual review and adjustment capability

### Technical Risks  
- **Risk**: Scraper changes breaking existing functionality
- **Mitigation**: Backward compatibility + rollback plan

### User Adoption Risks
- **Risk**: Confusion with new scoring system
- **Mitigation**: Clear explanations + gradual education

### API Rate Limit Risks
- **Risk**: Baseline collection hitting RapidAPI limits  
- **Mitigation**: Spread collection over time + caching

---

*This simplified approach focuses on the core value proposition—percentage-based scoring—while maintaining the proven stability of the existing system. Build complexity only when manual processes prove insufficient.*
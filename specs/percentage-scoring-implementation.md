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

**See detailed specification**: [`/specs/phase-0-mock-testing.md`](./phase-0-mock-testing.md)

**Summary**: Validate percentage scoring concept using mock baseline data with existing sales.

**Key Tasks**:
- Create mock baselines for 12 NFL cities
- Enhance scraper with percentage scoring logic
- Update frontend to display multipliers (×1.5)
- Test competitive balance and UI clarity

**Time Estimate**: 3-4 hours  
**Risk Level**: Low (easy rollback, no permanent changes)

### Phase 1: Real Baseline Collection (DEFERRED)

**See detailed specification**: [`/specs/phase-1-baseline-collection.md`](./phase-1-baseline-collection.md)

**Summary**: Collect real 90-day historical median prices via RapidAPI to replace mock baseline data.

**Key Tasks**:
- Create automated baseline collection script
- Research and validate real region IDs for NFL cities
- Execute collection with data quality validation
- Generate production-ready `/public/baselines.json`

**Time Estimate**: 4-5 hours  
**Risk Level**: Medium (API dependencies, data quality variables)

**Status**: 🚧 **HOLDING OFF** - Waiting for leaguemates to select their NFL cities from the 32 teams before collecting real baseline data. Mock baselines will continue supporting development of other components.

### Phase 2: Production Integration (SIMPLIFIED)

**Summary**: Use existing percentage scoring system with production data flow.

**Key Insight**: Phase 0 already created working percentage scoring! No need to modify the main scraper.

**Simple Integration Tasks**:
- Keep `scripts/scrape-rapidapi.js` unchanged (fetches fresh sales data)
- Use existing `scripts/phase0-test-scoring.js` logic on fresh data
- Replace mock baselines with real baselines (when cities selected)
- Switch frontend from `test-leaderboard.json` back to percentage-scored results

**Time Estimate**: 1 hour (just data flow changes)  
**Risk Level**: Very Low (leverage existing working system)

### Phase 3: UI Polish & Enhancement (SIMPLIFIED)

**See detailed specification**: [`/specs/phase-3-ui-polish.md`](./phase-3-ui-polish.md)

**Summary**: Polish the existing working percentage scoring UI with enhanced visual features.

**Current State**: Core percentage scoring ✅ ALREADY WORKING
- ✅ Multipliers display correctly (×30.0, ×19.8, etc.)
- ✅ Frontend processes percentage data properly  
- ✅ ZipCodeCard passes percentage fields to PriceDisplay
- ✅ Test data flow complete with `/test-leaderboard.json`

**Key Tasks** (only polish needed):
- Add tooltips and color coding for score ranges
- Enhance ZipDetailModal with score breakdown section
- Update LiveEventTicker to use multipliers instead of prices
- Visual indicators for competitive score ranges

**Time Estimate**: 2-3 hours (not full day!)  
**Risk Level**: Very Low (polish existing working system)

**Note**: 🚧 **Data source switch** from test data to production data will be handled separately during production integration.

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

### Day 2: Real Data Integration  
- **Morning**: Real baseline collection script and data generation
- **Afternoon**: Simple integration of percentage scoring with production data (1 hour)

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
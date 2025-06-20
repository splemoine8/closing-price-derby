# Competition Framework Implementation Audit

## Executive Summary

The core competition framework is **70% implemented** with solid foundations in place. The percentage scoring system, baseline calculation, and data collection pipeline are working correctly. Key gaps are in competition state management, time-filtering, and UI mode switching.

## ✅ What We Have (Implemented)

### Baseline System
- **✅ 90-day baseline calculation** - `scripts/calculate-baselines.js`
- **✅ Baseline storage** - `public/baselines.json` with quality metrics
- **✅ Baseline integration** - Frontend loads and uses baselines correctly
- **✅ Frozen baselines** - System doesn't recalculate during competition

### Scoring Engine
- **✅ Percentage formula** - Exact match: `((salePrice - baselineMedian) / baselineMedian) × 100`
- **✅ Personal-best logic** - `getHighestSaleData()` finds highest sale per city
- **✅ Score calculation** - Lines 185-191 in `src/pages/Index.tsx`
- **✅ Multiplier display** - `×${(scorePct / 100 + 1).toFixed(1)}` format

### Data Pipeline
- **✅ Real data collection** - `scripts/scrape-rapidapi.js` working
- **✅ Separation of concerns** - Scraper collects, frontend calculates
- **✅ Data structure** - Proper JSON format for leaderboard and sales data
- **✅ Error handling** - Graceful degradation for missing data

### UI Components
- **✅ Leaderboard display** - Ranking with percentage scores
- **✅ Live ticker** - Shows current leaders and activity
- **✅ Real-time updates** - SWR with 60-second refresh
- **✅ Mobile responsive** - Touch-friendly design
- **✅ City modals** - Detailed sales data and charts

### Team Assignment
- **✅ Team names** - `public/team-names.json` with city assignments
- **✅ NFL city focus** - 12 cities correctly mapped

## ❌ What We Need (Missing)

### Competition State Management
- **❌ Competition config** - No centralized config for competition window using standardized UTC timestamps
- **❌ Mode detection** - No Setup/Live/Complete state logic
- **❌ State persistence** - No competition state storage
- **❌ Manual controls** - No admin interface for competition management

### Time-Filtered Scoring
- **❌ Competition date filtering** - `getHighestSaleData()` uses all-time data
- **❌ Sales period validation** - No check if sale occurred during competition
- **❌ Initialization data handling** - T-1 sales not treated specially
- **❌ Historical vs competition data** - No separation of pre/during/post competition
- **❌ Tie-breaker logic** - Scoring doesn't handle ties by comparing sale timestamps

### Data Accumulation
- **❌ Idempotent data accumulation** - Scraper overwrites data and lacks protection against creating duplicate entries on re-runs
- **❌ Defined sale record schema** - No formal schema for accumulated sales, which should include a unique ID, UTC sale timestamp, and a `scrapedAt` timestamp
- **❌ Result freezing** - No end-of-competition snapshot mechanism

### UI State Components
- **❌ Countdown timer** - No time remaining display
- **❌ Mode banners** - No Setup/Live/Complete indicators
- **❌ Competition status** - No visual indication of current phase
- **❌ Time-based messaging** - Ticker doesn't reflect competition timing

### End-Game Features
- **❌ Competition conclusion** - No automatic competition ending
- **❌ Final results** - No `final-results.json` generation
- **❌ Read-only mode** - No post-competition UI lockdown
- **❌ Draft order generation** - No final ranking export

## 🔧 Technical Implementation Gaps

### File: `src/pages/Index.tsx`
**Lines 38-79: `getHighestSaleData()`**
- ✅ Finds highest sale correctly
- ❌ No date filtering for competition period
- ❌ Uses all historical data instead of competition-only
- ❌ No tie-breaker logic to handle sales with identical percentage scores

**Lines 172-218: Sales data processing**
- ✅ Calculates scores properly
- ❌ No competition period validation
- ❌ Processes all sales regardless of timing

### File: `scripts/scrape-rapidapi.js`
**Lines 222-251: Data saving**
- ✅ Saves raw leaderboard data
- ❌ Overwrites data instead of performing an atomic, idempotent accumulation
- ❌ No competition metadata in output
- ❌ No historical preservation
- ❌ Does not add unique identifiers or `scrapedAt` UTC timestamps to records

### Missing Files/Components
- `src/hooks/useCompetitionState.ts` - Competition state management
- `src/components/CompetitionCountdown.tsx` - Timer display
- `src/components/CompetitionBanner.tsx` - Mode indicators
- `public/competition-config.json` - Competition parameters
- `public/final-results.json` - End-game results

## 📊 Implementation Priority Matrix

### High Priority (Core Competition Logic)
1. **Competition state management** - Essential for time-based filtering
2. **Date filtering in scoring** - Critical for competition integrity
3. **Data accumulation** - Prevents data loss during competition

### Medium Priority (User Experience)
4. **Countdown timer** - Important for engagement
5. **Mode banners** - Helps users understand current state
6. **Competition status indicators** - Provides context

### Low Priority (Polish)
7. **End-game automation** - Can be handled manually initially
8. **Admin controls** - Nice to have for competition management
9. **Advanced analytics** - Post-competition features

## 🎯 Recommended Implementation Order

1. **Define Data Schemas** - Finalize the structure for `public/competition-config.json` (with UTC timestamps) and the accumulated sales data format (with unique IDs, UTC sale dates, etc.)
2. **Modify Scraper for Idempotent Accumulation** - Update `scripts/scrape-rapidapi.js` to append new, unique sales records. Implement the "write-to-temp-then-rename" strategy
3. **Create Competition Config** - Create the actual `public/competition-config.json` file with UTC start/end dates
4. **Add Competition State Hook** - Implement `src/hooks/useCompetitionState.ts` to read the config and determine the current mode (`Setup`/`Live`/`Complete`) based on the current time vs. the UTC window
5. **Update Scoring to Filter by Dates & Handle Ties** - Modify `getHighestSaleData()` to consume the state from the hook and implement the tie-breaker logic
6. **Implement UI Components** - Add the countdown timer and mode banners, driven by the state hook
7. **Add End-Game Automation** - Finalize competition conclusion logic

## 📋 Success Criteria

**Phase 1 Complete When:**
- Sales scoring only considers competition-period data
- Competition state properly tracked and displayed
- Data accumulates throughout competition without loss

**Full Implementation Complete When:**
- 14-day competition runs start to finish automatically
- UI reflects current competition state accurately
- Final results generated and preserved correctly
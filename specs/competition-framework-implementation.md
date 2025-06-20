# Competition Framework Implementation Specification

## Document Overview

This specification consolidates the Competition Framework Audit findings with external AI feedback to create a definitive implementation plan. It addresses critical gaps in competition state management, time-based filtering, and data accumulation while incorporating scalability and data integrity improvements.

## Current State Summary

**Implementation Status: 70% Complete**

### ✅ Implemented Components
- 90-day baseline calculation with quality metrics
- Percentage-based scoring formula: `((salePrice - baselineMedian) / baselineMedian) × 100`
- Real data collection via RapidAPI
- Responsive leaderboard UI with real-time updates
- 12 NFL city team assignments

### ❌ Missing Components
- Competition state management (Setup/Live/Complete modes)
- Time-filtered scoring (currently uses all-time data)
- Idempotent data accumulation
- UI state indicators (countdown, mode banners)
- End-game automation

## Competition Timeline

- **Draft Night:** Sunday, June 22, 2025
- **Competition Start:** Monday, June 23, 2025 at 6:00 AM Pacific
- **Competition End:** Sunday, July 6, 2025 at 11:59 PM Pacific
- **Duration:** 14 days
- **Start Mode:** Clean slate (all teams start at 0)

## Critical Implementation Requirements

### 1. Data Schema Definitions

#### Competition Configuration Schema
**File:** `public/competition-config.json`
```json
{
  "competition_id": "2025-summer-derby",
  "name": "Summer 2025 Closing Price Derby",
  "utc_start_timestamp": "2025-06-23T13:00:00.000Z",  // 6:00 AM Pacific
  "utc_end_timestamp": "2025-07-07T06:59:59.999Z",     // 11:59 PM Pacific July 6
  "pacific_start": "2025-06-23T06:00:00",
  "pacific_end": "2025-07-06T23:59:59",
  "draft_night": "2025-06-22",
  "baseline_snapshot_date": "2025-06-22",
  "start_from_zero": true,  // Clean slate - no pre-loaded data
  "cities": [
    "kansas-city", "new-orleans", "green-bay", "nashville",
    "buffalo", "pittsburgh", "cincinnati", "cleveland",
    "jacksonville", "indianapolis", "baltimore", "charlotte"
  ],
  "status": "setup" // setup | live | complete
}
```

#### Sale Record Schema
**Files:** `data/sales-by-city/{city}.json`
```json
{
  "sale_id": "sha256_hash_of_key_properties",
  "address": "123 Main St",
  "city": "chicago",
  "state": "IL",
  "sale_price": 450000,
  "sale_timestamp_utc": "2025-01-05T14:30:00.000Z",
  "scraped_at_utc": "2025-01-05T15:45:00.000Z",
  "source": "rapidapi",
  "bedrooms": 3,
  "bathrooms": 2,
  "square_feet": 1800
}
```

**Justification:** Deterministic IDs prevent duplicates, UTC timestamps ensure consistent time handling, and city-based partitioning improves scalability.

### 2. Time Zone Handling Strategy

#### Problem
JavaScript's `new Date()` interprets date strings differently based on execution environment timezone, creating competition integrity risks.

#### Solution
1. **Investigate RapidAPI Date Format** (IMMEDIATE ACTION)
   - Determine exact format of sale dates from API
   - Document timezone assumptions in source data

2. **Strict UTC Conversion Rules**
   ```javascript
   function convertSourceDateToUTC(sourceDate) {
     // If source provides date-only (e.g., "2025-01-05")
     // Interpret as midnight UTC
     if (/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) {
       return new Date(sourceDate + 'T00:00:00.000Z').toISOString();
     }
     // If source includes time but no timezone
     // Document assumption and convert accordingly
     // ... additional conversion logic
   }
   ```

**Justification:** Prevents sales on competition boundaries from being incorrectly included/excluded due to timezone ambiguity.

### 3. Data Accumulation Architecture

#### Current Problem
- Scraper overwrites data on each run
- No protection against duplicates
- Single monolithic file becomes unwieldy

#### Proposed Solution
```
data/
├── sales-by-city/
│   ├── chicago.json
│   ├── new-york.json
│   ├── los-angeles.json
│   └── ... (one per city)
├── aggregated/
│   ├── leaderboard-snapshot.json
│   └── competition-stats.json
```

#### Scraper Logic (Pseudocode)
```javascript
async function accumulateSalesForCity(city) {
  // 1. Load existing sales
  const existingSales = loadSalesFile(`data/sales-by-city/${city}.json`);
  const existingIds = new Set(existingSales.map(s => s.sale_id));
  
  // 2. Fetch new data
  const apiSales = await fetchFromRapidApi(city);
  
  // 3. Filter and transform
  const newSales = apiSales
    .map(sale => ({
      sale_id: generateDeterministicId(sale),
      ...transformToSchema(sale),
      scraped_at_utc: new Date().toISOString()
    }))
    .filter(sale => !existingIds.has(sale.sale_id));
  
  // 4. Atomic write
  if (newSales.length > 0) {
    const allSales = [...existingSales, ...newSales];
    atomicWriteJson(`data/sales-by-city/${city}.json`, allSales);
  }
}

function generateDeterministicId(sale) {
  const key = `${sale.address}|${sale.city}|${sale.price}|${sale.date}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}
```

**Justification:** City-based partitioning reduces memory usage, deterministic IDs ensure idempotency, atomic writes prevent data corruption.

### 4. Clean Slate Competition Start

#### Implementation Requirements
- **No Pre-loaded Data:** Competition starts with all teams at 0
- **Live Data Collection:** Scraper begins at 6 AM Pacific on June 23
- **Equal Starting Position:** First sales of the day determine initial rankings
- **Display Logic:** Cities without sales show "—" instead of a score

#### Initialization Logic
```javascript
// In competition start handler
async function initializeCompetition() {
  // Do NOT load previous day's data
  // Start with empty sales records for competition period
  const competitionSales = {};
  
  // Begin scraping immediately at start time
  if (currentTime >= competitionStartTime) {
    startScrapingInterval();
  }
}
```

### 5. Competition State Management

#### Hook Implementation
**File:** `src/hooks/useCompetitionState.ts`
```typescript
interface CompetitionState {
  mode: 'setup' | 'live' | 'complete';
  config: CompetitionConfig;
  timeRemaining: number | null;
  startDate: Date;
  endDate: Date;
}

export function useCompetitionState(): CompetitionState {
  const config = useSWR('/competition-config.json');
  const now = new Date();
  
  const startDate = new Date(config.utc_start_timestamp);
  const endDate = new Date(config.utc_end_timestamp);
  
  let mode: CompetitionState['mode'];
  if (now < startDate) mode = 'setup';
  else if (now <= endDate) mode = 'live';
  else mode = 'complete';
  
  const timeRemaining = mode === 'live' 
    ? endDate.getTime() - now.getTime() 
    : null;
  
  return { mode, config, timeRemaining, startDate, endDate };
}
```

### 5. Time-Filtered Scoring with Tie Breakers

#### Updated Logic
**File:** `src/pages/Index.tsx`
```typescript
function getHighestSaleData(city: string, competitionState: CompetitionState) {
  const allSales = salesData[city] || [];
  
  // Filter to competition period only
  const competitionSales = allSales.filter(sale => {
    const saleDate = new Date(sale.sale_timestamp_utc);
    return saleDate >= competitionState.startDate && 
           saleDate <= competitionState.endDate;
  });
  
  // Handle clean slate start - return null if no sales
  if (competitionSales.length === 0) {
    return null; // Display "—" on leaderboard
  }
  
  // Find highest percentage sale with tie-breaker
  return competitionSales.reduce((best, current) => {
    const currentPct = calculatePercentage(current.price, baseline);
    const bestPct = calculatePercentage(best.price, baseline);
    
    if (currentPct > bestPct) return current;
    if (currentPct < bestPct) return best;
    
    // Tie-breaker: earlier sale wins
    const currentDate = new Date(current.sale_timestamp_utc);
    const bestDate = new Date(best.sale_timestamp_utc);
    if (currentDate < bestDate) return current;
    if (currentDate > bestDate) return best;
    
    // Secondary tie-breaker: deterministic by ID
    return current.sale_id < best.sale_id ? current : best;
  });
}
```

**Justification:** Ensures only competition-period sales count, rewards faster action in ties, provides deterministic results.

## Implementation Priority & Timeline

### Phase 1: Data Foundation (Days 1-3)
**Priority: CRITICAL**

1. **Investigate RapidAPI Date Format** ⚡ IMMEDIATE
   - Run test queries to document exact date/time format
   - Implement robust UTC conversion function
   - Add comprehensive date parsing tests

2. **Create Competition Configuration**
   - Define and create `competition-config.json`
   - Set competition dates in UTC
   - Add configuration validation

3. **Implement City-Partitioned Data Schema**
   - Create `data/sales-by-city/` directory structure  
   - Update scraper for deterministic IDs
   - Implement atomic file writes

### Phase 2: Core Competition Logic (Days 4-6)
**Priority: HIGH**

4. **Build Competition State Hook**
   - Implement `useCompetitionState.ts`
   - Add mode detection logic
   - Calculate time remaining

5. **Update Scoring for Time Filtering**
   - Modify `getHighestSaleData()` to use competition dates
   - Implement tie-breaker logic
   - Add unit tests for edge cases

6. **Enhance Data Accumulation**
   - Update scraper for idempotent operation
   - Add duplicate detection
   - Implement city-based processing

### Phase 3: User Experience (Days 7-9)
**Priority: MEDIUM**

7. **Competition UI Components**
   - Create `CompetitionCountdown.tsx`
   - Build `CompetitionBanner.tsx` for mode display
   - Update ticker for competition-aware messaging

8. **Real-time State Updates**
   - Integrate state hook throughout UI
   - Add visual mode indicators
   - Implement countdown timer

### Phase 4: Competition Conclusion (Days 10-11)
**Priority: LOW**

9. **End-Game Automation**
   - Generate `final-results.json` on completion
   - Implement read-only mode
   - Create draft order export

10. **Admin Controls** (Optional)
    - Manual competition state override
    - Result verification tools
    - Data snapshot management

## Known Risks & Mitigations

### 1. Atomic Write Race Condition
**Risk:** Brief 404 during file rename operation
**Mitigation:** Accept as low-probability event; SWR retry handles gracefully
**Status:** Document as known issue, no action required

### 2. Data Growth Over Time
**Risk:** City files grow unbounded
**Mitigation:** Implement data archival post-competition
**Timeline:** Address in future iteration

### 3. Baseline Data Quality
**Risk:** Poor baselines affect competition integrity
**Mitigation:** Already implemented quality metrics in `baselines.json`
**Status:** ✅ Addressed

## Implementation Coverage Checklist

### From Audit - Missing Components Coverage:

#### ✅ Competition State Management
- [x] Competition config schema defined with UTC timestamps
- [x] Mode detection logic in `useCompetitionState` hook
- [x] State persistence via `competition-config.json`
- [ ] Manual admin controls (marked as optional/low priority)

#### ✅ Time-Filtered Scoring
- [x] Competition date filtering in `getHighestSaleData()`
- [x] Sales period validation logic
- [x] Clean slate initialization (no T-1 data)
- [x] Historical vs competition data separation
- [x] Tie-breaker logic with timestamps and IDs

#### ✅ Data Accumulation
- [x] Idempotent accumulation with SHA256 IDs
- [x] Defined sale record schema with all required fields
- [x] Result freezing mechanism in Phase 4
- [x] Atomic write strategy documented

#### ✅ UI State Components
- [x] Countdown timer component (`CompetitionCountdown.tsx`)
- [x] Mode banners (`CompetitionBanner.tsx`)
- [x] Competition status indicators
- [x] Time-based ticker messaging

#### ✅ End-Game Features
- [x] Automatic competition ending at countdown zero
- [x] Final results generation (`final-results.json`)
- [x] Read-only mode implementation
- [x] Draft order export functionality

## Success Metrics

### Phase 1 Complete When:
- [ ] UTC date handling verified and tested
- [ ] Competition config created with proper schema
- [ ] Scraper writes deduplicated data to city files

### Phase 2 Complete When:
- [ ] Sales scoring uses only competition-period data
- [ ] Tie-breaker logic implemented and tested
- [ ] State hook provides accurate mode detection

### Phase 3 Complete When:
- [ ] UI displays current competition state
- [ ] Countdown timer shows accurate time remaining
- [ ] Mode transitions work seamlessly

### Full Implementation Complete When:
- [ ] 14-day competition runs automatically start to finish
- [ ] No data loss or duplication during competition
- [ ] Final results preserved and exportable
- [ ] UI accurately reflects all competition states

## Next Steps

1. **IMMEDIATE:** Test RapidAPI date format and document findings
2. **BY JUNE 20:** Create competition-config.json with June 23 start date
3. **BY JUNE 21:** Complete Phase 1 data foundation tasks
4. **BY JUNE 22:** Implement core competition logic (Phase 2)
5. **JUNE 22 EVENING:** Final testing before draft night
6. **JUNE 23 at 6 AM:** Competition goes live

## Appendix: Technical Decisions

### Why SHA256 for Sale IDs?
- Deterministic: Same sale always generates same ID
- Collision-resistant: Extremely unlikely to have duplicates
- Standard: Well-understood cryptographic function

### Why City-Based Partitioning?
- Reduces memory footprint per operation
- Enables parallel processing
- Natural sharding boundary
- Easier debugging and data inspection

### Why Earlier Sale Wins Ties?
- Rewards quick action in competitive environment
- Aligns with "first-mover advantage" principle
- Clear, understandable rule for participants

This specification provides a complete roadmap for implementing the remaining 30% of the competition framework with enhanced robustness and scalability.
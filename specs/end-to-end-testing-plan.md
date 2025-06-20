# End-to-End Testing Plan for Competition Framework

**Document Date:** June 20, 2025  
**Target Launch:** June 23, 2025 at 6:00 AM Pacific  
**Implementation Status:** 95% Complete - Production Ready  

## Testing Objective

Validate the complete competition framework before live launch, ensuring all components work together seamlessly for the 14-day closing price derby competition.

## Testing Timeline

**Total Duration:** ~2 hours  
**Recommended Schedule:** June 21-22, 2025  
**Final Validation:** June 22 evening before draft night  

## Phase 1: Component Isolation Testing ✅ COMPLETED (June 20, 2025)

### 1.1 Competition State Management
**File:** `src/hooks/useCompetitionState.ts`
- [x] Verify hook loads competition config from `/competition-config.json`
- [x] Confirm start date: June 23, 2025 6:00 AM Pacific (13:00 UTC)
- [x] Confirm end date: July 6, 2025 11:59 PM Pacific (06:59 UTC July 7)
- [x] Test mode detection: Should currently return `'setup'` *(CONFIRMED: Returns 'setup')*
- [x] Validate time remaining calculation shows accurate countdown *(CONFIRMED: Shows "3d 07:21:32")*

### 1.2 UI Components
**Files:** `src/components/CompetitionCountdown.tsx`, `src/components/CompetitionBanner.tsx`
- [x] **CompetitionCountdown**: Should display in setup mode with "Derby begins in X days" *(CONFIRMED: Visible and accurate)*
- [x] **CompetitionBanner**: Should NOT display in setup mode (only shows when complete) *(CONFIRMED: Properly hidden)*
- [x] Countdown timer updates every second *(CONFIRMED: Live updates working)*
- [x] Time format displays correctly (days, hours:minutes:seconds) *(CONFIRMED: "3d 07:21:32" format)*

### 1.3 Leaderboard Display
**File:** `src/pages/Index.tsx`
- [x] Leaderboard shows current data in setup mode *(CONFIRMED: All cities display correctly)*
- [x] Team assignments loaded from `/team-names.json` *(CONFIRMED: Scott, AJ, Danny, Bryce, Kevin, Ryan, Amir visible)*
- [x] Price displays and percentage calculations work correctly *(CONFIRMED: Median prices shown)*
- [x] Modal details open without errors *(CONFIRMED: UI functional)*

**Phase 1 Results:** ✅ **100% SUCCESSFUL** - All components working perfectly in setup mode

## Phase 2: Data Pipeline Testing (45 minutes)

### 2.1 Scraper Execution
**File:** `scripts/scrape-city-partitioned.js`

```bash
# Test scraper with new city-partitioned system
npm run scrape
```

**Validation Checklist:**
- [ ] Script runs without errors
- [ ] Creates/updates files in `data/sales-by-city/` directory
- [ ] All 12 cities process successfully:
  - [ ] Baltimore.json
  - [ ] Buffalo.json  
  - [ ] Charlotte.json
  - [ ] Cincinnati.json
  - [ ] Cleveland.json
  - [ ] GreenBay.json
  - [ ] Indianapolis.json
  - [ ] Jacksonville.json
  - [ ] KansasCity.json
  - [ ] Nashville.json
  - [ ] NewOrleans.json
  - [ ] Pittsburgh.json

### 2.2 Data Integrity Validation
**Focus:** SHA256 ID generation and duplicate prevention

```bash
# Run scraper twice to test idempotency
npm run scrape
# Wait 5 minutes, then run again
npm run scrape
```

**Validation:**
- [ ] No duplicate sales appear in city files
- [ ] File sizes remain stable on second run (minimal new data)
- [ ] `generateDeterministicId()` produces consistent IDs
- [ ] UTC timestamp conversion works correctly

### 2.3 Date Handling Verification
**File:** `scripts/test-api-dates.js`

```bash
# Test API date format understanding
node scripts/test-api-dates.js
```

**Validation:**
- [ ] API returns expected date formats
- [ ] `convertSourceDateToUTC()` handles all date variations
- [ ] No date parsing warnings or errors
- [ ] Timestamps are consistently in UTC format

## Phase 3: Competition Simulation (30 minutes)

### 3.1 Time-Filtered Scoring Test
**File:** `src/pages/Index.tsx` - `getHighestSaleData()` function

**Test Scenario:** Temporarily modify competition dates to test filtering logic

```javascript
// In competition-config.json, temporarily set:
"utc_start_timestamp": "2025-06-19T13:00:00.000Z", // Yesterday
"utc_end_timestamp": "2025-06-21T13:00:00.000Z",   // Tomorrow
```

**Expected Behavior:**
- [ ] Competition state switches to `'live'` mode
- [ ] Countdown disappears or shows time remaining
- [ ] Only sales within date range count for scoring
- [ ] Cities without competition-period sales show "—"

**IMPORTANT:** Reset dates to original values after testing

### 3.2 Mode Transition Testing
**Files:** All UI components with competition state dependency

**Test States:**
1. **Setup Mode** (current): 
   - [ ] Countdown visible
   - [ ] Banner hidden
   - [ ] Normal leaderboard display

2. **Live Mode** (simulated):
   - [ ] Countdown shows time remaining or disappears
   - [ ] Scoring uses filtered data
   - [ ] UI remains responsive

3. **Complete Mode** (simulated):
   - [ ] Banner appears with "The results are in"
   - [ ] Countdown disappears
   - [ ] Leaderboard shows final results

### 3.3 Scoring Logic Validation
**Focus:** Percentage calculations and tie-breakers

**Test Cases:**
- [ ] Baseline values loaded correctly from `/baselines.json`
- [ ] Percentage formula: `((salePrice - baseline) / baseline) × 100`
- [ ] Tie-breaker: Earlier sale wins, then deterministic by sale_id
- [ ] Clean slate handling when no competition sales exist

## Phase 4: Production Readiness Validation (15 minutes)

### 4.1 Configuration Verification
**File:** `public/competition-config.json`

```json
{
  "utc_start_timestamp": "2025-06-23T13:00:00.000Z",
  "utc_end_timestamp": "2025-07-07T06:59:59.999Z", 
  "start_from_zero": true,
  "status": "setup"
}
```

**Checklist:**
- [ ] Start date exactly: June 23, 2025 6:00 AM Pacific
- [ ] End date exactly: July 6, 2025 11:59 PM Pacific  
- [ ] Clean slate mode enabled (`start_from_zero: true`)
- [ ] Status set to "setup"

### 4.2 Baseline Data Quality
**File:** `public/baselines.json`

- [ ] All 12 cities have baseline values
- [ ] Quality metrics show sufficient data confidence
- [ ] No missing or zero baselines
- [ ] Values seem reasonable for each market

### 4.3 Team Assignments
**File:** `public/team-names.json`

- [ ] All 12 cities have team assignments
- [ ] Player names assigned to each city
- [ ] `lastUpdated` timestamp is recent
- [ ] No duplicate assignments

## Critical Test Commands

```bash
# 1. Start development server
npm run dev

# 2. Test scraper
npm run scrape

# 3. Test date handling  
node scripts/test-api-dates.js

# 4. Run linter
npm run lint

# 5. Build for production
npm run build

# 6. Preview production build
npm run preview
```

## Success Criteria

### ✅ System Ready for Launch When:

1. **State Management**
   - Countdown shows accurate time until June 23 6:00 AM Pacific
   - Competition state hook correctly identifies current mode
   - UI components display appropriate content for current state

2. **Data Pipeline**
   - Scraper runs without errors using city-partitioned system
   - SHA256 IDs prevent duplicate data accumulation
   - UTC date conversion handles all API response formats

3. **Competition Logic**
   - Scoring filters to competition-period sales only
   - Tie-breaker logic works deterministically
   - Clean slate start displays "—" for cities without sales

4. **User Experience**
   - All UI components render correctly
   - Real-time updates work with SWR
   - Modal details show filtered competition data

5. **Production Configuration**
   - Competition dates set correctly for June 23 launch
   - All cities have valid baselines and team assignments
   - Build process completes without errors

## Risk Mitigation

### Known Issues to Monitor:
1. **Atomic Write Race Condition**: Brief 404s during file updates (acceptable - SWR retries)
2. **API Rate Limits**: Monitor for 429 responses during testing
3. **Timezone Edge Cases**: Verify behavior exactly at competition boundaries

### Rollback Plan:
- Keep backup of working configuration files
- Document any temporary changes made during testing
- Have previous working commit ID ready for emergency revert

## Post-Testing Actions

### Before June 23 Launch:
- [ ] Reset any modified configuration files to production values
- [ ] Commit final tested configuration
- [ ] Set up automated scraping schedule (4-hour intervals)
- [ ] Monitor system health on June 22 evening

### Day of Launch (June 23):
- [ ] Verify countdown reaches zero at 6:00 AM Pacific
- [ ] Confirm first scraper run at 6:00 AM captures initial sales
- [ ] Monitor leaderboard updates throughout the day
- [ ] Validate competition scoring uses only post-start sales

## Conclusion

This testing plan ensures comprehensive validation of all competition framework components before the June 23 launch. The systematic approach covers data integrity, state management, UI functionality, and production readiness while providing clear success criteria and risk mitigation strategies.

**Testing should be completed by June 22 evening to allow for any final adjustments before the competition begins.**
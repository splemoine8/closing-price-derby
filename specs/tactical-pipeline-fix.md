# Tactical Pipeline Fix - Competition Week

## Executive Summary

With only 7 days remaining in the competition, this plan focuses on **immediate stability** rather than architectural perfection. The goal is to eliminate the critical disk space risk while preserving the exact leaderboard logic that friends are relying on.

## Problem Statement

**Critical Issue**: Unbounded local JSON file growth will eventually crash the Render service
**Timeline Constraint**: Only 7 days left in competition
**Risk Tolerance**: Zero tolerance for leaderboard bugs that could ruin the competition

## Current vs. Target Architecture

### Current (Risky)
```
Redfin API → scrape-city-partitioned.js → Local JSON Files + Supabase (per-city)
                                            ↓
                             aggregate-leaderboard.js → Supabase (blob)
                                            ↓
                                         Frontend
```

**Risk**: Local JSON files grow forever, will crash Render instance

### Target (Stable)
```
Redfin API → scrape-city-partitioned.js → Supabase (per-city JSON only)
                                            ↓
                             aggregate-leaderboard.js → Supabase (blob)
                                            ↓
                                         Frontend
```

**Benefit**: No local files = no disk space issues, same exact output

## Implementation Plan

### Phase 1: Environment Setup & Scraper Changes (Day 1)

**Environment Setup**:
1. Create `.env.test` file with separate test Supabase project credentials
2. Add environment variable toggle: `USE_TEST_SUPABASE=true/false`
3. Update scripts to respect test environment settings

**File**: `cron-worker/scripts/scrape-city-partitioned.js`

**Changes**:
1. Remove all `fs.writeFileSync()` calls that create local JSON files
2. Keep existing Supabase upsert logic unchanged
3. Add environment variable support for test vs production Supabase
4. Add logging to confirm data is being saved to correct Supabase instance

**Validation**:
- Verify city data appears correctly in TEST Supabase after scraper run
- Confirm no local files are created
- Confirm production Supabase remains untouched

### Phase 2: Modify Aggregator (Day 1-2)

**File**: `cron-worker/scripts/aggregate-leaderboard.js`

**Changes**:
1. Replace `loadCitySales()` function to fetch from Supabase instead of local files
2. Keep all aggregation logic exactly the same
3. Ensure final output blob is identical to current system

**Validation**:
- Run both old and new systems on same data
- Assert final leaderboard JSON is byte-for-byte identical
- Test with actual production data

### Phase 3: Deploy and Monitor (Day 2)

**Deployment**:
1. Deploy changes to Render
2. Monitor first few scraper runs
3. Verify leaderboard updates correctly
4. Keep rollback plan ready

**Monitoring**:
- Check Render disk usage (should stop growing)
- Verify leaderboard accuracy
- Monitor for any errors in logs
- Consider adding webhook alert on job failure: `node script.js || curl -X POST <alert-url>`

## Technical Implementation Details

### Modified loadCitySales() Function
```javascript
// OLD: Read from local file
async function loadCitySales(cityName) {
  const filePath = path.join('data', 'sales-by-city', `${cityName}.json`);
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

// NEW: Read from Supabase with fail-fast error handling
async function loadCitySales(cityName) {
  try {
    const sales = await fetchSalesByCity(cityName);
    console.log(`  - Fetched ${sales.length} sales from Supabase for ${cityName}`);
    return sales;
  } catch (error) {
    console.error(`CRITICAL: Failed to fetch sales for ${cityName} from Supabase. Aborting aggregation.`, error);
    // Re-throw the error to halt the script - better to fail completely than generate incorrect leaderboard
    throw error;
  }
}
```

### Scraper Changes
```javascript
// REMOVE: Local file writing
// await fs.writeFile(outputFile, JSON.stringify(validSales, null, 2));

// KEEP: Supabase upsert (already exists)
await upsertCitySales(cityName, validSales);
```

## Risk Assessment

### New Dependencies (Managed)
- **Supabase Availability**: Aggregator now depends on Supabase being available during execution
- **Network Reliability**: Brief outages during aggregation will cause job failure (better than silent corruption)
- **Read Load**: Increased Supabase read operations (low impact given data volume)

### Minimal Risk
- **Data Loss**: Impossible - only changing I/O, not data logic
- **Leaderboard Changes**: None - aggregation logic unchanged
- **Deployment Issues**: Minor - can rollback in minutes

### Critical Safety Measures
- **Fail-Fast Error Handling**: Script fails completely on any Supabase error rather than generating incomplete leaderboard
- **Loud Failures**: All errors logged and halt execution immediately
- **Complete vs Partial Failure**: Better to have no update than wrong update

### Validation Strategy
1. **Pre-deployment**: Test locally with production data copy
2. **Parallel validation**: Run old and new systems, compare outputs
3. **Rollback ready**: Keep old code deployable for instant recovery

## Success Criteria

- ✅ Zero local JSON files created after deployment
- ✅ Render disk usage stops growing
- ✅ Leaderboard updates continue working normally
- ✅ All city data loads correctly from Supabase
- ✅ Friends see no difference in leaderboard behavior

## Timeline

| Task | Duration | Deliverable |
|------|----------|-------------|
| Modify scraper | 4 hours | No local file creation |
| Modify aggregator | 4-6 hours | Supabase-based data loading |
| Local testing | 2 hours | Validation of identical output |
| Deploy & monitor | 2 hours | Production deployment |
| **Total** | **1-2 days** | **Stable system through competition** |

## Post-Competition Plan

After the competition ends (July 7+), implement the full architectural refactor using `/specs/data-pipeline-refactor-plan.md`:

1. **Normalized database tables** instead of JSON blobs
2. **Materialized views** for performance
3. **Data lifecycle management** with automatic cleanup
4. **Single unified script** instead of two-step process

## Key Principle

**"Don't break the leaderboard during competition week"**

This tactical fix eliminates the operational risk while preserving the exact scoring logic that friends trust. The full refactor can wait until after July 7th when there's time to implement and test it properly.

---

*Last updated: June 30, 2025*  
*Document version: 1.0 - Tactical Competition Week Fix*
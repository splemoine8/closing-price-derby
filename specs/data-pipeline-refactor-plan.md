# Data Pipeline Refactor Plan

## Executive Summary

The current real estate data pipeline has significant architectural issues including duplicate data storage, brittle two-step processing, unbounded growth, and no data lifecycle management. This plan outlines a migration to a unified, database-centric architecture that eliminates redundancy, improves reliability, and scales better.

## Current State Analysis

### Current Architecture Issues

1. **Duplicate Data Storage**
   - Same sales data stored in Supabase in two formats (per-city + blob)
   - Inconsistent data states when aggregator fails partway through
   - Using Postgres as simple key-value store, forfeiting relational benefits

2. **Brittle Two-Step Process**
   - `scrape-city-partitioned.js` → `aggregate-leaderboard.js` tight coupling
   - Failure in one component cascades to the other
   - Double the monitoring complexity and failure points

3. **Unbounded Growth**
   - Local JSON files grow forever with no cleanup mechanism
   - Eventually will cause disk space issues on Render
   - Massive files become slow and memory-intensive to process

4. **Mixed Storage Patterns**
   - Some data per-city, some as blobs
   - No consistent querying patterns
   - Difficult to maintain and debug

5. **No Data Lifecycle Management**
   - Old competition data retained indefinitely
   - Bloats database and slows queries
   - Increases storage costs for zero benefit

### Current Data Flow
```
Redfin API → scrape-city-partitioned.js → Local JSON + Supabase (per-city)
                                     ↓
                          aggregate-leaderboard.js → Supabase (blob)
                                     ↓
                                  Frontend
```

## Target Architecture

### New Data Flow
```
Redfin API → process-sales.js → Supabase (normalized table) → Materialized View → Frontend
```

### Core Principles
- **Single Source of Truth**: Supabase as the only data store
- **Database-Centric**: Leverage PostgreSQL's strengths (indexing, querying, aggregation)
- **Idempotent Operations**: Safe to re-run scripts without duplicating data
- **Structured Data**: Normalized tables instead of JSON blobs

## Proposed Schema

### New `sales` Table
```sql
CREATE TABLE sales (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    sale_id TEXT UNIQUE NOT NULL, -- Deterministic SHA256 ID from current system
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    address TEXT NOT NULL,
    sale_price NUMERIC(12, 2) NOT NULL,
    sale_date TIMESTAMPTZ NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    source TEXT DEFAULT 'rapidapi' NOT NULL,
    
    -- Property details
    bedrooms INTEGER,
    bathrooms INTEGER,
    square_feet INTEGER,
    property_url TEXT,
    
    -- Competition tracking
    competition_id TEXT, -- Links to specific competition period
    
    -- Flexible storage for future API fields
    raw_data JSONB
);

-- Performance indexes
CREATE INDEX idx_sales_city_date ON sales(city, sale_date DESC);
CREATE INDEX idx_sales_competition ON sales(competition_id, sale_date DESC);
CREATE INDEX idx_sales_price ON sales(sale_price DESC);
CREATE UNIQUE INDEX idx_sales_unique_id ON sales(sale_id);
```

### Materialized View for Leaderboard
```sql
CREATE MATERIALIZED VIEW leaderboard_current AS
SELECT 
    s.city,
    MAX(s.sale_price) as highest_price,
    MAX(s.address) FILTER (WHERE s.sale_price = (SELECT MAX(sale_price) FROM sales s2 WHERE s2.city = s.city AND s2.competition_id = 'current')) as top_address,
    MAX(s.sale_date) FILTER (WHERE s.sale_price = (SELECT MAX(sale_price) FROM sales s2 WHERE s2.city = s.city AND s2.competition_id = 'current')) as top_sale_date,
    COUNT(*) as total_sales,
    -- Add baseline calculation here when available
    tc.team_name,
    tc.state
FROM sales s
JOIN team_cities tc ON tc.city = s.city
WHERE s.competition_id = 'current'
GROUP BY s.city, tc.team_name, tc.state
ORDER BY highest_price DESC;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW leaderboard_current;
END;
$$;
```

## Migration Plan

### Development Environment Setup

**Prerequisites**:
- Local Supabase instance OR separate Supabase project for testing
- Copy of current production data for local testing
- Environment variables to toggle between old/new systems

### Phase 1: Local Development & Testing (4-5 days)

**Objectives**: Build and thoroughly test new system locally without touching production

**Tasks**:

1. **Set up isolated testing environment**
   - Create new Supabase project for testing OR use local Supabase
   - Copy current production data to test environment
   - Set up environment variables:
     ```bash
     # .env.local
     USE_NEW_PIPELINE=false
     SUPABASE_TEST_URL=your-test-project-url
     SUPABASE_TEST_KEY=your-test-key
     ```

2. **Create new schema in test environment**
   ```sql
   -- Run in TEST Supabase only
   CREATE TABLE sales (...);
   CREATE MATERIALIZED VIEW leaderboard_current AS (...);
   ```

3. **Build new processing script**
   - Create `process-sales-v2.js` alongside existing scripts
   - Implement feature flags to run independently of current system
   - Add comprehensive logging and validation
   - Test with sample Redfin API data

4. **Local validation framework**
   - Create automated tests comparing old vs new output
   - Build data integrity checks
   - Performance benchmarking tools
   - Create sample data generators for edge cases

5. **Comprehensive local testing**
   - Test all 12 cities with historical data
   - Validate leaderboard calculations match current system exactly
   - Test error scenarios (API failures, network issues)
   - Performance testing with full data volume
   - Test data cleanup/lifecycle management

### Phase 2: Production Staging & Validation (2 days)

**Objectives**: Prepare production environment but keep new system disabled

**Tasks**:

1. **Deploy new code to production (disabled)**
   - Deploy new scripts with feature flags OFF
   - Create new tables in production Supabase
   - Ensure zero impact on current system

2. **Backfill production data in new format**
   ```javascript
   // migrate-historical-data.js
   // Run once in production to populate new tables
   // Use existing production data as source
   // Validate against known leaderboard state
   ```

3. **Parallel validation in production**
   - Add optional dual-calculation to existing aggregator
   - Compare results between old and new systems
   - Log discrepancies for investigation
   - Ensure perfect data consistency

### Phase 3: Controlled Production Cutover (1 day)

**Objectives**: Switch to new system with instant rollback capability

**Tasks**:

1. **Feature flag cutover**
   ```javascript
   // Environment variable controls which system runs
   if (process.env.USE_NEW_PIPELINE === 'true') {
     await runNewPipeline();
   } else {
     await runLegacyPipeline();
   }
   ```

2. **Gradual rollout**
   - Enable new system for non-critical endpoints first
   - Monitor for 30 minutes, check error rates
   - Enable for leaderboard if all looks good
   - Full cutover only after validation

3. **Monitoring & rollback plan**
   - Real-time monitoring of new system performance
   - Automated alerts for errors or performance degradation
   - One-click rollback capability via feature flag
   - Keep old system ready for immediate restoration

### Phase 4: Cleanup & Optimization (1 day)

**Objectives**: Remove old system and optimize new one (only after 24+ hours of stable operation)

**Tasks**:
1. **Confirm system stability**
   - 24+ hours of error-free operation
   - Performance metrics meet or exceed targets
   - Zero user-reported issues

2. **Safe cleanup**
   - Archive old data rather than delete
   - Remove old code gradually over several deployments
   - Keep rollback capability for 1 week post-migration

## Implementation Details

### New Processing Script Structure
```javascript
// process-sales.js (unified scraper + aggregator)
async function processCitySales(cityName) {
    // 1. Fetch from Redfin API
    const properties = await fetchSoldProperties(regionId, cityName);
    
    // 2. Transform to new schema
    const salesRecords = properties
        .filter(p => isPropertyValidForCity(p, cityName))
        .map(p => transformToSalesRecord(p, cityName));
    
    // 3. Upsert to database
    const { error } = await supabase
        .from('sales')
        .upsert(salesRecords, { 
            onConflict: 'sale_id', 
            ignoreDuplicates: true 
        });
    
    if (error) {
        // Write to dead letter queue
        await writeFailedBatch(salesRecords, error);
        throw error;
    }
    
    // 4. Refresh materialized view
    await supabase.rpc('refresh_leaderboard');
}
```

### Error Handling Strategy
- **Primary path**: Direct upsert to Supabase
- **Failure path**: Write failed batches to timestamped JSON files
- **Recovery**: Manual script to process failed batches
- **Monitoring**: Log all failures with context for debugging

### Performance Considerations
- **Write volume**: ~4,200 records/day in 48 batches = ~88 records/batch (very light)
- **Read optimization**: Materialized views pre-compute expensive aggregations
- **Indexing strategy**: Composite indexes on (city, date) and (competition_id, date)
- **Data retention**: Auto-cleanup records older than 6 months

## Risk Assessment

### Minimal Risk (due to conservative approach)
- **Data loss**: Eliminated by keeping production untouched until validation complete
- **Extended downtime**: Eliminated by feature flag instant rollback capability
- **Performance issues**: Mitigated by comprehensive local testing and staging validation

### Low Risk
- **Feature flag bugs**: Mitigated by thorough testing and gradual rollout
- **Supabase service limits**: Current volume well within free tier limits
- **Schema evolution needs**: New structure more flexible than current blobs

### Risk Mitigation Strategies
1. **Zero Production Impact**: New system built and tested completely offline
2. **Instant Rollback**: Feature flags allow immediate return to old system
3. **Parallel Validation**: Both systems run side-by-side to ensure identical results
4. **Gradual Deployment**: Non-critical endpoints first, then full system
5. **Extended Monitoring**: 24+ hour stability requirement before cleanup

## Local Testing & Validation Procedures

### Test Environment Setup
```bash
# Create isolated test environment
cp .env .env.test
# Update with test Supabase credentials
# Set USE_NEW_PIPELINE=false initially
```

### Validation Framework
```javascript
// test/validate-pipeline.js
async function validatePipelineEquivalence() {
  // 1. Run both old and new systems on same data
  // 2. Compare leaderboard results exactly
  // 3. Compare sales data structure and content
  // 4. Validate performance metrics
  // 5. Test error handling scenarios
}
```

### Required Test Cases
1. **Data Consistency**: Identical leaderboard results between systems
2. **Performance**: New system meets or exceeds current performance
3. **Error Handling**: Graceful failure modes, no data corruption
4. **Edge Cases**: Missing data, API failures, duplicate sales
5. **Competition Periods**: Accurate date filtering and score calculation
6. **City Filtering**: Proper geographic filtering (including NYC boroughs)

### Success Criteria (must pass before production deployment)
- ✅ 100% identical leaderboard results for last 30 days of data
- ✅ <500ms average response time for leaderboard queries  
- ✅ 0% data loss in error scenarios
- ✅ All 12 cities process correctly with proper filtering
- ✅ Memory usage <50% of current system
- ✅ All automated tests pass with 100% coverage of critical paths

## Success Metrics

### Performance Targets
- Leaderboard page load: <500ms (vs current ~2s with blob processing)
- Sales modal load: <300ms (vs current ~1s)
- Scraper runtime: <5 minutes total (vs current ~10 minutes with aggregation)

### Reliability Targets
- 99.9% uptime during migration
- Zero data loss
- <1% error rate on new upsert operations

### Maintainability Improvements
- Single script vs. two coupled scripts
- Structured queries vs. blob processing
- Automated data cleanup vs. manual intervention

## Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 4-5 days | Complete local development, testing framework, validation |
| Phase 2 | 2 days | Production staging, data backfill, parallel validation |
| Phase 3 | 1 day | Feature flag cutover, monitoring, rollback ready |
| Phase 4 | 1 day | Cleanup after 24+ hours stable operation |
| **Total** | **8-9 days** | Complete migration with comprehensive testing |

### Detailed Timeline

**Phase 1 (Local Development)**
- Day 1-2: Environment setup, schema creation, basic script development
- Day 3-4: Comprehensive testing, validation framework, edge case testing  
- Day 5: Performance testing, documentation, final local validation

**Phase 2 (Production Staging)**
- Day 6: Deploy disabled code, create production tables, backfill data
- Day 7: Parallel validation, data consistency checks, final preparation

**Phase 3 (Cutover)**
- Day 8: Feature flag cutover with monitoring and instant rollback capability

**Phase 4 (Cleanup)**
- Day 9+: Only after 24+ hours of stable operation

## Post-Migration Benefits

1. **Simplified Architecture**: Single script, single data source
2. **Better Performance**: Materialized views vs. blob processing
3. **Improved Reliability**: Idempotent operations, better error handling
4. **Easier Maintenance**: Structured data, standard SQL queries
5. **Cost Optimization**: Automatic data cleanup, efficient storage
6. **Future Flexibility**: Normalized schema supports new features easily

## Next Steps

### Immediate Actions (Before Starting Development)
1. **Review and approve** migration plan and conservative timeline  
2. **Set up test Supabase project** for isolated development
3. **Export current production data** for local testing
4. **Create development branch** for all new pipeline work

### Phase 1 Start (Local Development)
1. **Set up local environment** with test data and new Supabase project
2. **Create new schema** in test environment only
3. **Build validation framework** to compare old vs new systems
4. **Develop new pipeline script** alongside existing production code

### Safety Checkpoints
- ✅ **Checkpoint 1**: Local validation shows 100% identical results
- ✅ **Checkpoint 2**: Performance tests meet all targets  
- ✅ **Checkpoint 3**: Error handling tests pass completely
- ✅ **Checkpoint 4**: Production staging shows perfect data consistency

### Production Deployment Requirements
- All local tests passing for minimum 1 week
- Perfect data consistency validation in staging
- Feature flag infrastructure tested and ready
- Rollback procedures documented and tested
- 24/7 monitoring alerts configured

### Key Principle
**Production remains completely untouched until we have 100% confidence the new system works identically to the current system.**

---

*Last updated: June 30, 2025*  
*Document version: 2.0 - Conservative Migration Approach*
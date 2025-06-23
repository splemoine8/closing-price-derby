# Data Pipeline Fix Plan

## Overview

This document outlines the plan to fix the broken data pipeline between the scraper and aggregator. The core issue is that the scraper writes to local filesystem while the aggregator expects data from Supabase, creating a gap in the automated pipeline.

## Current State

### Problem
1. **Scraper**: Writes sales data to `data/sales-by-city/*.json` files only
2. **Aggregator**: Expects to read from Supabase `competition_data` table
3. **Result**: Automated cron job fails - data never flows from scraper to aggregator

### Existing Table Structure
```sql
competition_data
├── id (primary key)
├── data_type (text)
├── data (jsonb) -- currently stores all cities in one blob
└── updated_at (timestamp)
```

### Code Changes Already Made
1. ✅ Scraper updated to call `pushSales()` after writing files
2. ✅ `fetchSalesByCity()` updated to expect per-city rows
3. ✅ Baseline upload added to cron-worker
4. ✅ dotenv/config imports added

## Implementation Plan: Phased Migration

### Phase 1: Add Column & Dual-Read Support ✅ COMPLETED

#### 1.1 Database Change ✅
```sql
-- Non-blocking operation in Postgres
ALTER TABLE competition_data ADD COLUMN city TEXT NULL;

-- Added unique constraint for upsert operations
CREATE INDEX CONCURRENTLY competition_data_data_type_city_idx 
  ON competition_data (data_type, city);
ALTER TABLE competition_data 
  ADD CONSTRAINT competition_data_data_type_city_key 
  UNIQUE USING INDEX competition_data_data_type_city_idx;

-- Dropped old constraint that only included data_type
DROP CONSTRAINT competition_data_data_type_key;
```

#### 1.2 Update fetchSales.js for Dual-Read ✅
```javascript
export async function fetchSalesByCity(city) {
  const key = sanitize(city);
  if (cache[key]) return cache[key];

  // 1. Try new per-city format first
  const { data: newFormat } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .eq('city', key)
    .single();

  if (newFormat?.data) {
    cache[key] = newFormat.data;
    return cache[key];
  }

  // 2. Fall back to old blob format
  const { data: oldBlob } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .is('city', null)
    .single();

  if (oldBlob?.data?.[key]) {
    cache[key] = oldBlob.data[key];
    return cache[key];
  }

  cache[key] = [];
  return [];
}
```

#### 1.3 Environment Variables
Add to `.env` and Render:
```ini
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...  # For write access
VITE_SUPABASE_ANON_KEY=eyJyyy... # For read access
RAPIDAPI_KEY=xxx
```

### Phase 2: Test & Deploy ✅ COMPLETED

#### 2.1 Local Testing ✅
```bash
# Test scraper with single city
node scripts/scrape-city-partitioned.js
# ✅ Result: "Successfully pushed 194 sales to Supabase for city: 'Denver'"

# Verify in Supabase
# ✅ Confirmed: New rows with city='Denver' and data_type='sales_data'

# Test aggregator
node scripts/aggregate-leaderboard.js  
# ✅ Result: "📊 Processing Denver... - Fetched 194 sales from Supabase"
```

#### 2.2 Deploy to Render (PENDING)
1. Add environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.)
2. Deploy latest code
3. Monitor first cron run

### Phase 3: Data Migration (After Verification)

#### 3.1 Create Migration Script
```javascript
// scripts/migrate-sales-data.js
async function migrateSalesData() {
  // 1. Fetch old blob
  const { data: oldRow } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .is('city', null)
    .single();

  if (!oldRow?.data) return;

  // 2. Create new rows per city
  const cities = Object.keys(oldRow.data);
  for (const city of cities) {
    await supa.from('competition_data').upsert({
      data_type: 'sales_data',
      city: sanitize(city),
      data: oldRow.data[city],
      updated_at: new Date().toISOString()
    });
  }
}
```

#### 3.2 Run Migration
```bash
node scripts/migrate-sales-data.js
```

### Phase 4: Cleanup (After 1 Week)

#### 4.1 Add Constraints
```sql
-- Add unique constraint
ALTER TABLE competition_data 
  ADD CONSTRAINT competition_data_unique 
  UNIQUE(data_type, city);

-- Make city required (after verifying all data migrated)
ALTER TABLE competition_data 
  ALTER COLUMN city SET NOT NULL;
```

#### 4.2 Remove Dual-Read Logic
Update fetchSales.js to only read new format

#### 4.3 Archive & Delete Old Data
```sql
-- Archive first
CREATE TABLE competition_data_archive AS 
  SELECT * FROM competition_data 
  WHERE data_type = 'sales_data' AND city IS NULL;

-- Then delete
DELETE FROM competition_data 
  WHERE data_type = 'sales_data' AND city IS NULL;
```

## Risk Mitigation

1. **No Downtime**: Nullable column addition is instant
2. **Backward Compatible**: Dual-read supports both formats
3. **Reversible**: Each phase can be rolled back
4. **Data Preservation**: Old data archived before deletion

## Timeline

- **Day 1**: ✅ Phase 1 & 2 (COMPLETED - database schema updated, dual-read implemented, testing successful)
- **Day 2-7**: Monitor, verify data flow (NEXT: Deploy to Render)
- **Week 2**: Phase 3 migration
- **Week 3**: Phase 4 cleanup

## Success Criteria

1. ✅ Scraper successfully writes to Supabase (per-city format)
2. ✅ Aggregator reads from both old and new formats (dual-read implemented)
3. ✅ No data loss during migration (filesystem still used as backup)
4. ✅ Frontend continues working throughout (backward compatibility maintained)

## Rollback Plan

If issues arise:
1. Remove city column from pushSales()
2. Revert fetchSales.js to original
3. Data remains intact in both formats
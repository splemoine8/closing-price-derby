# Comprehensive Refactoring Plan - Backend & Frontend

## Overview

This plan addresses critical architectural flaws in both the backend data pipeline and frontend components. The goal is to create a single source of truth in the database, eliminate redundant calculations, and simplify the entire system.

## Current System Flaws

### Backend Issues
1. **Incorrect City Filtering**: `scrape-city-partitioned.js` defaults to accepting ALL properties for non-configured cities
2. **File-Based State**: Relies on JSON files that can be lost on ephemeral filesystems
3. **Inefficient Data Flow**: Stores entire city data as JSON blobs, then re-fetches for calculations

### Frontend Issues
1. **Multiple Data Fetches**: `Index.tsx` makes redundant API calls for leaderboard and sales data
2. **Frontend Business Logic**: Complex calculations (highest sale, deltas, scores) done in React components
3. **Redundant Calculations**: `ZipDetailModal` recalculates scores that should come from backend

## Implementation Plan

### Phase 1: Critical Bug Fix ⏱️ 5 minutes
**Status: [x] Completed**

Fix the city filtering logic to prevent data corruption:

```javascript
// In scripts/scrape-city-partitioned.js - line 153
function isPropertyValidForCity(property, targetCityName) {
  const propertyCity = property.addressInfo?.city;
  if (!propertyCity) return false;

  const targetCity = targetCityName.split(',')[0].trim();
  const cleanPropertyCity = propertyCity.split('(')[0].trim();

  // Special handling for NYC boroughs
  if (targetCity === 'New York' && CITY_FILTER_CONFIG['New York'].allowedCities.some(
      allowedCity => allowedCity.toLowerCase() === cleanPropertyCity.toLowerCase()
    )) {
    return true;
  }

  // DEFAULT: Require exact match for all other cities
  return targetCity.toLowerCase() === cleanPropertyCity.toLowerCase();
}
```

### Phase 2: Database Architecture ⏱️ 2-3 hours
**Status: [ ] Not Started**

#### 2.1 Create New Tables
```sql
-- Cities configuration table
CREATE TABLE cities (
  name TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  baseline_price NUMERIC NOT NULL,
  region_id TEXT NOT NULL,
  state TEXT
);

-- Granular sales data
CREATE TABLE sales (
  sale_id TEXT PRIMARY KEY, -- SHA256 hash of address|city|price|timestamp
  city_name TEXT REFERENCES cities(name),
  address TEXT NOT NULL,
  sale_price NUMERIC NOT NULL,
  sale_timestamp_utc TIMESTAMPTZ NOT NULL,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  square_feet INTEGER,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sales_city_timestamp ON sales(city_name, sale_timestamp_utc DESC);
CREATE INDEX idx_sales_competition_period ON sales(sale_timestamp_utc) 
  WHERE sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z';
```

#### 2.2 Create Leaderboard VIEW
```sql
CREATE OR REPLACE VIEW leaderboard AS
WITH current_highest_sales AS (
  SELECT
    s.city_name,
    s.sale_price,
    s.address as top_sale_address,
    s.sale_timestamp_utc as last_sold_date,
    -- Rank by price desc, then date asc for tie-breaking
    ROW_NUMBER() OVER(
      PARTITION BY s.city_name 
      ORDER BY s.sale_price DESC, s.sale_timestamp_utc ASC
    ) as rank
  FROM sales s
  WHERE s.sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z'
)
SELECT
  c.name as city,
  c.state,
  c.team_name,
  c.baseline_price,
  COALESCE(chs.sale_price, 0) as price,
  -- Calculate score and multiplier in the view
  CASE
    WHEN chs.sale_price > c.baseline_price
    THEN ((chs.sale_price - c.baseline_price) / c.baseline_price) * 100
    ELSE NULL
  END as score_pct,
  CASE
    WHEN chs.sale_price > c.baseline_price AND chs.sale_price <= c.baseline_price * 75
    THEN CONCAT('×', ROUND((chs.sale_price / c.baseline_price)::numeric, 1))
    ELSE '-'
  END as multiplier,
  chs.top_sale_address,
  chs.last_sold_date,
  -- Additional fields for frontend
  CASE 
    WHEN chs.sale_price > 0 THEN chs.sale_price - c.baseline_price
    ELSE 0
  END as price_delta
FROM cities c
LEFT JOIN current_highest_sales chs 
  ON c.name = chs.city_name AND chs.rank = 1
ORDER BY score_pct DESC NULLS LAST;
```

#### 2.3 Create Sales Detail VIEW
```sql
CREATE OR REPLACE VIEW city_sales_detail AS
SELECT 
  city_name,
  address,
  sale_price as price,
  sale_timestamp_utc::date as date,
  bedrooms as beds,
  bathrooms as baths,
  square_feet as sqft,
  url
FROM sales
WHERE sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z'
ORDER BY sale_price DESC, sale_timestamp_utc ASC;
```

### Phase 3: Unified Scraper ⏱️ 1 hour
**Status: [ ] Not Started**

Create `scripts/run-competition-update.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import 'dotenv/config';

const supa = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Generate deterministic ID for deduplication
function generateSaleId(sale) {
  const key = `${sale.address}|${sale.city_name}|${sale.sale_price}|${sale.sale_timestamp_utc}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function main() {
  console.log('🏁 Starting competition data update...');
  
  // 1. Fetch city configurations from database
  const { data: cities, error: citiesError } = await supa
    .from('cities')
    .select('*');
    
  if (citiesError) throw citiesError;
  
  for (const city of cities) {
    console.log(`\n📍 Processing ${city.name}...`);
    
    // 2. Fetch properties from Redfin API
    const properties = await fetchFromRedfin(city.region_id, city.name);
    
    // 3. Transform and filter properties
    const newSales = properties
      .map(p => transformProperty(p, city.name))
      .filter(sale => sale && isValidForCity(sale, city.name));
    
    if (newSales.length > 0) {
      // 4. Add deterministic IDs
      const salesWithIds = newSales.map(sale => ({
        ...sale,
        sale_id: generateSaleId(sale)
      }));
      
      // 5. Upsert to database (ignores duplicates)
      const { error: upsertError } = await supa
        .from('sales')
        .upsert(salesWithIds, { 
          onConflict: 'sale_id',
          ignoreDuplicates: true 
        });
        
      if (upsertError) {
        console.error(`❌ Error upserting sales for ${city.name}:`, upsertError);
      } else {
        console.log(`✅ Processed ${newSales.length} sales for ${city.name}`);
      }
    }
  }
  
  console.log('\n✅ Competition update complete!');
}

main().catch(console.error);
```

### Phase 4: Frontend Simplification ⏱️ 2 hours
**Status: [ ] Not Started**

#### 4.1 Update Index.tsx
**Remove:**
- `getHighestSaleData` function entirely
- Second `useSWR` call for sales data
- Complex `useMemo` calculations
- `useEffect` for data merging

**Add:**
```typescript
// Single data fetch from leaderboard view
const { data: leaderboard } = useSWR(
  'leaderboard',
  () => supabase.from('leaderboard').select('*')
);

// Direct pass-through to components
const displayData = leaderboard || [];
```

#### 4.2 Update ZipDetailModal.tsx
**Remove:**
- Score calculations in `ScoreBreakdown` component
- `actualScorePct` and `actualMultiple` calculations

**Update:**
```typescript
// Receive calculated values as props
interface ZipDetailModalProps {
  city: string;
  state: string;
  scorePct: number;
  multiplier: string;
  topSaleAddress: string;
  // ... other props
}

// Fetch detail sales from view
const { data: salesDetail } = useSWR(
  ['city-sales', city],
  () => supabase
    .from('city_sales_detail')
    .select('*')
    .eq('city_name', city)
    .limit(10)
);
```

#### 4.3 Update useCompetitionData Hook
```typescript
export function useCompetitionData() {
  // Single source of truth
  const { data, error, mutate } = useSWR(
    'competition-leaderboard',
    async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    { refreshInterval: 60000 }
  );
  
  return {
    leaderboard: data || [],
    isLoading: !data && !error,
    error,
    mutate
  };
}
```

### Phase 5: Migration & Testing ⏱️ 1 hour
**Status: [ ] Not Started**

1. **Parallel Testing**
   - [ ] Run both systems simultaneously
   - [ ] Compare outputs for accuracy
   - [ ] Monitor for discrepancies
   - [ ] Verify score calculations match

2. **Cutover Checklist**
   - [ ] Update Render cron job command
   - [ ] Remove JSON file dependencies
   - [ ] Update environment variables
   - [ ] Remove deprecated scripts
   - [ ] Update documentation

## Success Metrics

1. **Data Accuracy**: No more cross-city contamination
2. **Performance**: Single API call instead of multiple
3. **Simplicity**: <50% of current frontend code
4. **Reliability**: No file system dependencies
5. **Real-time**: Always current data from views

## Progress Tracking

- [x] Phase 1: Fix city filtering bug ✅ Completed
- [x] Phase 2: Create database architecture ✅ Migration files created
- [x] Phase 3: Build unified scraper ✅ Completed with backward compatibility
- [x] Phase 4: Simplify frontend ✅ New components created
- [ ] Phase 5: Migrate and test

## Notes

- Keep existing system running during migration
- Test thoroughly before cutting over
- Monitor closely after deployment
- Be ready to rollback if issues arise
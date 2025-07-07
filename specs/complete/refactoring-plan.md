# Competition App Refactoring Plan

## 1. Diagnosis: Current System Flaws

Our current data pipeline for the competition app has three critical architectural flaws that are causing recurring bugs and making maintenance difficult.

### Flaw A: Incorrect City Filtering Logic

The `scrape-city-partitioned.js` script does not correctly enforce a strict city match for all cities. For any city not explicitly configured with special rules (like New York), it defaults to accepting all properties fetched from the API for that region. This is the root cause of incorrect data, such as sales from "Scottsdale" appearing in the "Phoenix" dataset.

### Flaw B: Brittle File-Based State

The entire process relies on multiple `.json` files (`team-names.json`, `baselines.json`, `sales-by-city/*.json`) being present on the Render instance's local filesystem. This is unreliable, as these filesystems can be ephemeral. The single source of truth for all persistent data must be our Supabase database.

### Flaw C: Redundant & Inefficient Data Flow

The current data flow is overly complex and inefficient:

**Scraper** (`scrape-city-partitioned.js`): Reads local JSON files, fetches from the API, merges data, writes back to local JSON files, and then upserts the entire collection of sales for a city as a single JSON blob into a row in Supabase.

**Aggregator** (`aggregate-leaderboard.js`): Reads that same massive JSON blob back from Supabase, only to calculate the leaderboard.

This round-trip is slow, error-prone, and makes debugging difficult.

## 2. Action Plan: The "Right Way" Refactor

We will execute a two-phase plan. First, we will patch the most critical bug to stop immediate data corruption. Second, we will refactor the entire pipeline to be robust, efficient, and maintainable.

### Phase 1: Immediate Bug Fix (Stop the Bleeding)

**Task: Fix the City Filtering Logic**

In `scripts/scrape-city-partitioned.js`, we must modify the `isPropertyValidForCity` function to enforce a strict match by default.

**Current (Buggy) Logic:**

```javascript
// ...
if (Object.prototype.hasOwnProperty.call(CITY_FILTER_CONFIG, targetCity)) {
  // ... special logic for NYC
  return ...;
}
// This is the bug: defaults to true for all other cities
return true;
```

**New (Corrected) Logic:**

```javascript
// In scripts/scrape-city-partitioned.js

function isPropertyValidForCity(property, targetCityName) {
  const propertyCity = property.addressInfo?.city;
  if (!propertyCity) return false;

  const targetCity = targetCityName.split(',')[0].trim(); // "Phoenix, AZ" -> "Phoenix"
  const cleanPropertyCity = propertyCity.split('(')[0].trim(); // Handle "New York (Manhattan)"

  // Special handling for NYC boroughs
  if (targetCity === 'New York' && CITY_FILTER_CONFIG['New York'].allowedCities.some(
      allowedCity => allowedCity.toLowerCase() === cleanPropertyCity.toLowerCase()
    )) {
    return true;
  }

  // Default behavior: require an exact match for all other cities
  if (targetCity.toLowerCase() === cleanPropertyCity.toLowerCase()) {
    return true;
  }

  // If it's not a borough of NYC and not an exact match, it's invalid.
  return false;
}
```

### Phase 2: Long-Term Architectural Refactor

This phase will replace the old, brittle system with a modern, database-centric architecture.

#### Step 1: Redesign Supabase Tables

We will use two primary tables to store all our data, eliminating all `.json` config files.

**`cities` Table:** This will be our configuration source.

- `name` (text, primary key, e.g., "Phoenix")
- `team_name` (text)
- `baseline_price` (numeric)
- `region_id` (text, from the old CITY_REGIONS constant)

**`sales` Table:** This will store granular sales data, with one row per sale.

- `sale_id` (text, primary key, a deterministic SHA256 hash)
- `city_name` (text, foreign key to cities.name)
- `address` (text)
- `sale_price` (numeric)
- `sale_timestamp_utc` (timestamp with time zone)
- `bedrooms` (integer)
- `bathrooms` (numeric)
- `square_feet` (integer)
- `url` (text)

#### Step 2: Create a Single, Unified Scraper Script

We will create a new script, `scripts/run-competition-update.js`, that replaces both `scrape-city-partitioned.js` and `aggregate-leaderboard.js`. This script will be the only one run by our cron job.

**`run-competition-update.js` Logic:**

```javascript
// Pseudocode for the new, unified script

async function main() {
  // 1. Fetch all city configurations from the `cities` table in Supabase.
  const { data: cities, error } = await supa.from('cities').select('*');
  if (error) throw error;

  for (const city of cities) {
    // 2. Fetch new properties from the Redfin API using the city's region_id.
    const properties = await getSoldProperties(city.region_id, city.name);

    // 3. Transform and filter properties into sale records.
    //    - Use the robust city filtering logic from Phase 1.
    //    - Generate the deterministic sale_id for each.
    const newSaleRecords = properties
      .map(p => transformPropertyToSaleRecord(p, city.name))
      .filter(Boolean); // filter out nulls

    if (newSaleRecords.length > 0) {
      // 4. Upsert ONLY the new sales into the `sales` table.
      //    The `onConflict` clause on `sale_id` makes this idempotent.
      //    If a sale already exists, it's ignored.
      await supa.from('sales').upsert(newSaleRecords, { onConflict: 'sale_id', ignoreDuplicates: true });
      console.log(`✅ Upserted ${newSaleRecords.length} new sales for ${city.name}.`);
    }
  }

  console.log('✅ Competition data refresh complete.');
}
```

#### Step 3: Create a Dynamic Leaderboard VIEW in Supabase

This is the most powerful part of the refactor. We will create a database VIEW that calculates the leaderboard on the fly. This eliminates the need for the `aggregate-leaderboard.js` script entirely.

**SQL for leaderboard View:**

```sql
-- Create this VIEW in your Supabase SQL Editor

CREATE OR REPLACE VIEW leaderboard AS

WITH current_highest_sales AS (
  -- Use a window function to find the highest sale for each city within the competition period
  SELECT
    s.city_name,
    s.sale_price,
    s.address as top_sale_address,
    s.sale_timestamp_utc as last_sold_date,
    -- Rank sales by price desc, then date asc for tie-breaking
    ROW_NUMBER() OVER(PARTITION BY s.city_name ORDER BY s.sale_price DESC, s.sale_timestamp_utc ASC) as rank
  FROM
    sales s
  WHERE
    -- Use your competition start/end dates here
    s.sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z'
)

SELECT
  c.name as city,
  c.team_name,
  c.baseline_price,
  COALESCE(chs.sale_price, 0) as price,
  -- Calculate score and multiplier directly in SQL
  CASE
    WHEN chs.sale_price > c.baseline_price
    THEN ((chs.sale_price - c.baseline_price) / c.baseline_price) * 100
    ELSE NULL
  END as score_pct,
  chs.top_sale_address,
  chs.last_sold_date
FROM
  cities c
LEFT JOIN
  current_highest_sales chs ON c.name = chs.city_name AND chs.rank = 1 -- Only join the #1 ranked sale
ORDER BY
  score_pct DESC NULLS LAST;
```

#### Step 4: Final System Updates

**Frontend:** Update the frontend application to fetch its data directly from the new `leaderboard` view in Supabase, instead of reading from static `.json` files.

**Render Cron Job:** Update the cron job's Command to execute the new, single script: `node scripts/run-competition-update.js`.
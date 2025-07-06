# Supabase Database Migrations

## Overview

These migrations implement Phase 2 of the refactoring plan, creating a proper database architecture for the Closing Price Derby competition.

## Migration Files

1. **001_create_cities_and_sales_tables.sql**
   - Creates `cities` table with team assignments, baselines, and region IDs
   - Creates `sales` table for granular property sales data
   - Includes performance indexes

2. **002_create_leaderboard_views.sql**
   - Creates `leaderboard` view with calculated scores and multipliers
   - Creates `city_sales_detail` view for frontend modal data
   - All business logic moved to database layer

## How to Run Migrations

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file in order
4. Run each migration

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Option 3: Direct SQL Connection

```bash
# Using psql
psql -h your-db-host -U postgres -d postgres < 001_create_cities_and_sales_tables.sql
psql -h your-db-host -U postgres -d postgres < 002_create_leaderboard_views.sql
```

## Important Notes

- These migrations will DROP existing tables if they exist
- The `cities` table is populated with actual baseline prices from baselines.json
- The views calculate scores and multipliers automatically
- Competition date range is hardcoded in the views (2025-06-23 to 2025-07-07)

## Testing the Migration

After running migrations, test with:

```sql
-- Check cities data
SELECT * FROM cities;

-- Check if leaderboard view works (will be empty until sales data is added)
SELECT * FROM leaderboard;

-- Insert test sale
INSERT INTO sales (sale_id, city_name, address, sale_price, sale_timestamp_utc) 
VALUES ('test123', 'Phoenix', '123 Test St', 1000000, '2025-06-25T12:00:00Z');

-- Check leaderboard again
SELECT * FROM leaderboard WHERE city = 'Phoenix';
```

## Next Steps

After migrations are complete:
1. Run `scripts/run-competition-update.js` to populate sales data
2. Update frontend to use the new views
3. Test both systems in parallel before full cutover
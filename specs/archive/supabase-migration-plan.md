# Supabase Migration Plan: Render Architecture Fix

**Document Date:** June 20, 2025  
**Status:** In Progress  
**Priority:** Critical (Launch: June 23, 2025)  

## Problem Statement

**Issue Discovered:** Render services have isolated file systems. Our current architecture with separate "Static Site" and "Cron Job" services doesn't work because:

- ✅ Cron job updates JSON files (leaderboard.json, sales-data.json)
- ❌ Static site never sees these updates (separate file system)
- ❌ Competition data remains stale/empty

**Root Cause:** Render's security model isolates services - no shared persistent storage between static sites and background jobs.

## Solution: External Data Storage (Supabase)

**Architecture Change:** Move from file-based to database-based data storage.

### Before (Broken):
```
Cron Job → Updates local JSON files (isolated)
Static Site → Reads local JSON files (different copy)
```

### After (Working):
```
Cron Job → Writes to Supabase database
Static Site → Reads from Supabase database
```

## Implementation Plan

### Phase 1: Supabase Setup ✅ COMPLETED
- [x] Create Supabase account (`whiskeywinter` org)
- [x] Create project (`closing-price-derby`)
- [x] Install client library (`@supabase/supabase-js`)
- [x] Get API credentials (URL + anon key)
- [x] Create database table (`competition_data`)

### Phase 2: Code Migration (IN PROGRESS)

#### 2.1 Database Schema
```sql
CREATE TABLE competition_data (
  id SERIAL PRIMARY KEY,
  data_type VARCHAR(50) NOT NULL,  -- 'leaderboard', 'sales_data', 'baselines'
  data JSONB NOT NULL,             -- The actual JSON data
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2.2 Data Types to Migrate
1. **`leaderboard`** - Main competition leaderboard (was `/public/leaderboard.json`)
2. **`sales_data`** - Detailed sales by ZIP (was `/public/sales-data.json`)
3. **`baselines`** - Market baseline calculations (was `/public/baselines.json`)

#### 2.3 Cron Job Changes (Update Scraper)
**File:** `scripts/scrape-city-partitioned.js`

**Current Logic:**
```javascript
// Write to local files
fs.writeFileSync('public/leaderboard.json', JSON.stringify(leaderboardData));
fs.writeFileSync('public/sales-data.json', JSON.stringify(salesData));
```

**New Logic:**
```javascript
// Write to Supabase
await supabase.from('competition_data').upsert([
  { data_type: 'leaderboard', data: leaderboardData },
  { data_type: 'sales_data', data: salesData }
]);
```

#### 2.4 React App Changes (Update Data Fetching)
**File:** `src/hooks/useCompetitionData.ts`

**Current Logic:**
```javascript
const { data: leaderboardData } = useSWR('/leaderboard.json', fetcher);
```

**New Logic:**
```javascript
const { data: leaderboardData } = useSWR('supabase-leaderboard', () => 
  supabase.from('competition_data').select('data').eq('data_type', 'leaderboard')
);
```

### Phase 3: Environment Variables

#### Development (.env file):
```
RAPIDAPI_KEY=a509d2419fmshc7b0cadf825ab7cp182b5bjsn176e62f79b5c
VITE_OPENWEATHER_API_KEY=ed7a9064438ab0303d56e48bd420f14d
VITE_SUPABASE_URL=[your-project-url]
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

#### Production (Render Environment Variables):
- **Static Site Service:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENWEATHER_API_KEY`
- **Cron Job Service:** `RAPIDAPI_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Phase 4: Testing & Deployment

1. **Local Testing:**
   - Test cron job writes to Supabase
   - Test React app reads from Supabase
   - Verify data persistence across service restarts

2. **Production Deployment:**
   - Deploy updated cron job with Supabase integration
   - Deploy updated static site with Supabase data fetching
   - Verify end-to-end data flow

## Current Status

### ✅ Completed:
- Supabase project created and configured
- Client library installed
- Database table created with proper schema
- RLS policies configured for public read/write access
- API credentials obtained and configured
- Scraper script updated to write to Supabase
- React app updated to read from Supabase with JSON fallback
- End-to-end integration tested successfully
- Data successfully uploaded to Supabase

### 🔄 In Progress:
- Deploy to Render with Supabase integration

### ⏳ Next Steps:
1. **Add environment variables** to both Render services:
   - Static Site: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Cron Job: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `RAPIDAPI_KEY`
2. **Deploy updated code** to Render
3. **Verify production deployment** works with Supabase

## Benefits of This Architecture

### ✅ Immediate Fixes:
- **Persistent data** survives service restarts
- **Shared storage** between all services
- **Real-time updates** - no deployment needed for data changes

### ✅ Future Improvements:
- **Scalable** - proper database backend
- **Real-time subscriptions** - live updates possible
- **Data integrity** - ACID transactions
- **Backup/recovery** - built-in with Supabase
- **API access** - easy to add mobile apps later

## Risk Mitigation

### Rollback Plan:
- Keep current JSON file structure as backup
- Can quickly revert to file-based approach if needed
- Supabase free tier has no vendor lock-in

### Timeline Buffer:
- **3 days to launch** (June 23rd)
- **Migration estimated: 4-6 hours**
- **Buffer: 2+ days for testing/fixes**

## Technical Debt Resolved

This migration fixes several architectural issues:
1. **File system isolation** on Render
2. **Data persistence** across deployments  
3. **Service communication** between cron job and static site
4. **Scalability limitations** of file-based storage

---

**Next Update:** Once credentials are obtained and code migration begins.

**Dependencies:** Supabase project URL and anon key from dashboard.
# Launch Preparation Plan for June 23rd Competition

**Document Date:** June 22, 2025  
**Status:** Pre-Launch  
**Launch Time:** Monday, June 23, 2025 at 6:00 AM Pacific  

## Current State Assessment

### ✅ Completed
- Supabase integration deployed and working
- Team assignments exist for 12 cities 
- Basic cron job infrastructure in place
- Competition framework implemented

### ⚠️ Needs Attention
- Baselines from June 18th (may need refresh for accuracy)
- Competition config in TEST mode with wrong dates
- Cron job runs every 4 hours (needs optimization for competition)
- Cron job calls old script instead of city-partitioned scraper
- Sales data needs to be cleared before launch

## Phase 1: Post-Draft Updates (After draft completion tonight)

### 1.1 Update Team Assignments
- **File:** `public/team-names.json`
- **Action:** Manually edit with final city picks from draft
- **Where:** Local machine, then commit and push
- **Timing:** Immediately after draft completion
- **Note:** May involve more than 12 cities if draft expanded

### 1.2 Recalculate Fresh Baselines
**Where to run:** Local machine (has .env file with RAPIDAPI_KEY)

**Steps:**
1. `npm run calculate-baselines`
2. Verify `public/baselines.json` has updated values
3. Run aggregation to upload to Supabase: `node scripts/aggregate-leaderboard.js`
4. Commit and push changes

**Purpose:** Get current 90-day median prices (last calculated June 18th)
**Verification:** Check that all cities have reasonable baseline values in both JSON file and Supabase

## Phase 2: Competition Configuration (Tonight/Early Tomorrow)

### 2.1 Update Competition Config
**Where:** Local machine, then commit and push

**Steps:**
1. Edit `public/competition-config.json` with these values:
   ```json
   {
     "competition_id": "2025-summer-derby",
     "name": "Summer 2025 Closing Price Derby",
     "utc_start_timestamp": "2025-06-23T13:00:00.000Z",
     "utc_end_timestamp": "2025-07-07T06:59:59.999Z",
     "pacific_start": "2025-06-23T06:00:00",
     "pacific_end": "2025-07-06T23:59:59",
     "start_from_zero": true,
     "status": "setup"
   }
   ```
2. Commit and push changes

### 2.2 Clear Pre-Competition Sales Data
**Where:** Local machine, then push to trigger Supabase update

**Steps:**
1. Clear local sales files: `rm data/sales-by-city/*.json` (creates empty files)
2. Run aggregation to clear Supabase: `node scripts/aggregate-leaderboard.js`
3. Commit and push changes
4. **Verification:** Website should show all cities with "—" scores and baseline values

## Phase 3: Cron Job Optimization 

### 3.1 Render Cron Job Configuration
**Where:** Render Dashboard → Cron Job Service

**Current Setup:** Render runs `npm run scrape` every 4 hours ✅

**Issue:** `npm run scrape` only collects data but doesn't process it for the website

**Required Fix:** Render cron job needs to run BOTH:
1. `npm run scrape` (collects sales data)
2. `node scripts/aggregate-leaderboard.js` (processes data and uploads to Supabase)

**Render Command Update:** Change cron job command to:
```bash
npm run scrape && node scripts/aggregate-leaderboard.js
```

### 3.2 Implement Smart Scheduling  
**Where:** Render Dashboard → Cron Job Service → Schedule

**Competition Hours (6AM-10PM Pacific):**
- Every 30 minutes: `*/30 6-22 * * *`

**Overnight Hours (10PM-6AM Pacific):**
- Every hour: `0 22-5 * * *`

**Note:** May need to create two separate cron jobs in Render for different schedules

### 3.3 Verify Environment Variables
**Where:** Render Dashboard → Cron Job Service → Environment

**Required Variables:**
- `RAPIDAPI_KEY` (for scraping)
- `VITE_SUPABASE_URL` (for data upload)
- `VITE_SUPABASE_ANON_KEY` (for data upload)

## Phase 4: Production Deployment & Launch

### 4.1 Pre-Launch Deployment
**When:** Tonight after all config changes
**Where:** Local machine

**Steps:**
1. Commit all changes: `git add -A && git commit -m "prepare for launch"`
2. Push to trigger deployment: `git push origin percentage-scoring`
3. **Verification:** Check Render dashboard - both services should redeploy
4. **Test:** Visit live site to confirm it shows setup mode with "—" scores

### 4.2 Environment Verification  
**Where:** Render Dashboard → Service Settings → Environment

**Static Site Service needs:**
- ✅ `VITE_SUPABASE_URL` 
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `VITE_OPENWEATHER_API_KEY`

**Cron Job Service needs:**
- ✅ `RAPIDAPI_KEY`
- ✅ `VITE_SUPABASE_URL` 
- ✅ `VITE_SUPABASE_ANON_KEY`

### 4.3 Launch Day Monitoring (June 23rd 6AM)
**Timeline:**
- **6:00 AM:** Competition automatically switches to "live" mode (check website)
- **6:30 AM:** First scheduled scrape should run (check Render logs)
- **7:00 AM:** Verify sales data begins appearing on website
- **All Day:** Monitor Render cron job logs for errors

**Where to Monitor:**
- Live website for data updates
- Render Dashboard → Cron Job Service → Logs
- Supabase Dashboard → Database for data flow

## Key Files to Modify

1. **`public/team-names.json`** - Final draft assignments
2. **`public/competition-config.json`** - Production dates and settings
3. **`scripts/cron.js`** - Optimized scheduling and correct script calls
4. **`public/baselines.json`** - Fresh baseline calculations
5. **`data/sales-by-city/*.json`** - Clear all pre-competition data

## Success Criteria

### Pre-Launch (Setup Mode)
- ✅ All cities display baseline values
- ✅ All cities show "—" scores (no competition data yet)
- ✅ Countdown timer shows time until 6AM Pacific
- ✅ Cron job configured but not collecting competition data

### Launch Day (Live Mode)  
- ✅ Automatic mode switch at 6AM Pacific
- ✅ Cron job begins collecting sales data every 30 minutes
- ✅ Real sales data populates on website after first scrape
- ✅ Supabase integration working for both data reads and writes
- ✅ Live event ticker shows activity as sales come in

## Risk Mitigation

### Backup Plans
- JSON files maintained alongside Supabase for fallback
- Manual aggregation script can be run if cron job fails
- Demo branch available for reference if issues arise

### Monitoring Points
- Render service logs for cron job execution
- Supabase dashboard for data updates
- Website functionality and data display
- API rate limits and error responses

## Quick Execution Checklist

### Tonight (After Draft)
**Local Machine Tasks:**
1. `git checkout percentage-scoring` (make sure you're on the right branch)
2. Edit `public/team-names.json` with final draft results
3. `npm run calculate-baselines` (uses RAPIDAPI_KEY from .env)
4. `node scripts/aggregate-leaderboard.js` (uploads fresh baselines to Supabase)
5. Edit `public/competition-config.json` with production dates and "setup" status
6. `rm data/sales-by-city/*.json` (clear old sales data)
7. `node scripts/aggregate-leaderboard.js` (clear Supabase sales data)
8. `git add -A && git commit -m "prepare for launch"`
9. `git push origin percentage-scoring`

**Render Dashboard Tasks:**
1. Go to Cron Job Service → Command
2. Change from `npm run scrape` to `npm run scrape && node scripts/aggregate-leaderboard.js`
3. Update schedule to `*/30 6-22 * * *` (every 30 min, 6AM-10PM Pacific)
4. Verify environment variables are set (should be ✅ from earlier)

### Launch Day (6AM Pacific)
**Monitoring Only:**
1. Check live website switches to "live" mode at 6AM
2. Check Render logs show cron job running at 6:30AM
3. Check website shows real sales data by 7AM

---

**Next Update:** After draft completion with final city assignments
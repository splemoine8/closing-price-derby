# Launch Preparation Plan for June 23rd Competition

**Document Date:** June 22, 2025  
**Status:** Pre-Launch  
**Launch Time:** Monday, June 23, 2025 at 6:00 AM Pacific  

## Current State Assessment

### ✅ Completed
- Supabase integration deployed and working ✅
- Static site environment variables configured ✅  
- Cron job environment variables configured ✅
- Cron job command updated to `npm run scrape && node scripts/aggregate-leaderboard.js` ✅
- Vite build issues resolved (import paths fixed) ✅
- Baseline data uploaded to Supabase ✅
- **NEW:** Baseline calculation modified to only process drafted cities ✅
- Competition framework implemented ✅

### ⚠️ Needs Attention  
- Team assignments still using test data (needs final draft results)
- Competition config in TEST mode with wrong dates
- Cron job schedule needs optimization for competition hours
- Sales data needs to be cleared before launch
- **NEW:** May need region IDs added if draft includes new cities

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
1. `npm run calculate-baselines` (**NEW:** Now only calculates for drafted cities)
2. Verify `public/baselines.json` has updated values for drafted cities only
3. Run aggregation to upload to Supabase: `node scripts/aggregate-leaderboard.js`
4. Commit and push changes

**Purpose:** Get current 90-day median prices for final drafted cities only  
**Verification:** Check that only drafted cities have baseline values in both JSON file and Supabase

**⚠️ Important:** If draft includes new cities not in `scripts/city-regions.js`, you'll get clear error messages. Add region IDs for new cities first.

### 1.3 Add Region IDs for New Cities (If Needed)
**When:** Only if draft includes cities beyond the current 12 in `city-regions.js`  
**Where:** Local machine

**Current cities with region IDs:**
- Kansas City, New Orleans, Green Bay, Nashville
- Buffalo, Pittsburgh, Cincinnati, Cleveland  
- Jacksonville, Indianapolis, Baltimore, Charlotte

**If new cities drafted:**
1. **Manual lookup:** Use `scripts/update-region-ids.js` to find region IDs
2. **Add to mapping:** Edit `scripts/city-regions.js` with new city entries
3. **Format:** `'City Name, ST': 'region_id'`
4. **Test:** Run `npm run calculate-baselines` to verify mapping works

**Common NFL cities likely to need addition:**
- Phoenix, AZ → Atlanta, GA → Boston, MA → Chicago, IL
- Dallas, TX → Denver, CO → Detroit, MI → Houston, TX  
- Las Vegas, NV → Los Angeles, CA → Miami, FL → Minneapolis, MN
- Philadelphia, PA → San Francisco, CA → Seattle, WA → Tampa Bay, FL

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

**Current Setup:** ✅ Render command updated to `npm run scrape && node scripts/aggregate-leaderboard.js`

**Status:** ✅ Command configuration completed

**Verification:** Cron job now properly:
1. Collects sales data for drafted cities only (`npm run scrape`)
2. Processes and uploads to Supabase (`node scripts/aggregate-leaderboard.js`)

### 3.2 Implement Smart Scheduling  
**Where:** Render Dashboard → Cron Job Service → Schedule

**Competition Hours (6AM-10PM Pacific):**
- Every 30 minutes: `*/30 6-22 * * *`

**Overnight Hours (10PM-6AM Pacific):**
- Every hour: `0 22-5 * * *`

**Note:** May need to create two separate cron jobs in Render for different schedules

### 3.3 Verify Environment Variables
**Where:** Render Dashboard → Cron Job Service → Environment

**Status:** ✅ All variables configured

**Required Variables:**
- ✅ `RAPIDAPI_KEY` (for scraping)
- ✅ `VITE_SUPABASE_URL` (for data upload)
- ✅ `VITE_SUPABASE_ANON_KEY` (for data upload)

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
3. **If new cities:** Add region IDs to `scripts/city-regions.js` if needed
4. `npm run calculate-baselines` (**NEW:** Only calculates for drafted cities)
5. `node scripts/aggregate-leaderboard.js` (uploads fresh baselines to Supabase)
6. Edit `public/competition-config.json` with production dates and "setup" status
7. `rm data/sales-by-city/*.json` (clear old sales data)
8. `node scripts/aggregate-leaderboard.js` (clear Supabase sales data)
9. `git add -A && git commit -m "prepare for launch"`
10. `git push origin percentage-scoring`

**Render Dashboard Tasks:**
1. ✅ **COMPLETED:** Cron job command already updated
2. Update schedule to `*/30 6-22 * * *` (every 30 min, 6AM-10PM Pacific)
3. ✅ **COMPLETED:** Environment variables verified

### Launch Day (6AM Pacific)
**Monitoring Only:**
1. Check live website switches to "live" mode at 6AM
2. Check Render logs show cron job running at 6:30AM
3. Check website shows real sales data by 7AM

---

**Next Update:** After draft completion with final city assignments
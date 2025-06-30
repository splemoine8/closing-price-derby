# Day 1 Testing Checklist

## Pre-Competition Launch (Before 6:00 AM PT)

### Render Deployment Verification
- [ ] **Static site service deployed** and accessible at production URL
- [ ] **Cron worker service deployed** and showing "Deployed" status in Render
- [ ] **Both cron schedules configured correctly**:
  - Day schedule: Every 30 minutes, 6:00 AM - 8:00 PM PT
  - Night schedule: Every 1 hour, 8:00 PM - 6:00 AM PT
- [ ] **Environment variables set** for cron worker (SUPABASE_URL, SUPABASE_ANON_KEY, RAPIDAPI_KEY)
- [ ] **Latest commit deployed** on both services (check commit hash)

### File Synchronization Check
- [ ] **competition-config.json identical** in both root and cron-worker directories
- [ ] **team-names.json identical** in both root and cron-worker directories  
- [ ] **city-regions.js synchronized** between scripts/ and cron-worker/scripts/
- [ ] **Only 12 city files present** in cron-worker/data/sales-by-city/ (no old cities)

### System Status Verification
- [ ] **Frontend loads correctly** at production URL
- [ ] **No React console errors** (check browser dev tools)
- [ ] **Baselines display properly** with correct formatting ($XXXk or $X.XM)
- [ ] **Competition shows "LIVE" status** (not countdown/setup mode)
- [ ] **All 12 drafted cities present** in leaderboard
- [ ] **Team names match draft results** from team-names.json

### Data Pipeline Check
- [ ] **Supabase connection working** (baselines load from Supabase)
- [ ] **Sales data initially empty** (all scores show "—")
- [ ] **Baseline values correct** for all 12 cities:
  - San Francisco: $1.7M
  - Los Angeles: $1.2M  
  - New York: $999K
  - Denver: $635K
  - Miami: $580K
  - Nashville: $528K
  - Dallas: $472K
  - Phoenix: $452K
  - Las Vegas: $436K
  - Tampa: $398K
  - Houston: $376K
  - New Orleans: $289K

## Mid-Day Testing (12:00 PM - 2:00 PM PT)

### Cron Job Verification
- [ ] **First automated scrape completed** (check Render cron logs)
- [ ] **New sales data appears** in frontend within 30 minutes of cron run
- [ ] **Scores calculate correctly** (verify a few manually: score = (sale - baseline) / baseline × 100)
- [ ] **Leaderboard updates automatically** without manual refresh needed
- [ ] **Modal sales details populate** when clicking ZIP codes with sales

### Performance Check
- [ ] **Page load speed acceptable** (< 3 seconds)
- [ ] **Mobile responsiveness working** on phone/tablet
- [ ] **Real-time updates functioning** (SWR polling + Supabase)
- [ ] **No memory leaks** (check browser dev tools performance tab)

## End-of-Day Testing (5:00 PM - 7:00 PM PT)

### Competition Integrity
- [ ] **Multiple sales per city handled correctly** (highest sale score shown)
- [ ] **Team rankings accurate** based on scores
- [ ] **Sales timestamps within competition window** (after 6:00 AM PT start)
- [ ] **Data consistency** between Render dashboard and frontend display

### Error Handling
- [ ] **API failures gracefully handled** (shows cached/fallback data)
- [ ] **Network interruptions don't break site** (SWR error boundaries)
- [ ] **Invalid sales data filtered out** (price > 0, valid addresses)

## Night Schedule Transition (8:00 PM PT)

### Cron Schedule Switchover
- [ ] **Day cron job stops running** at 8:00 PM PT (check logs)
- [ ] **Night cron job starts running** at 8:00 PM PT (1-hour intervals)
- [ ] **No data conflicts** during schedule transition
- [ ] **Night job uses same data pipeline** (scrape → aggregate → Supabase)
- [ ] **Consistent Supabase table updates** from both cron schedules

### Overnight Monitoring Setup
- [ ] **Render cron logs accessible** for overnight debugging
- [ ] **Supabase dashboard monitoring** set up for night updates
- [ ] **RapidAPI rate limits sufficient** for 1-hour interval calls
- [ ] **Error alerts configured** (if available) for failed overnight runs

## Emergency Troubleshooting

### If No Sales Data Appears
1. Check Render cron job logs for scraping errors
2. Verify city-regions.js has correct region IDs
3. Test RapidAPI key still valid and has credits
4. Manual run: `npm run scrape && node scripts/aggregate-leaderboard.js`

### If Scores Are Wrong
1. Check baselines.json matches Supabase baselines table
2. Verify sales data format (sale_price field exists)
3. Test calculation: (sale_price - baseline) / baseline × 100

### If Frontend Breaks
1. Check browser console for React errors
2. Verify competition-config.json status is "live"
3. Test Supabase connection and API keys
4. Fallback to cached JSON files if Supabase fails

### If Cron Jobs Fail
1. **Check both Render services**: static site + cron worker deployment status
2. **Verify environment variables**: SUPABASE_URL, SUPABASE_ANON_KEY, RAPIDAPI_KEY in cron worker
3. **Check cron schedule syntax**: Ensure both day/night schedules are valid cron expressions
4. **Manual trigger test**: Run `npm run scrape && node scripts/aggregate-leaderboard.js` from cron-worker directory
5. **File sync issues**: Compare competition-config.json and team-names.json between directories
6. **RapidAPI quota**: Check if API calls are being rate-limited or quota exceeded

### If Data Stops Updating
1. **Identify which cron job failed**: day schedule (30 min) or night schedule (1 hour)
2. **Check Supabase table permissions**: Ensure cron worker can write to leaderboard, sales_data, baselines tables
3. **Verify city data**: Ensure cron-worker/data/sales-by-city/ has files for all 12 cities
4. **Network connectivity**: Check if Render cron worker can reach external APIs

## Success Criteria for Day 1
- ✅ **Both Render services deployed** and running (static site + cron worker)
- ✅ **Day cron schedule active** (30-minute updates 6 AM - 8 PM PT)
- ✅ **Night cron schedule ready** (1-hour updates 8 PM - 6 AM PT)
- ✅ **First sales data appears** within 2 hours of competition start
- ✅ **Smooth schedule transition** at 8:00 PM PT
- ✅ **No critical errors or downtime** on either service
- ✅ **File synchronization maintained** between directories
- ✅ **Participants can see real-time updates** throughout the day

## Key Monitoring Dashboards
- **Render Dashboard**: 
  - Static site deployment status and logs
  - Cron worker deployment status and execution logs
  - Both day and night cron job schedules
- **Supabase Dashboard**: 
  - Real-time data updates in leaderboard, sales_data, baselines tables
  - API usage and connection monitoring
- **RapidAPI Dashboard**: 
  - Redfin API usage and rate limits
  - Track calls from both day (30min) and night (1hr) schedules

## Critical File Locations
- **Main App**: `/Users/scottlemoine/Documents/Websites/closing-price-derby/`
- **Cron Worker**: `/Users/scottlemoine/Documents/Websites/closing-price-derby/cron-worker/`
- **Must Stay Synced**: competition-config.json, team-names.json, city-regions.js
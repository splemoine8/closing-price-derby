# Production Competition System Plan

## Overview
Transform the current manual real estate leaderboard into a fully automated 14-day competition system with timed periods, automated scraping, and seamless user experience.

## Current System Analysis
- React app displaying real estate leaderboard
- Manual Redfin data scraping via RapidAPI
- Cities ranked by highest sale price
- Live event ticker with rank changes
- Static deployment ready

## Production Requirements
- **Competition Duration:** Single 14-day competition with clear start/end
- **Clean Slate:** All cities start at $0 when competition begins
- **Automated Scraping:** Optimal interval scheduling for real-time updates
- **API Budget:** 35,500 requests/month constraint
- **Countdown Timer:** Real-time period remaining display

## Technical Architecture

### API Budget Optimization
- **Monthly Limit:** 35,500 requests
- **Daily Budget:** ~1,180 requests/day
- **Per Scrape Cost:** ~12 calls (12 cities × 1 call each for sold properties)
- **Maximum Possible:** ~98 scrapes/day (2,958/month)
- **Optimal Frequency:** Every 15-20 minutes during active competition
- **Smart Scheduling:** Higher frequency during business hours

### Data Structure
```
/public/
  competition.json     # Single competition metadata and status
  leaderboard.json     # Live competition leaderboard
  sales-data.json      # Detailed sales information
  results.json         # Final results (created when competition ends)
```

### Deployment Architecture
- **Frontend:** Vercel/Netlify static deployment
- **Automation:** Vercel Cron Functions or GitHub Actions 
- **Storage:** JSON files in Git repo with auto-deployment
- **Competition Management:** Serverless functions for lifecycle
- **Data Integrity:** Distributed locking to prevent race conditions in git-as-database
- **Update Latency:** ~15min intervals + 30s-2min deployment time (acceptable for 14-day competition)

## Implementation Phases

### Phase 1: Competition State Management
**Objective:** Add single competition timer and lifecycle

1. **Competition Metadata System**
   - Create `/public/competition.json`
   - Store: `{ startDate, endDate, status, winner }`
   - Three states: `upcoming`, `active`, `completed`

2. **Countdown Timer Component**
   - Display days/hours/minutes remaining
   - Server timestamps with client-side countdown
   - Timezone handling (UTC storage, local display)
   - Graceful expired competition handling

3. **Competition Status Integration**
   - Update app to check competition status
   - Show appropriate UI for each state
   - Hide/show features based on competition phase

4. **Results System**
   - Generate final results when competition ends
   - Preserve winner and final standings
   - Winner celebration display

**Deliverables:**
- Competition metadata structure
- Countdown timer component
- Status-aware UI updates
- Results generation system

### Phase 2: Automated Scraping Infrastructure
**Objective:** Implement hands-off automated data collection

1. **Serverless Scraping Functions**
   - Convert existing scraper to serverless function
   - Deploy on Vercel Cron or GitHub Actions
   - Environment variable management for API keys
   - **CRITICAL:** Implement distributed locking to prevent race conditions

2. **Smart Scheduling System**
   - Every 15 minutes during business hours (9 AM - 6 PM)
   - Every 30 minutes during evenings/weekends
   - Every 60 minutes overnight (12 AM - 6 AM)
   - Pause scraping when competition ends
   - Budget monitoring and alerts

3. **Competition Lifecycle Automation**
   - Generate final results at competition end
   - Update competition status to completed
   - Stop automated scraping
   - Preserve final leaderboard state

4. **Robust Error Handling**
   - API failure recovery
   - Rate limit management
   - Logging and monitoring
   - Manual override capabilities
   - **NEW:** Concurrent execution prevention with lock mechanisms

**Deliverables:**
- Automated scraping pipeline
- Competition lifecycle automation
- Monitoring and error handling
- Budget optimization system

### Phase 3: Enhanced Competition Experience
**Objective:** Polish and competitive features

1. **Competition Phase UX**
   - Pre-competition: City assignments display, countdown
   - Active: Live leaderboard, real-time updates every 15-30 minutes
   - Post-competition: Winner celebration, final results

2. **Enhanced Live Features**
   - More frequent rank change detection
   - Price milestone celebrations ($1M, $5M, $10M breakthroughs)
   - Time-sensitive notifications (final day excitement)
   - Real-time competition intensity

3. **Admin Controls** (Optional)
   - Manual competition start/end
   - Emergency reset capabilities
   - Scraping control override
   - Competition extension if needed

4. **Results Celebration**
   - Winner announcement with fireworks/confetti
   - Final standings with statistics
   - Competition highlights reel
   - Bragging rights display

**Deliverables:**
- Enhanced real-time experience
- Competition celebration features
- Administrative controls
- Results presentation system

## Competition Flow Design

### Pre-Competition Phase
- Countdown timer to competition start
- City assignments display (already drafted)
- Rules and prize information
- Anticipation building features

### Active Competition Phase
- Live leaderboard updates every 15-30 minutes
- Real-time countdown to competition end
- Frequent rank change notifications
- Price milestone celebrations and alerts

### Post-Competition Phase
- Winner announcement and celebration
- Final standings with detailed statistics
- Competition highlights and memorable moments
- Bragging rights preservation

## Technical Specifications

### Competition Metadata Schema
```json
{
  "name": "Closing Price Derby 2025",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-15T00:00:00Z",
  "status": "active",
  "participants": {
    "Las Vegas": "Leo",
    "Newport Beach": "Bob",
    "Miami Beach": "Sarah"
  },
  "winner": null,
  "prize": "$500"
}
```

### Scraping Schedule
- **Business Hours (9 AM - 6 PM):** Every 15 minutes
- **Evening/Weekend:** Every 30 minutes  
- **Overnight (12 AM - 6 AM):** Every 60 minutes
- **Competition Ended:** Paused

### Error Handling Strategy
- API failure: Retry with exponential backoff
- Rate limiting: Respect limits, adjust schedule
- Data corruption: Validate and restore from backup
- Competition timing: Manual override capabilities

## Success Metrics
- **Automation Reliability:** 99%+ uptime during competitions
- **API Budget Adherence:** Stay within monthly limits
- **User Engagement:** Regular check-ins during competitions
- **Data Freshness:** Updates within target intervals

## Timeline Estimate
- **Phase 1:** 1-2 implementation sessions
- **Phase 2:** 1-2 implementation sessions  
- **Phase 3:** 1 implementation session
- **Testing & Polish:** 1 session

**Total:** 4-6 implementation sessions for complete production system

## Risk Mitigation
- **API Limits:** Monitor usage, implement graceful degradation
- **Competition Timing:** Manual override controls
- **Data Loss:** Regular backups and validation
- **Deployment Issues:** Staged rollout and rollback plans
- **Race Conditions:** Distributed locking mechanism to prevent concurrent scraper runs
- **Deployment Latency:** Accept 15min + 30s-2min deployment time for 14-day competition (consider Vercel KV for future real-time updates)

## Future Enhancements
- Mobile app notifications
- Social media integration
- Advanced analytics and insights
- Multi-league support
- Real-time chat integration
- **Real-time Data Store:** Migrate from git-as-database to Vercel KV for instant updates without deployment latency
- **Hybrid Architecture:** Keep git for audit trail + KV for live data
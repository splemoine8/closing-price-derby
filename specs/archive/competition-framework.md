# Competition Framework Specification

## Overview

The Closing Price Derby is a 14-day competitive real estate tracking game where 12 NFL city markets compete based on their highest property sale prices relative to market baselines.

## Competition Structure

### 1. Pre-Competition Stage

**Draft Night (Sunday, June 22)**
- Each manager is assigned one of the 12 NFL cities (offline, manual update)
- Cities: Kansas City, New Orleans, Green Bay, Nashville, Buffalo, Pittsburgh, Cincinnati, Cleveland, Jacksonville, Indianapolis, Baltimore, Charlotte

**Baseline Establishment**
- System pulls **90-day median sale price** for every city and stores in `baselines.json`
- Baselines are frozen and will not change during competition unless manually reset
- All baselines calculated using same methodology for fairness

**App State: "Setup Mode"**
- Leaderboard shows all teams with "—" (no score yet)
- Global countdown displays: **"Derby begins in … [T-hours : minutes : seconds]"**
- Setup banner visible at top of app

### 2. Kick-Off Day (Monday, June 23 - T = 0)

**Morning Initialization (06:00 Pacific Time)**
- Competition goes live with all teams starting at 0 (no pre-loaded data)
- Scraper begins polling for same-day sales immediately
- App switches to "Live Derby" mode

**Competition Hours**
- From 06:00 Pacific: continuous scraping at determined intervals
- Updates occur throughout the day as new sales data comes in
- All teams start equal - first sales of the day determine initial positions

**App State: "Live Derby Mode"**
- Countdown shows: **"Time remaining … [13 days 23 h 59 m xx s]"**
- Countdown auto-decrements every second
- Live ticker shows real-time updates as sales are recorded

### 3. Scoring Logic

**Formula (Percentage-Based)**
```
scorePct = ((salePrice - baselineMedian) / baselineMedian) × 100
```

**Personal-Best Only System**
- A city's score only rises: new record replaces old if `scorePct` is higher
- Lower scores are ignored (no score decreases)
- Tie-breaker: earlier close date wins
- Cities without records show "—"

**Competition Period Filtering**
- Only sales that close during the 14-day competition period count
- Pre-competition sales (including T-1 initialization) establish starting positions
- Sales outside competition window are ignored for scoring

### 4. 14-Day Derby Flow

**Daily Pattern**
- Morning: owners see spikes from overnight closings
- Throughout day: refresh or watch live ticker for new personal bests
- Scores never drop, so all notifications are positive

**Live Updates**
- Push alerts: "Jacksonville sets a new high: +638%!"
- Ticker rotates: latest records, rank jumps, "last updated" timestamp
- Live countdown always visible

**Data Accumulation**
- Sales data accumulates throughout competition (not replaced)
- Historical record of all competition-period sales maintained
- Detailed sales data available in city modals

### 5. End-of-Game (Sunday, July 6 - T + 14 days, 23:59 Pacific)

**Competition Close**
- Countdown reaches **00:00:00**
- App fires "Derby Complete!" banner
- Standings frozen to `final-results.json`
- UI flips to read-only mode

**Final Results**
- Draft order for fantasy league generated from final ranks
- Competition results preserved for historical reference
- Detailed analytics and city performance summaries available

## Technical Implementation Notes

### Data Pipeline
- **Scraper**: Collects raw sales data, no calculations
- **Frontend**: All scoring calculations and ranking logic
- **Storage**: Accumulating sales data during competition period

### State Management
- Competition dates and current state tracked in config
- Mode detection based on current time vs competition window
- Real-time countdown with second-level precision

### API Integration
- Redfin data via RapidAPI for real sales information
- Rate limiting and error handling for continuous operation
- Backup and recovery for competition data integrity

### User Experience
- Mobile-first design for on-the-go checking
- Real-time updates without manual refresh
- Clear visual indicators for competition state and time remaining
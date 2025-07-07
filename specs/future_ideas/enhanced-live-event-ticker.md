# Enhanced LiveEventTicker Implementation Plan

## Overview
Transform the current basic LiveEventTicker into an engaging, real-time event notification system that shows personalized competition updates using team names and real-time sales data.

## Current State Analysis
- **Data Source**: `leaderboard` view with city rankings, team names, prices, multipliers
- **Sales Table**: Contains sale_price, city_name, sale_timestamp_utc, address  
- **Frontend**: Currently generates basic static events from leaderboard state
- **Update Frequency**: Frontend polls every 60 seconds via SWR
- **Current Events**: Basic leaderboard position updates like "🔥 Miami leads with 2.5x!"

## Proposed Architecture: Database-First Event System

### Core Philosophy
- **Database-First**: All event generation logic runs on Supabase, not client browsers
- **Real-time**: Use Supabase Realtime subscriptions for instant event delivery
- **Personalized**: All messages use team names (e.g., "Kevin" for Los Angeles)
- **Priority-Based**: Critical events (leader changes) show before normal events (velocity)
- **Spam Prevention**: Built-in cooldown system to prevent repetitive messages

## Database Schema Changes

### 1. `competition_events` Table
Primary table for storing all live events with the following structure:
- **id**: Auto-incrementing primary key
- **created_at**: Timestamp for sorting and relative time calculation
- **event_type**: Categories like 'RECORD_SALE', 'RANK_CHANGE', 'VELOCITY', 'MILESTONE'
- **priority**: Integer (1=critical, 2=high, 3=normal) for display ordering
- **message**: User-facing display text with team names and emojis
- **metadata**: JSONB for structured data (sale_id, city_name, old_rank, new_rank)
- **city_name**: For filtering and cooldown logic

### 2. `leaderboard_snapshot` Table
Stores previous leaderboard state for detecting rank changes:
- **city**: Primary key
- **rank_position**: Previous position in leaderboard
- **price**: Previous highest sale price
- **score_pct**: Previous percentage score
- **snapshot_time**: When this snapshot was taken

## Event Generation Logic (Two-Tier Approach)

### Tier 1: Immediate Events (Sales Table Trigger)
**Trigger**: AFTER INSERT on `sales` table
**Events Generated**:
- New record sales for a city
- Milestone achievements (first $10M+ sale, first $20M+ sale)
- Basic velocity checks (3+ sales in last hour)

**Logic**: Simple stateless checks that only need the new sale and current city data

### Tier 2: Complex Events (Scheduled Job - Every 60s)
**Trigger**: pg_cron scheduled function
**Events Generated**:
- Rank changes and position swaps
- Leader changes
- Advanced velocity analysis
- Gap closing events ("Denver now only $5M behind Chicago")

**Logic**: Compares current leaderboard state with previous snapshot, generates events for differences

## Event Types & Priority System

### Priority 1 (Critical) - Always Show First
- New competition leader
- Competition record sales
- Major rank jumps (5+ position changes)

### Priority 2 (High) - Important Updates  
- New record sales for individual cities
- Entering/leaving top 3
- Significant multiplier milestones (×20, ×30, ×40)

### Priority 3 (Normal) - General Activity
- Velocity events ("on fire" with multiple sales)
- Milestone achievements (first $10M+ sale)
- Position changes within same tier

## Spam Prevention & Cooldown System

### Cooldown Rules
- **Velocity Events**: Max 1 per city per hour
- **Record Sales**: No cooldown (always exciting)
- **Rank Changes**: Max 1 per rank change per city
- **Milestone Events**: Once per milestone per city

### Implementation
Before inserting any event, check if similar event exists for same city within cooldown period.

## Frontend Changes

### New Hook: `useLiveEvents()`
**Responsibilities**:
- Fetch initial recent events (last 10-20)
- Subscribe to Supabase Realtime for new events
- Maintain ordered list of events by priority then timestamp
- Handle connection failures gracefully

### Enhanced LiveEventTicker Component
**New Features**:
- Priority-based event display
- Better animations for new events
- Relative timestamp calculation ("2hrs ago")
- Fallback to current system if events table is empty

### Integration Points
- Replace current static event generation in IndexNew.tsx
- Keep existing 10-second rotation timing
- Maintain current styling and animations

## Message Templates & Personalization

### Team Name Integration
All messages should use team names from the leaderboard data instead of city names:
- "🚀 New leader! Kevin (Los Angeles) overtakes Danny (Las Vegas)!"
- "💥 Blockbuster! AJ (Tampa) shatters their record with $10.3M!"

### Message Categories
- **Record Sales**: "🚀 Blockbuster! {team} ({city}) shatters their record with ${price}!"
- **Leader Changes**: "👑 New leader! {team} ({city}) takes the crown!"
- **Rank Changes**: "📈 {team} ({city}) climbs to #{new_rank}!"
- **Velocity**: "🔥 {team} ({city}) on fire with {count} sales in the last hour!"
- **Milestones**: "💰 First ${amount}M+ sale for {team} ({city})!"

## Implementation Steps

### Phase 1: Database Setup
1. Create `competition_events` table with RLS policies
2. Create `leaderboard_snapshot` table
3. Enable Supabase Realtime on `competition_events`

### Phase 2: Backend Logic
1. Implement sales table trigger for immediate events
2. Create scheduled job function for complex events  
3. Add cooldown and priority logic
4. Test event generation with sample data

### Phase 3: Frontend Integration
1. Create `useLiveEvents` hook with Realtime subscription
2. Update LiveEventTicker to use new event system
3. Add priority handling and relative timestamps
4. Implement graceful fallback

### Phase 4: Testing & Refinement
1. Test with historical sales data
2. Verify cooldown system prevents spam
3. Fine-tune message templates and priorities
4. Monitor performance impact

## Success Metrics
- **Engagement**: Users spend more time watching the ticker
- **Real-time Feel**: Events appear within seconds of sales
- **Relevance**: Events feel meaningful and exciting, not repetitive
- **Performance**: No impact on sales insertion speed
- **Reliability**: System works even during high sales volume

## Future Enhancements
- **Streak Tracking**: "That's 3 blockbuster sales in a row for Austin!"
- **Historical Context**: "Biggest sale in Miami since 2019!"
- **Comparative Events**: "Las Vegas just matched San Francisco's top sale!"
- **Volume Milestones**: "Miami just crossed $1B in total sales volume!"
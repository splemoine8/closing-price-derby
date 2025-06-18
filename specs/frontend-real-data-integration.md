# Frontend Real Data Integration

## Overview
Transition the frontend from using test data (`test-leaderboard.json`) to real scraped data (`leaderboard.json`) combined with fixed baseline calculations (`baselines.json`). This enables live competition scoring with actual real estate sales while maintaining fair, fixed baselines.

## Current State

### Data Sources
- **Frontend reads**: `/test-leaderboard.json` (dummy prices with real baselines)
- **Scraper produces**: `/leaderboard.json` (real sales without baselines)
- **Baseline calculator produces**: `/baselines.json` (fixed market medians)
- **Team assignments**: `/team-names.json` (player name assignments for each city)

### Issues with Current Approach
- Test data has artificial high prices ($13.5M sales)
- Real scraped data lacks baseline information for scoring
- Frontend can't use real data without scoring context
- **Duplicate calculations**: ZipDetailModal recalculates scores independently from main leaderboard
- **Performance overhead**: Same scoring logic executed multiple times
- **Consistency risk**: Different components could calculate different values

## Proposed Solution

### Architecture: Single Source of Truth for Calculations
Implement frontend-side data combination with centralized scoring:
1. **Index.tsx becomes calculation hub**: Loads all data sources and performs all scoring calculations
2. **Components become display-only**: Receive pre-calculated scores, no duplicate logic
3. **Single calculation pass**: Scores calculated once, passed to all components
4. **Enhanced data propagation**: Sales data enhanced with pre-calculated multipliers when passed to modals

### Benefits
- **Clean separation of concerns**: Scraper just collects, frontend scores
- **Fixed baselines**: Competition fairness maintained
- **Real-time data**: Live sales reflected immediately
- **No scraper changes**: Existing data pipeline unchanged
- **Single source of truth**: All calculations happen in one place
- **Guaranteed consistency**: Same values displayed across all components
- **Better performance**: No duplicate calculation overhead
- **Easier maintenance**: Single location for scoring logic updates

## Implementation Plan

### Phase 1: Create Custom Data Hook

**Create `src/hooks/useCompetitionData.ts`:**

```typescript
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'

// Types for data sources
type BaselineData = {
  generatedAt: string;
  daysUsed: number;
  minSalesRequired: number;
  baselines: Record<string, number>;
};

type TeamNamesData = {
  lastUpdated: string;
  assignments: Record<string, string>;
};

type ZipStat = {
  zip: string;
  city: string;
  state: string;
  price: number;
  teamName?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useCompetitionData() {
  // Dynamic data - needs refresh
  const { data: leaderboardData, mutate, isLoading: leaderboardLoading, error: leaderboardError } = useSWR<ZipStat[]>(
    '/leaderboard.json',
    fetcher,
    { 
      refreshInterval: 60000,
      onError: (error) => console.error('Failed to load leaderboard data:', error)
    }
  );

  // Static data - immutable during competition
  const { data: baselineData, error: baselineError } = useSWRImmutable<BaselineData>(
    '/baselines.json',
    fetcher
  );

  const { data: teamNamesData, error: teamNamesError } = useSWRImmutable<TeamNamesData>(
    '/team-names.json',
    fetcher
  );

  // Error handling with graceful degradation
  if (baselineError) {
    console.warn('Failed to load baseline data. Multipliers will be unavailable.', baselineError);
  }
  
  if (teamNamesError) {
    console.warn('Failed to load team names data. Using fallback team names.', teamNamesError);
  }

  const isLoading = leaderboardLoading || !leaderboardData;
  const hasAllData = leaderboardData && baselineData && teamNamesData;

  return {
    leaderboardData,
    baselineData,
    teamNamesData,
    mutate,
    isLoading,
    hasAllData,
    errors: {
      leaderboard: leaderboardError,
      baseline: baselineError,
      teamNames: teamNamesError
    }
  };
}
```

### Phase 2: Update Index.tsx with Custom Hook

**Replace existing data fetching in `src/pages/Index.tsx`:**

```typescript
import { useCompetitionData } from '@/hooks/useCompetitionData';

// Replace existing SWR hooks with custom hook
const { 
  leaderboardData, 
  baselineData, 
  teamNamesData, 
  mutate, 
  isLoading, 
  hasAllData,
  errors 
} = useCompetitionData();

// Show toast notifications for data issues
useEffect(() => {
  if (errors.leaderboard) {
    toast.error('Could not load leaderboard – retrying');
  }
  if (errors.baseline) {
    toast.warning('Baseline data unavailable – multipliers will show as "--"');
  }
}, [errors]);
```

### Phase 3: Centralized Data Processing

**Single useMemo for all calculations:**

```typescript
const zipData = useMemo(() => {
  if (!leaderboardData) return [];
  
  const mapped = leaderboardData
    .filter(item => item.price > 0)
    .map((item): ZipCodeData => {
      // Get baseline for this city (graceful degradation)
      const cityName = item.city;
      const baseline = baselineData?.baselines[cityName] || 0;
      
      // Get team name from assignments (graceful degradation)
      const teamName = teamNamesData?.assignments[cityName] || item.teamName || 'Unknown';
      
      // Calculate score and multiplier with fallbacks
      let scorePct = 0;
      let multiplier = '×1.0';
      
      if (baseline > 0) {
        scorePct = ((item.price - baseline) / baseline) * 100;
        multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
      } else if (!baselineData) {
        multiplier = '--'; // Indicates missing baseline data
      }
      
      return {
        rank: 0, // Will be set after sorting
        zipCode: item.zip,
        city: item.city,
        state: item.state,
        teamName: teamName,
        topPrice: item.price,
        priceDelta: 0,
        baseline: baseline,
        scorePct: scorePct,
        multiplier: multiplier
      };
    });
  
  // Sort by score percentage, then by price
  const sorted = mapped.sort((a, b) => {
    if (a.scorePct !== b.scorePct) {
      return (b.scorePct || 0) - (a.scorePct || 0);
    }
    return (b.topPrice || 0) - (a.topPrice || 0);
  });
  
  // Assign ranks
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}, [leaderboardData, baselineData, teamNamesData]);
```

### Phase 4: Remove Duplicate Calculations from Components

**Update ZipDetailModal to be display-only:**

```typescript
// REMOVE these calculation functions from ZipDetailModal:
// - Line 187-189: saleMultiple calculation
// - Line 198-199: actualScorePct and actualMultiple calculations  
// - Line 332-334: Individual sale multiplier calculations

// REPLACE with pre-calculated values passed from parent:
interface ZipDetailModalProps {
  // ... existing props
  baseline?: number;
  highestSaleMultiplier?: string;  // NEW: Pre-calculated from parent
  salesWithMultipliers?: EnhancedSaleData[];  // NEW: Sales with pre-calculated multipliers
}
```

**Enhance sales data with multipliers in Index.tsx:**

```typescript
// Calculate multipliers for all sales when preparing modal data
const getEnhancedSalesData = (zipCode: string, baseline: number) => {
  const sales = salesData?.[zipCode] || [];
  return sales.map(sale => ({
    ...sale,
    multiplier: baseline > 0 
      ? `×${((sale.price - baseline) / baseline + 1).toFixed(1)}` 
      : baselineData ? '×1.0' : '--'  // Show '--' if no baseline data available
  }));
};
```

**Missing Baseline Handling:**
- Console warnings logged automatically in useCompetitionData hook
- Display multipliers as "--" when baseline data unavailable
- Toast notification warns user about missing baseline data
- Cities still shown in leaderboard but with degraded scoring info

### Phase 5: Clean Up

**Remove Test Data Dependencies:**
1. Delete `/public/test-leaderboard.json` after verification
2. Update any references in documentation
3. Remove test data generation from baseline calculator

**Update Comments and Documentation:**
- Update code comments to reflect production data usage
- Update README to document the dual data source approach
- Add error handling for missing data scenarios

## Testing Plan

1. **Verify Data Loading**: Ensure all three data sources load correctly
2. **Score Calculation**: Verify scores match expected values
3. **Calculation Consistency**: Confirm main leaderboard and modal show identical multipliers
4. **Ranking Logic**: Confirm cities sort correctly by performance
5. **Edge Cases**: Test with missing baselines, zero prices, etc.
6. **Performance**: Ensure no lag from calculation centralization
7. **Component Independence**: Verify modal displays work with pre-calculated data

## Migration Steps

1. **Backup current state**: Save test-leaderboard.json for rollback
2. **Deploy changes**: Update Index.tsx with new logic
3. **Verify functionality**: Check scoring and ranking work correctly
4. **Monitor for issues**: Watch for any data mismatches
5. **Clean up**: Remove test data file once stable

## Future Enhancements

### Potential Improvements
- Cache baseline data in localStorage for faster loads
- Add visual indicators for baseline quality/confidence
- Enable baseline refresh for new competition seasons
- Add admin interface for baseline management

### Long-term Considerations
- Consider moving score calculation to a service worker
- Implement baseline versioning for historical tracking
- Add competition phase management (setup vs active)
- Enable multiple baseline strategies (median, average, etc.)

## Team Names Management

### Separate JSON File Architecture

**File**: `/public/team-names.json`
```json
{
  "lastUpdated": "2025-06-18T12:00:00Z",
  "assignments": {
    "Kansas City": "Patrick",
    "New Orleans": "Drew",
    "Green Bay": "Aaron",
    "Nashville": "Derrick",
    "Buffalo": "Josh",
    "Pittsburgh": "TJ",
    "Cincinnati": "Joe",
    "Cleveland": "Myles",
    "Jacksonville": "Trevor",
    "Indianapolis": "Anthony",
    "Baltimore": "Lamar",
    "Charlotte": "Bryce"
  }
}
```

### Benefits of Separate Team Names File

1. **Easy Updates**: Change player names without code deployment
2. **Manual Updates**: Team names refresh when user hits refresh button
3. **Version Tracking**: `lastUpdated` timestamp for change tracking
4. **No Code Changes**: Updates happen through JSON file edits only
5. **Centralized Management**: Single source of truth for team assignments

### Integration with Scraper

The scraper can also read from `/public/team-names.json` to get current assignments, replacing the hardcoded `FRIEND_ASSIGNMENTS` in `city-regions.js`.

## Notes

**Important Considerations:**
- Baselines should remain fixed during active competition
- Frontend scoring allows easy algorithm adjustments
- Team names can be updated independently of code deployments
- Separation of data collection and scoring improves maintainability
- Real-time updates maintain user engagement

**Data Consistency:**
- Ensure scraper city names match baseline city names
- Ensure team name city keys match leaderboard city names
- Handle timezone differences in timestamps
- Validate data types between sources
- Log any data quality issues for monitoring

**Calculation Architecture:**
- All scoring calculations happen once in custom useCompetitionData hook and Index.tsx useMemo
- Components receive pre-calculated values to ensure consistency  
- No duplicate calculation logic across different components
- Single source of truth for all multiplier displays
- useSWRImmutable used for static data (baselines, team names) to prevent unnecessary refetches
- Graceful degradation when baseline or team data unavailable
# Phase 0: Mock Data Testing Specification

## Overview

Phase 0 validates the percentage-based scoring concept using mock baseline data with existing sales. This allows us to test the scoring formula, UI changes, and competitive balance before investing time in real historical data collection.

**Goal**: Prove the percentage scoring approach works with minimal risk and effort.

---

## Tasks Breakdown

### 0.1 Create Mock Baselines (30 minutes)

#### Create `/public/baselines.json`
```json
{
  "lastUpdated": "2025-06-18T00:00:00Z",
  "calculationPeriod": "Mock data for testing - Phase 0",
  "note": "Estimated medians for testing percentage scoring concept",
  "baselines": {
    "Kansas City": {
      "median": 850000,
      "sampleSize": 50,
      "dateRange": "estimated",
      "state": "MO"
    },
    "New Orleans": {
      "median": 720000,
      "sampleSize": 45,
      "dateRange": "estimated",
      "state": "LA"
    },
    "Green Bay": {
      "median": 450000,
      "sampleSize": 35,
      "dateRange": "estimated",
      "state": "WI"
    },
    "Nashville": {
      "median": 950000,
      "sampleSize": 55,
      "dateRange": "estimated",
      "state": "TN"
    },
    "Buffalo": {
      "median": 420000,
      "sampleSize": 40,
      "dateRange": "estimated",
      "state": "NY"
    },
    "Pittsburgh": {
      "median": 380000,
      "sampleSize": 50,
      "dateRange": "estimated",
      "state": "PA"
    },
    "Cincinnati": {
      "median": 400000,
      "sampleSize": 45,
      "dateRange": "estimated",
      "state": "OH"
    },
    "Cleveland": {
      "median": 350000,
      "sampleSize": 40,
      "dateRange": "estimated",
      "state": "OH"
    },
    "Jacksonville": {
      "median": 650000,
      "sampleSize": 50,
      "dateRange": "estimated",
      "state": "FL"
    },
    "Indianapolis": {
      "median": 480000,
      "sampleSize": 55,
      "dateRange": "estimated",
      "state": "IN"
    },
    "Baltimore": {
      "median": 750000,
      "sampleSize": 45,
      "dateRange": "estimated",
      "state": "MD"
    },
    "Carolina": {
      "median": 820000,
      "sampleSize": 50,
      "dateRange": "estimated",
      "state": "NC"
    }
  }
}
```

**Validation**: Check baseline ranges make sense for NFL markets:
- Lowest: Cleveland ($350k) - Rust Belt affordability
- Highest: Nashville ($950k) - Hot growth market
- Range: 2.7x spread creates competitive scoring opportunities

---

### 0.2 Update City Regions Mapping (15 minutes)

#### Modify `scripts/city-regions.js`
Replace existing luxury cities with NFL cities and estimated region IDs:

```javascript
export const CITY_REGIONS = {
  'Kansas City, MO': '6_12345',     // Placeholder - need real region IDs
  'New Orleans, LA': '6_23456',
  'Green Bay, WI': '6_34567',
  'Nashville, TN': '6_45678',
  'Buffalo, NY': '6_56789',
  'Pittsburgh, PA': '6_67890',
  'Cincinnati, OH': '6_78901',
  'Cleveland, OH': '6_89012',
  'Jacksonville, FL': '6_90123',
  'Indianapolis, IN': '6_01234',
  'Baltimore, MD': '6_12346',
  'Charlotte, NC': '6_23457'        // Using Charlotte for Carolina Panthers
};

export const FRIEND_ASSIGNMENTS = {
  'Kansas City, MO': 'Patrick',
  'New Orleans, LA': 'Drew',
  'Green Bay, WI': 'Aaron',
  'Nashville, TN': 'Derrick',
  'Buffalo, NY': 'Josh',
  'Pittsburgh, PA': 'TJ',
  'Cincinnati, OH': 'Joe',
  'Cleveland, OH': 'Myles',
  'Jacksonville, FL': 'Trevor',
  'Indianapolis, IN': 'Anthony',
  'Baltimore, MD': 'Lamar',
  'Charlotte, NC': 'Bryce'
};
```

**Note**: Region IDs are placeholders - we'll get real ones when we implement real data collection.

---

### 0.3 Enhance Scraper for Mock Testing (1 hour)

#### Create scoring functions in `scripts/scrape-rapidapi.js`

```javascript
// Add at top of file
import fs from 'fs/promises';
import path from 'path';

// New function: Load baseline data
async function loadBaselines() {
  try {
    const baselinesPath = path.join(process.cwd(), 'public', 'baselines.json');
    const baselinesData = await fs.readFile(baselinesPath, 'utf8');
    const baselines = JSON.parse(baselinesData);
    return baselines.baselines;
  } catch (error) {
    console.warn('⚠️  No baselines.json found, using price-only scoring');
    return null;
  }
}

// New function: Calculate percentage score
function calculateScore(price, baseline) {
  if (!baseline || baseline <= 0) {
    return { scorePct: 0, multiplier: '×1.0' };
  }
  
  const scorePct = ((price - baseline) / baseline) * 100;
  const multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
  
  return { scorePct: Math.round(scorePct * 10) / 10, multiplier };
}

// New function: Get city baseline
function getCityBaseline(cityName, baselines) {
  if (!baselines) return null;
  
  // Try exact match first
  if (baselines[cityName]) {
    return baselines[cityName].median;
  }
  
  // Try partial match (e.g., "Kansas City" for "Kansas City, MO")
  const cityKey = Object.keys(baselines).find(key => 
    key.toLowerCase().includes(cityName.toLowerCase()) ||
    cityName.toLowerCase().includes(key.toLowerCase())
  );
  
  return cityKey ? baselines[cityKey].median : null;
}
```

#### Modify existing functions

**Update `scrapeAllCities()` function**:
```javascript
async function scrapeAllCities() {
  console.log('🚀 Starting RapidAPI Redfin scraper with percentage scoring...\n');
  
  // Load baselines at start
  const baselines = await loadBaselines();
  if (baselines) {
    console.log('✅ Loaded mock baselines for percentage scoring');
  }
  
  const leaderboard = [];
  const errors = [];
  const allSalesData = {};

  // ... existing city loop logic ...
  
  if (highestSale) {
    const cityName = cityName.split(',')[0].trim(); // Get base city name
    const baseline = getCityBaseline(cityName, baselines);
    const { scorePct, multiplier } = calculateScore(highestSale.price, baseline);
    
    leaderboard.push({
      city: cityName,
      playerName: FRIEND_ASSIGNMENTS[cityName] || 'Unknown Player',
      recentHighest: highestSale.price,
      recentAddress: highestSale.address,
      recentSalesCount: highestSale.salesCount,
      baseline: baseline,              // NEW
      scorePct: scorePct,             // NEW  
      multiplier: multiplier,         // NEW
      lastUpdated: new Date().toISOString(),
      regionId
    });
  }
}
```

**Update sorting logic**:
```javascript
// Sort by score percentage (highest first), fallback to price
leaderboard.sort((a, b) => {
  if (a.scorePct !== b.scorePct) {
    return (b.scorePct || 0) - (a.scorePct || 0);
  }
  return (b.recentHighest || 0) - (a.recentHighest || 0);
});
```

**Update `saveResults()` function**:
```javascript
const frontendData = leaderboard.map(item => ({
  zip: item.city.replace(/\s+/g, ''),
  city: item.city,
  state: item.city.split(',')[1]?.trim() || '',
  teamName: item.playerName,
  price: item.recentHighest,
  baseline: item.baseline,           // NEW
  scorePct: item.scorePct,          // NEW
  multiplier: item.multiplier,      // NEW
  ts: new Date(item.lastUpdated).getTime()
}));
```

---

### 0.4 Test Scoring Logic (30 minutes)

#### Run enhanced scraper
```bash
npm run scrape
```

#### Validate results
Check that:
1. **Baselines loaded**: Console shows "✅ Loaded mock baselines"
2. **Scores calculated**: Leaderboard.json includes scorePct and multiplier fields
3. **Ranking changed**: Cities ranked by percentage, not absolute price
4. **Realistic multipliers**: Scores in reasonable range (×0.5 to ×3.0)

#### Example expected output
```json
[
  {
    "zip": "Cleveland",
    "city": "Cleveland", 
    "state": "OH",
    "teamName": "Myles",
    "price": 875000,
    "baseline": 350000,
    "scorePct": 150.0,
    "multiplier": "×2.5",
    "ts": 1750196971026
  }
]
```

---

### 0.5 Quick Frontend Test (45 minutes)

#### Minimal PriceDisplay update
File: `src/components/PriceDisplay.tsx`

```typescript
interface PriceDisplayProps {
  price: number;
  baseline?: number;
  scorePct?: number;
  multiplier?: string;
}

export function PriceDisplay({ price, baseline, scorePct, multiplier }: PriceDisplayProps) {
  // Show multiplier if available, fallback to price
  if (multiplier && baseline) {
    return (
      <div className="text-right">
        <div className="text-2xl font-bold text-green-600">
          {multiplier}
        </div>
        <div className="text-sm text-gray-500">
          ${price.toLocaleString()}
        </div>
      </div>
    );
  }
  
  // Fallback to existing price display
  return (
    <div className="text-2xl font-bold">
      ${price >= 1000000 ? `${(price / 1000000).toFixed(1)}M` : `${(price / 1000).toFixed(0)}K`}
    </div>
  );
}
```

#### Update ZipCodeCard to pass new props
File: `src/components/ZipCodeCard.tsx`

```typescript
// In component, pass new fields to PriceDisplay:
<PriceDisplay 
  price={data.topPrice}
  baseline={data.baseline}
  scorePct={data.scorePct}
  multiplier={data.multiplier}
/>
```

#### Test in browser
1. Start dev server: `npm run dev`
2. Check leaderboard shows multipliers instead of prices
3. Verify ranking reflects percentage scores
4. Ensure mobile view still works

---

### 0.6 Validation & Feedback (30 minutes)

#### Competitive balance check
- **High multipliers**: Small markets (Cleveland, Pittsburgh) should show high multipliers
- **Low multipliers**: Expensive markets should show lower multipliers  
- **Ranking shift**: Order should change from pure price-based

#### Manual score verification
Pick top 3 cities and manually verify:
```
Score % = (Price - Baseline) ÷ Baseline × 100
Multiplier = ×{(scorePct/100 + 1).toFixed(1)}
```

#### Document findings
Create notes on:
- Which baselines feel too high/low
- Unexpected ranking outcomes
- UI clarity of multiplier display
- Any technical issues

---

## Expected Outcomes

### Success Criteria
- [ ] Mock baselines load successfully
- [ ] Scoring calculations work correctly  
- [ ] Rankings change from price-based to percentage-based
- [ ] Frontend displays multipliers clearly
- [ ] Competitive balance feels more fair

### Potential Issues & Solutions
- **Baselines too high/low**: Adjust estimates and re-test
- **Ranking doesn't change**: Check sorting logic in scraper
- **UI unclear**: Iterate on multiplier display format
- **Cities missing**: Add region ID placeholders

### Decision Points
- Do the baseline estimates feel realistic?
- Is the multiplier format (×1.5) intuitive?
- Does percentage scoring create better competition?
- Are there any technical blockers?

---

## Next Steps

If Phase 0 validates the approach:
1. **Proceed to Phase 1**: Real baseline data collection
2. **Refine estimates**: Adjust any baselines that feel off
3. **UI improvements**: Enhanced score breakdown and tooltips

If Phase 0 reveals issues:
1. **Iterate on baselines**: Adjust estimates
2. **Modify formula**: Consider different scoring approaches  
3. **UI changes**: Improve multiplier display clarity

---

**Time Estimate**: 3-4 hours total
**Risk Level**: Low (no permanent changes, easy rollback)
**Value**: High (validates entire approach quickly)
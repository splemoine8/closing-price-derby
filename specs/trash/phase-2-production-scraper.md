# Phase 2: Production Scraper Enhancement

## Overview

Phase 2 integrates percentage scoring into the production scraper system. This updates the existing `scripts/scrape-rapidapi.js` to calculate percentage scores using baseline data and generate enhanced leaderboard output for the live competition.

**Goal**: Make percentage scoring the default production scoring method while maintaining backward compatibility.

**Prerequisites**: 
- Phase 0 completed successfully 
- Phase 1 baseline data available (real or mock baselines)

---

## Tasks Breakdown

### 2.1 Enhance Production Scraper (2 hours)

#### Modify `scripts/scrape-rapidapi.js`

**Add baseline loading functionality:**

```javascript
// Add at top of file with other imports
import fs from 'fs/promises';
import path from 'path';

// New function: Load baseline data
async function loadBaselines() {
  try {
    const baselinesPath = path.join(process.cwd(), 'public', 'baselines.json');
    const baselinesData = await fs.readFile(baselinesPath, 'utf8');
    const baselines = JSON.parse(baselinesData);
    console.log('✅ Loaded baselines for percentage scoring');
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
  
  return { 
    scorePct: Math.round(scorePct * 10) / 10, 
    multiplier 
  };
}

// New function: Get city baseline from loaded data
function getCityBaseline(cityName, baselines) {
  if (!baselines) return null;
  
  // Try exact match first
  if (baselines[cityName]) {
    return baselines[cityName].median;
  }
  
  // Try partial match for different city formats
  const cityKey = Object.keys(baselines).find(key => 
    key.toLowerCase().includes(cityName.toLowerCase()) ||
    cityName.toLowerCase().includes(key.toLowerCase())
  );
  
  return cityKey ? baselines[cityKey].median : null;
}
```

#### Update main scraping function

**Modify `scrapeAllCities()` function:**

```javascript
async function scrapeAllCities() {
  console.log('🚀 Starting RapidAPI Redfin scraper with percentage scoring...\n');
  
  // Load baselines at start
  const baselines = await loadBaselines();
  if (baselines) {
    const cityCount = Object.keys(baselines).length;
    console.log(`📊 Using ${cityCount} baseline cities for percentage scoring\n`);
  }
  
  const leaderboard = [];
  const errors = [];
  const allSalesData = {};

  // Process each city region
  for (const [cityKey, regionId] of Object.entries(CITY_REGIONS)) {
    const cityName = cityKey.split(',')[0].trim();
    const state = cityKey.split(',')[1]?.trim() || '';
    const friendName = FRIEND_ASSIGNMENTS[cityKey] || 'Unknown';
    
    console.log(`\n🏙️  Processing ${cityName}, ${state} (${friendName})...`);
    
    try {
      // Existing sales fetching logic...
      const salesData = await rapidAPI.fetchRecentSales(regionId);
      
      if (salesData && salesData.length > 0) {
        // Find highest sale (existing logic)
        const highestSale = findHighestSale(salesData);
        
        if (highestSale) {
          // NEW: Calculate percentage score
          const baseline = getCityBaseline(cityName, baselines);
          const { scorePct, multiplier } = calculateScore(highestSale.price, baseline);
          
          // Enhanced leaderboard entry
          leaderboard.push({
            city: cityName,
            state: state,
            playerName: friendName,
            recentHighest: highestSale.price,
            recentAddress: highestSale.address,
            recentSalesCount: salesData.length,
            baseline: baseline,              // NEW
            scorePct: scorePct,             // NEW  
            multiplier: multiplier,         // NEW
            lastUpdated: new Date().toISOString(),
            regionId
          });
          
          // Log percentage score info
          if (baseline) {
            console.log(`   💰 Top sale: $${highestSale.price.toLocaleString()}`);
            console.log(`   📊 Baseline: $${baseline.toLocaleString()}`);
            console.log(`   🎯 Score: ${multiplier} (${scorePct.toFixed(1)}%)`);
          } else {
            console.log(`   💰 Top sale: $${highestSale.price.toLocaleString()} (no baseline)`);
          }
        }
        
        // Store sales data for modals (existing logic)
        allSalesData[cityName.replace(/\s+/g, '')] = salesData.slice(0, 10);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${cityName}:`, error.message);
      errors.push({ city: cityName, error: error.message });
    }
    
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Enhanced sorting: percentage score first, then price
  leaderboard.sort((a, b) => {
    // Primary: Sort by percentage score (highest first)
    if (a.scorePct !== b.scorePct) {
      return (b.scorePct || 0) - (a.scorePct || 0);
    }
    // Secondary: Sort by price (highest first)
    return (b.recentHighest || 0) - (a.recentHighest || 0);
  });
  
  console.log('\n🏆 Final Rankings (Percentage-Based):');
  leaderboard.forEach((city, index) => {
    const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`${rankIcon} #${index + 1}: ${city.city} (${city.playerName}) - ${city.multiplier}`);
  });
  
  await saveResults(leaderboard, allSalesData, errors);
}
```

#### Update data output functions

**Modify `saveResults()` function:**

```javascript
async function saveResults(leaderboard, salesData, errors) {
  // Enhanced frontend data structure
  const frontendData = leaderboard.map((item, index) => ({
    zip: item.city.replace(/\s+/g, ''),
    city: item.city,
    state: item.state,
    teamName: item.playerName,
    price: item.recentHighest,
    baseline: item.baseline,           // NEW
    scorePct: item.scorePct,          // NEW
    multiplier: item.multiplier,      // NEW
    ts: new Date(item.lastUpdated).getTime(),
    lastSoldDate: formatSaleDate(item.lastUpdated), // Convert to friendly format
    topSaleAddress: item.recentAddress  // NEW: Address details
  }));

  // Save leaderboard data
  const leaderboardPath = path.join(process.cwd(), 'public', 'leaderboard.json');
  await fs.writeFile(leaderboardPath, JSON.stringify(frontendData, null, 2));
  
  // Save sales data for modals (existing logic)
  const salesPath = path.join(process.cwd(), 'public', 'sales-data.json');
  await fs.writeFile(salesPath, JSON.stringify(salesData, null, 2));
  
  console.log('\n💾 Results saved:');
  console.log(`   📄 Leaderboard: ${frontendData.length} cities`);
  console.log(`   📊 Sales data: ${Object.keys(salesData).length} city datasets`);
  
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.length} cities failed`);
    errors.forEach(error => {
      console.log(`      - ${error.city}: ${error.error}`);
    });
  }
}

// Helper function for date formatting
function formatSaleDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}
```

---

### 2.2 Backward Compatibility Testing (1 hour)

#### Test with existing frontend

1. **Run enhanced scraper**:
   ```bash
   npm run scrape
   ```

2. **Verify output structure**:
   - [ ] `/public/leaderboard.json` contains new fields (baseline, scorePct, multiplier)
   - [ ] Existing fields preserved (zip, city, state, teamName, price, ts)
   - [ ] Sales data structure unchanged
   - [ ] Cities ranked by percentage score when baselines available

3. **Test frontend compatibility**:
   ```bash
   npm run dev
   ```
   
   **Check that**:
   - [ ] Leaderboard loads without errors
   - [ ] Multipliers display correctly (if PriceDisplay updated in Phase 0)
   - [ ] Price fallback works for cities without baselines
   - [ ] Modals still function with sales data

#### Expected output example

**Enhanced `/public/leaderboard.json`**:
```json
[
  {
    "zip": "GreenBay",
    "city": "Green Bay",
    "state": "WI",
    "teamName": "Aaron",
    "price": 2800000,
    "baseline": 450000,
    "scorePct": 522.2,
    "multiplier": "×6.2",
    "ts": 1750196971026,
    "lastSoldDate": "Jun 18, 2025",
    "topSaleAddress": "1234 Lambeau Dr"
  },
  {
    "zip": "Cleveland",
    "city": "Cleveland", 
    "state": "OH",
    "teamName": "Myles",
    "price": 1800000,
    "baseline": 350000,
    "scorePct": 414.3,
    "multiplier": "×5.1",
    "ts": 1750196985975,
    "lastSoldDate": "Jun 18, 2025",
    "topSaleAddress": "5678 Lake Ave"
  }
]
```

---

### 2.3 Error Handling & Edge Cases (45 minutes)

#### Handle missing baseline scenarios

**Add fallback logic for cities without baseline data**:

```javascript
// In calculateScore function, add logging for missing baselines
function calculateScore(price, baseline) {
  if (!baseline || baseline <= 0) {
    console.log(`   ⚠️  No baseline available, using price-only scoring`);
    return { scorePct: 0, multiplier: '×1.0' };
  }
  
  const scorePct = ((price - baseline) / baseline) * 100;
  const multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
  
  return { 
    scorePct: Math.round(scorePct * 10) / 10, 
    multiplier 
  };
}

// In main scraping loop, handle mixed scoring scenarios
if (baseline) {
  console.log(`   🎯 Percentage scoring: ${multiplier}`);
} else {
  console.log(`   💲 Price-only scoring: $${highestSale.price.toLocaleString()}`);
}
```

#### Handle extreme score values

**Add bounds checking for reasonable multipliers**:

```javascript
function calculateScore(price, baseline) {
  if (!baseline || baseline <= 0) {
    return { scorePct: 0, multiplier: '×1.0' };
  }
  
  const scorePct = ((price - baseline) / baseline) * 100;
  
  // Bounds checking for display purposes
  let multiplier;
  if (scorePct > 999) {
    multiplier = '×10.0+';  // Cap display at 10x+
  } else if (scorePct < -90) {
    multiplier = '×0.1';    // Floor at 0.1x
  } else {
    multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
  }
  
  return { 
    scorePct: Math.round(scorePct * 10) / 10, 
    multiplier 
  };
}
```

#### Add comprehensive logging

**Enhanced console output for debugging**:

```javascript
// At end of scrapeAllCities function
console.log('\n📈 Scoring Summary:');
console.log('===================');

const withBaselines = leaderboard.filter(city => city.baseline);
const withoutBaselines = leaderboard.filter(city => !city.baseline);

console.log(`Cities with percentage scoring: ${withBaselines.length}`);
console.log(`Cities with price-only scoring: ${withoutBaselines.length}`);

if (withBaselines.length > 0) {
  const scores = withBaselines.map(city => city.scorePct);
  console.log(`Score range: ${Math.min(...scores).toFixed(1)}% to ${Math.max(...scores).toFixed(1)}%`);
}
```

---

### 2.4 Production Deployment Prep (30 minutes)

#### Update npm scripts

**Add to `package.json`**:
```json
{
  "scripts": {
    "scrape": "node scripts/scrape-rapidapi.js",
    "scrape:test": "node scripts/phase0-test-scoring.js",
    "collect-baselines": "node scripts/collect-baselines.js"
  }
}
```

#### Create backup and rollback procedure

**Backup current scraper**:
```bash
cp scripts/scrape-rapidapi.js scripts/scrape-rapidapi-v1-backup.js
```

**Document rollback steps** in `ROLLBACK.md`:
```markdown
# Scraper Rollback Procedure

## Quick Rollback
1. Restore backup: `cp scripts/scrape-rapidapi-v1-backup.js scripts/scrape-rapidapi.js`
2. Run original scraper: `npm run scrape`
3. Verify output: Check that leaderboard.json has original structure

## Frontend Fallback
- Frontend automatically uses price field if percentage fields missing
- No frontend changes needed for rollback
```

#### Validate production readiness

**Final checklist**:
- [ ] Enhanced scraper produces valid JSON output
- [ ] Baseline loading works with both real and mock data
- [ ] Error handling covers API failures and missing data
- [ ] Logging provides clear feedback on scoring method used
- [ ] Backward compatibility maintained with existing frontend
- [ ] Rollback procedure documented and tested

---

## Expected Outcomes

### Success Criteria
- [ ] Production scraper integrates percentage scoring seamlessly
- [ ] Output includes both percentage and price data for compatibility
- [ ] Cities with baselines use percentage ranking
- [ ] Cities without baselines fall back to price ranking
- [ ] No breaking changes to existing functionality

### Enhanced Data Structure
The scraper will now generate leaderboard data with:
- **Backward compatible**: All existing fields preserved
- **Enhanced scoring**: New baseline, scorePct, multiplier fields
- **Mixed scoring**: Handles cities with and without baseline data
- **Detailed logging**: Clear feedback on scoring calculations

### Performance Considerations
- **Baseline loading**: One-time file read at script start
- **Score calculation**: Lightweight math operation per city
- **No API overhead**: Uses existing sales data for calculations
- **Same output frequency**: Maintains existing 4-hour scraping schedule

---

## Risk Mitigation

### Calculation Errors
- **Risk**: Incorrect percentage math affecting rankings
- **Mitigation**: Comprehensive logging and manual verification process
- **Testing**: Compare results with Phase 0 test scoring

### Missing Baseline Data
- **Risk**: Some cities lacking baseline data
- **Mitigation**: Graceful fallback to price-only scoring
- **Detection**: Clear logging when baseline missing

### Data Structure Changes
- **Risk**: Breaking existing frontend functionality
- **Mitigation**: Backward compatibility maintained
- **Rollback**: Simple restore of backup scraper

### API Rate Limiting
- **Risk**: Additional baseline loading causing rate limits
- **Mitigation**: Baseline loaded from local file, not API
- **Monitoring**: Existing rate limiting preserved

---

## Testing Validation

### Manual Verification Steps
1. **Score calculation**: Manually verify top 3 city calculations
2. **Ranking logic**: Confirm percentage scores sort correctly
3. **Fallback behavior**: Test cities without baseline data
4. **Frontend compatibility**: Verify no breaking changes

### Data Quality Checks
- **Reasonable multipliers**: Values between ×0.1 and ×10.0
- **Ranking changes**: Different from pure price-based ranking
- **Consistent output**: Same data structure every run
- **Error handling**: Graceful handling of missing/bad data

---

## Next Steps

### If Phase 2 Successful
1. **Proceed to Phase 3**: Enhanced frontend components
2. **Monitor production**: Watch for any scoring issues
3. **Baseline updates**: Implement periodic baseline refresh

### If Issues Arise
1. **Quick rollback**: Restore v1 scraper backup
2. **Debug and fix**: Address specific calculation issues
3. **Iterate**: Refine scoring logic based on findings

---

**Time Estimate**: 4 hours total  
**Risk Level**: Low-Medium (existing functionality preserved)  
**Value**: High (enables production percentage scoring)

---

*This phase transforms the core data generation system to support percentage-based competition while maintaining full backward compatibility and easy rollback options.*
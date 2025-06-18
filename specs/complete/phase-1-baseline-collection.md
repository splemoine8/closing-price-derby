# Phase 1: Real Baseline Data Collection

## Overview

Phase 1 transitions from mock baseline data to real historical median prices collected via RapidAPI. This creates accurate percentage scoring based on actual 90-day market medians for the selected NFL cities.

**Goal**: Replace mock baselines with real historical data to enable fair percentage-based competition.

**Prerequisites**: Phase 0 completed successfully with percentage scoring system validated.

---

## Tasks Breakdown

### 1.1 Create Baseline Collection Script (2 hours)

#### Create `scripts/collect-baselines.js`

```javascript
import { RapidAPI } from './rapidapi-client.js';
import { CITY_REGIONS, FRIEND_ASSIGNMENTS } from './city-regions.js';
import fs from 'fs/promises';
import path from 'path';

const rapidAPI = new RapidAPI();

// Calculate date range for 90-day lookback
function getDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

// Collect historical sales for a city
async function collectCityBaseline(cityName, regionId) {
  console.log(`📊 Collecting baseline for ${cityName}...`);
  
  const { startDate, endDate } = getDateRange();
  
  try {
    // Fetch 90 days of sales data
    const salesData = await rapidAPI.fetchRecentSales(regionId, {
      startDate,
      endDate,
      limit: 1000 // Get more data for better median calculation
    });
    
    if (!salesData || salesData.length === 0) {
      console.warn(`⚠️  No sales data found for ${cityName}`);
      return null;
    }
    
    // Filter valid sales (remove $0 and extreme outliers)
    const validSales = salesData
      .filter(sale => sale.price > 50000 && sale.price < 50000000)
      .map(sale => sale.price)
      .sort((a, b) => a - b);
    
    if (validSales.length < 10) {
      console.warn(`⚠️  Insufficient data for ${cityName}: ${validSales.length} sales`);
      return null;
    }
    
    // Calculate median
    const medianIndex = Math.floor(validSales.length / 2);
    const median = validSales.length % 2 === 0
      ? Math.round((validSales[medianIndex - 1] + validSales[medianIndex]) / 2)
      : validSales[medianIndex];
    
    console.log(`✅ ${cityName}: $${median.toLocaleString()} median (${validSales.length} sales)`);
    
    return {
      median,
      sampleSize: validSales.length,
      dateRange: `${startDate} to ${endDate}`,
      rawSales: validSales // For validation
    };
    
  } catch (error) {
    console.error(`❌ Failed to collect baseline for ${cityName}:`, error.message);
    return null;
  }
}

// Main collection function
async function collectAllBaselines() {
  console.log('🏟️  Collecting real baseline data for NFL cities\\n');
  
  const { startDate, endDate } = getDateRange();
  const baselines = {};
  const collectionLog = [];
  
  // Process each city
  for (const [cityKey, regionId] of Object.entries(CITY_REGIONS)) {
    const cityName = cityKey.split(',')[0].trim();
    const state = cityKey.split(',')[1]?.trim() || '';
    
    const baseline = await collectCityBaseline(cityName, regionId);
    
    if (baseline) {
      baselines[cityName] = {
        median: baseline.median,
        sampleSize: baseline.sampleSize,
        dateRange: baseline.dateRange,
        state: state
      };
      
      collectionLog.push({
        city: cityName,
        success: true,
        median: baseline.median,
        sampleSize: baseline.sampleSize
      });
    } else {
      collectionLog.push({
        city: cityName,
        success: false,
        error: 'Insufficient data or API error'
      });
    }
    
    // Rate limiting: wait between API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Generate baseline file
  const baselineData = {
    lastUpdated: new Date().toISOString(),
    calculationPeriod: `90-day median (${startDate} to ${endDate})`,
    collectionMethod: "RapidAPI Redfin historical sales",
    baselines
  };
  
  // Save to public directory
  const outputPath = path.join(process.cwd(), 'public', 'baselines.json');
  await fs.writeFile(outputPath, JSON.stringify(baselineData, null, 2));
  
  // Summary report
  console.log('\\n📋 Baseline Collection Summary:');
  console.log('================================');
  
  const successful = collectionLog.filter(log => log.success);
  const failed = collectionLog.filter(log => !log.success);
  
  console.log(`✅ Successful: ${successful.length}/${collectionLog.length} cities`);
  
  if (successful.length > 0) {
    console.log('\\nSuccessful Collections:');
    successful.forEach(log => {
      console.log(`   ${log.city}: $${log.median.toLocaleString()} (${log.sampleSize} sales)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\\n❌ Failed Collections:');
    failed.forEach(log => {
      console.log(`   ${log.city}: ${log.error}`);
    });
  }
  
  const medians = successful.map(log => log.median);
  if (medians.length > 0) {
    console.log(`\\n📊 Baseline Range:`);
    console.log(`   Lowest: $${Math.min(...medians).toLocaleString()}`);
    console.log(`   Highest: $${Math.max(...medians).toLocaleString()}`);
    console.log(`   Spread: ${(Math.max(...medians) / Math.min(...medians)).toFixed(1)}x`);
  }
  
  console.log(`\\n💾 Baselines saved to: ${outputPath}`);
  
  return baselineData;
}

// Export for testing
export { collectAllBaselines, collectCityBaseline };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectAllBaselines().catch(console.error);
}
```

#### Create collection npm script

Add to `package.json`:
```json
{
  "scripts": {
    "collect-baselines": "node scripts/collect-baselines.js"
  }
}
```

---

### 1.2 Update City Regions with Real Region IDs (1 hour)

#### Research and validate region IDs

**Manual verification process**:
1. Use RapidAPI Redfin search to find correct region IDs for each NFL city
2. Test API calls with each region ID to ensure data returns
3. Verify region boundaries match intended market areas

#### Update `scripts/city-regions.js`

Replace placeholder region IDs with real ones discovered through API testing:

```javascript
export const CITY_REGIONS = {
  'Kansas City, MO': '6_real_id_1',     // Replace with actual region ID
  'New Orleans, LA': '6_real_id_2',
  'Green Bay, WI': '6_real_id_3',
  'Nashville, TN': '6_real_id_4',
  'Buffalo, NY': '6_real_id_5',
  'Pittsburgh, PA': '6_real_id_6',
  'Cincinnati, OH': '6_real_id_7',
  'Cleveland, OH': '6_real_id_8',
  'Jacksonville, FL': '6_real_id_9',
  'Indianapolis, IN': '6_real_id_10',
  'Baltimore, MD': '6_real_id_11',
  'Charlotte, NC': '6_real_id_12'      // Carolina Panthers
};
```

**Note**: If any city lacks sufficient data or has incorrect region ID, document for manual baseline estimation.

---

### 1.3 Execute Baseline Collection (30 minutes)

#### Run collection script

```bash
npm run collect-baselines
```

#### Validate collection results

**Success criteria**:
- [ ] At least 10/12 cities have successful baseline collection
- [ ] Sample sizes are adequate (>20 sales per city preferred)
- [ ] Baseline range is reasonable (no extreme outliers)
- [ ] Generated `baselines.json` has correct structure

**Expected output example**:
```json
{
  "lastUpdated": "2025-06-18T15:30:00Z",
  "calculationPeriod": "90-day median (2025-03-20 to 2025-06-18)",
  "collectionMethod": "RapidAPI Redfin historical sales",
  "baselines": {
    "Kansas City": {
      "median": 425000,
      "sampleSize": 47,
      "dateRange": "2025-03-20 to 2025-06-18",
      "state": "MO"
    },
    "New Orleans": {
      "median": 380000,
      "sampleSize": 32,
      "dateRange": "2025-03-20 to 2025-06-18",
      "state": "LA"
    }
    // ... all successful cities
  }
}
```

#### Handle collection failures

**If cities fail to collect baseline data**:

1. **Check region ID**: Verify correct region for that market
2. **Manual estimation**: Use real estate websites to estimate median
3. **Neighbor approximation**: Use similar nearby market baseline
4. **Document**: Note which baselines are estimated vs. calculated

**Manual baseline template**:
```json
"Green Bay": {
  "median": 280000,
  "sampleSize": 0,
  "dateRange": "estimated - insufficient API data",
  "state": "WI",
  "note": "Estimated from Zillow market data"
}
```

---

### 1.4 Data Quality Validation (45 minutes)

#### Baseline reasonableness check

**Validation steps**:
- [ ] Compare baselines to known market data (Zillow, Realtor.com)
- [ ] Check that expensive markets (Nashville, Baltimore) have higher baselines
- [ ] Verify affordable markets (Cleveland, Buffalo) have lower baselines
- [ ] Look for obvious outliers or data errors

#### Manual calculation verification

**Pick 2-3 cities and manually verify**:
1. Download raw sales data from RapidAPI for verification
2. Calculate median manually using spreadsheet
3. Compare with script output
4. Investigate any significant discrepancies

#### Sample size analysis

**Evaluate data quality**:
- Cities with >40 sales: High confidence baselines
- Cities with 20-40 sales: Medium confidence 
- Cities with <20 sales: Low confidence, consider manual estimation

#### Document findings

Create `baseline-collection-report.md`:
```markdown
# Baseline Collection Report - Phase 1

## Collection Results
- Date: 2025-06-18
- Period: 90-day lookback
- Successful: 10/12 cities

## Data Quality Summary
| City | Median | Sample Size | Confidence | Notes |
|------|--------|-------------|------------|-------|
| Kansas City | $425k | 47 | High | ✅ Good data |
| Cleveland | $285k | 23 | Medium | ⚠️ Small sample |

## Manual Adjustments Made
- Green Bay: Estimated $280k (insufficient API data)
- Pittsburgh: Verified against Zillow data

## Recommendations
- Proceed with implementation
- Monitor for data quality issues in production
```

---

### 1.5 Integration Testing (30 minutes)

#### Test with existing percentage scoring system

1. **Backup current test data**:
   ```bash
   cp public/test-leaderboard.json public/test-leaderboard-backup.json
   ```

2. **Update scraper to use real baselines**:
   - Modify `scripts/phase0-test-scoring.js` to use new `baselines.json`
   - Run test scoring with real baseline data
   - Compare rankings with mock data results

3. **Validate score calculations**:
   ```bash
   node scripts/phase0-test-scoring.js
   ```

#### Frontend compatibility check

1. **Start development server**:
   ```bash
   npm run dev
   ```

2. **Verify display**:
   - [ ] Multipliers display correctly with real baselines
   - [ ] Rankings reflect real baseline differences
   - [ ] No UI breaking changes
   - [ ] Mobile view still functional

---

## Expected Outcomes

### Success Criteria
- [ ] Real baseline data collected for 10+ NFL cities
- [ ] Baselines reflect actual market conditions
- [ ] Score calculations work with real data
- [ ] Frontend displays percentage scores correctly
- [ ] Competitive balance maintained or improved

### Data Quality Targets
- **Sample size**: Average >30 sales per city
- **Baseline range**: 2x-4x spread from lowest to highest
- **Data freshness**: 90-day lookback captures current market
- **Geographic coverage**: All major NFL markets represented

### Decision Points
- Are the real baselines significantly different from mock estimates?
- Do any cities require manual baseline adjustment?
- Is the competitive balance better with real data?
- Are there any technical issues with collection process?

---

## Risk Mitigation

### API Rate Limiting
- **Risk**: Hitting RapidAPI usage limits during collection
- **Mitigation**: Add delays between requests, batch processing
- **Fallback**: Spread collection over multiple days if needed

### Insufficient Data
- **Risk**: Some cities lacking adequate sales history
- **Mitigation**: Manual estimation process documented
- **Fallback**: Use neighboring market data or public sources

### Data Quality Issues
- **Risk**: Outliers or bad data skewing baselines
- **Mitigation**: Filtering logic and manual validation
- **Fallback**: Commissioner review and adjustment process

### Regional Mismatch
- **Risk**: Region IDs don't match intended market boundaries
- **Mitigation**: Manual verification before collection
- **Fallback**: Use broader metropolitan area regions

---

## Next Steps

### If Phase 1 Successful
1. **Proceed to Phase 2**: Update production scraper with real baselines
2. **Monitor results**: Watch for any baseline-related issues
3. **Document process**: Create baseline refresh procedure

### If Phase 1 Has Issues
1. **Manual baseline completion**: Fill gaps with estimated data
2. **Regional adjustment**: Modify region IDs if needed
3. **Hybrid approach**: Mix real + estimated baselines as needed

### Future Baseline Updates
- **Frequency**: Monthly baseline refresh recommended
- **Automation**: Consider automated collection script
- **Seasonal adjustment**: Account for market seasonal patterns

---

**Time Estimate**: 4-5 hours total
**Risk Level**: Medium (API dependencies, data quality variables)
**Value**: High (enables fair percentage-based competition)

---

*This phase establishes the foundation for accurate percentage scoring by replacing mock estimates with real market data. The manual validation process ensures baselines reflect actual market conditions while maintaining competitive balance.*
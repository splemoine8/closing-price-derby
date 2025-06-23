#!/usr/bin/env node

// Script to calculate real market median baselines for competition
// Run once before competition starts to establish fixed baseline prices
// Usage: node --env-file=.env ./scripts/calculate-baselines.js

import fs from 'fs';
import path from 'path';
import { CITY_REGIONS, FRIEND_ASSIGNMENTS } from './city-regions.js';

// RapidAPI configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Configuration
const DAYS_FOR_BASELINE = 90; // Use 90 days of data for median calculation
const MIN_SALES_REQUIRED = 5; // Minimum sales needed for reliable median

async function getSoldPropertiesForBaseline(regionId, cityName) {
  console.log(`🏠 Fetching ${DAYS_FOR_BASELINE}-day sales data for ${cityName} (region ${regionId})`);
  
  const response = await fetch(
    `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=${DAYS_FOR_BASELINE}`,
    {
      headers: {
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get sold properties for ${cityName}: ${response.status}`);
  }

  const response_data = await response.json();
  
  // Extract properties from nested structure
  const properties = [];
  if (response_data.data && Array.isArray(response_data.data)) {
    response_data.data.forEach(item => {
      if (item.homeData) {
        properties.push(item.homeData);
      }
    });
  }
  
  console.log(`📊 Found ${properties.length || 0} sold properties in ${cityName}`);
  
  return properties;
}

function calculateMedianPrice(properties, cityName) {
  if (!properties || properties.length === 0) {
    console.log(`⚠️  No properties available for ${cityName}`);
    return null;
  }

  // Extract valid prices
  const prices = [];
  properties.forEach(property => {
    const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
    if (price > 0) {
      prices.push(price);
    }
  });

  if (prices.length < MIN_SALES_REQUIRED) {
    console.log(`⚠️  Insufficient sales data for ${cityName}: ${prices.length} sales (need ${MIN_SALES_REQUIRED})`);
    return null;
  }

  // Remove extreme outliers (below 1st percentile or above 99th percentile)
  prices.sort((a, b) => a - b);
  const p1 = Math.floor(prices.length * 0.01);
  const p99 = Math.floor(prices.length * 0.99);
  const filteredPrices = prices.slice(p1, p99);

  // Calculate median
  const mid = Math.floor(filteredPrices.length / 2);
  const median = filteredPrices.length % 2 === 0
    ? (filteredPrices[mid - 1] + filteredPrices[mid]) / 2
    : filteredPrices[mid];

  console.log(`📈 ${cityName} median: $${median.toLocaleString()} (from ${filteredPrices.length} sales, excluded ${prices.length - filteredPrices.length} outliers)`);
  
  return {
    median: Math.round(median),
    sampleSize: filteredPrices.length,
    originalSampleSize: prices.length,
    outlieresRemoved: prices.length - filteredPrices.length,
    minPrice: filteredPrices[0],
    maxPrice: filteredPrices[filteredPrices.length - 1]
  };
}

async function calculateBaselines() {
  console.log('🎯 Starting baseline calculation for competition setup...\n');
  
  // Read team assignments to get drafted cities only
  let teamNamesData;
  try {
    const teamNamesRaw = fs.readFileSync('public/team-names.json', 'utf8');
    teamNamesData = JSON.parse(teamNamesRaw);
  } catch (error) {
    console.error('❌ Error reading team-names.json:', error.message);
    console.log('📝 Make sure you have updated public/team-names.json with final draft results');
    process.exit(1);
  }

  const draftedCities = Object.keys(teamNamesData.assignments || {});
  if (draftedCities.length === 0) {
    console.error('❌ No cities found in team-names.json assignments');
    console.log('📝 Please update public/team-names.json with final draft results first');
    process.exit(1);
  }

  console.log(`📋 Found ${draftedCities.length} drafted cities:`, draftedCities.join(', '));
  
  const baselines = {};
  const qualityReport = {};
  const errors = [];

  // Only process cities that were actually drafted
  for (const shortCityName of draftedCities) {
    // Find the full city name with state in CITY_REGIONS
    const fullCityName = Object.keys(CITY_REGIONS).find(fullName => 
      fullName.split(',')[0].trim() === shortCityName.trim()
    );
    
    if (!fullCityName) {
      console.error(`❌ Region ID not found for drafted city: "${shortCityName}"`);
      console.log(`📝 Add this city to scripts/city-regions.js first`);
      errors.push(`No region ID mapping for ${shortCityName}`);
      continue;
    }
    
    const regionId = CITY_REGIONS[fullCityName];
    console.log(`🔗 Mapped "${shortCityName}" → "${fullCityName}" → ${regionId}`);

    try {
      console.log(`\n🔍 Processing ${fullCityName}...`);
      
      // Get 90-day sales data
      const properties = await getSoldPropertiesForBaseline(regionId, fullCityName);
      
      // Calculate median
      const medianData = calculateMedianPrice(properties, fullCityName);
      
      if (medianData) {
        const baseCityName = fullCityName.split(',')[0].trim();
        baselines[baseCityName] = medianData.median;
        qualityReport[baseCityName] = {
          median: medianData.median,
          sampleSize: medianData.sampleSize,
          originalSampleSize: medianData.originalSampleSize,
          outliersRemoved: medianData.outlieresRemoved,
          minPrice: medianData.minPrice,
          maxPrice: medianData.maxPrice,
          dataQuality: medianData.sampleSize >= MIN_SALES_REQUIRED * 2 ? 'High' : 'Moderate'
        };
        console.log(`✅ ${baseCityName}: $${medianData.median.toLocaleString()}`);
      } else {
        errors.push(`Failed to calculate baseline for ${fullCityName}: insufficient data`);
        console.log(`❌ ${fullCityName}: Insufficient data for baseline`);
      }

      // Rate limiting - 250ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (error) {
      console.error(`❌ Error processing ${fullCityName}:`, error.message);
      errors.push(`${fullCityName}: ${error.message}`);
    }
  }

  return { baselines, qualityReport, errors };
}

async function saveBaselines(baselines, qualityReport, errors) {
  const publicPath = path.join(process.cwd(), 'public');
  
  // Create baselines.json for production use
  const baselineData = {
    generatedAt: new Date().toISOString(),
    daysUsed: DAYS_FOR_BASELINE,
    minSalesRequired: MIN_SALES_REQUIRED,
    baselines: baselines
  };

  fs.writeFileSync(
    path.join(publicPath, 'baselines.json'),
    JSON.stringify(baselineData, null, 2)
  );

  // Create detailed quality report
  const reportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      citiesProcessed: Object.keys(CITY_REGIONS).length,
      successfulBaselines: Object.keys(baselines).length,
      errors: errors.length
    },
    qualityMetrics: qualityReport,
    errors: errors
  };

  fs.writeFileSync(
    path.join(publicPath, 'baseline-quality-report.json'),
    JSON.stringify(reportData, null, 2)
  );

  // Update test-leaderboard.json with real baselines
  const testDataPath = path.join(publicPath, 'test-leaderboard.json');
  if (fs.existsSync(testDataPath)) {
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    
    // Update each city's baseline in test data
    testData.forEach(city => {
      const cityBaseline = baselines[city.city];
      if (cityBaseline) {
        city.baseline = cityBaseline;
        // Recalculate score and multiplier with real baseline
        const scorePct = ((city.price - cityBaseline) / cityBaseline) * 100;
        city.scorePct = scorePct;
        city.multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
      }
    });

    fs.writeFileSync(testDataPath, JSON.stringify(testData, null, 2));
    console.log(`\n📝 Updated test-leaderboard.json with real baselines`);
  }

  console.log(`\n✅ Baselines saved to: ${path.join(publicPath, 'baselines.json')}`);
  console.log(`📊 Quality report saved to: ${path.join(publicPath, 'baseline-quality-report.json')}`);
}

async function main() {
  try {
    const { baselines, qualityReport, errors } = await calculateBaselines();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 BASELINE CALCULATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Successfully calculated ${Object.keys(baselines).length} baselines:`);
    Object.entries(baselines).forEach(([city, median]) => {
      const quality = qualityReport[city]?.dataQuality || 'Unknown';
      console.log(`   ${city}: $${median.toLocaleString()} (${quality} quality)`);
    });

    if (errors.length > 0) {
      console.log(`\n❌ ${errors.length} errors occurred:`);
      errors.forEach(error => console.log(`   ${error}`));
    }

    await saveBaselines(baselines, qualityReport, errors);
    
    console.log(`\n🎯 Baseline calculation complete! Ready for competition.`);
    console.log(`📄 Review the quality report for data confidence levels.`);
    
  } catch (error) {
    console.error('❌ Baseline calculation failed:', error);
    process.exit(1);
  }
}

// Run the calculation
main();
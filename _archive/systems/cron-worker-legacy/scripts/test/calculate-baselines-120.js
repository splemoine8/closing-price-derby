#!/usr/bin/env node

// Script to calculate 120-day market median baselines for comparison
// Usage: node --env-file=.env ./scripts/calculate-baselines-120.js

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

// Configuration - Changed to 120 days
const DAYS_FOR_BASELINE = 120; // Use 120 days of data for median calculation
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
  console.log('🎯 Starting 120-day baseline calculation for comparison...\n');
  
  const baselines = {};
  const qualityReport = {};
  const errors = [];

  for (const [cityName, regionId] of Object.entries(CITY_REGIONS)) {
    try {
      console.log(`\n🔍 Processing ${cityName}...`);
      
      // Get 120-day sales data
      const properties = await getSoldPropertiesForBaseline(regionId, cityName);
      
      // Calculate median
      const medianData = calculateMedianPrice(properties, cityName);
      
      if (medianData) {
        const baseCityName = cityName.split(',')[0].trim();
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
        errors.push(`Failed to calculate baseline for ${cityName}: insufficient data`);
        console.log(`❌ ${cityName}: Insufficient data for baseline`);
      }

      // Rate limiting - 250ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (error) {
      console.error(`❌ Error processing ${cityName}:`, error.message);
      errors.push(`${cityName}: ${error.message}`);
    }
  }

  return { baselines, qualityReport, errors };
}

async function saveBaselines(baselines, qualityReport, errors) {
  const publicPath = path.join(process.cwd(), 'public');
  
  // Create baselines-120.json for comparison
  const baselineData = {
    generatedAt: new Date().toISOString(),
    daysUsed: DAYS_FOR_BASELINE,
    minSalesRequired: MIN_SALES_REQUIRED,
    baselines: baselines
  };

  fs.writeFileSync(
    path.join(publicPath, 'baselines-120.json'),
    JSON.stringify(baselineData, null, 2)
  );

  // Create detailed quality report for 120-day baseline
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
    path.join(publicPath, 'baseline-120-quality-report.json'),
    JSON.stringify(reportData, null, 2)
  );

  console.log(`\n✅ 120-day baselines saved to: ${path.join(publicPath, 'baselines-120.json')}`);
  console.log(`📊 Quality report saved to: ${path.join(publicPath, 'baseline-120-quality-report.json')}`);
}

async function compareBaselines() {
  const publicPath = path.join(process.cwd(), 'public');
  const baseline90Path = path.join(publicPath, 'baselines.json');
  
  if (!fs.existsSync(baseline90Path)) {
    console.log('\n⚠️  No 90-day baseline found for comparison');
    return;
  }

  const baseline90 = JSON.parse(fs.readFileSync(baseline90Path, 'utf8'));
  const baseline120 = JSON.parse(fs.readFileSync(path.join(publicPath, 'baselines-120.json'), 'utf8'));

  console.log('\n' + '='.repeat(80));
  console.log('📊 BASELINE COMPARISON: 90-DAY vs 120-DAY');
  console.log('='.repeat(80));

  const comparison = {};
  
  Object.keys(baseline90.baselines).forEach(city => {
    const value90 = baseline90.baselines[city];
    const value120 = baseline120.baselines[city];
    
    if (value90 && value120) {
      const difference = value120 - value90;
      const percentChange = ((difference / value90) * 100).toFixed(2);
      
      comparison[city] = {
        baseline90: value90,
        baseline120: value120,
        difference: difference,
        percentChange: parseFloat(percentChange)
      };

      console.log(`\n${city}:`);
      console.log(`  90-day:  $${value90.toLocaleString()}`);
      console.log(`  120-day: $${value120.toLocaleString()}`);
      console.log(`  Difference: ${difference >= 0 ? '+' : ''}$${difference.toLocaleString()} (${percentChange}%)`);
    }
  });

  // Save comparison report
  const comparisonReport = {
    generatedAt: new Date().toISOString(),
    comparison: comparison,
    summary: {
      averagePercentChange: (Object.values(comparison).reduce((sum, c) => sum + c.percentChange, 0) / Object.keys(comparison).length).toFixed(2),
      citiesWithIncrease: Object.values(comparison).filter(c => c.percentChange > 0).length,
      citiesWithDecrease: Object.values(comparison).filter(c => c.percentChange < 0).length,
      maxChange: Object.entries(comparison).reduce((max, [city, data]) => 
        Math.abs(data.percentChange) > Math.abs(max.percentChange) ? { city, ...data } : max, 
        { percentChange: 0 }
      )
    }
  };

  fs.writeFileSync(
    path.join(publicPath, 'baseline-comparison.json'),
    JSON.stringify(comparisonReport, null, 2)
  );

  console.log('\n' + '='.repeat(80));
  console.log(`📊 Average change: ${comparisonReport.summary.averagePercentChange}%`);
  console.log(`📈 Cities with increase: ${comparisonReport.summary.citiesWithIncrease}`);
  console.log(`📉 Cities with decrease: ${comparisonReport.summary.citiesWithDecrease}`);
  console.log(`🎯 Largest change: ${comparisonReport.summary.maxChange.city} (${comparisonReport.summary.maxChange.percentChange}%)`);
  console.log('\n💾 Comparison saved to: baseline-comparison.json');
}

async function main() {
  try {
    const { baselines, qualityReport, errors } = await calculateBaselines();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 120-DAY BASELINE CALCULATION SUMMARY');
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
    
    // Compare with 90-day baseline
    await compareBaselines();
    
    console.log(`\n🎯 120-day baseline calculation complete!`);
    
  } catch (error) {
    console.error('❌ Baseline calculation failed:', error);
    process.exit(1);
  }
}

// Run the calculation
main();
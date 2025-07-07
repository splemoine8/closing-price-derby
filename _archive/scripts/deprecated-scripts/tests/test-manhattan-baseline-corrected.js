#!/usr/bin/env node

// CORRECTED test script using EXACT baseline methodology from calculate-baselines.js
// Tests Manhattan region 6_35948 with proper 90-day median + outlier filtering

import fetch from 'node-fetch';
import 'dotenv/config';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';
const MANHATTAN_REGION_ID = '6_35948';

// Use EXACT same parameters as calculate-baselines.js
const DAYS_FOR_BASELINE = 90; // Match line 21
const MIN_SALES_REQUIRED = 5; // Match line 22

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

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
  
  // Extract properties from nested structure (exact copy from calculate-baselines.js)
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

  // Extract valid prices (exact copy from calculate-baselines.js lines 65-71)
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

  // Remove extreme outliers (exact copy from calculate-baselines.js lines 78-82)
  prices.sort((a, b) => a - b);
  const p1 = Math.floor(prices.length * 0.01);
  const p99 = Math.floor(prices.length * 0.99);
  const filteredPrices = prices.slice(p1, p99);

  // Calculate median (exact copy from calculate-baselines.js lines 84-88)
  const mid = Math.floor(filteredPrices.length / 2);
  const median = filteredPrices.length % 2 === 0
    ? (filteredPrices[mid - 1] + filteredPrices[mid]) / 2
    : filteredPrices[mid];

  console.log(`📈 ${cityName} median: $${median.toLocaleString()} (from ${filteredPrices.length} sales, excluded ${prices.length - filteredPrices.length} outliers)`);
  
  return {
    median: Math.round(median),
    sampleSize: filteredPrices.length,
    originalSampleSize: prices.length,
    outliersRemoved: prices.length - filteredPrices.length,
    minPrice: filteredPrices[0],
    maxPrice: filteredPrices[filteredPrices.length - 1]
  };
}

async function testCorrectedManhattanBaseline() {
  console.log('🎯 CORRECTED Manhattan Baseline Test (Using Exact Calculate-Baselines Methodology)');
  console.log('='.repeat(80));
  console.log(`📅 Using ${DAYS_FOR_BASELINE} days of data (not 365)`);
  console.log(`🧮 Using median calculation (not 25th percentile)`);
  console.log(`🚫 Using 1%-99% outlier filtering`);
  console.log('');
  
  try {
    // Fetch properties using exact same method
    const properties = await getSoldPropertiesForBaseline(MANHATTAN_REGION_ID, 'Manhattan Test');
    
    if (!properties || properties.length === 0) {
      console.log('❌ No properties found for Manhattan region');
      return;
    }
    
    // Calculate baseline using exact same method
    const result = calculateMedianPrice(properties, 'Manhattan Test');
    
    if (!result) {
      console.log('❌ Could not calculate baseline');
      return;
    }
    
    console.log('\n🏆 CORRECTED Manhattan Baseline Results:');
    console.log('='.repeat(50));
    console.log(`Baseline (Median):     $${result.median.toLocaleString()}`);
    console.log(`Sample Size:           ${result.sampleSize} sales`);
    console.log(`Original Sample:       ${result.originalSampleSize} sales`);
    console.log(`Outliers Removed:      ${result.outliersRemoved} sales`);
    console.log(`Price Range (Filtered): $${result.minPrice.toLocaleString()} - $${result.maxPrice.toLocaleString()}`);
    
    console.log('\n📊 Comparison with Current NY Baseline:');
    console.log('='.repeat(50));
    const currentNYBaseline = 999000;
    console.log(`Current NY (All Boroughs): $${currentNYBaseline.toLocaleString()}`);
    console.log(`Manhattan Test Result:     $${result.median.toLocaleString()}`);
    
    const difference = result.median - currentNYBaseline;
    const percentChange = ((difference / currentNYBaseline) * 100).toFixed(1);
    
    if (difference > 0) {
      console.log(`✅ Difference: +$${difference.toLocaleString()} (+${percentChange}%)`);
      console.log(`✅ Manhattan baseline is HIGHER as expected!`);
    } else {
      console.log(`⚠️  Difference: $${difference.toLocaleString()} (${percentChange}%)`);
      console.log(`⚠️  Manhattan baseline is still lower - investigate further`);
    }
    
    console.log('\n📝 Next Steps:');
    if (difference > 0) {
      console.log('1. ✅ Manhattan region looks good - higher luxury baseline');
      console.log('2. ✅ Update city-regions.js to use 6_35948');
      console.log('3. ✅ Run calculate-baselines script');
      console.log('4. ✅ Deploy the change');
    } else {
      console.log('1. ⚠️  Investigate why Manhattan baseline is not higher');
      console.log('2. ⚠️  Check if region 6_35948 covers the right areas');
      console.log('3. ⚠️  Consider if data sample is representative');
    }
    
  } catch (error) {
    console.error('❌ Error testing Manhattan baseline:', error.message);
  }
}

// Run the corrected test
testCorrectedManhattanBaseline();
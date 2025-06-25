#!/usr/bin/env node

// Test script to verify New York baseline using exact methodology from calculate-baselines.js
// Specifically tests region ID 6_30749 (all boroughs) with 90-day baseline through June 22nd

import 'dotenv/config';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Configuration - exact same as calculate-baselines.js
const DAYS_FOR_BASELINE = 90;
const MIN_SALES_REQUIRED = 5;
const NYC_REGION_ID = '6_30749';  // All boroughs region ID
const CITY_NAME = 'New York, NY';

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
    outliersRemoved: prices.length - filteredPrices.length,
    minPrice: filteredPrices[0],
    maxPrice: filteredPrices[filteredPrices.length - 1]
  };
}

async function testNYBaseline() {
  console.log('🎯 Testing New York baseline calculation...\n');
  console.log(`Region ID: ${NYC_REGION_ID} (all boroughs)`);
  console.log(`Baseline period: ${DAYS_FOR_BASELINE} days`);
  console.log(`Current baseline in system: $999,000\n`);
  
  try {
    // Get sales data
    const properties = await getSoldPropertiesForBaseline(NYC_REGION_ID, CITY_NAME);
    
    // Extract all valid prices with property details for CSV
    const salesData = [];
    properties.forEach(property => {
      const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
      if (price > 0) {
        salesData.push({
          address: property.addressInfo?.formattedStreetLine || 'Unknown',
          price: price,
          beds: property.beds || 0,
          baths: property.baths || 0,
          sqft: parseInt(property.sqftInfo?.amount || 0),
          lastSoldDate: property.lastSaleData?.lastSoldDate || '',
          url: property.url ? `https://www.redfin.com${property.url}` : ''
        });
      }
    });
    
    // Sort by price for analysis
    salesData.sort((a, b) => a.price - b.price);
    
    // Apply same outlier filtering as baseline calculation
    const p1 = Math.floor(salesData.length * 0.01);
    const p99 = Math.floor(salesData.length * 0.99);
    const filteredSales = salesData.slice(p1, p99);
    
    // Mark outliers in original data
    salesData.forEach((sale, index) => {
      sale.included_in_baseline = index >= p1 && index < p99 ? 'YES' : 'NO (outlier)';
    });
    
    // Calculate median from filtered data
    const mid = Math.floor(filteredSales.length / 2);
    const median = filteredSales.length % 2 === 0
      ? (filteredSales[mid - 1].price + filteredSales[mid].price) / 2
      : filteredSales[mid].price;
    
    // Create CSV content
    const csvHeaders = 'address,price,beds,baths,sqft,lastSoldDate,included_in_baseline,url';
    const csvRows = salesData.map(sale => 
      `"${sale.address}",${sale.price},${sale.beds},${sale.baths},${sale.sqft},"${sale.lastSoldDate}","${sale.included_in_baseline}","${sale.url}"`
    );
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    
    // Save CSV file
    const fs = await import('fs');
    const csvPath = 'scripts/ny-baseline-calculation.csv';
    fs.writeFileSync(csvPath, csvContent);
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 NEW YORK BASELINE CALCULATION RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Calculated baseline: $${Math.round(median).toLocaleString()}`);
    console.log(`📊 Sample size: ${filteredSales.length} sales (from ${salesData.length} total)`);
    console.log(`🗑️  Outliers removed: ${salesData.length - filteredSales.length}`);
    console.log(`📉 Price range (after outlier removal): $${filteredSales[0].price.toLocaleString()} - $${filteredSales[filteredSales.length-1].price.toLocaleString()}`);
    console.log(`🎯 Data quality: ${filteredSales.length >= MIN_SALES_REQUIRED * 2 ? 'High' : 'Moderate'}`);
    console.log(`📄 Full data exported to: ${csvPath}`);
    
    // Show median calculation details
    console.log('\n📊 MEDIAN CALCULATION:');
    console.log(`Total sales found: ${salesData.length}`);
    console.log(`Outliers removed (1st & 99th percentile): ${salesData.length - filteredSales.length}`);
    console.log(`Sales used for baseline: ${filteredSales.length}`);
    if (filteredSales.length % 2 === 0) {
      console.log(`Middle values: $${filteredSales[mid-1].price.toLocaleString()} and $${filteredSales[mid].price.toLocaleString()}`);
      console.log(`Median calculation: ($${filteredSales[mid-1].price.toLocaleString()} + $${filteredSales[mid].price.toLocaleString()}) ÷ 2 = $${Math.round(median).toLocaleString()}`);
    } else {
      console.log(`Middle value (position ${mid + 1}): $${filteredSales[mid].price.toLocaleString()}`);
    }
    
    // Compare with current baseline
    const currentBaseline = 999000;
    const difference = Math.round(median) - currentBaseline;
    const percentDiff = ((difference / currentBaseline) * 100).toFixed(1);
    
    console.log('\n📊 COMPARISON WITH CURRENT BASELINE:');
    console.log(`Current baseline: $${currentBaseline.toLocaleString()}`);
    console.log(`Calculated baseline: $${Math.round(median).toLocaleString()}`);
    console.log(`Difference: ${difference >= 0 ? '+' : ''}$${difference.toLocaleString()} (${difference >= 0 ? '+' : ''}${percentDiff}%)`);
    
    if (Math.abs(percentDiff) <= 5) {
      console.log('✅ Current baseline is within 5% of calculated baseline - good match!');
    } else if (Math.abs(percentDiff) <= 10) {
      console.log('⚠️  Current baseline differs by more than 5% but less than 10%');
    } else {
      console.log('❌ Current baseline differs significantly (>10%) from calculated baseline');
    }
    
    console.log(`\n💡 Tell your leaguemate: The baseline uses the median of 90 days of sales data with outliers removed.`);
    console.log(`   This is more stable than mean/average which can be skewed by luxury sales.`);
    console.log(`   Review the CSV file to see all ${salesData.length} sales and which ones were included.`);
    
  } catch (error) {
    console.error('❌ Error testing NY baseline:', error.message);
    process.exit(1);
  }
}

// Run the test
testNYBaseline();
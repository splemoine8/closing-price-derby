#!/usr/bin/env node

// Test script to calculate baseline for Manhattan region 6_35948
// Compare it to existing New York baseline

import fetch from 'node-fetch';
import 'dotenv/config';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';
const MANHATTAN_REGION_ID = '6_35948';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

function convertSourceDateToUTC(sourceDate) {
  if (!sourceDate) return null;
  
  if (typeof sourceDate === 'number') {
    return new Date(sourceDate).toISOString();
  }
  
  if (typeof sourceDate === 'string') {
    const parsed = new Date(sourceDate);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }
  
  return null;
}

async function fetchManhattanSalesData() {
  console.log(`🔍 Fetching Manhattan sales data for baseline calculation...`);
  
  try {
    // Fetch last 12 months of data for more robust baseline
    const response = await fetch(
      `${BASE_URL}/properties/search-sold?regionId=${MANHATTAN_REGION_ID}&soldWithin=365`,
      {
        headers: {
          'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract and process properties
    const salesData = [];
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        if (item.homeData) {
          const property = item.homeData;
          const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
          const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
          const rawDate = property.lastSaleData?.lastSoldDate;
          const utcDate = convertSourceDateToUTC(rawDate);
          
          if (price > 0 && utcDate) {
            salesData.push({
              address,
              price,
              date: utcDate,
              beds: property.beds || 0,
              baths: property.baths || 0,
              sqft: parseInt(property.sqftInfo?.amount || 0)
            });
          }
        }
      });
    }
    
    return salesData;
  } catch (error) {
    console.error('❌ Error fetching Manhattan data:', error.message);
    return [];
  }
}

function calculateBaseline(salesData) {
  if (salesData.length === 0) {
    return null;
  }
  
  // Sort prices
  const prices = salesData.map(sale => sale.price).sort((a, b) => a - b);
  
  // Calculate statistics
  const count = prices.length;
  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const median = prices[Math.floor(count / 2)];
  
  // Calculate percentiles
  const p25 = prices[Math.floor(count * 0.25)];
  const p75 = prices[Math.floor(count * 0.75)];
  const p10 = prices[Math.floor(count * 0.10)];
  const p90 = prices[Math.floor(count * 0.90)];
  
  // For baseline, typically use 25th percentile to represent "baseline" market
  const baseline = p25;
  
  return {
    count,
    avg,
    median,
    baseline,
    p10,
    p25,
    p75,
    p90,
    min: prices[0],
    max: prices[count - 1]
  };
}

async function testManhattanBaseline() {
  console.log('🎯 Manhattan Baseline Test');
  console.log('='.repeat(50));
  
  const salesData = await fetchManhattanSalesData();
  
  if (salesData.length === 0) {
    console.log('❌ No sales data found');
    return;
  }
  
  console.log(`📊 Found ${salesData.length} valid sales in last 12 months`);
  
  const stats = calculateBaseline(salesData);
  
  console.log('\n💰 Manhattan Price Statistics:');
  console.log('='.repeat(40));
  console.log(`Count:       ${stats.count.toLocaleString()}`);
  console.log(`Average:     $${Math.round(stats.avg).toLocaleString()}`);
  console.log(`Median:      $${stats.median.toLocaleString()}`);
  console.log(`Baseline:    $${stats.baseline.toLocaleString()} (25th percentile)`);
  console.log(`Range:       $${stats.min.toLocaleString()} - $${stats.max.toLocaleString()}`);
  console.log('');
  console.log('Percentiles:');
  console.log(`10th:        $${stats.p10.toLocaleString()}`);
  console.log(`25th:        $${stats.p25.toLocaleString()}`);
  console.log(`75th:        $${stats.p75.toLocaleString()}`);
  console.log(`90th:        $${stats.p90.toLocaleString()}`);
  
  // Sample some high-end sales for context
  const highEndSales = salesData
    .filter(sale => sale.price >= stats.p90)
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);
  
  console.log('\n🏆 Sample High-End Sales (Top 10%):');
  console.log('='.repeat(40));
  highEndSales.forEach((sale, i) => {
    console.log(`${i + 1}. $${sale.price.toLocaleString()} - ${sale.address}`);
  });
  
  console.log('\n📝 Next Steps:');
  console.log('1. Compare this baseline to current NY baseline');
  console.log('2. If this looks better, update city-regions.js');
  console.log('3. Run calculate-baselines script');
  console.log('4. Deploy the change');
  
  return stats;
}

// Run the test
testManhattanBaseline();
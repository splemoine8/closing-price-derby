#!/usr/bin/env node

// Test script to fetch sample data from Manhattan region 6_35948
// This will help us verify if this region actually returns Manhattan-specific data

import fetch from 'node-fetch';
import 'dotenv/config';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

// Test the new Manhattan region ID
const MANHATTAN_REGION_ID = '6_35948';
const TEST_REGION_NAME = 'Manhattan Test';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

async function testManhattanRegion() {
  console.log(`🔍 Testing Manhattan region ID: ${MANHATTAN_REGION_ID}`);
  console.log(`🎯 Fetching recent sales data...`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/properties/search-sold?regionId=${MANHATTAN_REGION_ID}&soldWithin=30`,
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
    
    // Extract properties from nested structure
    const properties = [];
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        if (item.homeData) {
          properties.push(item.homeData);
        }
      });
    }
    
    console.log(`📊 Found ${properties.length} properties in last 30 days`);
    
    if (properties.length === 0) {
      console.log('⚠️ No properties found - this might not be the right region ID');
      return;
    }
    
    // Analyze sample properties
    console.log('\n🏠 Sample Properties Analysis:');
    console.log('='.repeat(60));
    
    const sampleSize = Math.min(10, properties.length);
    let totalPrice = 0;
    let prices = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const property = properties[i];
      const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
      const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
      const beds = property.beds || 0;
      const baths = property.baths || 0;
      const sqft = parseInt(property.sqftInfo?.amount || 0);
      const url = property.url ? `https://www.redfin.com${property.url}` : 'No URL';
      
      if (price > 0) {
        totalPrice += price;
        prices.push(price);
      }
      
      console.log(`${i + 1}. ${address}`);
      console.log(`   Price: $${price.toLocaleString()}`);
      console.log(`   Beds/Baths: ${beds}/${baths}, SqFt: ${sqft}`);
      console.log(`   URL: ${url}`);
      console.log('');
    }
    
    // Calculate statistics
    if (prices.length > 0) {
      const avgPrice = totalPrice / prices.length;
      prices.sort((a, b) => a - b);
      const medianPrice = prices[Math.floor(prices.length / 2)];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      console.log('📈 Price Analysis (Sample):');
      console.log('='.repeat(40));
      console.log(`Average: $${Math.round(avgPrice).toLocaleString()}`);
      console.log(`Median:  $${medianPrice.toLocaleString()}`);
      console.log(`Range:   $${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`);
      
      // Compare to what we know about current NY data
      console.log('\n🔍 Geographic Analysis:');
      console.log('Look at the URLs above to verify these are Manhattan properties');
      console.log('Expected: Properties should be in Manhattan, not outer boroughs');
    }
    
    console.log(`\n✅ Test complete! Please review the sample data above.`);
    console.log(`📝 Next step: If this looks like Manhattan data, run baseline calculation test.`);
    
  } catch (error) {
    console.error('❌ Error testing Manhattan region:', error.message);
  }
}

// Run the test
testManhattanRegion();
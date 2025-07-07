#!/usr/bin/env node

// Test Houston specifically to debug the issue

import fetch from 'node-fetch';
import 'dotenv/config';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

async function testHouston() {
  console.log('🏁 Testing Houston data...\n');
  
  // Fetch Houston properties
  const response = await fetch(`${BASE_URL}/properties/search-sold?regionId=6_8903&limit=50&offset=0`, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com'
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const properties = [];
  
  if (data.data && Array.isArray(data.data)) {
    data.data.forEach(item => {
      if (item.homeData) {
        properties.push(item.homeData);
      }
    });
  }
  
  console.log(`📊 Total properties received: ${properties.length}`);
  
  // Check city names
  const cityCounts = {};
  properties.forEach(p => {
    const city = p.addressInfo?.city || 'Unknown';
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });
  
  console.log('\nCity names in API response:');
  Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => {
      console.log(`  "${city}": ${count} properties`);
    });
  
  // Show raw examples
  console.log('\nFirst 3 properties (raw city data):');
  properties.slice(0, 3).forEach(p => {
    console.log(`  Address: ${p.addressInfo?.formattedStreetLine}`);
    console.log(`  City (raw): "${p.addressInfo?.city}"`);
    console.log(`  Price: $${p.priceInfo?.amount || 0}`);
    console.log('');
  });
}

testHouston().catch(console.error);
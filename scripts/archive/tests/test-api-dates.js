#!/usr/bin/env node

// Test script to understand RapidAPI date formats and implement UTC conversion

import fetch from 'node-fetch';
import crypto from 'crypto';
import { CITY_REGIONS } from './city-regions.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

async function testSingleCity() {
  const cityName = 'Kansas City, MO';
  const regionId = CITY_REGIONS[cityName];
  
  console.log(`🧪 Testing date formats for ${cityName} (region: ${regionId})`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=7`,
      {
        headers: {
          'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract first few properties to examine date formats
    const properties = [];
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        if (item.homeData) {
          properties.push(item.homeData);
        }
      });
    }

    console.log(`📊 Found ${properties.length} properties`);
    
    // Examine first 3 properties for date formats
    for (let i = 0; i < Math.min(3, properties.length); i++) {
      const property = properties[i];
      const rawDate = property.lastSaleData?.lastSoldDate;
      
      console.log(`\n🏠 Property ${i + 1}:`);
      console.log(`  Address: ${property.addressInfo?.formattedStreetLine}`);
      console.log(`  Raw date from API: "${rawDate}" (type: ${typeof rawDate})`);
      
      if (rawDate) {
        try {
          const jsDate = new Date(rawDate);
          console.log(`  Parsed as JS Date: ${jsDate.toISOString()}`);
          console.log(`  Local string: ${jsDate.toLocaleDateString()}`);
          console.log(`  UTC timestamp: ${jsDate.getTime()}`);
        } catch (error) {
          console.log(`  ❌ Failed to parse date: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }
}

// UTC conversion utility functions
function convertSourceDateToUTC(sourceDate) {
  if (!sourceDate) return null;
  
  // Handle various formats we might encounter
  if (typeof sourceDate === 'number') {
    // Unix timestamp
    return new Date(sourceDate).toISOString();
  }
  
  if (typeof sourceDate === 'string') {
    // Check for date-only format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) {
      // Interpret as midnight UTC to avoid timezone issues
      return new Date(sourceDate + 'T00:00:00.000Z').toISOString();
    }
    
    // For other string formats, use standard parsing but be explicit about UTC
    const parsed = new Date(sourceDate);
    if (isNaN(parsed.getTime())) {
      console.warn(`⚠️ Could not parse date: "${sourceDate}"`);
      return null;
    }
    return parsed.toISOString();
  }
  
  console.warn(`⚠️ Unknown date format: "${sourceDate}" (type: ${typeof sourceDate})`);
  return null;
}

function generateDeterministicId(saleData) {
  // Create a deterministic ID from key properties
  const { address, city, price, date } = saleData;
  const key = `${address}|${city}|${price}|${date}`;
  
  return crypto.createHash('sha256').update(key).digest('hex');
}

console.log('🧪 Testing RapidAPI date formats...\n');
await testSingleCity();

console.log('\n📝 Date conversion utility functions ready.');
console.log('✅ Next: Implement city-partitioned data structure');
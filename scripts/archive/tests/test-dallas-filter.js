#!/usr/bin/env node

// Test script to verify Dallas city filtering

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Import the filter function
function propertyMatchesCity(property, targetCity) {
  const target = targetCity.split(',')[0].trim().toLowerCase();
  const apiCity = (property.addressInfo?.city || '').toLowerCase();
  if (apiCity) return apiCity === target;
  const formatted = (property.addressInfo?.formattedStreetLine || '').toLowerCase();
  return new RegExp(`,\\s*${target}\\b`).test(formatted);
}

async function testDallas() {
  console.log('🏁 Testing Dallas city filtering...\n');
  
  // Fetch Dallas properties
  const response = await fetch(`${BASE_URL}/properties/search-sold?regionId=6_30794&limit=350&offset=0`, {
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
  
  // Test filtering
  const dallasProperties = properties.filter(p => propertyMatchesCity(p, 'Dallas, TX'));
  const filteredOut = properties.filter(p => !propertyMatchesCity(p, 'Dallas, TX'));
  
  console.log(`✅ Dallas properties: ${dallasProperties.length}`);
  console.log(`🚫 Filtered out: ${filteredOut.length}\n`);
  
  // Show what cities were filtered out
  const otherCities = {};
  filteredOut.forEach(p => {
    const city = p.addressInfo?.city || 'Unknown';
    otherCities[city] = (otherCities[city] || 0) + 1;
  });
  
  console.log('Cities filtered out:');
  Object.entries(otherCities)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => {
      console.log(`  - ${city}: ${count} properties`);
    });
  
  // Show examples of filtered properties
  console.log('\nExamples of filtered properties:');
  filteredOut.slice(0, 5).forEach(p => {
    console.log(`  - ${p.addressInfo?.city}: ${p.addressInfo?.formattedStreetLine}`);
  });
  
  // Check current Dallas sales in database
  const { data: currentSales, error } = await supa
    .from('sales')
    .select('*')
    .eq('city_name', 'Dallas')
    .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
    .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
    
  if (!error) {
    console.log(`\n📊 Current Dallas sales in database: ${currentSales.length}`);
    
    // Check for any Highland Park entries
    const highlandPark = currentSales.filter(s => 
      s.address.toLowerCase().includes('highland park') ||
      s.address.includes('75205') ||
      s.address.includes('75225')
    );
    
    if (highlandPark.length > 0) {
      console.log(`\n⚠️  Found ${highlandPark.length} potential Highland Park entries in Dallas data:`);
      highlandPark.slice(0, 3).forEach(s => {
        console.log(`  - ${s.address} - $${s.sale_price.toLocaleString()}`);
      });
    }
  }
}

testDallas().catch(console.error);
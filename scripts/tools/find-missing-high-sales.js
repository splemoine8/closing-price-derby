#!/usr/bin/env node

// Script to find potentially missing high-value sales due to city filtering issues
// Compares current leaderboard against ALL sales from API to find any we missed

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { CITY_REGIONS } from '../city-regions.js';
import { CANONICAL_CITY } from '../utils/canonical-city.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Get current competition dates
async function getCompetitionDates() {
  const { data, error } = await supa
    .from('competition_config')
    .select('utc_start, utc_end')
    .eq('is_active', true)
    .single();
    
  if (error) {
    console.error('Failed to fetch competition config:', error);
    // Fallback dates
    return {
      start: new Date('2025-06-23T07:00:00Z'),
      end: new Date('2025-07-14T06:59:59Z')
    };
  }
  
  return {
    start: new Date(data.utc_start),
    end: new Date(data.utc_end)
  };
}

// Get current highest sale for each city from the leaderboard
async function getCurrentLeaders() {
  console.log('📊 Fetching current leaderboard...\n');
  
  const { data, error } = await supa
    .from('leaderboard')
    .select('city, price, top_sale_address')
    .gt('price', 0)
    .order('price', { ascending: false });
    
  if (error) {
    console.error('Error fetching leaderboard:', error);
    return {};
  }
  
  // Create a map of city -> highest price
  const leaders = {};
  data.forEach(row => {
    leaders[row.city] = {
      price: row.price,
      address: row.top_sale_address
    };
  });
  
  console.log('Current leaders sample:', Object.entries(leaders).slice(0, 5).map(([city, info]) => 
    `${city}: $${info.price.toLocaleString()}`
  ).join(', '));
  
  return leaders;
}

// Convert API date to UTC
function convertToUTC(dateValue) {
  if (!dateValue) return null;
  
  if (typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

// Fetch ALL properties from a region (no city filtering)
async function fetchAllFromRegion(regionId, regionName) {
  console.log(`🔍 Fetching ALL properties for ${regionName} region...`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=30`,
      {
        headers: {
          'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
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
    
    console.log(`  Found ${properties.length} total properties\n`);
    return properties;
  } catch (error) {
    console.error(`  Error fetching ${regionName}:`, error.message);
    return [];
  }
}

// Analyze properties to find missing high sales
async function analyzeMissingSales(properties, cityName, currentLeaders, competitionDates) {
  // Need to match the city name as it appears in the leaderboard (without state)
  const leaderboardCityName = cityName.split(',')[0].trim();
  const currentHighest = currentLeaders[leaderboardCityName]?.price || 0;
  
  console.log(`  Current leader for ${leaderboardCityName}: $${currentHighest.toLocaleString()}\n`);
  const missingSales = [];
  
  for (const property of properties) {
    const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
    const saleDate = convertToUTC(property.lastSaleData?.lastSoldDate);
    const address = property.addressInfo?.formattedStreetLine || 'Unknown';
    const apiCity = property.addressInfo?.city || '';
    
    // Skip if invalid data
    if (!price || !saleDate || price <= currentHighest) continue;
    
    // Check if within competition period
    if (saleDate < competitionDates.start || saleDate > competitionDates.end) continue;
    
    // This is a higher sale - why isn't it in our leaderboard?
    const normalizedApiCity = apiCity.trim().toLowerCase();
    const targetCity = cityName.toLowerCase();
    
    // Check various reasons it might be excluded
    let reason = 'Unknown';
    let shouldInclude = false;
    
    // Direct match
    if (normalizedApiCity === targetCity) {
      reason = 'Direct match - should be included!';
      shouldInclude = true;
    }
    // Check canonical mapping
    else if (CANONICAL_CITY[normalizedApiCity] === cityName) {
      reason = 'Matches via canonical mapping - should be included!';
      shouldInclude = true;
    }
    // Neighborhood or suburb
    else if (normalizedApiCity.includes(targetCity) || targetCity.includes(normalizedApiCity)) {
      reason = `Partial match: API="${apiCity}" vs Target="${cityName}"`;
    }
    // Complete mismatch
    else {
      reason = `Different city: API="${apiCity}" vs Target="${cityName}"`;
    }
    
    missingSales.push({
      price,
      address,
      apiCity,
      targetCity: cityName,
      saleDate: saleDate.toISOString().split('T')[0],
      reason,
      shouldInclude,
      priceDiff: price - currentHighest
    });
  }
  
  return missingSales.sort((a, b) => b.price - a.price);
}

// Main function
async function findMissingHighSales(testCity = null) {
  console.log('🔎 FINDING MISSING HIGH-VALUE SALES\n');
  console.log('=' .repeat(50) + '\n');
  
  const competitionDates = await getCompetitionDates();
  console.log(`Competition Period: ${competitionDates.start.toISOString().split('T')[0]} to ${competitionDates.end.toISOString().split('T')[0]}\n`);
  
  const currentLeaders = await getCurrentLeaders();
  console.log(`Found ${Object.keys(currentLeaders).length} cities in leaderboard\n`);
  console.log('=' .repeat(50) + '\n');
  
  const allMissingSales = [];
  
  // Filter cities to check
  const citiesToCheck = testCity 
    ? [[testCity, CITY_REGIONS[testCity]]] 
    : Object.entries(CITY_REGIONS);
    
  if (testCity && !CITY_REGIONS[testCity]) {
    console.error(`❌ City "${testCity}" not found in CITY_REGIONS`);
    console.log('\nAvailable cities:', Object.keys(CITY_REGIONS).slice(0, 10).join(', '), '...');
    return;
  }
  
  // Check each city
  for (const [cityName, regionId] of citiesToCheck) {
    const properties = await fetchAllFromRegion(regionId, cityName);
    const missingSales = await analyzeMissingSales(properties, cityName, currentLeaders, competitionDates);
    
    if (missingSales.length > 0) {
      console.log(`\n❗ ${cityName} - Found ${missingSales.length} sales HIGHER than current leader ($${currentLeaders[cityName]?.price?.toLocaleString() || 0})`);
      
      // Show top 3 missing sales
      missingSales.slice(0, 3).forEach((sale, i) => {
        console.log(`\n  ${i + 1}. $${sale.price.toLocaleString()} (+$${sale.priceDiff.toLocaleString()})`);
        console.log(`     Address: ${sale.address}`);
        console.log(`     API City: "${sale.apiCity}"`);
        console.log(`     Sale Date: ${sale.saleDate}`);
        console.log(`     Status: ${sale.reason}`);
        console.log(`     ACTION: ${sale.shouldInclude ? '🚨 FIX REQUIRED' : '✓ Correctly excluded'}`);
      });
      
      allMissingSales.push(...missingSales.filter(s => s.shouldInclude));
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📋 SUMMARY\n');
  
  if (allMissingSales.length === 0) {
    console.log('✅ No missing high-value sales found! City filtering is working correctly.');
  } else {
    console.log(`🚨 Found ${allMissingSales.length} high-value sales that should be included!\n`);
    
    // Group by issue type
    const byCity = {};
    allMissingSales.forEach(sale => {
      if (!byCity[sale.targetCity]) byCity[sale.targetCity] = [];
      byCity[sale.targetCity].push(sale);
    });
    
    console.log('Cities with missing sales:');
    Object.entries(byCity).forEach(([city, sales]) => {
      console.log(`  - ${city}: ${sales.length} missing sales worth up to $${Math.max(...sales.map(s => s.price)).toLocaleString()}`);
    });
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Update canonical-city.js mapping for these cities');
    console.log('2. Re-run the main scraper to capture these sales');
    console.log('3. Verify the fixes with this script again');
  }
}

// Run the script
const args = process.argv.slice(2);
const testCity = args[0];

if (testCity) {
  console.log(`🏙️  Testing with single city: ${testCity}\n`);
}

findMissingHighSales(testCity).catch(console.error);
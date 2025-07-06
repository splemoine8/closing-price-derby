#!/usr/bin/env node

// Unified scraper that populates the new database structure
// Phase 3 of the refactoring plan

import fetch from 'node-fetch';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { CITY_REGIONS, CITY_FILTER_CONFIG } from './city-regions.js';

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

// Generate deterministic ID for deduplication
function generateSaleId(sale) {
  const key = `${sale.address}|${sale.city_name}|${sale.sale_price}|${sale.sale_timestamp_utc}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Convert API date to UTC
function convertSourceDateToUTC(sourceDate) {
  if (!sourceDate) return null;
  
  if (typeof sourceDate === 'number') {
    return new Date(sourceDate).toISOString();
  }
  
  if (typeof sourceDate === 'string') {
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

// Ensure the property belongs to the target city
function propertyMatchesCity(property, targetCity) {
  // Normalize target (strip state if "Dallas, TX")
  const target = targetCity.split(',')[0].trim().toLowerCase();

  // 1) Try the explicit city field Redfin usually returns
  const apiCity = (property.addressInfo?.city || '').toLowerCase();
  if (apiCity) return apiCity === target;

  // 2) Fallback: parse the formatted street line
  const formatted = (property.addressInfo?.formattedStreetLine || '').toLowerCase();
  // Match "…, dallas, tx" or "…, dallas tx" (case-insensitive)
  return new RegExp(`,\\s*${target}\\b`).test(formatted);
}

// Fetch properties from Redfin API
async function fetchFromRedfin(regionId, cityName) {
  console.log(`  🏠 Fetching properties for ${cityName} (region ${regionId})...`);
  
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
    throw new Error(`Failed to fetch ${cityName}: ${response.status}`);
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
  
  console.log(`  📊 Found ${properties.length} properties`);
  return properties;
}

// Transform property to our sales table format
function transformProperty(property, cityName) {
  const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
  const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
  const rawDate = property.lastSaleData?.lastSoldDate;
  const utcDate = convertSourceDateToUTC(rawDate);
  
  if (!utcDate || price <= 0) return null;
  
  // Filter out absolute outliers
  const ABSOLUTE_MAX_SALE_PRICE = 100000000; // $100M
  if (price > ABSOLUTE_MAX_SALE_PRICE) {
    console.log(`  ⚠️ Skipping outlier: $${price.toLocaleString()} at ${address}`);
    return null;
  }
  
  // No date filtering here - let the VIEW handle competition period filtering
  
  // Use the property's actual city (already validated by propertyMatchesCity)
  // Normalize case - use proper case from our city name
  const propertyCity = property.addressInfo?.city || cityName.split(',')[0].trim();
  const expectedCity = cityName.split(',')[0].trim();
  
  // If the property city matches our expected city (case-insensitive), use our properly cased version
  const trueCity = propertyCity.toLowerCase() === expectedCity.toLowerCase() 
    ? expectedCity 
    : propertyCity;
  
  return {
    address,
    city_name: trueCity,
    sale_price: price,
    sale_timestamp_utc: utcDate,
    bedrooms: property.beds || null,
    bathrooms: property.baths || null,
    square_feet: parseInt(property.sqftInfo?.amount || 0) || null,
    url: property.url ? `https://www.redfin.com${property.url}` : null
  };
}

// Update legacy competition_data table for backward compatibility
async function updateLegacyTable(cityKey, salesData) {
  console.log(`  📦 Legacy Mode: Updating old 'competition_data' table for ${cityKey}...`);
  const { error } = await supa
    .from('competition_data')
    .upsert(
      {
        data_type: 'sales_data',
        city: cityKey,
        data: salesData,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'data_type,city' }
    );

  if (error) {
    console.error(`  ❌ Legacy update failed for ${cityKey}:`, error);
  } else {
    console.log(`  ✅ Legacy update successful for ${cityKey}.`);
  }
}

// Process a single city/region
async function processCityRegion(cityName, regionId) {
  try {
    // Fetch properties from API
    const properties = await fetchFromRedfin(regionId, cityName);
    
    
    // Transform and filter properties
    const newSales = properties
      .filter(p => propertyMatchesCity(p, cityName))  // City filtering FIRST
      .map(p => transformProperty(p, cityName))
      .filter(Boolean);
    
    console.log(`  ✅ Found ${newSales.length} valid ${cityName.split(',')[0]} sales`);
    
    return newSales;
  } catch (error) {
    console.error(`  ❌ Error processing ${cityName}:`, error.message);
    return [];
  }
}

// Main function
async function main() {
  console.log('🏁 Starting competition data update...');
  console.log('📅 Collecting all recent sales (competition filtering done in VIEW)\n');
  
  // 1. Fetch city configurations from database
  const { data: cities, error: citiesError } = await supa
    .from('cities')
    .select('*');
    
  if (citiesError) {
    console.error('❌ Failed to fetch cities:', citiesError);
    process.exit(1);
  }
  
  console.log(`🎯 Processing ${cities.length} cities from database\n`);
  
  let totalNewSales = 0;
  let totalCities = 0;
  
  for (const city of cities) {
    console.log(`\n📍 Processing ${city.name}...`);
    
    // Special handling for New York - process all boroughs
    if (city.name === 'New York') {
      console.log('  🗽 Special NYC processing - fetching all boroughs...');
      const nycConfig = CITY_FILTER_CONFIG['New York'];
      let allNycSales = [];
      
      for (const regionName of nycConfig.allowedCities) {
        const regionId = CITY_REGIONS[regionName];
        if (regionId) {
          console.log(`\n  🌆 Fetching ${regionName}...`);
          const sales = await processCityRegion(regionName, regionId);
          allNycSales.push(...sales);
          await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
        }
      }
      
      // Deduplicate NYC sales
      const salesMap = new Map();
      allNycSales.forEach(sale => {
        sale.city_name = 'New York'; // Normalize city name
        const id = generateSaleId(sale);
        salesMap.set(id, { ...sale, sale_id: id });
      });
      
      const uniqueSales = Array.from(salesMap.values());
      console.log(`  🗽 Total unique NYC sales: ${uniqueSales.length}`);
      
      if (uniqueSales.length > 0) {
        // Upsert to database
        const { error: upsertError } = await supa
          .from('sales')
          .upsert(uniqueSales, { 
            onConflict: 'sale_id',
            ignoreDuplicates: true 
          });
          
        if (upsertError) {
          console.error(`  ❌ Error upserting NYC sales:`, upsertError);
        } else {
          console.log(`  ✅ Successfully upserted ${uniqueSales.length} NYC sales`);
          totalNewSales += uniqueSales.length;
          totalCities++;
          
          // Update legacy table for backward compatibility
          await updateLegacyTable('NewYork', uniqueSales);
        }
      }
      
    } else {
      // Regular city processing
      const regionId = CITY_REGIONS[`${city.name}, ${city.state}`];
      if (!regionId) {
        console.log(`  ⚠️ No region ID found for ${city.name}, ${city.state}`);
        continue;
      }
      
      const sales = await processCityRegion(`${city.name}, ${city.state}`, regionId);
      
      if (sales.length > 0) {
        // Add sale IDs
        const salesWithIds = sales.map(sale => ({
          ...sale,
          sale_id: generateSaleId(sale)
        }));
        
        // Upsert to database
        const { error: upsertError } = await supa
          .from('sales')
          .upsert(salesWithIds, { 
            onConflict: 'sale_id',
            ignoreDuplicates: true 
          });
          
        if (upsertError) {
          console.error(`  ❌ Error upserting sales for ${city.name}:`, upsertError);
        } else {
          console.log(`  ✅ Successfully upserted ${salesWithIds.length} sales`);
          totalNewSales += salesWithIds.length;
          totalCities++;
          
          // Update legacy table for backward compatibility
          const cityKey = city.name.replace(/\s+/g, '');
          await updateLegacyTable(cityKey, salesWithIds);
        }
      }
    }
    
    // Rate limiting between cities
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Competition update complete!');
  console.log(`📊 Processed ${totalCities} cities with ${totalNewSales} total sales`);
  console.log('='.repeat(60));
  
  // Show sample of leaderboard data
  console.log('\n🏆 Current Leaderboard Preview:');
  const { data: leaderboard, error: leaderboardError } = await supa
    .from('leaderboard')
    .select('*')
    .limit(5);
    
  if (leaderboardError) {
    console.error('❌ Failed to fetch leaderboard:', leaderboardError);
  } else if (leaderboard && leaderboard.length > 0) {
    leaderboard.forEach((entry, i) => {
      console.log(`${i + 1}. ${entry.city}: $${entry.price.toLocaleString()} (${entry.multiplier || '-'})`);
    });
  }
}

// Run the scraper
main().catch(error => {
  console.error('❌ Scraper failed:', error);
  process.exit(1);
});
#!/usr/bin/env node

// City-partitioned scraper that reads cities from team-names.json
// Implements idempotent accumulation with SHA256 IDs and atomic writes

import fetch from 'node-fetch';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { CITY_REGIONS } from './city-regions.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Utility functions
function sanitize(city) {
  return city.replace(/[^A-Za-z]/g, ''); // "New York City (Giants)" -> "NewYorkCityGiants"
}

async function pushSales(city, sales) {
  const sanitizedCity = sanitize(city);
  console.log(`🔄 Attempting Supabase upsert for city: "${city}" → sanitized: "${sanitizedCity}"`);
  
  const { data, error } = await supa
    .from('competition_data')
    .upsert(
      {
        data_type: 'sales_data',
        city: sanitizedCity,
        data: sales,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'data_type,city' }
    )
    .select(); // Add select() to return the upserted data

  if (error) {
    console.error(`🔥 Supabase upsert failed for city "${sanitizedCity}":`, error);
    throw error; // fail the cron run so Render alerts you
  }
  
  if (data && data.length > 0) {
    console.log(`✅ Successfully pushed ${sales.length} sales to Supabase for city: "${sanitizedCity}" (confirmed: ${data.length} record(s) upserted)`);
  } else {
    console.warn(`⚠️ Upsert completed but no data returned for city: "${sanitizedCity}" - possible silent failure`);
  }
}

function convertSourceDateToUTC(sourceDate) {
  if (!sourceDate) return null;
  
  if (typeof sourceDate === 'number') {
    return new Date(sourceDate).toISOString();
  }
  
  if (typeof sourceDate === 'string') {
    // RapidAPI returns ISO 8601 UTC strings like "2025-06-16T07:00:00Z"
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
  // Create deterministic ID from key sale properties
  const key = `${saleData.address}|${saleData.city}|${saleData.sale_price}|${saleData.sale_timestamp_utc}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function loadTeamAssignments() {
  try {
    const teamData = await fs.readFile('public/team-names.json', 'utf8');
    const parsed = JSON.parse(teamData);
    return parsed.assignments || {};
  } catch (error) {
    console.error('❌ Failed to load team assignments:', error.message);
    return {};
  }
}

async function loadExistingSalesForCity(cityKey) {
  const filePath = `data/sales-by-city/${cityKey}.json`;
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet - return empty array
    return [];
  }
}

async function getSoldProperties(regionId, cityName) {
  console.log(`🏠 Fetching sold properties for ${cityName} (region ${regionId})`);
  
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
    throw new Error(`Failed to get sold properties for ${cityName}: ${response.status}`);
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
  
  console.log(`📊 Found ${properties.length} properties in ${cityName}`);
  return properties;
}

function transformPropertyToSaleRecord(property, cityName) {
  const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
  const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
  const rawDate = property.lastSaleData?.lastSoldDate;
  const utcDate = convertSourceDateToUTC(rawDate);
  
  if (!utcDate || price <= 0) return null;
  
  // Filter out absolute outliers (data errors)
  const ABSOLUTE_MAX_SALE_PRICE = 100000000; // $100M
  if (price > ABSOLUTE_MAX_SALE_PRICE) {
    console.log(`⚠️  Skipping outlier: $${price.toLocaleString()} at ${address} - exceeds $100M cap`);
    return null;
  }
  
  const saleRecord = {
    address,
    city: cityName.split(',')[0].trim(),
    state: cityName.split(',')[1]?.trim() || '',
    sale_price: price,
    sale_timestamp_utc: utcDate,
    scraped_at_utc: new Date().toISOString(),
    source: 'rapidapi',
    bedrooms: property.beds || 0,
    bathrooms: property.baths || 0,
    square_feet: parseInt(property.sqftInfo?.amount || 0),
    url: property.url ? `https://www.redfin.com${property.url}` : null
  };
  
  // Generate deterministic ID
  saleRecord.sale_id = generateDeterministicId(saleRecord);
  
  return saleRecord;
}

async function atomicWriteJson(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  
  try {
    // Write to temporary file
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    
    // Atomic rename
    await fs.rename(tempPath, filePath);
    
    console.log(`💾 Atomically saved ${data.length} records to ${filePath}`);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw error;
  }
}

async function accumulateSalesForCity(cityName, teamAssignments) {
  const cityKey = cityName.split(',')[0].replace(/\s+/g, ''); // e.g., "KansasCity"
  
  console.log(`\n🔍 Processing ${cityName} (assigned to: ${teamAssignments[cityName.split(',')[0].trim()] || 'Unassigned'})...`);
  
  // Get region ID
  const regionId = CITY_REGIONS[cityName];
  if (!regionId) {
    console.log(`⚠️ No region ID found for ${cityName}`);
    return { newSales: 0, totalSales: 0 };
  }
  
  try {
    // Load existing sales
    const existingSales = await loadExistingSalesForCity(cityKey);
    const existingIds = new Set(existingSales.map(s => s.sale_id));
    
    console.log(`📂 Loaded ${existingSales.length} existing sales for ${cityName}`);
    
    // Fetch new data from API
    const properties = await getSoldProperties(regionId, cityName);
    
    // Transform and filter new sales
    let newSales = properties
      .map(property => transformPropertyToSaleRecord(property, cityName))
      .filter(sale => sale !== null)
      .filter(sale => !existingIds.has(sale.sale_id));
    
    
    console.log(`🆕 Found ${newSales.length} new sales (${properties.length - newSales.length} duplicates filtered)`);
    
    // Only write if we have new data
    if (newSales.length > 0) {
      const allSales = [...existingSales, ...newSales];
      
      // Ensure directory exists
      await fs.mkdir('data/sales-by-city', { recursive: true });
      
      // Atomic write
      await atomicWriteJson(`data/sales-by-city/${cityKey}.json`, allSales);
      
      // Push to Supabase
      await pushSales(cityKey, allSales);
      
      return { newSales: newSales.length, totalSales: allSales.length };
    } else {
      console.log(`✅ No new sales to add for ${cityName}`);
      return { newSales: 0, totalSales: existingSales.length };
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${cityName}:`, error.message);
    return { newSales: 0, totalSales: 0, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting city-partitioned sales accumulation...\n');
  
  // Load team assignments to get current cities
  const teamAssignments = await loadTeamAssignments();
  const cities = Object.keys(teamAssignments);
  
  if (cities.length === 0) {
    console.log('⚠️ No cities found in team-names.json. Make sure draft has occurred.');
    process.exit(1);
  }
  
  console.log(`🎯 Processing ${cities.length} cities:`, cities.join(', '));
  
  const results = {};
  const errors = [];
  
  for (const cityName of cities) {
    // Find full city name with state from CITY_REGIONS
    const fullCityName = Object.keys(CITY_REGIONS).find(fullName => 
      fullName.split(',')[0].trim() === cityName
    );
    
    if (!fullCityName) {
      console.log(`⚠️ Could not find region mapping for ${cityName}`);
      errors.push(`No region mapping for ${cityName}`);
      continue;
    }
    
    const result = await accumulateSalesForCity(fullCityName, teamAssignments);
    results[cityName] = result;
    
    // Rate limiting - 250ms between requests
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 ACCUMULATION SUMMARY');
  console.log('='.repeat(60));
  
  let totalNew = 0;
  let totalAll = 0;
  
  Object.entries(results).forEach(([city, result]) => {
    if (result.error) {
      console.log(`❌ ${city}: Error - ${result.error}`);
    } else {
      console.log(`✅ ${city}: +${result.newSales} new (${result.totalSales} total)`);
      totalNew += result.newSales;
      totalAll += result.totalSales;
    }
  });
  
  console.log(`\n🎯 Total: +${totalNew} new sales, ${totalAll} total across all cities`);
  
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} errors:`, errors);
  }
  
  console.log('\n✅ City-partitioned accumulation complete!');
}

// Run the scraper
main().catch(error => {
  console.error('❌ Scraper failed:', error);
  process.exit(1);
});
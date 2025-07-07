#!/usr/bin/env node

// Fixed backfill script using valid soldWithin parameter
// Uses soldWithin=30 (1 month) to cover the 14-day competition period

import fetch from 'node-fetch';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { CITY_REGIONS, CITY_FILTER_CONFIG } from './city-regions.js';
import { CANONICAL_CITY } from './utils/canonical-city.js';

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

// Competition period
const COMPETITION_START = new Date('2025-06-23T07:00:00Z');
const COMPETITION_END = new Date('2025-07-07T06:59:59Z');

console.log(`🏁 Competition Backfill Script (Fixed)`);
console.log(`📅 Period: ${COMPETITION_START.toISOString()} to ${COMPETITION_END.toISOString()}`);
console.log(`📊 Using soldWithin=30 (valid API parameter for 1 month)\n`);

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
      return null;
    }
    return parsed.toISOString();
  }
  
  return null;
}

// Check if sale is in competition period
function isInCompetitionPeriod(utcDate) {
  if (!utcDate) return false;
  const saleDate = new Date(utcDate);
  return saleDate >= COMPETITION_START && saleDate <= COMPETITION_END;
}

// City filtering function
function propertyMatchesCity(property, targetCity) {
  const target = targetCity.split(',')[0].trim().toLowerCase();
  const apiCity = (property.addressInfo?.city || '').trim().toLowerCase();
  if (apiCity) return apiCity === target;
  const formatted = (property.addressInfo?.formattedStreetLine || '').trim().toLowerCase();
  return new RegExp(`,\\s*${target}\\b`).test(formatted);
}

// Fetch properties with pagination
async function fetchFromRedfin(regionId, cityName) {
  console.log(`  🏠 Fetching properties for ${cityName} (region ${regionId})...`);
  
  const allProperties = [];
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;
  const limit = 350;
  
  while (hasMore && pageCount < 10) { // Limit to 10 pages (3,500 properties) for safety
    const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=30&limit=${limit}&offset=${offset}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${cityName}: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract properties from nested structure
      const pageProperties = [];
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach(item => {
          if (item.homeData) {
            pageProperties.push(item.homeData);
          }
        });
      }
      
      allProperties.push(...pageProperties);
      pageCount++;
      
      console.log(`    📄 Page ${pageCount}: ${pageProperties.length} properties (total: ${allProperties.length})`);
      
      // Check if we should continue
      hasMore = pageProperties.length === limit;
      offset += limit;
      
      // Rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (error) {
      console.error(`    ❌ Error on page ${pageCount + 1}:`, error.message);
      hasMore = false;
    }
  }
  
  console.log(`  📊 Total fetched: ${allProperties.length} properties`);
  return allProperties;
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
    return null;
  }
  
  // Only include sales in competition period
  if (!isInCompetitionPeriod(utcDate)) {
    return null;
  }
  
  // Normalize city name
  const rawCity = (property.addressInfo?.city || cityName.split(',')[0]).trim();
  const key = rawCity.toLowerCase();
  const expectedCity = cityName.split(',')[0].trim();
  const trueCity = CANONICAL_CITY[key] || expectedCity;
  
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

// Process a single city/region
async function processCityRegion(cityName, regionId) {
  try {
    // Fetch properties from API
    const properties = await fetchFromRedfin(regionId, cityName);
    
    // Transform and filter properties
    const newSales = properties
      .filter(p => propertyMatchesCity(p, cityName))
      .map(p => transformProperty(p, cityName))
      .filter(Boolean);
    
    console.log(`  ✅ Found ${newSales.length} valid ${cityName.split(',')[0]} sales in competition period`);
    
    // Show date range of sales found
    if (newSales.length > 0) {
      const dates = newSales.map(s => new Date(s.sale_timestamp_utc));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      console.log(`  📅 Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    }
    
    return newSales;
  } catch (error) {
    console.error(`  ❌ Error processing ${cityName}:`, error.message);
    return [];
  }
}

// Process a city and update database
async function backfillCity(city) {
  console.log(`\n📍 Processing ${city.name}...`);
  
  let allSales = [];
  
  if (city.name === 'New York') {
    // Special NYC processing
    console.log('  🗽 Special NYC processing - fetching all boroughs...');
    
    const nycBoroughs = CITY_FILTER_CONFIG['New York']?.allowedCities || [];
    for (const boroughName of nycBoroughs) {
      const regionId = CITY_REGIONS[boroughName];
      if (!regionId) continue;
      
      console.log(`\n  🌆 Fetching ${boroughName}...`);
      const sales = await processCityRegion(boroughName, regionId);
      
      // Normalize all NYC sales to "New York"
      sales.forEach(sale => sale.city_name = 'New York');
      allSales.push(...sales);
      
      await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
    }
    
    // Deduplicate NYC sales
    const seen = new Set();
    allSales = allSales.filter(sale => {
      const key = `${sale.address}|${sale.sale_price}|${sale.sale_timestamp_utc}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log(`  🗽 Total unique NYC sales: ${allSales.length}`);
  } else {
    // Regular city processing
    const regionId = CITY_REGIONS[`${city.name}, ${city.state}`];
    if (!regionId) {
      console.log(`  ⚠️ No region ID found for ${city.name}, ${city.state}`);
      return { city: city.name, added: 0, updated: 0, errors: 0 };
    }
    
    allSales = await processCityRegion(`${city.name}, ${city.state}`, regionId);
  }
  
  // Update database
  if (allSales.length > 0) {
    console.log(`  💾 Updating database with ${allSales.length} sales...`);
    
    let added = 0;
    let updated = 0;
    let errors = 0;
    
    // Process in smaller batches
    const batchSize = 50;
    for (let i = 0; i < allSales.length; i += batchSize) {
      const batch = allSales.slice(i, i + batchSize);
      
      // Add sale_id to each record
      const salesWithIds = batch.map(sale => ({
        ...sale,
        sale_id: generateSaleId(sale)
      }));
      
      try {
        const { error } = await supa
          .from('sales')
          .upsert(salesWithIds, { onConflict: 'sale_id' });
          
        if (error) {
          console.error(`    ❌ Batch error:`, error.message);
          errors += batch.length;
        } else {
          added += batch.length;
          console.log(`    ✅ Batch ${Math.floor(i/batchSize) + 1}: ${batch.length} sales processed`);
        }
      } catch (err) {
        console.error(`    ❌ Batch exception:`, err.message);
        errors += batch.length;
      }
    }
    
    console.log(`  ✅ Complete: ${added} processed, ${errors} errors`);
    return { city: city.name, added, updated, errors };
  }
  
  return { city: city.name, added: 0, updated: 0, errors: 0 };
}

async function main() {
  console.log('\n🚀 Starting competition period backfill...\n');
  
  // Get cities from database
  const { data: cities, error } = await supa
    .from('cities')
    .select('*')
    .order('name');
    
  if (error) {
    console.error('❌ Error fetching cities:', error);
    return;
  }
  
  const results = [];
  
  // Process each city
  for (const city of cities) {
    const result = await backfillCity(city);
    results.push(result);
    
    // Rate limiting between cities
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL SUMMARY');
  console.log('='.repeat(60));
  
  let totalAdded = 0;
  let totalErrors = 0;
  
  results.forEach(result => {
    console.log(`${result.city}: ${result.added} processed, ${result.errors} errors`);
    totalAdded += result.added;
    totalErrors += result.errors;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${totalAdded} sales processed, ${totalErrors} errors`);
  console.log('='.repeat(60));
  
  if (totalErrors > 0) {
    console.log('\n⚠️ Some errors occurred. Check logs for details.');
  } else {
    console.log('\n✅ Backfill completed successfully!');
  }
}

// Check for specific city argument
const cityArg = process.argv[2];
if (cityArg) {
  // Run for specific city
  console.log(`\n🎯 Running backfill for ${cityArg} only...\n`);
  
  supa
    .from('cities')
    .select('*')
    .eq('name', cityArg)
    .single()
    .then(({ data: city, error }) => {
      if (error || !city) {
        console.error(`❌ City "${cityArg}" not found`);
        process.exit(1);
      }
      
      backfillCity(city).then(result => {
        console.log('\n✅ Backfill complete!');
        console.log(`${result.added} sales processed, ${result.errors} errors`);
      });
    });
} else {
  // Run for all cities
  main().catch(console.error);
}
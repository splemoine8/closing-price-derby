#!/usr/bin/env node

// Export all sales data for each city during the competition period
// This script fetches directly from the API and applies the same filtering logic as the scraper

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { CITY_REGIONS, CITY_FILTER_CONFIG } from './city-regions.js';
import { CANONICAL_CITY } from './utils/canonical-city.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// CLI argument parsing for custom date range and mode
const args = process.argv.slice(2);
let competitionStart = null;
let competitionEnd = null;
let maxPages = Infinity;
let exportMode = 'full';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start' && args[i + 1]) {
    competitionStart = new Date(args[i + 1]);
    if (isNaN(competitionStart.getTime())) {
      console.error('❌ Invalid start date');
      process.exit(1);
    }
    i++;
  } else if (args[i] === '--end' && args[i + 1]) {
    competitionEnd = new Date(args[i + 1]);
    if (isNaN(competitionEnd.getTime())) {
      console.error('❌ Invalid end date');
      process.exit(1);
    }
    i++;
  } else if (args[i] === '--mode' && args[i + 1]) {
    exportMode = args[i + 1];
    if (exportMode === 'quick') {
      maxPages = 1;
    } else if (exportMode.startsWith('pages=')) {
      maxPages = parseInt(exportMode.split('=')[1], 10);
    }
    i++;
  } else if (args[i] === '--quick') {
    // Backward compatibility
    exportMode = 'quick';
    maxPages = 1;
  } else if (args[i] === '--pages' && args[i + 1]) {
    // Backward compatibility
    maxPages = parseInt(args[i + 1], 10);
    exportMode = `pages=${maxPages}`;
    i++;
  }
}

// Competition period (defaults or from CLI args)
const COMPETITION_START = competitionStart || new Date('2025-06-23T07:00:00Z');
const COMPETITION_END = competitionEnd || new Date('2025-07-07T06:59:59Z');

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

// City filtering function (same as scraper)
function propertyMatchesCity(property, targetCity) {
  const target = targetCity.split(',')[0].trim().toLowerCase();
  const apiCity = (property.addressInfo?.city || '').trim().toLowerCase();
  if (apiCity) return apiCity === target;
  const formatted = (property.addressInfo?.formattedStreetLine || '').trim().toLowerCase();
  return new RegExp(`,\\s*${target}\\b`).test(formatted);
}

// Rate limiting helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch properties from Redfin API with pagination
async function fetchFromRedfin(regionId, cityName, limit = 350) {
  console.log(`  🏠 Fetching properties for ${cityName} (region ${regionId})...`);
  
  const allProperties = [];
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;
  
  while (hasMore && pageCount < maxPages) {
    const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error for ${cityName}: ${response.status} ${response.statusText}`);
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
    
    // Rate limiting between pages (RapidAPI: 100 req/min = 600ms minimum)
    if (hasMore) {
      await sleep(800);
    }
  }
  
  console.log(`  📊 Total fetched: ${allProperties.length} properties`);
  return allProperties;
}

// Transform property to sale record
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
  
  // Apply competition period filter
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
    city: trueCity,
    state: cityName.split(',')[1]?.trim() || '',
    price,
    date: utcDate,
    beds: property.beds || null,
    baths: property.baths || null,
    sqft: parseInt(property.sqftInfo?.amount || 0) || null,
    url: property.url ? `https://www.redfin.com${property.url}` : null
  };
}

// Process a single city
async function processCityData(cityName, regionId) {
  try {
    const properties = await fetchFromRedfin(regionId, cityName);
    
    // Apply city filtering and transformation
    const sales = properties
      .filter(p => propertyMatchesCity(p, cityName))
      .map(p => transformProperty(p, cityName))
      .filter(sale => sale !== null)
      .sort((a, b) => b.price - a.price);
    
    console.log(`  ✅ Found ${sales.length} valid sales in competition period`);
    
    return sales;
  } catch (error) {
    console.error(`  ❌ Error processing ${cityName}:`, error.message);
    return [];
  }
}

// Export to CSV
function exportToCSV(sales, cityName) {
  const headers = ['Address', 'City', 'State', 'Price', 'Date', 'Beds', 'Baths', 'Sqft', 'URL'];
  const rows = [headers];
  
  sales.forEach(sale => {
    rows.push([
      sale.address,
      sale.city,
      sale.state,
      sale.price,
      new Date(sale.date).toLocaleDateString(),
      sale.beds || '',
      sale.baths || '',
      sale.sqft || '',
      sale.url || ''
    ]);
  });
  
  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  return csv;
}

async function main() {
  console.log('🏁 Starting sales data export...\n');
  console.log(`📅 Competition Period: ${COMPETITION_START.toISOString()} to ${COMPETITION_END.toISOString()}`);
  console.log(`📋 Export Mode: ${exportMode}${maxPages < Infinity ? ` (max ${maxPages} pages)` : ''}\n`);
  
  // Create export directory
  const exportDir = join(__dirname, 'exports', new Date().toISOString().split('T')[0]);
  mkdirSync(exportDir, { recursive: true });
  
  // Get cities from database
  const { data: cities, error } = await supa
    .from('cities')
    .select('*')
    .order('name');
    
  if (error) {
    console.error('❌ Error fetching cities:', error);
    return;
  }
  
  const summaryData = [];
  
  // Process each city
  for (const city of cities) {
    console.log(`\n📍 Processing ${city.name}...`);
    
    let allSales = [];
    
    if (city.name === 'New York') {
      // Special NYC processing
      console.log('  🗽 Special NYC processing - fetching all boroughs...');
      
      // Get NYC boroughs from the config
      const nycBoroughs = CITY_FILTER_CONFIG['New York']?.allowedCities || [];
      for (const boroughName of nycBoroughs) {
        const regionId = CITY_REGIONS[boroughName];
        if (!regionId) continue;
        console.log(`\n  🌆 Fetching ${boroughName}...`);
        const sales = await processCityData(boroughName, regionId);
        
        // Normalize all NYC sales to "New York"
        sales.forEach(sale => sale.city = 'New York');
        allSales.push(...sales);
        
        await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
      }
      
      // Deduplicate NYC sales
      const seen = new Set();
      allSales = allSales.filter(sale => {
        const key = `${sale.address}|${sale.price}|${sale.date}`;
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
        continue;
      }
      
      allSales = await processCityData(`${city.name}, ${city.state}`, regionId);
    }
    
    // Sort by price descending
    allSales.sort((a, b) => b.price - a.price);
    
    // Export to CSV
    if (allSales.length > 0) {
      const csvContent = exportToCSV(allSales, city.name);
      const filename = join(exportDir, `${city.name.replace(/\s+/g, '_')}_sales.csv`);
      writeFileSync(filename, csvContent);
      console.log(`  💾 Exported to ${filename}`);
      
      // Add to summary
      summaryData.push({
        city: city.name,
        totalSales: allSales.length,
        highestSale: allSales[0],
        top5Sales: allSales.slice(0, 5)
      });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  // Generate summary report
  console.log('\n\n📊 SUMMARY REPORT');
  console.log('==================\n');
  
  const summaryRows = [];
  
  for (const data of summaryData) {
    console.log(`${data.city}:`);
    console.log(`  Total Sales: ${data.totalSales}`);
    if (data.highestSale) {
      console.log(`  Highest Sale: $${data.highestSale.price.toLocaleString()} - ${data.highestSale.address}`);
    }
    console.log('');
    
    // Add to summary CSV
    summaryRows.push([
      data.city,
      data.totalSales,
      data.highestSale ? data.highestSale.price : 0,
      data.highestSale ? data.highestSale.address : 'N/A'
    ]);
  }
  
  // Export summary
  const summaryCSV = [
    ['City', 'Total Sales', 'Highest Price', 'Highest Address'],
    ...summaryRows
  ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  const summaryFile = join(exportDir, 'SUMMARY.csv');
  writeFileSync(summaryFile, summaryCSV);
  console.log(`\n💾 Summary exported to ${summaryFile}`);
  console.log(`\n✅ Export complete! Check ${exportDir} for all CSV files.`);
}

main().catch(console.error);
#!/usr/bin/env node

// Fixed version of verify-highest-sales.js that respects quick mode
// This script compares three sources: API, sales table, and leaderboard view

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

// Check for quick mode
const QUICK_MODE = process.env.QUICK_VERIFY === '1' || process.argv.includes('--quick');

// CLI argument parsing for custom date range
const args = process.argv.slice(2);
let competitionStart = null;
let competitionEnd = null;

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

// City filtering function
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

// Get highest sale from API for a city (with pagination in full mode)
async function getHighestSaleFromAPI(cityName, regionId) {
  if (QUICK_MODE) {
    console.log(`    📱 Quick mode: checking first page only`);
    return getHighestFromSinglePage(cityName, regionId);
  }
  
  // Full mode: paginate through all results
  console.log(`    📚 Full mode: checking all pages`);
  let highestSale = null;
  let offset = 0;
  let pageCount = 0;
  const limit = 350;
  let hasMore = true;
  
  try {
    while (hasMore) {
      const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&limit=${limit}&offset=${offset}`;
      const response = await fetch(url, {
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
      
      pageCount++;
      console.log(`      📄 Page ${pageCount}: ${properties.length} properties`);
      
      // Process properties from this page
      const pageSales = properties
        .filter(p => propertyMatchesCity(p, cityName))
        .map(p => {
          const address = p.addressInfo?.formattedStreetLine || 'Unknown';
          const price = parseInt(p.priceInfo?.amount || p.priceInfo?.homePrice?.int64Value || 0);
          const utcDate = convertSourceDateToUTC(p.lastSaleData?.lastSoldDate);
          
          if (!utcDate || price <= 0 || price > 100000000) return null;
          if (!isInCompetitionPeriod(utcDate)) return null;
          
          return { address, price, date: utcDate };
        })
        .filter(sale => sale !== null);
      
      // Update highest if found
      const pageHighest = pageSales.sort((a, b) => b.price - a.price)[0];
      if (pageHighest && (!highestSale || pageHighest.price > highestSale.price)) {
        highestSale = pageHighest;
      }
      
      // Check if we should continue
      hasMore = properties.length === limit;
      offset += limit;
      
      // Rate limiting
      if (hasMore) {
        await sleep(800);
      }
    }
    
    return highestSale;
  } catch (error) {
    console.error(`  ❌ API Error for ${cityName}:`, error.message);
    return null;
  }
}

// Get highest from single page (quick mode)
async function getHighestFromSinglePage(cityName, regionId) {
  try {
    const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&limit=350&offset=0`;
    const response = await fetch(url, {
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
    
    // Filter and transform
    const validSales = properties
      .filter(p => propertyMatchesCity(p, cityName))
      .map(p => {
        const address = p.addressInfo?.formattedStreetLine || 'Unknown';
        const price = parseInt(p.priceInfo?.amount || p.priceInfo?.homePrice?.int64Value || 0);
        const utcDate = convertSourceDateToUTC(p.lastSaleData?.lastSoldDate);
        
        if (!utcDate || price <= 0 || price > 100000000) return null;
        if (!isInCompetitionPeriod(utcDate)) return null;
        
        return { address, price, date: utcDate };
      })
      .filter(sale => sale !== null)
      .sort((a, b) => b.price - a.price);
    
    return validSales[0] || null;
  } catch (error) {
    console.error(`  ❌ API Error for ${cityName}:`, error.message);
    return null;
  }
}

// Get highest sale from database
async function getHighestSaleFromDB(cityName) {
  try {
    const { data, error } = await supa
      .from('sales')
      .select('address, sale_price, sale_timestamp_utc')
      .eq('city_name', cityName)
      .gte('sale_timestamp_utc', COMPETITION_START.toISOString())
      .lte('sale_timestamp_utc', COMPETITION_END.toISOString())
      .order('sale_price', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    if (!data) return null;
    
    return {
      address: data.address,
      price: data.sale_price,
      date: data.sale_timestamp_utc
    };
  } catch (error) {
    console.error(`  ❌ DB Error for ${cityName}:`, error.message);
    return null;
  }
}

// Get data from leaderboard view
async function getLeaderboardData(cityName) {
  try {
    const { data, error } = await supa
      .from('leaderboard')
      .select('price, multiplier, top_sale_address')
      .eq('city', cityName)
      .single();
    
    if (error) throw error;
    
    return {
      price: data.price || 0,
      multiplier: data.multiplier || '-',
      address: data.top_sale_address || null
    };
  } catch (error) {
    console.error(`  ❌ Leaderboard Error for ${cityName}:`, error.message);
    return null;
  }
}

// Process NYC specially
async function processNYC() {
  console.log('\n📍 Processing New York (special handling)...');
  
  let highestSale = null;
  const allSales = [];
  
  // Fetch from all boroughs
  const nycBoroughs = CITY_FILTER_CONFIG['New York']?.allowedCities || [];
  for (const boroughName of nycBoroughs) {
    const regionId = CITY_REGIONS[boroughName];
    if (!regionId) continue;
    console.log(`  🌆 Checking ${boroughName}...`);
    const boroughHighest = await getHighestSaleFromAPI(boroughName, regionId);
    
    if (boroughHighest) {
      allSales.push(boroughHighest);
    }
    
    await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
  }
  
  // Find overall highest
  if (allSales.length > 0) {
    highestSale = allSales.sort((a, b) => b.price - a.price)[0];
  }
  
  const dbSale = await getHighestSaleFromDB('New York');
  const leaderboard = await getLeaderboardData('New York');
  
  return {
    city: 'New York',
    api: highestSale,
    db: dbSale,
    leaderboard: leaderboard
  };
}

// Process regular city
async function processCity(city) {
  console.log(`\n📍 Processing ${city.name}...`);
  
  const regionId = CITY_REGIONS[`${city.name}, ${city.state}`];
  if (!regionId) {
    console.log(`  ⚠️ No region ID found`);
    return null;
  }
  
  const apiSale = await getHighestSaleFromAPI(`${city.name}, ${city.state}`, regionId);
  const dbSale = await getHighestSaleFromDB(city.name);
  const leaderboard = await getLeaderboardData(city.name);
  
  return {
    city: city.name,
    api: apiSale,
    db: dbSale,
    leaderboard: leaderboard
  };
}

// Compare results and generate report
function compareResults(results) {
  const report = [];
  let totalCities = 0;
  let matchingCities = 0;
  let issues = [];
  
  results.forEach(result => {
    if (!result) return;
    
    totalCities++;
    const { city, api, db, leaderboard } = result;
    
    // Check if all sources match
    let status = '✅ MATCH';
    let isMatch = true;
    const details = [];
    
    // In quick mode, note that API data is partial
    if (QUICK_MODE && api && db && api.price < db.price) {
      status = '📊 PARTIAL DATA';
      details.push(`Quick mode: API shows page 1 only ($${api.price.toLocaleString()}) vs full DB ($${db.price.toLocaleString()})`);
      isMatch = true; // Don't count as failure in quick mode
    } else if (api && db) {
      if (Math.abs(api.price - db.price) > 1) { // Allow $1 difference for rounding
        status = '⚠️ PRICE MISMATCH';
        isMatch = false;
        details.push(`API: $${api.price.toLocaleString()} vs DB: $${db.price.toLocaleString()}`);
      }
    } else if (api && !db) {
      status = '❌ MISSING IN DB';
      isMatch = false;
      details.push('Sale found in API but not in database');
    } else if (!api && db) {
      status = '❌ EXTRA IN DB';
      isMatch = false;
      details.push('Sale in database but not found via API');
    } else if (!api && !db) {
      status = '⚠️ NO SALES';
      isMatch = false;
      details.push('No sales found in competition period');
    }
    
    // Compare with leaderboard
    if (leaderboard && db) {
      if (Math.abs(leaderboard.price - db.price) > 1) {
        status = '❌ LEADERBOARD MISMATCH';
        isMatch = false;
        details.push(`Leaderboard shows $${leaderboard.price.toLocaleString()}`);
      }
    }
    
    if (isMatch) matchingCities++;
    
    // Build report entry
    const entry = {
      city,
      status,
      api: api ? `$${api.price.toLocaleString()} - ${api.address}` : 'No sales',
      db: db ? `$${db.price.toLocaleString()} - ${db.address}` : 'No sales',
      leaderboard: leaderboard ? `$${(leaderboard.price/1000000).toFixed(1)}M (${leaderboard.multiplier})` : 'N/A',
      details: details.join('; ')
    };
    
    report.push(entry);
    
    if (!isMatch && status !== '📊 PARTIAL DATA') {
      issues.push(entry);
    }
  });
  
  return {
    report,
    summary: {
      totalCities,
      matchingCities,
      mismatchCount: totalCities - matchingCities,
      successRate: ((matchingCities / totalCities) * 100).toFixed(1)
    },
    issues
  };
}

async function main() {
  console.log('🏁 Starting highest sales verification...\n');
  console.log(`📅 Competition Period: ${COMPETITION_START.toISOString()} to ${COMPETITION_END.toISOString()}`);
  console.log(`📋 Verification Mode: ${QUICK_MODE ? 'QUICK (page 1 only)' : 'FULL (all pages)'}\n`);
  
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
    if (city.name === 'New York') {
      results.push(await processNYC());
    } else {
      results.push(await processCity(city));
    }
    
    await new Promise(resolve => setTimeout(resolve, 250)); // Rate limiting
  }
  
  // Generate report
  const { report, summary, issues } = compareResults(results);
  
  // Print report
  console.log('\n\n' + '='.repeat(80));
  console.log('VERIFICATION REPORT');
  console.log('='.repeat(80) + '\n');
  
  if (QUICK_MODE) {
    console.log('⚠️ QUICK MODE: API results are from first page only (partial data)');
    console.log('📊 Use full mode for comprehensive verification\n');
  }
  
  report.forEach(entry => {
    console.log(`City: ${entry.city}`);
    console.log(`Status: ${entry.status}`);
    console.log(`- API Highest:   ${entry.api}`);
    console.log(`- DB Highest:    ${entry.db}`);
    console.log(`- Leaderboard:   ${entry.leaderboard}`);
    if (entry.details) {
      console.log(`- Details: ${entry.details}`);
    }
    console.log('');
  });
  
  // Print summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Cities: ${summary.totalCities}`);
  console.log(`Matching: ${summary.matchingCities}`);
  console.log(`Mismatches: ${summary.mismatchCount}`);
  console.log(`Success Rate: ${summary.successRate}%`);
  
  // Print issues if any
  if (issues.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('ISSUES REQUIRING ATTENTION');
    console.log('='.repeat(80) + '\n');
    
    issues.forEach(issue => {
      console.log(`❗ ${issue.city}: ${issue.status}`);
      console.log(`   ${issue.details}`);
      console.log('');
    });
  }
  
  // Export report
  const exportDir = join(__dirname, 'exports', new Date().toISOString().split('T')[0]);
  mkdirSync(exportDir, { recursive: true });
  
  const reportFile = join(exportDir, 'verification-report.json');
  writeFileSync(reportFile, JSON.stringify({ report, summary, issues, mode: QUICK_MODE ? 'quick' : 'full' }, null, 2));
  console.log(`\n💾 Full report exported to ${reportFile}`);
  
  // Exit with appropriate code
  // In quick mode, don't fail on partial data mismatches
  const hasRealIssues = issues.filter(i => i.status !== '📊 PARTIAL DATA').length > 0;
  process.exit(hasRealIssues ? 1 : 0);
}

main().catch(console.error);
#!/usr/bin/env node

/**
 * Script to calculate and compare new market median baselines for the competition.
 * This version uses a smart recursive function to fetch all sales data,
 * guaranteeing a complete dataset for accurate median calculation.
 *
 * IT DOES NOT UPDATE ANY FILES. It only displays a comparison.
 *
 * Usage:
 * To run for all cities: node ./scripts/calculate-new-baselines.js
 * To run for a single city: node ./scripts/calculate-new-baselines.js --city="Houston"
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { CITY_REGIONS, CITY_FILTER_CONFIG } from './city-regions.js';

// --- CONFIGURATION ---
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';
const DAYS_FOR_BASELINE = 90;
const API_FETCH_WINDOW = 180;
const MIN_SALES_REQUIRED = 5;
const API_PAGE_LIMIT = 1000;
const VALID_HOME_TYPES = '1,2,3,4,7,8';
const MIN_BRACKET_WIDTH = 5000; // Safety guard: stop recursing if price range is less than $5k
const MAX_RECURSION_DEPTH = 15; // Safety guard: prevent infinite recursion

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// --- SUPABASE CLIENT ---
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Fetches the active competition's start date from the database.
 * @returns {Promise<Date|null>}
 */
async function getCompetitionStartDate() {
  console.log('🔍 Fetching active competition start date from Supabase...');
  const { data, error } = await supa
    .from('competition_config')
    .select('utc_start')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    console.error('❌ Could not fetch active competition start date:', error?.message || 'No active competition found.');
    return null;
  }

  const startDate = new Date(data.utc_start);
  console.log(`✅ Active competition start date found: ${startDate.toUTCString()}`);
  return startDate;
}

/**
 * Fetches the list of cities and their current baselines from Supabase.
 * @returns {Promise<{citiesToProcess: Array, currentBaselines: Object}>}
 */
async function loadCitiesAndBaselinesFromSupabase() {
    console.log('🏙️  Fetching city configurations from Supabase...');
    const { data, error } = await supa.from('cities').select('name, state, region_id, baseline_price');

    if (error || !data) {
        console.error('❌ Could not fetch cities from Supabase:', error?.message || 'No cities found.');
        return { citiesToProcess: [], currentBaselines: {} };
    }

    const citiesToProcess = data.map(city => ({
        name: city.name,
        state: city.state,
        region_id: city.region_id,
    }));

    const currentBaselines = data.reduce((acc, city) => {
        acc[city.name] = city.baseline_price;
        return acc;
    }, {});
    
    console.log(`✅ Found ${citiesToProcess.length} cities to process.`);
    return { citiesToProcess, currentBaselines };
}

/**
 * A single, rate-limited API call to Redfin.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<Object>} - The JSON response from the API.
 */
async function callRedfinApi(url) {
    await new Promise(resolve => setTimeout(resolve, 250)); // Rate limit every call
    const response = await fetch(url, { headers: { 'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY } });
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status} for URL: ${url}`);
    }
    return response.json();
}

/**
 * Recursively fetches all sold properties for a given region and price bracket,
 * subdividing the bracket if the API limit is reached.
 * @param {string} regionId - The Redfin region ID.
 * @param {number} minPrice - The minimum price for the current bracket.
 * @param {number} maxPrice - The maximum price for the current bracket.
 * @param {number} depth - The current recursion depth.
 * @returns {Promise<Array<Object>>} - A promise resolving to an array of all property data in the bracket.
 */
async function fetchCompleteSoldSet(regionId, minPrice, maxPrice, depth = 0) {
    const priceSegment = maxPrice ? `,${maxPrice}` : '';
    const priceParam = `&prices=${minPrice}${priceSegment}`;
    const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=${API_FETCH_WINDOW}&limit=${API_PAGE_LIMIT}&page=1${priceParam}&homeType=${VALID_HOME_TYPES}`;

    const pageData = await callRedfinApi(url);
    const properties = pageData.data?.map(item => item.homeData) || [];

    if (properties.length < API_PAGE_LIMIT) {
        return properties;
    }

    if ((maxPrice - minPrice) <= MIN_BRACKET_WIDTH || depth >= MAX_RECURSION_DEPTH) {
        console.warn(`  ⚠️ Bracket $${minPrice}-$${maxPrice} still at cap but is too small or deep to subdivide; accepting possible minor undercount.`);
        return properties;
    }

    console.log(`  ...bracket $${minPrice.toLocaleString()}-$${(maxPrice || 'unlimited').toLocaleString()} is full. Subdividing...`);
    const midPrice = Math.floor((minPrice + maxPrice) / 2);

    const lowerHalf = await fetchCompleteSoldSet(regionId, minPrice, midPrice, depth + 1);
    const upperHalf = await fetchCompleteSoldSet(regionId, midPrice + 1, maxPrice, depth + 1);

    return [...lowerHalf, ...upperHalf];
}

/**
 * Applies all data quality filters to the raw list of properties.
 * @param {Array<Object>} properties - The raw properties from the API.
 * @param {Array<string>} targetCityNames - An array of city names to include (e.g., ["Dallas"] or ["Manhattan, NY", "Brooklyn, NY"]).
 * @param {Date} competitionStartDate - The competition start date.
 * @returns {Array<Object>} - A cleaned and filtered list of properties.
 */
function filterProperties(properties, targetCityNames, competitionStartDate) {
    const allowedCities = new Set(targetCityNames.map(c => c.split(',')[0].trim().toLowerCase()));
    const baselineEndDate = new Date(competitionStartDate);
    const baselineStartDate = new Date(competitionStartDate);
    baselineStartDate.setDate(baselineStartDate.getDate() - DAYS_FOR_BASELINE);

    return properties.filter(p => {
        const saleDateStr = p.lastSaleData?.lastSoldDate;
        if (!saleDateStr) return false;
        const saleDate = new Date(saleDateStr);
        if (saleDate < baselineStartDate || saleDate > baselineEndDate) {
            return false;
        }

        const apiCity = (p.addressInfo?.city || '').trim().toLowerCase();
        if (allowedCities.has(apiCity)) {
            return true;
        }
        
        const formatted = (p.addressInfo?.formattedStreetLine || '').trim().toLowerCase();
        for (const allowedCity of allowedCities) {
            if (new RegExp(`,\\s*${allowedCity}\\b`).test(formatted)) {
                return true;
            }
        }
        return false;
    });
}


/**
 * Calculates the median price from a list of cleaned properties.
 * @param {Array<Object>} properties - The filtered list of properties.
 * @param {string} cityName - The name of the city for logging.
 * @returns {number|null} - The calculated median price or null.
 */
function calculateMedianPrice(properties, cityName) {
  if (!properties || properties.length < MIN_SALES_REQUIRED) {
    console.log(`  ⚠️ Insufficient sales data for ${cityName}: ${properties.length} sales (need ${MIN_SALES_REQUIRED})`);
    return null;
  }

  const prices = properties.map(p => {
    const priceStr = p.priceInfo?.amount?.toString().replace(/,/g, '');
    return Number(priceStr);
  }).filter(price => price > 0 && !isNaN(price));

  prices.sort((a, b) => a - b);

  const p1 = Math.floor(prices.length * 0.01);
  const p99 = Math.ceil(prices.length * 0.99);
  const filteredPrices = prices.slice(p1, p99);

  if (filteredPrices.length === 0) return null;

  const mid = Math.floor(filteredPrices.length / 2);
  const median = filteredPrices.length % 2 === 0
    ? (filteredPrices[mid - 1] + filteredPrices[mid]) / 2
    : filteredPrices[mid];

  console.log(`  📈 ${cityName} new median: $${median.toLocaleString()} (from ${filteredPrices.length} valid sales)`);
  return Math.round(median);
}

/**
 * Displays a formatted comparison of old vs. new baselines.
 * @param {Object} currentBaselines - The old baseline values.
 * @param {Object} newBaselines - The newly calculated baseline values.
 */
function displayComparison(currentBaselines, newBaselines) {
    console.log('\n' + '='.repeat(60));
    console.log('       BASELINE COMPARISON (OLD vs. NEW)');
    console.log('='.repeat(60));
    console.log('City\t\t| Current Baseline\t| New Baseline\t\t| Change');
    console.log('-'.repeat(60));

    const allCities = new Set([...Object.keys(currentBaselines), ...Object.keys(newBaselines)]);

    for (const city of Array.from(allCities).sort()) {
        const oldVal = currentBaselines[city] || 0;
        const newVal = newBaselines[city] || 0;
        const change = newVal - oldVal;
        
        const changeStr = change === 0 ? 'No Change' : `${change > 0 ? '+' : ''}$${Math.abs(change).toLocaleString()}`;
        
        const cityPad = city.padEnd(15, ' ');
        const oldPad = `$${oldVal.toLocaleString()}`.padEnd(15, ' ');
        const newPad = `$${newVal.toLocaleString()}`.padEnd(15, ' ');

        console.log(`${cityPad}\t| ${oldPad}\t| ${newPad}\t| ${changeStr}`);
    }
    console.log('='.repeat(60));
}

async function main() {
  console.log('🎯 Starting new baseline calculation...\n');
  
  const competitionStartDate = await getCompetitionStartDate();
  if (!competitionStartDate) {
      console.error('Halting script: Cannot proceed without a competition start date.');
      process.exit(1);
  }

  let { citiesToProcess, currentBaselines } = await loadCitiesAndBaselinesFromSupabase();
  if (citiesToProcess.length === 0) {
      console.error('Halting script: No cities found in the database.');
      process.exit(1);
  }

  // --- NEW: Command-line argument for single-city testing ---
  const args = process.argv.slice(2);
  const cityArg = args.find(arg => arg.startsWith('--city='));

  if (cityArg) {
    const targetCity = cityArg.split('=')[1];
    console.log(`\n🧪 RUNNING IN TEST MODE FOR A SINGLE CITY: ${targetCity}\n`);
    citiesToProcess = citiesToProcess.filter(c => c.name === targetCity);
    if (citiesToProcess.length === 0) {
        console.error(`❌ City "${targetCity}" not found in the database. Check spelling and capitalization.`);
        process.exit(1);
    }
  }
  // --- END NEW ---

  const newBaselines = {};

  for (const city of citiesToProcess) {
    try {
      if (city.name === 'New York') {
        console.log('\n🔍 Processing New York (all boroughs)...');
        const nycConfig = CITY_FILTER_CONFIG['New York'];
        let allNycProperties = new Map();

        for (const boroughName of nycConfig.allowedCities) {
            const regionId = CITY_REGIONS[boroughName];
            if (regionId) {
                console.log(`  -> Fetching data for ${boroughName}...`);
                const boroughProperties = await fetchCompleteSoldSet(regionId, 0, 50000000);
                boroughProperties.forEach(p => p && p.url && allNycProperties.set(p.url, p));
            }
        }
        
        const combinedProperties = Array.from(allNycProperties.values());
        console.log(`  🗽 Found ${combinedProperties.length} total unique sales across all NYC boroughs.`);
        const cleanedNycProperties = filterProperties(combinedProperties, nycConfig.allowedCities, competitionStartDate);
        const median = calculateMedianPrice(cleanedNycProperties, 'New York City (Combined)');
        if (median) {
            newBaselines['New York'] = median;
        }

      } else {
        const fullCityName = `${city.name}, ${city.state}`;
        console.log(`\n🔍 Processing ${fullCityName}...`);
        const rawProperties = await fetchCompleteSoldSet(city.region_id, 0, 50000000);
        
        const uniqueProperties = new Map();
        rawProperties.forEach(p => p && p.url && uniqueProperties.set(p.url, p));
        const cleanedProperties = filterProperties(Array.from(uniqueProperties.values()), [city.name], competitionStartDate);

        const median = calculateMedianPrice(cleanedProperties, fullCityName);
        
        if (median) {
          newBaselines[city.name] = median;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${city.name}:`, error.message);
    }
  }

  displayComparison(currentBaselines, newBaselines);

  console.log('\n\nNOTE: This script is in read-only mode. No files have been updated.');
  console.log('If the new baselines look correct, the next step is to enable saving them.');
}

main().catch(error => {
  console.error('❌ Baseline calculation failed:', error);
  process.exit(1);
});

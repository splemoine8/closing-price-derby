#!/usr/bin/env node

// Unified scraper that populates the new database structure
// This version performs incremental updates and filters out non-residential
// sales like 'Land' to ensure data quality.

import 'dotenv/config';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { CITY_REGIONS, CITY_FILTER_CONFIG } from './city-regions.js';
import { CANONICAL_CITY } from './utils/canonical-city.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';
const API_PAGE_LIMIT = 1000; // Use max limit to reduce API calls

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
  if (typeof sourceDate === 'number') return new Date(sourceDate).toISOString();
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
  const target = targetCity.split(',')[0].trim().toLowerCase();
  const apiCity = (property.addressInfo?.city || '').trim().toLowerCase();
  if (apiCity) return apiCity === target;
  const formatted = (property.addressInfo?.formattedStreetLine || '').trim().toLowerCase();
  return new RegExp(`,\\s*${target}\\b`).test(formatted);
}

/**
 * Fetches new sold properties from the Redfin API for a given region,
 * above a specified minimum price, handling pagination automatically.
 * @param {string} regionId - The region ID to search for.
 * @param {string} cityName - The name of the city for logging.
 * @param {number} minPrice - The minimum sale price to fetch.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of property objects.
 */
async function fetchNewSales(regionId, cityName, minPrice) {
  console.log(`  🏠 Fetching new sales for ${cityName} (region ${regionId}) with price > $${minPrice.toLocaleString()}`);
  
  let allProperties = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    const priceParam = `&prices=${minPrice + 1},`;
    const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=30&limit=${API_PAGE_LIMIT}&page=${currentPage}${priceParam}`;
    
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    };

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`API request failed on page ${currentPage} with status ${response.status}: ${await response.text()}`);
      }
      const pageData = await response.json();
      const propertiesOnPage = pageData.data?.map(item => item.homeData) || [];
      
      if (propertiesOnPage.length > 0) {
        allProperties.push(...propertiesOnPage);
      }
      
      hasMoreData = pageData.moreData === true && propertiesOnPage.length > 0;

      if (hasMoreData) {
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (error) {
      console.error(`❌ Error fetching data for ${cityName} on page ${currentPage}:`, error.message);
      hasMoreData = false;
    }
  }
  
  console.log(`  📊 Found ${allProperties.length} new properties for ${cityName}.`);
  return allProperties;
}

/**
 * Transforms raw property data into the format for our database,
 * applying critical data quality filters.
 * @param {Object} property - The raw property data from the API.
 * @param {string} cityName - The target city name.
 * @returns {Object|null} - A formatted sale object or null if it should be filtered out.
 */
function transformProperty(property, cityName) {
  // *** FILTER: Ignore properties that are 'Land' (type 5) or 'Other' (type 6) ***
  const propertyType = property.propertyType;
  if (propertyType === 5 || propertyType === 6) {
    const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
    console.log(`  🚫 Filtering out property type ${propertyType} (Land/Other) at ${address}`);
    return null;
  }
  
  // *** ADDITIONAL FILTER: Ignore properties with no beds, baths, or sqft (likely vacant lots) ***
  const beds = property.beds;
  const baths = property.baths;
  const sqft = property.sqftInfo?.amount;
  
  if (!beds && !baths && !sqft) {
    const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
    console.log(`  🚫 Filtering out property with no beds/baths/sqft (likely vacant lot) at ${address}`);
    return null;
  }

  const address = property.addressInfo?.formattedStreetLine || 'Unknown Address';
  const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
  const rawDate = property.lastSaleData?.lastSoldDate;
  const utcDate = convertSourceDateToUTC(rawDate);
  
  if (!utcDate || price <= 0) return null;
  
  const ABSOLUTE_MAX_SALE_PRICE = 100000000;
  if (price > ABSOLUTE_MAX_SALE_PRICE) {
    console.log(`  ⚠️ Skipping outlier: $${price.toLocaleString()} at ${address}`);
    return null;
  }
  
  const rawCity = (property.addressInfo?.city || cityName.split(',')[0]).trim();
  const key = rawCity.toLowerCase();
  const expectedCity = cityName.split(',')[0].trim();
  const trueCity = CANONICAL_CITY[key] || expectedCity;
  
  return {
    address, city_name: trueCity, sale_price: price, sale_timestamp_utc: utcDate,
    bedrooms: property.beds || null, bathrooms: property.baths || null,
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
      { data_type: 'sales_data', city: cityKey, data: salesData, updated_at: new Date().toISOString() },
      { onConflict: 'data_type,city' }
    );

  if (error) console.error(`  ❌ Legacy update failed for ${cityKey}:`, error);
  else console.log(`  ✅ Legacy update successful for ${cityKey}.`);
}

/**
 * Gets the highest sale price for a given city from the database within the competition period.
 * @param {string} cityName - The name of the city.
 * @returns {Promise<number>} - The maximum sale price, or 0 if none found.
 */
async function getMaxPriceForCity(cityName) {
    // First get the active competition dates
    const { data: config, error: configError } = await supa
        .from('competition_config')
        .select('utc_start, utc_end')
        .eq('is_active', true)
        .single();
    
    if (configError) {
        console.error(`  ❌ Error fetching competition config:`, configError.message);
        return 0;
    }

    // Get the highest sale within the competition period
    const { data, error } = await supa
        .from('sales')
        .select('sale_price')
        .eq('city_name', cityName)
        .gte('sale_timestamp_utc', config.utc_start)
        .lte('sale_timestamp_utc', config.utc_end)
        .order('sale_price', { ascending: false })
        .limit(1);

    if (error) {
        console.error(`  ❌ Error fetching max price for ${cityName}:`, error.message);
        return 0;
    }

    const maxPrice = data?.[0]?.sale_price || 0;
    console.log(`  📈 Current competition max price for ${cityName} is $${maxPrice.toLocaleString()}`);
    return maxPrice;
}


// Process a single city/region
async function processCityRegion(cityName, regionId, minPrice) {
  try {
    const properties = await fetchNewSales(regionId, cityName, minPrice);
    const newSales = properties
      .filter(p => propertyMatchesCity(p, cityName))
      .map(p => transformProperty(p, cityName))
      .filter(Boolean);
    
    console.log(`  ✅ Found ${newSales.length} valid new sales for ${cityName.split(',')[0]}`);
    return newSales;
  } catch (error) {
    console.error(`  ❌ Error processing ${cityName}:`, error.message);
    return [];
  }
}

// Main function
async function main() {
  console.log('🏁 Starting incremental competition data update...');
  
  const { data: cities, error: citiesError } = await supa.from('cities').select('*');
  if (citiesError) {
    console.error('❌ Failed to fetch cities:', citiesError);
    process.exit(1);
  }
  
  console.log(`🎯 Processing ${cities.length} cities from database\n`);
  
  let totalNewSales = 0;
  
  for (const city of cities) {
    console.log(`\n📍 Processing ${city.name}...`);
    
    if (city.name === 'New York') {
      console.log('  🗽 Special NYC processing - fetching all boroughs...');
      const nycConfig = CITY_FILTER_CONFIG['New York'];
      let allNycSales = [];
      
      const minPrice = await getMaxPriceForCity('New York');

      for (const regionName of nycConfig.allowedCities) {
        const regionId = CITY_REGIONS[regionName];
        if (regionId) {
          console.log(`\n  🌆 Fetching ${regionName}...`);
          const sales = await processCityRegion(regionName, regionId, minPrice);
          allNycSales.push(...sales);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      
      const salesMap = new Map();
      allNycSales.forEach(sale => {
        sale.city_name = 'New York';
        const id = generateSaleId(sale);
        salesMap.set(id, { ...sale, sale_id: id });
      });
      
      const uniqueSales = Array.from(salesMap.values());
      console.log(`  🗽 Total unique new NYC sales: ${uniqueSales.length}`);
      
      if (uniqueSales.length > 0) {
        const { error: upsertError } = await supa.from('sales').upsert(uniqueSales, { onConflict: 'sale_id', ignoreDuplicates: true });
        if (upsertError) {
          console.error(`  ❌ Error upserting NYC sales:`, upsertError.message);
        } else {
          console.log(`  ✅ Successfully upserted ${uniqueSales.length} new NYC sales`);
          totalNewSales += uniqueSales.length;
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
      
      const minPrice = await getMaxPriceForCity(city.name);
      const sales = await processCityRegion(`${city.name}, ${city.state}`, regionId, minPrice);
      
      if (sales.length > 0) {
        const salesWithIds = sales.map(sale => ({ ...sale, sale_id: generateSaleId(sale) }));
        
        const { error: upsertError } = await supa.from('sales').upsert(salesWithIds, { onConflict: 'sale_id', ignoreDuplicates: true });
        if (upsertError) {
          console.error(`  ❌ Error upserting sales for ${city.name}:`, upsertError.message);
        } else {
          console.log(`  ✅ Successfully upserted ${salesWithIds.length} new sales`);
          totalNewSales += salesWithIds.length;
          const cityKey = city.name.replace(/\s+/g, '');
          await updateLegacyTable(cityKey, salesWithIds);
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Incremental competition update complete!');
  console.log(`📊 Found and processed ${totalNewSales} total new sales across all cities.`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('❌ Scraper failed:', error);
  process.exit(1);
});

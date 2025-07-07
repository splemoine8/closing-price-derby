#!/usr/bin/env node

/**
 * Script to fetch recently sold real estate listings for a specific region
 * above a given price and export them to a CSV file.
 *
 * Usage:
 * 1. Place this script in a subdirectory (e.g., /scripts).
 * 2. Create a .env file in the project root with your API key:
 * RAPIDAPI_KEY='your_api_key_here'
 * 3. Run the script from your terminal with a region_id and minPrice:
 * node ./scripts/export-sold-listings.js --regionId=55 --minPrice=500000
 *
 * This will create a file named `sold_listings_region_55.csv`.
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---

// Configure dotenv to find the .env file in the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';
const SOLD_WITHIN_DAYS = 30; // Fetch listings sold in the last 30 days
const API_PAGE_LIMIT = 1000; // Set to the maximum allowed limit to reduce API calls
const SALE_DATE_AFTER = '2025-06-23'; // The specific date to filter sales after

/**
 * Fetches sold properties from the Redfin API for a given region and minimum price,
 * handling pagination automatically.
 * @param {string} regionId - The region ID to search for.
 * @param {number} minPrice - The minimum sale price to filter by.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of all property objects.
 */
async function fetchSoldListings(regionId, minPrice) {
  console.log(`🏠 Fetching listings for region ${regionId} with a minimum price of $${minPrice.toLocaleString()}...`);

  let allProperties = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    console.log(`   📄 Fetching page ${currentPage}...`);
    // Construct the price parameter for the URL. Format is "min,".
    const priceParam = `&prices=${minPrice},`;
    const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=${SOLD_WITHIN_DAYS}&limit=${API_PAGE_LIMIT}&page=${currentPage}${priceParam}`;
    
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
      
      console.log(`   -> Found ${propertiesOnPage.length} on this page. Total found so far: ${allProperties.length}`);

      // Check if there is more data to fetch
      hasMoreData = pageData.moreData === true && propertiesOnPage.length > 0;

      if (hasMoreData) {
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 250)); // Rate-limiting delay
      }

    } catch (error) {
      console.error(`❌ Error fetching data on page ${currentPage}:`, error.message);
      hasMoreData = false; 
    }
  }
  return allProperties;
}

/**
 * Converts an array of property objects into a CSV formatted string.
 * @param {Array<Object>} properties - The array of property data.
 * @returns {string} - A string in CSV format.
 */
function convertToCSV(properties) {
  if (!properties || properties.length === 0) {
    console.log('⚠️ No properties to convert to CSV.');
    return '';
  }

  console.log(`🔄 Converting ${properties.length} properties to CSV format...`);

  // Define the headers for the CSV file.
  const headers = [
    'Address', 'City', 'State', 'ZipCode', 'Price', 'SoldDate',
    'Beds', 'Baths', 'SquareFeet', 'LotSize', 'YearBuilt', 'URL',
  ];

  // Map each property object to a CSV row.
  const rows = properties.map(prop => {
    const addressInfo = prop.addressInfo || {};
    const priceInfo = prop.priceInfo || {};
    const propertyInfo = prop.propertyHistoryInfo || {};
    const sqftInfo = prop.sqftInfo || {};
    const lotSizeInfo = prop.lotSize || {};
    const lastSaleData = prop.lastSaleData || {};

    const row = [
      addressInfo.formattedStreetLine || 'N/A',
      addressInfo.city || 'N/A',
      addressInfo.state || 'N/A',
      addressInfo.zipCode || 'N/A',
      priceInfo.amount || lastSaleData.lastSoldPrice || 0,
      lastSaleData.lastSoldDate ? new Date(lastSaleData.lastSoldDate).toISOString().split('T')[0] : 'N/A',
      prop.beds || 'N/A',
      prop.baths || 'N/A',
      sqftInfo.amount || 'N/A',
      lotSizeInfo.amount || 'N/A',
      propertyInfo.yearBuilt || 'N/A',
      prop.url ? `https://www.redfin.com${prop.url}` : 'N/A',
    ];

    return row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Writes the CSV content to a file.
 * @param {string} regionId - The region ID, used for the filename.
 * @param {string} csvContent - The CSV data to write.
 */
function writeCSVToFile(regionId, csvContent) {
  if (!csvContent) {
    console.log('📄 No content to write. Skipping file creation.');
    return;
  }
  const fileName = `sold_listings_region_${regionId}.csv`;
  const filePath = path.join(process.cwd(), fileName);

  console.log(`💾 Saving data to ${filePath}...`);
  try {
    fs.writeFileSync(filePath, csvContent);
    console.log(`✅ Successfully created ${fileName}`);
  } catch (error) {
    console.error(`❌ Error writing to file ${fileName}:`, error);
  }
}

/**
 * Main function to run the script.
 */
async function main() {
  console.log('🚀 Starting the sold listings exporter...');

  if (!RAPIDAPI_KEY) {
    console.error('❌ ERROR: RAPIDAPI_KEY was not found.');
    console.error('   Please ensure you have a .env file in the project root with RAPIDAPI_KEY="your_key"');
    process.exit(1);
  }

  // Get command line arguments
  const args = process.argv.slice(2);
  const regionIdArg = args.find(arg => arg.startsWith('--regionId='));
  const minPriceArg = args.find(arg => arg.startsWith('--minPrice='));

  if (!regionIdArg || !minPriceArg) {
    console.error('❌ ERROR: Missing required arguments.');
    console.error('   Usage: node ./scripts/export-sold-listings.js --regionId=<value> --minPrice=<value>');
    console.error('   Example: node ./scripts/export-sold-listings.js --regionId=55 --minPrice=500000');
    process.exit(1);
  }

  const regionId = regionIdArg.split('=')[1];
  const minPrice = parseInt(minPriceArg.split('=')[1], 10);
  
  if (!regionId || isNaN(minPrice)) {
    console.error('❌ ERROR: Invalid arguments. Region ID cannot be empty and minPrice must be a number.');
    process.exit(1);
  }

  // 1. Fetch all data from the API using the price filter
  const allProperties = await fetchSoldListings(regionId, minPrice);
  console.log(`\n📊 Fetched a total of ${allProperties.length} properties before any filtering.`);

  // 2. Deduplicate results based on the property URL to be safe
  const uniqueProperties = new Map();
  allProperties.forEach(prop => {
    if (prop.url) {
      uniqueProperties.set(prop.url, prop);
    }
  });
  const deduplicatedProperties = Array.from(uniqueProperties.values());
  console.log(`✨ Found ${deduplicatedProperties.length} unique properties.`);

  // 3. Filter properties by the specified sale date
  const filterDate = new Date(SALE_DATE_AFTER);
  const finalProperties = deduplicatedProperties.filter(prop => {
      const soldDate = prop.lastSaleData?.lastSoldDate;
      return soldDate && new Date(soldDate) > filterDate;
  });
  console.log(`📅 Filtered down to ${finalProperties.length} properties sold after ${SALE_DATE_AFTER}.`);

  // 4. Convert the final data to CSV format
  const csvData = convertToCSV(finalProperties);

  // 5. Write the CSV data to a file
  writeCSVToFile(regionId, csvData);

  console.log('🏁 Script finished.');
}

main().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});

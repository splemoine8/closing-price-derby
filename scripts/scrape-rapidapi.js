import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { CITY_REGIONS, FRIEND_ASSIGNMENTS } from './city-regions.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

// Get cities from the cached region mapping
const CITIES = Object.keys(CITY_REGIONS);

// Load baseline data for percentage scoring
async function loadBaselines() {
  try {
    const baselinesPath = path.join(process.cwd(), 'public', 'baselines.json');
    const baselinesData = await fs.readFile(baselinesPath, 'utf8');
    const baselines = JSON.parse(baselinesData);
    console.log('✅ Loaded baseline data for percentage scoring');
    return baselines.baselines;
  } catch (error) {
    console.warn('⚠️  No baselines.json found, using price-only scoring');
    return null;
  }
}

// Calculate percentage score and multiplier display
function calculateScore(price, baseline) {
  if (!baseline || baseline <= 0) {
    return { scorePct: 0, multiplier: '×1.0' };
  }
  
  const scorePct = ((price - baseline) / baseline) * 100;
  const multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
  
  return { scorePct: Math.round(scorePct * 10) / 10, multiplier };
}

// Get city baseline from loaded baselines data
function getCityBaseline(cityName, baselines) {
  if (!baselines) return null;
  
  // Try exact match first
  if (baselines[cityName]) {
    return baselines[cityName].median;
  }
  
  // Try partial match (e.g., "Kansas City" for "Kansas City, MO")
  const cityKey = Object.keys(baselines).find(key => 
    key.toLowerCase().includes(cityName.toLowerCase()) ||
    cityName.toLowerCase().includes(key.toLowerCase())
  );
  
  return cityKey ? baselines[cityKey].median : null;
}

async function getCityRegionId(cityName) {
  console.log(`🔍 Looking up region ID for: ${cityName}`);
  
  const response = await fetch(
    `${BASE_URL}/properties/auto-complete?query=${encodeURIComponent(cityName)}`,
    {
      headers: {
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get region ID for ${cityName}: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract rows from nested structure
  const allRows = [];
  if (data.data && Array.isArray(data.data)) {
    data.data.forEach(section => {
      if (section.rows && Array.isArray(section.rows)) {
        allRows.push(...section.rows);
      }
    });
  }
  
  // Look for city/region in results (type "2" is city)
  const cityResult = allRows.find(item => 
    item.type === '2' && item.name.toLowerCase().includes(cityName.split(',')[0].toLowerCase())
  );

  if (!cityResult) {
    console.log(`⚠️  No region found for ${cityName}, available options:`, 
      allRows.slice(0, 3).map(r => `${r.name} (${r.type})`));
    return null;
  }

  console.log(`✅ Found region ID ${cityResult.id} for ${cityName}`);
  return cityResult.id;
}

async function getSoldProperties(regionId, cityName) {
  console.log(`🏠 Fetching sold properties for region ${regionId} (${cityName})`);
  
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

  const response_data = await response.json();
  
  // Extract properties from nested structure
  const properties = [];
  if (response_data.data && Array.isArray(response_data.data)) {
    response_data.data.forEach(item => {
      if (item.homeData) {
        properties.push(item.homeData);
      }
    });
  }
  
  console.log(`📊 Found ${properties.length || 0} sold properties in ${cityName}`);
  
  return properties;
}

function filterRecentSales(properties) {
  // For testing, let's show the highest sale from the past 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return properties.filter(property => {
    // Check the lastSaleData.lastSoldDate field
    const soldDate = property.lastSaleData?.lastSoldDate;
    
    if (!soldDate) {
      return false;
    }
    
    const saleDate = new Date(soldDate);
    return saleDate >= sevenDaysAgo;
  });
}

function findHighestSaleRecent(properties, cityName) {
  const recentSales = filterRecentSales(properties);
  
  if (recentSales.length === 0) {
    console.log(`📅 No recent sales found in ${cityName}`);
    return null;
  }

  // Find highest priced sale from recent sales
  const highestSale = recentSales.reduce((max, property) => {
    const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
    const maxPrice = parseInt(max.priceInfo?.amount || max.priceInfo?.homePrice?.int64Value || 0);
    return price > maxPrice ? property : max;
  });

  const price = parseInt(highestSale.priceInfo?.amount || highestSale.priceInfo?.homePrice?.int64Value || 0);
  const address = highestSale.addressInfo?.formattedStreetLine || 'Unknown Address';
  
  console.log(`🏆 Highest recent sale in ${cityName}: $${price?.toLocaleString()} at ${address}`);
  
  return {
    price,
    address,
    soldDate: highestSale.lastSaleData?.lastSoldDate,
    salesCount: recentSales.length
  };
}

async function scrapeAllCities() {
  console.log('🚀 Starting RapidAPI Redfin scraper with percentage scoring...\n');
  
  // Load baselines at start
  const baselines = await loadBaselines();
  
  const leaderboard = [];
  const errors = [];
  const allSalesData = {}; // Store all sales by city for modals

  for (const cityName of CITIES) {
    try {
      // Step 1: Get region ID (use cached first, fallback to API lookup)
      let regionId = CITY_REGIONS[cityName];
      
      if (!regionId) {
        console.log(`🔍 No cached region ID for ${cityName}, looking up via API...`);
        regionId = await getCityRegionId(cityName);
      } else {
        console.log(`✅ Using cached region ID ${regionId} for ${cityName}`);
      }
      
      if (!regionId) {
        errors.push(`No region ID found for ${cityName}`);
        continue;
      }

      // Step 2: Get sold properties
      const properties = await getSoldProperties(regionId, cityName);
      
      if (!properties || properties.length === 0) {
        console.log(`📭 No properties found for ${cityName}`);
        continue;
      }

      // Step 3: Find recent highest sale
      const highestSale = findHighestSaleRecent(properties, cityName);
      
      // Step 4: Collect all recent sales for modal
      const recentSales = filterRecentSales(properties);
      const cityKey = cityName.split(',')[0].replace(/\s+/g, ''); // Match frontend zip format
      
      allSalesData[cityKey] = recentSales
        .sort((a, b) => {
          const priceA = parseInt(a.priceInfo?.amount || a.priceInfo?.homePrice?.int64Value || 0);
          const priceB = parseInt(b.priceInfo?.amount || b.priceInfo?.homePrice?.int64Value || 0);
          return priceB - priceA; // Sort by price descending
        })
        .slice(0, 10) // Top 10 sales
        .map(property => ({
          address: property.addressInfo?.formattedStreetLine || 'Unknown Address',
          date: new Date(property.lastSaleData?.lastSoldDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          price: parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0),
          beds: property.beds || 0,
          baths: property.baths || 0,
          sqft: parseInt(property.sqftInfo?.amount || 0),
          url: property.url ? `https://www.redfin.com${property.url}` : null
        }));
      
      if (highestSale) {
        const baseCityName = cityName.split(',')[0].trim(); // Get base city name for baseline lookup
        const baseline = getCityBaseline(baseCityName, baselines);
        const { scorePct, multiplier } = calculateScore(highestSale.price, baseline);
        
        console.log(`📊 ${baseCityName}: $${highestSale.price.toLocaleString()} vs baseline $${baseline?.toLocaleString() || 'N/A'} = ${multiplier}`);
        
        leaderboard.push({
          city: cityName,
          playerName: FRIEND_ASSIGNMENTS[cityName] || 'Unknown Player',
          recentHighest: highestSale.price,
          recentAddress: highestSale.address,
          recentSalesCount: highestSale.salesCount,
          baseline: baseline,           // NEW: Baseline median
          scorePct: scorePct,          // NEW: Percentage score
          multiplier: multiplier,      // NEW: Display format
          lastUpdated: new Date().toISOString(),
          regionId // Store for future use
        });
      }

      // Rate limiting - 5 req/sec limit, so 0.25s delay to be safe
      await new Promise(resolve => setTimeout(resolve, 250));
      
    } catch (error) {
      console.error(`❌ Error processing ${cityName}:`, error.message);
      errors.push(`${cityName}: ${error.message}`);
    }
  }

  // Sort by score percentage (highest first), fallback to price
  leaderboard.sort((a, b) => {
    if (a.scorePct !== b.scorePct) {
      return (b.scorePct || 0) - (a.scorePct || 0);
    }
    return (b.recentHighest || 0) - (a.recentHighest || 0);
  });
  
  // Add ranks
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });

  return { leaderboard, errors, allSalesData };
}

async function saveResults(leaderboard, errors, allSalesData) {
  // Save to public directory for frontend
  const publicPath = path.join(process.cwd(), 'public', 'leaderboard.json');
  
  // Transform to frontend-expected format
  const frontendData = leaderboard.map(item => ({
    zip: item.city.split(',')[0].replace(/\s+/g, ''), // Create a pseudo-zip from city name
    city: item.city.split(',')[0].trim(),
    state: item.city.split(',')[1]?.trim() || '',
    teamName: item.playerName,
    price: item.recentHighest,
    ts: new Date(item.lastUpdated).getTime()
  }));

  // Save in the format the frontend expects
  await fs.writeFile(publicPath, JSON.stringify(frontendData, null, 2));
  console.log(`💾 Leaderboard saved to: ${publicPath}`);
  
  // Save detailed sales data for modals
  const salesPath = path.join(process.cwd(), 'public', 'sales-data.json');
  await fs.writeFile(salesPath, JSON.stringify(allSalesData, null, 2));
  console.log(`💾 Sales data saved to: ${salesPath}`);
  
  // Also save a timestamped backup with full details
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `rapidapi-results-${timestamp}.json`;
  const backupData = {
    date: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    leaderboard,
    frontendData,
    metadata: {
      totalCities: CITIES.length,
      successfulScrapes: leaderboard.length,
      errors: errors.length > 0 ? errors : undefined
    }
  };
  await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`💾 Backup saved to: ${backupPath}`);
}

async function main() {
  try {
    if (!RAPIDAPI_KEY) {
      throw new Error('❌ Please set RAPIDAPI_KEY environment variable');
    }
    
    const { leaderboard, errors, allSalesData } = await scrapeAllCities();
    
    console.log('\n🏆 Recent Sales Leaderboard:');
    if (leaderboard.length === 0) {
      console.log('   No recent sales found - this is unusual');
    } else {
      leaderboard.forEach(player => {
        console.log(`   ${player.rank}. ${player.playerName} (${player.city}): $${player.recentHighest?.toLocaleString() || 'N/A'}`);
        console.log(`      Address: ${player.recentAddress}`);
        console.log(`      Recent sales: ${player.recentSalesCount}`);
        console.log('');
      });
    }
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(error => console.log(`   ${error}`));
    }
    
    await saveResults(leaderboard, errors, allSalesData);
    console.log('\n✅ Scraping completed successfully!');
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scrapeAllCities, getCityRegionId, getSoldProperties };
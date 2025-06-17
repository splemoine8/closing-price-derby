import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

// Test cities for the 12-person fantasy league
const CITIES = [
  'Beverly Hills, CA',
  'Manhattan, NY', 
  'Miami Beach, FL',
  'San Francisco, CA',
  'Boston, MA',
  'Chicago, IL',
  'Seattle, WA',
  'Austin, TX',
  'Denver, CO',
  'Nashville, TN',
  'Atlanta, GA',
  'Las Vegas, NV'
];

// Friend assignments (you can customize these)
const FRIEND_ASSIGNMENTS = {
  'Beverly Hills, CA': 'Alice',
  'Manhattan, NY': 'Bob', 
  'Miami Beach, FL': 'Charlie',
  'San Francisco, CA': 'David',
  'Boston, MA': 'Emma',
  'Chicago, IL': 'Frank',
  'Seattle, WA': 'Grace',
  'Austin, TX': 'Henry',
  'Denver, CO': 'Ivy',
  'Nashville, TN': 'Jack',
  'Atlanta, GA': 'Kate',
  'Las Vegas, NV': 'Leo'
};

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
  console.log('🚀 Starting RapidAPI Redfin scraper...\n');
  
  const leaderboard = [];
  const errors = [];

  for (const cityName of CITIES) {
    try {
      // Step 1: Get region ID
      const regionId = await getCityRegionId(cityName);
      
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
      
      if (highestSale) {
        leaderboard.push({
          city: cityName,
          playerName: FRIEND_ASSIGNMENTS[cityName] || 'Unknown Player',
          recentHighest: highestSale.price,
          recentAddress: highestSale.address,
          recentSalesCount: highestSale.salesCount,
          lastUpdated: new Date().toISOString(),
          regionId // Store for future use
        });
      }

      // Rate limiting - be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error processing ${cityName}:`, error.message);
      errors.push(`${cityName}: ${error.message}`);
    }
  }

  // Sort by highest recent price
  leaderboard.sort((a, b) => (b.recentHighest || 0) - (a.recentHighest || 0));
  
  // Add ranks
  leaderboard.forEach((item, index) => {
    item.rank = index + 1;
  });

  return { leaderboard, errors };
}

async function saveResults(leaderboard, errors) {
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
    
    const { leaderboard, errors } = await scrapeAllCities();
    
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
    
    await saveResults(leaderboard, errors);
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
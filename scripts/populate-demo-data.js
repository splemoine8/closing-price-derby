#!/usr/bin/env node

// Script to populate demo data for all cities
import fs from 'fs/promises';
import path from 'path';

const DEMO_DATA = {
  "Cincinnati": { price: 3950000, multiplier: "×16.8" },
  "Charlotte": { price: 6800000, multiplier: "×11.1" },
  "Nashville": { price: 5200000, multiplier: "×9.8" },
  "Jacksonville": { price: 2100000, multiplier: "×7.7" },
  "Kansas City": { price: 4500000, multiplier: "×13.8" },
  "Green Bay": { price: 1800000, multiplier: "×6.0" },
  "Buffalo": { price: 1950000, multiplier: "×7.7" },
  "Indianapolis": { price: 3200000, multiplier: "×11.4" },
  "Baltimore": { price: 2250000, multiplier: "×12.3" },
  "Cleveland": { price: 850000, multiplier: "×6.8" },
  "NewOrleans": { price: 4200000, multiplier: "×14.0" },
  "Pittsburgh": { price: 2600000, multiplier: "×10.0" }
};

const CITY_ZIPS = {
  "Cincinnati": "45201",
  "Charlotte": "28201",
  "Nashville": "37201",
  "Jacksonville": "32202",
  "KansasCity": "64108",
  "GreenBay": "54301",
  "Buffalo": "14201",
  "Indianapolis": "46201",
  "Baltimore": "21201",
  "Cleveland": "44101",
  "NewOrleans": "70112",
  "Pittsburgh": "15201"
};

async function populateCityData() {
  for (const [cityFile, data] of Object.entries(DEMO_DATA)) {
    const cityName = cityFile.replace(/([A-Z])/g, ' $1').trim();
    const fileName = cityFile === "NewOrleans" ? "NewOrleans" : 
                     cityFile === "KansasCity" ? "KansasCity" :
                     cityFile === "GreenBay" ? "GreenBay" : cityFile;
    
    const zipCode = CITY_ZIPS[fileName] || "00000";
    
    const cityData = {
      sales: [
        {
          id: `${fileName}-demo1`,
          address: `123 Main St`,
          city: cityName,
          state: getState(cityName),
          zip_code: zipCode,
          price: data.price,
          sale_date: "2025-06-19",
          sale_timestamp_utc: "2025-06-19T14:00:00.000Z"
        },
        {
          id: `${fileName}-demo2`,
          address: `456 Oak Ave`,
          city: cityName,
          state: getState(cityName),
          zip_code: zipCode,
          price: Math.floor(data.price * 0.7),
          sale_date: "2025-06-18",
          sale_timestamp_utc: "2025-06-18T14:00:00.000Z"
        },
        {
          id: `${fileName}-demo3`,
          address: `789 Elm St`,
          city: cityName,
          state: getState(cityName),
          zip_code: zipCode,
          price: Math.floor(data.price * 0.5),
          sale_date: "2025-06-17",
          sale_timestamp_utc: "2025-06-17T14:00:00.000Z"
        }
      ]
    };
    
    await fs.writeFile(
      path.join('data/sales-by-city', `${fileName}.json`),
      JSON.stringify(cityData, null, 2)
    );
    console.log(`✅ Created demo data for ${cityName}`);
  }
  
  // Now run the aggregation script to create leaderboard
  console.log('\n🔄 Running aggregation script...');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('node scripts/aggregate-leaderboard.js');
    console.log('✅ Leaderboard aggregated successfully!');
  } catch (error) {
    console.error('❌ Failed to aggregate leaderboard:', error.message);
  }
}

function getState(city) {
  const stateMap = {
    "Cincinnati": "OH",
    "Charlotte": "NC",
    "Nashville": "TN",
    "Jacksonville": "FL",
    "Kansas City": "MO",
    "Green Bay": "WI",
    "Buffalo": "NY",
    "Indianapolis": "IN",
    "Baltimore": "MD",
    "Cleveland": "OH",
    "New Orleans": "LA",
    "Pittsburgh": "PA"
  };
  return stateMap[city] || "US";
}

// Run the script
populateCityData().catch(console.error);
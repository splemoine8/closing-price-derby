#!/usr/bin/env node

// Script to update region IDs for cities in city-regions.js
// Usage: node scripts/update-region-ids.js

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// RapidAPI configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Cities that need real region IDs (currently have placeholders)
const CITIES_TO_UPDATE = [
  'Kansas City, MO',
  'New Orleans, LA', 
  'Green Bay, WI',
  'Buffalo, NY',
  'Pittsburgh, PA',
  'Cincinnati, OH',
  'Cleveland, OH',
  'Jacksonville, FL',
  'Indianapolis, IN',
  'Baltimore, MD',
  'Charlotte, NC'
];

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
    console.error(`❌ API request failed for ${cityName}: ${response.status}`);
    return null;
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

async function updateRegionIds() {
  console.log('🚀 Starting region ID update process...\n');
  
  const cityRegionsPath = join(__dirname, 'city-regions.js');
  
  // Read current file
  const currentContent = readFileSync(cityRegionsPath, 'utf8');
  
  // Track updates
  const updates = {};
  let updatedContent = currentContent;
  
  // Process each city
  for (const cityName of CITIES_TO_UPDATE) {
    try {
      const regionId = await getCityRegionId(cityName);
      
      if (regionId) {
        updates[cityName] = regionId;
        
        // Update the content - find and replace the placeholder
        const currentRegex = new RegExp(`'${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': '[^']*'`);
        const newValue = `'${cityName}': '${regionId}'`;
        
        if (currentRegex.test(updatedContent)) {
          updatedContent = updatedContent.replace(currentRegex, newValue);
          console.log(`📝 Updated ${cityName} -> ${regionId}`);
        } else {
          console.log(`⚠️  Could not find entry for ${cityName} in file`);
        }
      }
      
      // Rate limiting - wait 250ms between requests
      await new Promise(resolve => setTimeout(resolve, 250));
      
    } catch (error) {
      console.error(`❌ Error updating ${cityName}:`, error.message);
    }
  }
  
  // Write updated file
  if (Object.keys(updates).length > 0) {
    writeFileSync(cityRegionsPath, updatedContent);
    console.log(`\n✅ Successfully updated ${Object.keys(updates).length} region IDs in city-regions.js`);
    
    // Show summary
    console.log('\n📊 Updated IDs:');
    Object.entries(updates).forEach(([city, id]) => {
      console.log(`  ${city}: ${id}`);
    });
  } else {
    console.log('\n⚠️  No region IDs were updated');
  }
}

// Run the update
updateRegionIds().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
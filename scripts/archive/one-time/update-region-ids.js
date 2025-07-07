#!/usr/bin/env node

// Script to update region IDs for cities in city-regions.js
// Automatically reads drafted cities from team-names.json and adds missing region IDs
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

async function getCityRegionId(cityName, stateName) {
  console.log(`🔍 Looking up region ID for: ${cityName}, ${stateName}`);
  
  const fullCityName = `${cityName}, ${stateName}`;
  const response = await fetch(
    `${BASE_URL}/properties/auto-complete?query=${encodeURIComponent(fullCityName)}`,
    {
      headers: {
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    }
  );

  if (!response.ok) {
    console.error(`❌ API request failed for ${fullCityName}: ${response.status}`);
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
    item.type === '2' && item.name.toLowerCase().includes(cityName.toLowerCase())
  );

  if (!cityResult) {
    console.log(`⚠️  No region found for ${fullCityName}, available options:`, 
      allRows.slice(0, 3).map(r => `${r.name} (${r.type})`));
    return null;
  }

  console.log(`✅ Found region ID ${cityResult.id} for ${fullCityName}`);
  return cityResult.id;
}

async function updateRegionIds() {
  console.log('🚀 Starting automatic region ID update process...\n');
  
  const cityRegionsPath = join(__dirname, 'city-regions.js');
  const teamNamesPath = join(dirname(__dirname), 'public', 'team-names.json');
  
  // Read team assignments
  let teamData;
  try {
    const teamNamesContent = readFileSync(teamNamesPath, 'utf8');
    teamData = JSON.parse(teamNamesContent);
  } catch (error) {
    console.error('❌ Error reading team-names.json:', error.message);
    process.exit(1);
  }
  
  // Read current city-regions file
  const currentContent = readFileSync(cityRegionsPath, 'utf8');
  
  // Parse existing CITY_REGIONS to check what we already have
  const existingRegions = {};
  const regionMatches = currentContent.match(/'([^']+)':\s*'([^']+)'/g);
  if (regionMatches) {
    regionMatches.forEach(match => {
      const [city, region] = match.match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
      existingRegions[city] = region;
    });
  }
  
  console.log(`📋 Found ${Object.keys(teamData.cities).length} cities in team-names.json`);
  console.log(`📋 Found ${Object.keys(existingRegions).length} existing region mappings\n`);
  
  // Find cities that need region IDs
  const missingCities = [];
  for (const [cityName, cityInfo] of Object.entries(teamData.cities)) {
    const fullCityName = `${cityName}, ${cityInfo.state}`;
    if (!existingRegions[fullCityName]) {
      missingCities.push({ name: cityName, state: cityInfo.state, full: fullCityName });
    } else {
      console.log(`✓ ${fullCityName} already has region ID: ${existingRegions[fullCityName]}`);
    }
  }
  
  if (missingCities.length === 0) {
    console.log('\n✅ All drafted cities already have region IDs!');
    return;
  }
  
  console.log(`\n🔍 Need to find region IDs for ${missingCities.length} cities:\n`);
  
  // Track updates
  const newEntries = [];
  
  // Process each missing city
  for (const city of missingCities) {
    try {
      const regionId = await getCityRegionId(city.name, city.state);
      
      if (regionId) {
        newEntries.push(`  '${city.full}': '${regionId}'`);
      }
      
      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error looking up ${city.full}:`, error.message);
    }
  }
  
  // Update the file if we found new region IDs
  if (newEntries.length > 0) {
    // Find the closing brace of CITY_REGIONS and insert new entries
    const insertPosition = currentContent.indexOf('};');
    
    if (insertPosition !== -1) {
      // Add comma after last existing entry if needed
      const beforeInsert = currentContent.substring(0, insertPosition).trimEnd();
      const needsComma = !beforeInsert.endsWith(',');
      
      const updatedContent = 
        currentContent.substring(0, insertPosition) +
        (needsComma ? ',\n' : '\n') +
        newEntries.join(',\n') + '\n' +
        currentContent.substring(insertPosition);
      
      writeFileSync(cityRegionsPath, updatedContent);
      console.log(`\n✅ Successfully added ${newEntries.length} new region IDs to city-regions.js`);
    } else {
      console.error('❌ Could not find CITY_REGIONS closing brace in file');
    }
  } else {
    console.log('\n⚠️  No new region IDs were found');
  }
}

// Run the update
updateRegionIds().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
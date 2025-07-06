#!/usr/bin/env node

// Script to generate SQL INSERT statements for cities table with correct baseline prices
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateBaselineInserts() {
  try {
    // Read baselines.json
    const baselinesData = await fs.readFile(path.join(__dirname, '..', 'public', 'baselines.json'), 'utf8');
    const baselines = JSON.parse(baselinesData);
    
    // Read team-names.json for team assignments
    const teamNamesData = await fs.readFile(path.join(__dirname, '..', 'public', 'team-names.json'), 'utf8');
    const teamNames = JSON.parse(teamNamesData);
    
    // City to state mapping
    const cityStateMap = {
      'New York': 'NY',
      'Nashville': 'TN',
      'New Orleans': 'LA',
      'Los Angeles': 'CA',
      'Las Vegas': 'NV',
      'Dallas': 'TX',
      'Miami': 'FL',
      'Phoenix': 'AZ',
      'San Francisco': 'CA',
      'Houston': 'TX',
      'Tampa': 'FL',
      'Denver': 'CO'
    };
    
    // Region IDs from city-regions.js
    const regionIds = {
      'New York': '6_30749',
      'Nashville': '6_13415',
      'New Orleans': '6_14233',
      'Los Angeles': '6_11203',
      'Las Vegas': '6_10201',
      'Dallas': '6_30794',
      'Miami': '6_11458',
      'Phoenix': '6_14240',
      'San Francisco': '6_17151',
      'Houston': '6_8903',
      'Tampa': '6_18142',
      'Denver': '6_5155'
    };
    
    console.log('-- INSERT statements for cities table with actual baseline prices');
    console.log('-- Generated from baselines.json\n');
    
    const insertStatements = [];
    
    for (const [city, baseline] of Object.entries(baselines.baselines)) {
      const teamName = teamNames.assignments[city] || 'Unknown';
      const state = cityStateMap[city] || 'XX';
      const regionId = regionIds[city] || 'unknown';
      
      insertStatements.push(
        `INSERT INTO cities (name, team_name, baseline_price, region_id, state) VALUES ` +
        `('${city}', '${teamName}', ${baseline}, '${regionId}', '${state}');`
      );
    }
    
    console.log(insertStatements.join('\n'));
    
    // Save to file
    const outputPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_cities_data.sql');
    await fs.writeFile(outputPath, insertStatements.join('\n'));
    console.log(`\n-- Saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error generating baseline inserts:', error);
  }
}

generateBaselineInserts();
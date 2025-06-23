#!/usr/bin/env node

import 'dotenv/config';
console.log('[agg]', new Date().toISOString(), 'start');

// Aggregation script that reads city-partitioned data and generates production files
// Creates leaderboard.json and sales-data.json for frontend consumption

import fs from 'fs/promises';
import path from 'path';
import { upsertCompetitionData } from './lib/supabase-client.js';
import { isSaleInPeriod, extractSaleTimestamp } from '../../lib/dateUtils.js';
import { fetchSalesByCity } from '../../lib/fetchSales.js';

async function loadTeamAssignments() {
  try {
    const teamData = await fs.readFile('team-names.json', 'utf8');
    const parsed = JSON.parse(teamData);
    return {
      assignments: parsed.assignments || {},
      cities: parsed.cities || {}
    };
  } catch (error) {
    console.error('❌ Failed to load team assignments:', error.message);
    return { assignments: {}, cities: {} };
  }
}

async function loadBaselines() {
  try {
    const baselineData = await fs.readFile('baselines.json', 'utf8');
    const parsed = JSON.parse(baselineData);
    return parsed.baselines || {};
  } catch (error) {
    console.error('❌ Failed to load baselines:', error.message);
    return {};
  }
}

async function loadCompetitionState() {
  try {
    const configData = await fs.readFile('competition-config.json', 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('❌ Failed to load competition config:', error.message);
    return null;
  }
}

async function loadCitySales(cityName) {
  try {
    const sales = await fetchSalesByCity(cityName);
    console.log(`  - Fetched ${sales.length} sales from Supabase`);
    return sales;
  } catch (error) {
    console.warn(`  - Failed to fetch sales for ${cityName} from Supabase:`, error.message);
    return [];
  }
}

function filterSalesByCompetitionPeriod(sales, competitionConfig) {
  if (!competitionConfig || !competitionConfig.start_from_zero) {
    return sales; // No filtering if not in competition mode
  }
  
  // Use Pacific time date boundaries instead of UTC timestamps
  const startDatePacific = competitionConfig.pacific_start.split('T')[0]; // "2025-06-23"
  const endDatePacific = competitionConfig.pacific_end.split('T')[0]; // "2025-07-06"
  
  return sales.filter(sale => {
    return isSaleInPeriod(sale, startDatePacific, endDatePacific);
  });
}

function findHighestSale(sales) {
  if (sales.length === 0) return null;
  
  // Sort by price descending, then by date ascending (earlier wins ties)
  const sorted = sales.sort((a, b) => {
    const priceA = a.sale_price || a.price;
    const priceB = b.sale_price || b.price;
    if (priceB !== priceA) {
      return priceB - priceA; // Higher price wins
    }
    // Tie-breaker: earlier sale wins
    const aTimestamp = extractSaleTimestamp(a);
    const bTimestamp = extractSaleTimestamp(b);
    return new Date(aTimestamp).getTime() - new Date(bTimestamp).getTime();
  });
  
  return sorted[0];
}

function calculateScoreAndMultiplier(salePrice, baseline) {
  if (!baseline || baseline <= 0) return { scorePct: null, multiplier: null };
  
  // Only sales above baseline count for scoring
  if (salePrice <= baseline) {
    return { scorePct: null, multiplier: null };
  }
  
  const scorePct = ((salePrice - baseline) / baseline) * 100;
  const multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
  
  return { scorePct, multiplier };
}

function transformSaleForFrontend(sale) {
  const saleTimestamp = extractSaleTimestamp(sale);
  return {
    address: sale.address,
    date: new Date(saleTimestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    price: sale.sale_price,
    beds: sale.bedrooms,
    baths: sale.bathrooms,
    sqft: sale.square_feet,
    url: sale.url
  };
}

async function generateLeaderboardAndSalesData() {
  console.log('🔄 Generating leaderboard and sales data from Supabase...\n');
  
  // Load configuration data
  const teamData = await loadTeamAssignments();
  const baselines = await loadBaselines();
  const competitionConfig = await loadCompetitionState();
  
  const cities = Object.keys(teamData.assignments);
  if (cities.length === 0) {
    console.log('⚠️ No cities found in team assignments');
    return;
  }
  
  console.log(`🎯 Processing ${cities.length} cities for leaderboard...`);
  
  const leaderboard = [];
  const salesData = {};
  
  for (const cityName of cities) {
    const cityKey = cityName.replace(/\s+/g, ''); // e.g., "Kansas City" -> "KansasCity"
    
    console.log(`📊 Processing ${cityName}...`);
    
    // Load city sales from Supabase
    const allSales = await loadCitySales(cityName);
    
    // Filter by competition period if applicable
    const competitionSales = filterSalesByCompetitionPeriod(allSales, competitionConfig);
    console.log(`  - ${competitionSales.length} sales in competition period`);
    
    // Find highest sale for leaderboard
    const highestSale = findHighestSale(competitionSales);
    const baseline = baselines[cityName];
    
    // Get city info from central source of truth
    const cityInfo = teamData.cities[cityName] || {};
    const teamName = cityInfo.teamName || teamData.assignments[cityName] || 'Unknown';
    const stateAbbrev = cityInfo.state || '';

    if (highestSale && baseline) {
      const { scorePct, multiplier } = calculateScoreAndMultiplier(highestSale.sale_price, baseline);
      
      leaderboard.push({
        zip: cityKey, // Use cityKey as pseudo-zip for frontend compatibility
        city: cityName,
        state: stateAbbrev,
        teamName: teamName,
        price: highestSale.sale_price,
        baseline: baseline,
        scorePct: scorePct,
        multiplier: multiplier || '-',  // Convert null to dash for sales below baseline
        ts: new Date().getTime(),
        lastSoldDate: new Date(extractSaleTimestamp(highestSale)).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        topSaleAddress: highestSale.address
      });
      
      console.log(`  - Highest sale: $${highestSale.sale_price.toLocaleString()} (${multiplier || '-'})`);
    } else {
      // No competition sales or no baseline - create placeholder entry
      // During setup mode, show baseline but score as "-"
      leaderboard.push({
        zip: cityKey,
        city: cityName,
        state: stateAbbrev,
        teamName: teamName,
        price: 0,
        baseline: baseline || 0,
        scorePct: null,
        multiplier: '-',  // Show dash instead of null for setup mode
        ts: new Date().getTime(),
        lastSoldDate: null,
        topSaleAddress: null
      });
      
      console.log(`  - No competition sales found (setup mode)`);
    }
    
    // For sales data: during setup mode, provide empty array (no sales to show in modal)
    // During live/complete mode, show competition sales only
    const salesForModal = competitionSales.length > 0 ? 
      competitionSales
        .sort((a, b) => b.sale_price - a.sale_price)
        .slice(0, 10)
        .map(transformSaleForFrontend) :
      []; // Empty during setup mode
    
    salesData[cityKey] = salesForModal;
  }
  
  // Sort leaderboard by score percentage (highest first)
  leaderboard.sort((a, b) => {
    if (a.scorePct === null && b.scorePct === null) return 0;
    if (a.scorePct === null) return 1;
    if (b.scorePct === null) return -1;
    return b.scorePct - a.scorePct;
  });
  
  console.log('\n✅ Generated data:');
  console.log(`  - Leaderboard: ${leaderboard.length} cities`);
  console.log(`  - Sales data: ${Object.keys(salesData).length} cities`);
  
  // Also write to Supabase
  try {
    console.log('\n📤 Uploading to Supabase...');
    await upsertCompetitionData('baselines', baselines);
    await upsertCompetitionData('leaderboard', leaderboard);
    await upsertCompetitionData('sales_data', salesData);
    console.log('✅ Successfully uploaded data to Supabase');
  } catch (error) {
    console.error('❌ Failed to upload to Supabase:', error.message);
    console.warn('⚠️  Supabase upload failed. Data was not saved.');
  }
  
  // Summary
  console.log('\n📊 Leaderboard Summary:');
  leaderboard.slice(0, 5).forEach((city, index) => {
    const position = index + 1;
    const score = city.multiplier || 'No sales';
    console.log(`  ${position}. ${city.city} (${city.teamName}): ${score}`);
  });
  
  console.log('\n🎯 Aggregation complete!');
}

// Run the aggregation
generateLeaderboardAndSalesData().catch(error => {
  console.error('❌ Aggregation failed:', error);
  process.exit(1);
});
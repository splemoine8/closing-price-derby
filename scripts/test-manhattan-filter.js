#!/usr/bin/env node

// Test Manhattan filtering on current NYC data
import fs from 'fs/promises';
import { filterManhattanListings, getBoroughStats } from '../lib/manhattanUtils.js';

async function testManhattanFilter() {
  console.log('🗽 Testing Manhattan filtering on current NYC data...\n');
  
  // Load current NYC data
  const nycData = JSON.parse(await fs.readFile('data/sales-by-city/NewYork.json', 'utf8'));
  
  console.log(`📊 Current NYC data: ${nycData.length} total sales`);
  
  // Get borough distribution
  const stats = getBoroughStats(nycData);
  console.log('\n🏙️ Borough Distribution:');
  console.log(`   Manhattan: ${stats.manhattan} (${stats.manhattanPercentage}%)`);
  console.log(`   Brooklyn: ${stats.brooklyn}`);
  console.log(`   Queens: ${stats.queens}`);
  console.log(`   Bronx: ${stats.bronx}`);
  console.log(`   Staten Island: ${stats.statenIsland}`);
  console.log(`   Other: ${stats.other}`);
  
  // Filter to Manhattan only
  const manhattanListings = filterManhattanListings(nycData);
  console.log(`\n✅ Filtered result: ${manhattanListings.length} Manhattan-only sales`);
  
  if (manhattanListings.length > 0) {
    console.log('\n🏢 Manhattan Sales Examples:');
    manhattanListings.slice(0, 5).forEach((sale, i) => {
      console.log(`   ${i + 1}. ${sale.address} - $${sale.sale_price?.toLocaleString()}`);
      console.log(`      URL: ${sale.url}`);
    });
    
    // Check if any Manhattan sales are in competition period
    const competitionSales = manhattanListings.filter(sale => {
      const saleDate = sale.sale_timestamp_utc;
      return saleDate && saleDate >= '2025-06-23' && saleDate <= '2025-07-06';
    });
    
    console.log(`\n🎯 Manhattan sales in competition period: ${competitionSales.length}`);
    if (competitionSales.length > 0) {
      console.log('Competition Manhattan sales:');
      competitionSales.forEach((sale, i) => {
        console.log(`   ${i + 1}. ${sale.address} - $${sale.sale_price?.toLocaleString()} (${sale.sale_timestamp_utc})`);
      });
    }
  } else {
    console.log('❌ No Manhattan sales found with current filtering logic');
  }
}

testManhattanFilter();
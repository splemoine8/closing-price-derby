#!/usr/bin/env node

/**
 * Script to identify potential land sales in the database for manual review.
 * Looks for keywords and patterns that suggest land/lot sales rather than homes.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Keywords that often indicate land sales
const LAND_KEYWORDS = [
  'land',
  'lot',
  'parcel',
  'acre',
  'vacant',
  'unimproved',
  'buildable',
  'development site',
  'future development'
];

async function identifyLandSales() {
  console.log('🔍 Identifying potential land sales in the database...\n');

  // Build OR condition for all keywords
  const orConditions = LAND_KEYWORDS.map(keyword => `address.ilike.%${keyword}%`).join(',');

  // Fetch potential land sales
  const { data: suspiciousSales, error } = await supa
    .from('sales')
    .select('*')
    .or(orConditions)
    .order('sale_price', { ascending: false });

  if (error) {
    console.error('Error fetching sales:', error);
    return;
  }

  console.log(`Found ${suspiciousSales.length} potential land sales:\n`);
  console.log('=' + '='.repeat(100));

  // Group by city for easier review
  const byCity = {};
  suspiciousSales.forEach(sale => {
    if (!byCity[sale.city_name]) {
      byCity[sale.city_name] = [];
    }
    byCity[sale.city_name].push(sale);
  });

  // Display by city
  Object.keys(byCity).sort().forEach(city => {
    console.log(`\n📍 ${city} (${byCity[city].length} potential land sales)`);
    console.log('-'.repeat(80));
    
    byCity[city].forEach(sale => {
      console.log(`\nAddress: ${sale.address}`);
      console.log(`Price: $${sale.sale_price.toLocaleString()}`);
      console.log(`Date: ${new Date(sale.sale_timestamp_utc).toLocaleDateString()}`);
      console.log(`URL: ${sale.url || 'No URL'}`);
      
      // Highlight matching keywords
      const matchingKeywords = LAND_KEYWORDS.filter(keyword => 
        sale.address.toLowerCase().includes(keyword.toLowerCase())
      );
      console.log(`Keywords found: ${matchingKeywords.join(', ')}`);
      
      // Show if this affects the leaderboard
      if (sale.sale_price > 1000000) {
        console.log(`⚠️  HIGH VALUE - May affect leaderboard`);
      }
    });
  });

  // Summary of impact
  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  
  const highValueLand = suspiciousSales.filter(s => s.sale_price > 1000000);
  console.log(`\nTotal potential land sales: ${suspiciousSales.length}`);
  console.log(`High-value (>$1M) land sales: ${highValueLand.length}`);
  
  // Check which cities' leaderboards might be affected
  const affectedCities = new Set();
  for (const sale of highValueLand) {
    // Check if this is the top sale for the city
    const { data: leaderboard } = await supa
      .from('leaderboard')
      .select('price, top_sale_address')
      .eq('city', sale.city_name)
      .single();
    
    if (leaderboard && leaderboard.top_sale_address === sale.address) {
      affectedCities.add(sale.city_name);
    }
  }
  
  if (affectedCities.size > 0) {
    console.log(`\n⚠️  Cities with land sales as current leader: ${Array.from(affectedCities).join(', ')}`);
  }

  console.log('\nTo remove these sales after review, you can create a cleanup script');
  console.log('or manually delete them from the database using their sale_id values.');
}

identifyLandSales().catch(console.error);
#!/usr/bin/env node

// Check top sales after city filtering

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTopSales() {
  console.log('🏆 Top sales by city (after filtering):\n');
  
  const cities = ['Los Angeles', 'Dallas', 'Phoenix', 'Miami', 'Las Vegas'];
  
  for (const city of cities) {
    const { data: topSales } = await supa
      .from('sales')
      .select('address, sale_price, sale_timestamp_utc')
      .eq('city_name', city)
      .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
      .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z')
      .order('sale_price', { ascending: false })
      .limit(3);
      
    if (topSales && topSales.length > 0) {
      console.log(`\n${city}:`);
      topSales.forEach((sale, i) => {
        const date = new Date(sale.sale_timestamp_utc).toLocaleDateString();
        console.log(`  ${i+1}. ${sale.address}`);
        console.log(`     $${sale.sale_price.toLocaleString()} (${date})`);
      });
    }
  }
  
  // Check leaderboard view
  console.log('\n\n📊 Leaderboard (from VIEW):');
  const { data: leaderboard } = await supa
    .from('leaderboard')
    .select('city, price, multiplier, top_sale_address')
    .order('score_pct', { ascending: false, nullsFirst: false })
    .limit(5);
    
  if (leaderboard) {
    leaderboard.forEach((entry, i) => {
      console.log(`  ${i+1}. ${entry.city}: $${(entry.price/1000000).toFixed(1)}M (${entry.multiplier})`);
      if (entry.top_sale_address) {
        console.log(`     ${entry.top_sale_address}`);
      }
    });
  }
}

checkTopSales().catch(console.error);
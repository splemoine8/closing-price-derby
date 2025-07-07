#!/usr/bin/env node

// Check the 4 cities that were showing $0

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkProblemCities() {
  console.log('🔍 Checking previously problematic cities:\n');
  
  const cities = ['Houston', 'Denver', 'San Francisco', 'Tampa'];
  
  for (const city of cities) {
    const { data: topSale } = await supa
      .from('sales')
      .select('address, sale_price, sale_timestamp_utc')
      .eq('city_name', city)
      .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
      .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z')
      .order('sale_price', { ascending: false })
      .limit(1)
      .single();
      
    const { data: count } = await supa
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('city_name', city)
      .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
      .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
      
    if (topSale) {
      const date = new Date(topSale.sale_timestamp_utc).toLocaleDateString();
      console.log(`✅ ${city}:`);
      console.log(`   Highest: $${topSale.sale_price.toLocaleString()} - ${topSale.address}`);
      console.log(`   Total sales: ${count}`);
    } else {
      console.log(`❌ ${city}: No sales found`);
    }
  }
  
  // Check leaderboard view
  console.log('\n📊 Full Leaderboard:');
  const { data: leaderboard } = await supa
    .from('leaderboard')
    .select('city, price, multiplier')
    .order('score_pct', { ascending: false, nullsFirst: false });
    
  if (leaderboard) {
    leaderboard.forEach((entry, i) => {
      const priceStr = entry.price > 0 ? `$${(entry.price/1000000).toFixed(1)}M` : '$0';
      console.log(`  ${i+1}. ${entry.city}: ${priceStr} (${entry.multiplier})`);
    });
  }
}

checkProblemCities().catch(console.error);
#!/usr/bin/env node

// Quick script to check database sales data

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabaseSales() {
  // Check Dallas specifically since it has the biggest discrepancy
  console.log('🔍 Checking Dallas sales in database...\n');
  
  const { data: dallasSales, error } = await supa
    .from('sales')
    .select('address, sale_price, sale_timestamp_utc')
    .eq('city_name', 'Dallas')
    .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
    .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z')
    .order('sale_price', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error querying database:', error);
    return;
  }
  
  console.log('Top 10 Dallas sales in DB:');
  dallasSales.forEach((sale, i) => {
    console.log(`${i + 1}. $${sale.sale_price.toLocaleString()} - ${sale.address}`);
  });
  
  // Get counts for all cities
  console.log('\n📊 Sales count per city in competition period:\n');
  
  const { data: cityCounts, error: countError } = await supa
    .from('sales')
    .select('city_name')
    .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
    .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
    
  if (!countError && cityCounts) {
    const counts = {};
    cityCounts.forEach(row => {
      counts[row.city_name] = (counts[row.city_name] || 0) + 1;
    });
    
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([city, count]) => {
        console.log(`${city}: ${count} sales`);
      });
  }
  
  // Check if the $10.9M Dallas property exists
  console.log('\n🎯 Looking for the $10.9M Dallas property specifically...\n');
  
  const { data: specificSale, error: specificError } = await supa
    .from('sales')
    .select('*')
    .eq('city_name', 'Dallas')
    .eq('address', '4231 W Lawther Dr')
    .single();
    
  if (specificSale && !specificError) {
    console.log('Found it!');
    console.log('Address:', specificSale.address);
    console.log('Price:', `$${specificSale.sale_price.toLocaleString()}`);
    console.log('Date:', specificSale.sale_timestamp_utc);
    console.log('Sale ID:', specificSale.sale_id);
  } else {
    console.log('Could not find the $10.9M property at 4231 W Lawther Dr');
  }
}

checkDatabaseSales().catch(console.error);
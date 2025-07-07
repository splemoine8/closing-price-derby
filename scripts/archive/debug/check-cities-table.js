#!/usr/bin/env node

// Check cities table to see what's configured

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkCities() {
  console.log('🏙️  Cities configured in database:\n');
  
  const { data: cities, error } = await supa
    .from('cities')
    .select('*')
    .order('name');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  cities.forEach(city => {
    console.log(`${city.name} - Team: ${city.team_name}, Region: ${city.region_id}`);
  });
  
  // Check for missing cities
  console.log('\n\n❓ Checking for missing cities...');
  const expectedCities = ['Houston', 'Denver', 'San Francisco', 'Tampa'];
  
  for (const cityName of expectedCities) {
    const found = cities.find(c => c.name === cityName);
    if (!found) {
      console.log(`  ❌ ${cityName} is MISSING from cities table`);
    } else {
      console.log(`  ✅ ${cityName} is configured`);
    }
  }
  
  // Check sales for these cities
  console.log('\n\n📊 Checking sales data:');
  for (const cityName of expectedCities) {
    const { data: sales, count } = await supa
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('city_name', cityName)
      .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
      .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
      
    console.log(`  ${cityName}: ${count || 0} sales`);
  }
}

checkCities().catch(console.error);
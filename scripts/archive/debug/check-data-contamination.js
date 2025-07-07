#!/usr/bin/env node

// Quick script to check for cross-city contamination in the database

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const contamination_checks = [
  {
    city: 'Dallas',
    contaminants: ['Highland Park', 'University Park', 'HP', 'UP']
  },
  {
    city: 'Los Angeles', 
    contaminants: ['Beverly Hills', 'BH', 'Santa Monica', 'West Hollywood']
  },
  {
    city: 'Phoenix',
    contaminants: ['Scottsdale', 'Tempe', 'Mesa', 'Glendale']
  },
  {
    city: 'Miami',
    contaminants: ['Miami Beach', 'Coral Gables', 'Key Biscayne']
  }
];

async function checkContamination() {
  console.log('🔍 Checking for cross-city contamination in database...\n');
  
  let totalContamination = 0;
  
  for (const check of contamination_checks) {
    console.log(`\n📍 Checking ${check.city}...`);
    
    for (const contaminant of check.contaminants) {
      const { data, error, count } = await supa
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('city_name', check.city)
        .ilike('address', `%${contaminant}%`)
        .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
        .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
        
      if (error) {
        console.error(`  ❌ Error checking ${contaminant}:`, error.message);
        continue;
      }
      
      if (count > 0) {
        console.log(`  ⚠️  Found ${count} addresses containing "${contaminant}"`);
        totalContamination += count;
        
        // Get examples
        const { data: examples } = await supa
          .from('sales')
          .select('address, sale_price')
          .eq('city_name', check.city)
          .ilike('address', `%${contaminant}%`)
          .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
          .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z')
          .limit(3);
          
        if (examples) {
          examples.forEach(ex => {
            console.log(`     Example: ${ex.address} - $${ex.sale_price.toLocaleString()}`);
          });
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (totalContamination === 0) {
    console.log('✅ RESULT: No cross-city contamination detected!');
  } else {
    console.log(`❌ RESULT: Found ${totalContamination} contaminated records`);
    console.log('\nThis may require cleaning the database and re-running the scraper.');
  }
}

checkContamination().catch(console.error);
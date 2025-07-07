#!/usr/bin/env node

// Check for cross-city contamination in existing database

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkContamination() {
  console.log('🔍 Checking for cross-city contamination in database...\n');
  
  // Cities and their common contaminants
  const cityChecks = [
    {
      city: 'Los Angeles',
      contaminants: ['Beverly Hills', 'West Hollywood', 'Santa Monica', 'Culver City']
    },
    {
      city: 'Dallas',
      contaminants: ['Highland Park', 'University Park', 'Farmers Branch', 'Irving']
    },
    {
      city: 'Phoenix',
      contaminants: ['Scottsdale', 'Tempe', 'Mesa', 'Glendale', 'Chandler']
    },
    {
      city: 'Miami',
      contaminants: ['Miami Beach', 'Coral Gables', 'Coconut Grove', 'Key Biscayne']
    }
  ];
  
  for (const check of cityChecks) {
    console.log(`\n📍 Checking ${check.city}...`);
    
    // Get all sales for this city
    const { data: sales, error } = await supa
      .from('sales')
      .select('sale_id, address, sale_price')
      .eq('city_name', check.city)
      .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
      .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
      
    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      continue;
    }
    
    console.log(`  Total sales: ${sales.length}`);
    
    // Check each contaminant
    for (const contaminant of check.contaminants) {
      const contaminated = sales.filter(s => 
        s.address.toLowerCase().includes(contaminant.toLowerCase())
      );
      
      if (contaminated.length > 0) {
        console.log(`  ⚠️  Found ${contaminated.length} ${contaminant} properties:`);
        contaminated.slice(0, 3).forEach(s => {
          console.log(`     - ${s.address} ($${s.sale_price.toLocaleString()})`);
        });
      }
    }
  }
  
  // Check highest sale for each city
  console.log('\n\n🏆 Highest sales by city:');
  const cities = ['Los Angeles', 'Dallas', 'Phoenix', 'Miami'];
  
  for (const city of cities) {
    const { data: topSale } = await supa
      .from('sales')
      .select('address, sale_price')
      .eq('city_name', city)
      .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
      .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z')
      .order('sale_price', { ascending: false })
      .limit(1)
      .single();
      
    if (topSale) {
      console.log(`  ${city}: ${topSale.address} - $${topSale.sale_price.toLocaleString()}`);
    }
  }
}

checkContamination().catch(console.error);
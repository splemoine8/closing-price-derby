#!/usr/bin/env node

// Debug Nashville data mismatch

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function debugNashville() {
  console.log('🔍 Checking Nashville data...\n');
  
  // Check for the $6.7M property
  const { data: highProp, error: highError } = await supa
    .from('sales')
    .select('*')
    .eq('city_name', 'Nashville')
    .eq('address', '404 W Brookfield Ave')
    .single();
    
  if (highProp && !highError) {
    console.log('Found 404 W Brookfield Ave in database:');
    console.log('Price:', `$${highProp.sale_price.toLocaleString()}`);
    console.log('Date:', highProp.sale_timestamp_utc);
  } else {
    console.log('404 W Brookfield Ave NOT found in database');
  }
  
  // Get top Nashville sales
  console.log('\nTop 5 Nashville sales in database:');
  const { data: topSales, error } = await supa
    .from('sales')
    .select('address, sale_price, sale_timestamp_utc')
    .eq('city_name', 'Nashville')
    .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
    .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z')
    .order('sale_price', { ascending: false })
    .limit(5);
    
  if (topSales && !error) {
    topSales.forEach((sale, i) => {
      console.log(`${i + 1}. $${sale.sale_price.toLocaleString()} - ${sale.address} (${sale.sale_timestamp_utc})`);
    });
  }
}

debugNashville().catch(console.error);
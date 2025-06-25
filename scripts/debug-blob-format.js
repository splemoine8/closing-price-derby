#!/usr/bin/env node

// Debug script to check the old blob format in Supabase
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBlobFormat() {
  console.log('🔍 Checking old blob format in Supabase...\n');
  
  const { data: oldBlob, error: oldError } = await supa
    .from('competition_data')
    .select('data, updated_at')
    .eq('data_type', 'sales_data')
    .is('city', null)
    .single();
  
  if (oldBlob && !oldError && oldBlob.data) {
    console.log(`📊 Old blob format found, updated: ${oldBlob.updated_at}`);
    console.log('Cities in blob:');
    
    const cities = Object.keys(oldBlob.data);
    cities.forEach(city => {
      const salesCount = Array.isArray(oldBlob.data[city]) ? oldBlob.data[city].length : 0;
      console.log(`  - "${city}": ${salesCount} sales`);
    });
    
    // Check specifically for NewYork
    if (oldBlob.data.NewYork) {
      console.log(`\n🗽 NewYork data found: ${oldBlob.data.NewYork.length} sales`);
      const sample = oldBlob.data.NewYork[0];
      console.log('Sample sale:', {
        address: sample.address,
        sale_timestamp_utc: sample.sale_timestamp_utc,
        sale_price: sample.sale_price
      });
    } else {
      console.log('\n❌ No NewYork data in blob');
    }
  } else {
    console.log('❌ No old blob format found');
    console.log('Error:', oldError);
  }
}

checkBlobFormat();
#!/usr/bin/env node

// Debug script to check what city keys exist in Supabase
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function sanitize(city) {
  return city.replace(/[^A-Za-z]/g, '');
}

async function checkSupabaseKeys() {
  console.log('🔍 Checking city keys in Supabase...\n');
  
  // Check new per-city format
  const { data: cityRecords, error: cityError } = await supa
    .from('competition_data')
    .select('city, data_type, updated_at')
    .eq('data_type', 'sales_data')
    .not('city', 'is', null);
  
  if (cityRecords && cityRecords.length > 0) {
    console.log('📊 Per-city records found:');
    cityRecords.forEach(record => {
      console.log(`  - City: "${record.city}", Updated: ${record.updated_at}`);
    });
  } else {
    console.log('❌ No per-city records found');
  }
  
  // Check specific NYC keys
  const nycVariants = ['NewYork', 'newyork', 'new_york'];
  console.log('\n🗽 Testing NYC key variants:');
  
  for (const key of nycVariants) {
    const { data, error } = await supa
      .from('competition_data')
      .select('city, data')
      .eq('data_type', 'sales_data')
      .eq('city', key)
      .single();
    
    if (data && !error) {
      const salesCount = Array.isArray(data.data) ? data.data.length : 0;
      console.log(`  ✅ "${key}": ${salesCount} sales found`);
    } else {
      console.log(`  ❌ "${key}": Not found`);
    }
  }
  
  console.log('\n🔄 Testing sanitize function:');
  console.log(`  "New York" → "${sanitize('New York')}"`);
}

checkSupabaseKeys();
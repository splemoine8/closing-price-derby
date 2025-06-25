#!/usr/bin/env node

// Direct Supabase queries to understand the exact data structure
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function sanitize(city) {
  return city.replace(/[^A-Za-z]/g, '');
}

async function debugSupabaseQueries() {
  console.log('🔍 Direct Supabase queries to debug NYC data...\n');
  
  // 1. Check all competition_data records
  console.log('1. All competition_data records:');
  const { data: allRecords, error: allError } = await supa
    .from('competition_data')
    .select('data_type, city, updated_at')
    .order('updated_at', { ascending: false });
  
  if (allRecords) {
    allRecords.forEach(record => {
      console.log(`   ${record.data_type} | city: "${record.city}" | updated: ${record.updated_at}`);
    });
  }
  
  // 2. Try the exact query from fetchSalesByCity for NYC
  console.log('\n2. Exact NYC query from fetchSalesByCity:');
  const nycKey = sanitize('New York');
  console.log(`   Searching for city: "${nycKey}"`);
  
  const { data: nycData, error: nycError } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .eq('city', nycKey)
    .single();
  
  if (nycError) {
    console.log(`   Error: ${nycError.message}`);
  } else if (nycData) {
    const salesCount = Array.isArray(nycData.data) ? nycData.data.length : 0;
    console.log(`   Found data with ${salesCount} sales`);
  }
  
  // 3. Check if there are any sales_data records with city != null
  console.log('\n3. All sales_data records with cities:');
  const { data: salesRecords, error: salesError } = await supa
    .from('competition_data')
    .select('city, updated_at')
    .eq('data_type', 'sales_data')
    .not('city', 'is', null);
  
  if (salesRecords && salesRecords.length > 0) {
    salesRecords.forEach(record => {
      console.log(`   City: "${record.city}" | Updated: ${record.updated_at}`);
    });
  } else {
    console.log('   No per-city sales_data records found');
  }
  
  // 4. Check what the scraper would have pushed
  console.log('\n4. Expected scraper push format:');
  console.log(`   data_type: "sales_data"`);
  console.log(`   city: "${nycKey}"`);
  console.log(`   Should match exactly for upsert to work`);
}

debugSupabaseQueries();
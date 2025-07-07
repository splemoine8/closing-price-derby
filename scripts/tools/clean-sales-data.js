#!/usr/bin/env node

// Clean all sales data to remove contamination

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanSalesData() {
  console.log('🧹 Cleaning sales data...\n');
  
  // Delete all sales in competition period
  const { error, count } = await supa
    .from('sales')
    .delete()
    .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
    .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
    
  if (error) {
    console.error('❌ Error deleting sales:', error);
    return;
  }
  
  console.log(`✅ Deleted ${count} sales records`);
  console.log('\nNow re-run the scraper to populate with clean data:');
  console.log('  node scripts/run-competition-update.js');
}

cleanSalesData().catch(console.error);
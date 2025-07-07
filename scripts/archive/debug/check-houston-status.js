#!/usr/bin/env node

// Quick check on Houston data status

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkHoustonStatus() {
  console.log('🔍 Checking Houston data status...\n');
  
  // Count Houston sales in competition period
  const { count, error } = await supa
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('city_name', 'Houston')
    .gte('sale_timestamp_utc', '2025-06-23T07:00:00Z')
    .lte('sale_timestamp_utc', '2025-07-07T06:59:59Z');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Houston sales in database: ${count}`);
  console.log(`Houston sales found by backfill: 28,032`);
  console.log(`Difference: ${28032 - (count || 0)}`);
  
  // Check most recent Houston sale
  const { data: recent, error: recentError } = await supa
    .from('sales')
    .select('created_at, sale_timestamp_utc')
    .eq('city_name', 'Houston')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (recent && !recentError) {
    console.log(`\nMost recent Houston sale added: ${recent.created_at}`);
  }
}

checkHoustonStatus().catch(console.error);
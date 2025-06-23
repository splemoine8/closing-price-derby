#!/usr/bin/env node

// Script to purge existing New York sales data from Supabase
// This allows us to start fresh with Manhattan-only data after switching region IDs

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.VITE_SUPABASE_SERVICE_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '❌');
  console.error('   SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✓' : '❌');
  process.exit(1);
}

const supa = createClient(supabaseUrl, supabaseServiceKey);

function sanitize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

async function purgeNewYorkSales() {
  console.log('🗑️  Purging existing New York sales data from Supabase...\n');
  
  const cityKey = sanitize('New York');
  console.log(`🔍 Looking for sales data with city key: "${cityKey}"`);
  
  try {
    // First, check what exists
    const { data: existingData, error: checkError } = await supa
      .from('competition_data')
      .select('data_type, city, updated_at')
      .eq('data_type', 'sales_data')
      .eq('city', cityKey);
    
    if (checkError) {
      console.error('❌ Error checking existing data:', checkError.message);
      return;
    }
    
    if (!existingData || existingData.length === 0) {
      console.log('ℹ️  No existing New York sales data found');
      return;
    }
    
    console.log(`📊 Found ${existingData.length} New York sales record(s):`);
    existingData.forEach((record, i) => {
      console.log(`   ${i + 1}. Type: ${record.data_type}, City: ${record.city}, Updated: ${record.updated_at}`);
    });
    
    // Delete the records
    console.log(`\n🗑️  Deleting New York sales data...`);
    const { error: deleteError } = await supa
      .from('competition_data')
      .delete()
      .eq('data_type', 'sales_data')
      .eq('city', cityKey);
    
    if (deleteError) {
      console.error('❌ Error deleting data:', deleteError.message);
      return;
    }
    
    console.log('✅ Successfully purged New York sales data!');
    console.log('📝 Next scraper run will populate with Manhattan-only data');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the purge
purgeNewYorkSales();
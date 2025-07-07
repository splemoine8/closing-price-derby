#!/usr/bin/env node

// Debug why the $6.7M Nashville sale is missing from database

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Generate deterministic ID (same as scraper)
function generateSaleId(sale) {
  const key = `${sale.address}|${sale.city_name}|${sale.sale_price}|${sale.sale_timestamp_utc}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function debugMissingSale() {
  console.log('🔍 Debugging missing $6.7M Nashville sale...\n');
  
  // The missing sale details from CSV
  const missingSale = {
    address: '404 W Brookfield Ave',
    city_name: 'Nashville',
    sale_price: 6700000,
    sale_timestamp_utc: '2025-06-24T07:00:00.000Z' // Assuming UTC conversion
  };
  
  const saleId = generateSaleId(missingSale);
  console.log('Expected Sale ID:', saleId);
  
  // Check if this ID exists
  const { data: existingById, error: idError } = await supa
    .from('sales')
    .select('*')
    .eq('sale_id', saleId)
    .single();
    
  if (existingById && !idError) {
    console.log('\n✅ Sale EXISTS by ID but may have different data:');
    console.log('Address:', existingById.address);
    console.log('City:', existingById.city_name);
    console.log('Price:', `$${existingById.sale_price.toLocaleString()}`);
    console.log('Date:', existingById.sale_timestamp_utc);
  } else {
    console.log('\n❌ Sale NOT FOUND by ID');
  }
  
  // Check for similar addresses
  console.log('\n🏠 Checking for similar addresses...');
  const { data: similarAddresses, error: addrError } = await supa
    .from('sales')
    .select('address, city_name, sale_price, sale_timestamp_utc')
    .ilike('address', '%404%Brookfield%')
    .order('sale_timestamp_utc', { ascending: false })
    .limit(5);
    
  if (similarAddresses && similarAddresses.length > 0) {
    console.log('Found similar addresses:');
    similarAddresses.forEach(sale => {
      console.log(`- ${sale.address}, ${sale.city_name} - $${sale.sale_price.toLocaleString()} on ${sale.sale_timestamp_utc}`);
    });
  } else {
    console.log('No similar addresses found');
  }
  
  // Check last scraper run for Nashville
  console.log('\n📅 Checking recent Nashville scraper activity...');
  const { data: recentNashville, error: recentError } = await supa
    .from('sales')
    .select('sale_timestamp_utc, created_at')
    .eq('city_name', 'Nashville')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (recentNashville && recentNashville.length > 0) {
    console.log('Most recent Nashville sales added to DB:');
    recentNashville.forEach(sale => {
      console.log(`- Sale from ${sale.sale_timestamp_utc} added at ${sale.created_at}`);
    });
  }
  
  // Check if we need to run the scraper
  console.log('\n💡 Analysis:');
  console.log('The $6.7M sale at 404 W Brookfield Ave closed on 6/24/2025');
  console.log('This sale is NOT in the database');
  console.log('ACTION NEEDED: Run the scraper to capture this missing sale');
}

debugMissingSale().catch(console.error);
#!/usr/bin/env node

/**
 * Script to purge a specific property from the 'sales' table.
 * 
 * Usage:
 * node scripts/tools/purge-property.js --city="Miami" --address="1141 N Venetian Dr"
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const args = process.argv.slice(2);
const parsedArgs = {};

args.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key && value) {
    const cleanKey = key.replace('--', '');
    parsedArgs[cleanKey] = value;
  }
});

// Validate required arguments
if (!parsedArgs.city || !parsedArgs.address || !parsedArgs.reason) {
  console.error('❌ Missing required arguments');
  console.log('\nUsage:');
  console.log('  node scripts/tools/purge-property.js --city="Miami" --address="1141 N Venetian Dr" --reason="duplicate_listing"');
  console.log('\nRequired arguments:');
  console.log('  --city    : The city name');
  console.log('  --address : The full address');
  console.log('  --reason  : The reason for blacklisting');
  process.exit(1);
}

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const city = parsedArgs.city;
  const address = parsedArgs.address;
  const reason = parsedArgs.reason;

  console.log('🔥 Starting purge script...');
  console.log(`   Looking for property:`);
  console.log(`   - City: ${city}`);
  console.log(`   - Address: ${address}`);
  console.log(`   - Blacklist reason: ${reason}`);

  // First, let's find all matching properties
  const { data: checkData, error: checkError } = await supa
    .from('sales')
    .select('sale_id, sale_price, sale_timestamp_utc')
    .match({
      city_name: city,
      address: address,
    });

  if (checkError) {
    console.error('❌ Error checking for property:', checkError.message);
    process.exit(1);
  }

  if (!checkData || checkData.length === 0) {
    console.log('⚠️  No matching property found in the database.');
    process.exit(0);
  }

  console.log(`\n✓ Found ${checkData.length} matching record(s):`);
  checkData.forEach((record, index) => {
    console.log(`\n  Record ${index + 1}:`);
    console.log(`  - Sale ID: ${record.sale_id}`);
    console.log(`  - Price: $${record.sale_price.toLocaleString()}`);
    console.log(`  - Sale Date: ${new Date(record.sale_timestamp_utc).toLocaleDateString()}`);
  });

  // Ask for confirmation
  console.log('\n⚠️  WARNING: This will permanently delete ALL the above record(s).');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Perform the delete
  try {
    const { data, error } = await supa
      .from('sales')
      .delete()
      .match({
        city_name: city,
        address: address,
      });

    if (error) {
      throw error;
    }

    console.log('✅ Successfully purged the property from the database.');

    // Add property to blacklist
    try {
      console.log('📝 Adding property to blacklist...');
      const { error: blacklistError } = await supa
        .from('private.blacklisted_properties')
        .upsert({
          city_name: city,
          address: address,
          reason: reason,
          blacklisted_by: 'manual_purge_script'
        }, {
          onConflict: 'city_name,address'
        });

      if (blacklistError) {
        console.error('⚠️  Failed to add property to blacklist:', blacklistError.message);
        console.log('   Property was still purged successfully.');
      } else {
        console.log('✅ Successfully added property to blacklist.');
      }
    } catch (blacklistError) {
      console.error('⚠️  Failed to add property to blacklist:', blacklistError.message);
      console.log('   Property was still purged successfully.');
    }

  } catch (error) {
    console.error('❌ An error occurred while trying to purge the property:');
    console.error(error.message);
    process.exit(1);
  }

  console.log('🏁 Purge script finished.');
}

// Execute the main function
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * One-time use script to purge a specific incorrect property
 * from the 'sales' table in the Supabase database.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

// Details of the incorrect property to be deleted
const PROPERTY_TO_DELETE = {
  city: 'Phoenix',
  address: '5145 N 7th St',
  price: 34750000,
};

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Main function to run the purge script.
 */
async function main() {
  console.log('🔥 Starting purge script...');
  console.log(`   Attempting to delete property:`);
  console.log(`   - City: ${PROPERTY_TO_DELETE.city}`);
  console.log(`   - Address: ${PROPERTY_TO_DELETE.address}`);
  console.log(`   - Price: $${PROPERTY_TO_DELETE.price.toLocaleString()}`);

  try {
    // Perform the delete operation
    const { data, error } = await supa
      .from('sales')
      .delete()
      .match({
        city_name: PROPERTY_TO_DELETE.city,
        address: PROPERTY_TO_DELETE.address,
        sale_price: PROPERTY_TO_DELETE.price,
      });

    if (error) {
      // Throw the error to be caught by the catch block
      throw error;
    }

    console.log('✅ Successfully purged the incorrect property from the database.');

  } catch (error) {
    console.error('❌ An error occurred while trying to purge the property:');
    console.error(error.message);
    process.exit(1);
  }

  console.log('🏁 Purge script finished.');
}

// Execute the main function
main();

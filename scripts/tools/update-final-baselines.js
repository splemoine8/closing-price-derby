#!/usr/bin/env node

/**
 * One-time use script to update the baseline_price for each city
 * in the Supabase 'cities' table with the final, correct values.
 *
 * This script makes NO API calls.
 *
 * Usage: node ./scripts/update-final-baselines.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// --- FINAL BASELINE VALUES ---
// These are the correct median prices taken from the last run of the
// calculate-new-baselines.js script.
const FINAL_BASELINES = {
  'Dallas': 485000,
  'Denver': 600000,
  'Houston': 330000,
  'Las Vegas': 439900,
  'Los Angeles': 1160000,
  'Miami': 585000,
  'Nashville': 540000,
  'New Orleans': 328500,
  'New York': 863000,
  'Phoenix': 430500,
  'San Francisco': 1500000,
  'Tampa': 415000,
};

// --- SUPABASE CLIENT ---
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Main function to run the update script.
 */
async function main() {
  console.log('🚀 Starting baseline update script...');
  console.log('   This will update the `baseline_price` in your `cities` table.');

  let successfulUpdates = 0;
  let failedUpdates = 0;

  // Loop through each city and its new baseline price
  for (const [cityName, newBaseline] of Object.entries(FINAL_BASELINES)) {
    console.log(`\nUpdating ${cityName}...`);
    console.log(`  -> New Baseline: $${newBaseline.toLocaleString()}`);

    try {
      const { data, error } = await supa
        .from('cities')
        .update({ baseline_price: newBaseline })
        .eq('name', cityName)
        .select();

      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log(`  ✅ Successfully updated ${cityName}.`);
        successfulUpdates++;
      } else {
        console.warn(`  ⚠️ Could not find city "${cityName}" in the database. Skipping.`);
        failedUpdates++;
      }

    } catch (error) {
      console.error(`  ❌ FAILED to update ${cityName}:`, error.message);
      failedUpdates++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Baseline update complete!');
  console.log(`   - ${successfulUpdates} cities updated successfully.`);
  console.log(`   - ${failedUpdates} cities failed or were skipped.`);
  console.log('='.repeat(60));
}

// Execute the main function
main();

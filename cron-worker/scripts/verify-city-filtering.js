#!/usr/bin/env node

// Verify city filtering by checking the aggregated leaderboard data

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const NYC_ALLOWED_CITIES = ['New York', 'New York City', 'Manhattan', 'Bronx', 'Queens', 'Staten Island', 'Brooklyn'];

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyCityFiltering() {
  console.log('🔍 Verifying City Filtering in Production Data\n');

  // Fetch the aggregated sales data
  const { data: salesBlob, error } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .is('city', null)
    .single();

  if (error || !salesBlob?.data) {
    console.error('❌ Failed to fetch sales data from Supabase');
    return;
  }

  const allCitySales = salesBlob.data;
  const cities = Object.keys(allCitySales);
  
  console.log(`Found ${cities.length} cities in aggregated data\n`);

  let totalIssues = 0;
  const results = {};

  // Check each city
  for (const cityKey of cities) {
    const sales = allCitySales[cityKey] || [];
    
    console.log(`\n📊 Checking ${cityKey} (${sales.length} sales shown in modal)`);
    
    // Get unique city names from the sales
    const uniqueCities = [...new Set(sales.map(s => s.city || 'Unknown'))];
    
    if (cityKey === 'NewYork') {
      // Special handling for New York
      console.log('  Expected: New York boroughs (Manhattan, Brooklyn, Queens, Bronx, Staten Island)');
      console.log(`  Found: ${uniqueCities.join(', ')}`);
      
      const invalidCities = uniqueCities.filter(city => 
        !NYC_ALLOWED_CITIES.some(allowed => 
          allowed.toLowerCase() === city.toLowerCase()
        )
      );
      
      if (invalidCities.length > 0) {
        console.log(`  ❌ Invalid cities found: ${invalidCities.join(', ')}`);
        totalIssues++;
      } else {
        console.log('  ✅ All sales are from valid NYC boroughs');
      }
    } else {
      // For all other cities, should only have one city name
      const expectedCity = cityKey.replace(/([A-Z])/g, ' $1').trim(); // "LosAngeles" -> "Los Angeles"
      
      console.log(`  Expected: ${expectedCity}`);
      console.log(`  Found: ${uniqueCities.join(', ')}`);
      
      if (uniqueCities.length === 1) {
        const foundCity = uniqueCities[0];
        // Check if it matches (case-insensitive)
        if (foundCity.toLowerCase() === expectedCity.toLowerCase() ||
            foundCity.toLowerCase() === cityKey.toLowerCase()) {
          console.log('  ✅ Correct - only contains sales from the target city');
        } else {
          console.log(`  ❌ Incorrect city name: "${foundCity}" instead of "${expectedCity}"`);
          totalIssues++;
        }
      } else if (uniqueCities.length > 1) {
        console.log(`  ❌ Multiple cities found - possible contamination`);
        totalIssues++;
      }
    }
    
    // Show sample sales
    if (sales.length > 0) {
      console.log('  Sample sales:');
      sales.slice(0, 3).forEach(sale => {
        console.log(`    - ${sale.address} | ${sale.city} | $${sale.price.toLocaleString()}`);
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  if (totalIssues === 0) {
    console.log('✅ City filtering is working correctly!');
    console.log('All cities contain only sales from the correct locations.');
    console.log('\nNew York correctly includes all boroughs.');
  } else {
    console.log(`❌ Found ${totalIssues} cities with potential filtering issues`);
  }

  // Also check the leaderboard data
  console.log('\n' + '='.repeat(60));
  console.log('🏆 LEADERBOARD VERIFICATION');
  console.log('='.repeat(60));

  const { data: leaderboardBlob } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'leaderboard')
    .is('city', null)
    .single();

  if (leaderboardBlob?.data) {
    const leaderboard = leaderboardBlob.data;
    console.log('\nTop 5 cities by multiplier:');
    leaderboard
      .sort((a, b) => (b.scorePct || 0) - (a.scorePct || 0))
      .slice(0, 5)
      .forEach((city, i) => {
        console.log(`${i + 1}. ${city.city} (${city.teamName}): ${city.multiplier} - $${city.price.toLocaleString()}`);
      });
  }
}

// Run verification
verifyCityFiltering().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
#!/usr/bin/env node

// Detailed test to verify city filtering including NY boroughs
// Also checks for potential cross-contamination issues

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const NYC_ALLOWED_CITIES = ['New York', 'New York City', 'Manhattan', 'Bronx', 'Queens', 'Staten Island', 'Brooklyn'];

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fetchSalesFromSupabase(cityKey) {
  const { data, error } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .eq('city', cityKey)
    .single();

  if (error || !data) {
    console.log(`No data found for ${cityKey} in Supabase`);
    return [];
  }

  return data.data || [];
}

async function testSupabaseData() {
  console.log('🔍 Testing City Filtering (From Supabase - Latest Data)\n');
  
  // List of all cities
  const cities = [
    'NewYork', 'Nashville', 'NewOrleans', 'LosAngeles', 
    'LasVegas', 'Dallas', 'Miami', 'Phoenix', 
    'SanFrancisco', 'Houston', 'Tampa', 'Denver'
  ];
  
  const crossContamination = {};
  let totalIssues = 0;
  
  for (const cityKey of cities) {
    const sales = await fetchSalesFromSupabase(cityKey);
    
    console.log(`\n📊 Checking ${cityKey} (${sales.length} total sales in Supabase)`);
    
    if (sales.length === 0) continue;
    
    // Group sales by their actual city name
    const cityCounts = {};
    const wrongCitySales = [];
    
    for (const sale of sales) {
      const saleCity = sale.city || sale.addressInfo?.city || 'Unknown';
      cityCounts[saleCity] = (cityCounts[saleCity] || 0) + 1;
      
      // Track potential cross-contamination
      if (!crossContamination[saleCity]) {
        crossContamination[saleCity] = new Set();
      }
      crossContamination[saleCity].add(cityKey);
      
      // Check if this sale belongs in this city
      if (cityKey === 'NewYork') {
        // Special handling for New York - check if city is in allowed list
        const isValid = NYC_ALLOWED_CITIES.some(allowed => 
          allowed.toLowerCase() === saleCity.toLowerCase() || 
          allowed.toLowerCase() === saleCity.split('(')[0].trim().toLowerCase()
        );
        if (!isValid) {
          wrongCitySales.push({
            address: sale.address,
            city: saleCity,
            price: sale.sale_price || sale.price
          });
        }
      } else {
        // For all other cities, the sale city should match the target city
        const targetCity = cityKey.replace(/([A-Z])/g, ' $1').trim(); // "LosAngeles" -> "Los Angeles"
        
        // Check various formats
        const isValid = 
          saleCity.toLowerCase() === targetCity.toLowerCase() ||
          saleCity.toLowerCase() === cityKey.toLowerCase() ||
          saleCity.toLowerCase().replace(/\s+/g, '') === cityKey.toLowerCase();
          
        if (!isValid) {
          wrongCitySales.push({
            address: sale.address,
            city: saleCity,
            price: sale.sale_price || sale.price
          });
        }
      }
    }
    
    // Display city breakdown
    console.log('\nCity breakdown:');
    const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
    
    if (sortedCities.length > 5) {
      // Show top 5 and summary
      sortedCities.slice(0, 5).forEach(([city, count]) => {
        const percentage = ((count / sales.length) * 100).toFixed(1);
        console.log(`  - ${city}: ${count} sales (${percentage}%)`);
      });
      console.log(`  ... and ${sortedCities.length - 5} more cities`);
    } else {
      sortedCities.forEach(([city, count]) => {
        const percentage = ((count / sales.length) * 100).toFixed(1);
        console.log(`  - ${city}: ${count} sales (${percentage}%)`);
      });
    }
    
    // Report issues
    if (wrongCitySales.length > 0) {
      console.log(`\n❌ Found ${wrongCitySales.length} sales from wrong cities:`);
      wrongCitySales.slice(0, 3).forEach(sale => {
        console.log(`  - ${sale.address} in ${sale.city} ($${sale.price?.toLocaleString() || 'N/A'})`);
      });
      if (wrongCitySales.length > 3) {
        console.log(`  ... and ${wrongCitySales.length - 3} more`);
      }
      totalIssues += wrongCitySales.length;
    } else {
      console.log('\n✅ All sales are from the correct city');
    }
  }
  
  // Check for cross-contamination
  console.log('\n' + '='.repeat(60));
  console.log('🔄 CROSS-CONTAMINATION CHECK');
  console.log('='.repeat(60));
  
  let contaminationFound = false;
  Object.entries(crossContamination).forEach(([cityName, foundIn]) => {
    if (foundIn.size > 1) {
      contaminationFound = true;
      console.log(`❌ "${cityName}" found in multiple city datasets:`);
      console.log(`   - ${Array.from(foundIn).join(', ')}`);
    }
  });
  
  if (!contaminationFound) {
    console.log('✅ No cross-contamination found between cities');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  if (totalIssues === 0) {
    console.log('✅ City filtering is working correctly in Supabase data!');
    console.log('All cities contain only sales from the correct locations.');
  } else {
    console.log(`❌ Found ${totalIssues} total sales in wrong cities`);
  }
  
  // Special test for New York boroughs
  console.log('\n' + '='.repeat(60));
  console.log('🏙️  NEW YORK BOROUGHS TEST');
  console.log('='.repeat(60));
  
  const nySales = await fetchSalesFromSupabase('NewYork');
  const boroughCounts = {};
  
  nySales.forEach(sale => {
    const city = sale.city || 'Unknown';
    boroughCounts[city] = (boroughCounts[city] || 0) + 1;
  });
  
  console.log(`Total NY sales: ${nySales.length}`);
  console.log('\nBorough breakdown:');
  Object.entries(boroughCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([borough, count]) => {
      const percentage = ((count / nySales.length) * 100).toFixed(1);
      const isAllowed = NYC_ALLOWED_CITIES.some(allowed => 
        allowed.toLowerCase() === borough.toLowerCase()
      );
      const status = isAllowed ? '✅' : '❌';
      console.log(`  ${status} ${borough}: ${count} sales (${percentage}%)`);
    });
}

// Run the test
testSupabaseData().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
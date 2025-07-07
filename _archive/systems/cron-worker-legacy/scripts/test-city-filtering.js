#!/usr/bin/env node

// Test script to verify city filtering is working correctly
// Checks that each city only contains sales from the correct city (except NY boroughs)

import fs from 'fs/promises';
import path from 'path';

const NYC_ALLOWED_CITIES = ['New York', 'New York City', 'Manhattan', 'Bronx', 'Queens', 'Staten Island', 'Brooklyn'];

async function loadCitySales(cityKey) {
  try {
    const filePath = path.join('data/sales-by-city', `${cityKey}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Failed to load ${cityKey}:`, error.message);
    return [];
  }
}

async function testCityFiltering() {
  console.log('🔍 Testing City Filtering\n');
  
  // Get all city files
  const salesDir = 'data/sales-by-city';
  const files = await fs.readdir(salesDir);
  const cityFiles = files.filter(f => f.endsWith('.json'));
  
  const results = {};
  let totalIssues = 0;
  
  for (const file of cityFiles) {
    const cityKey = file.replace('.json', '');
    const sales = await loadCitySales(cityKey);
    
    console.log(`\n📊 Checking ${cityKey} (${sales.length} total sales)`);
    
    // Group sales by their actual city name
    const cityCounts = {};
    const wrongCitySales = [];
    
    for (const sale of sales) {
      const saleCity = sale.city;
      cityCounts[saleCity] = (cityCounts[saleCity] || 0) + 1;
      
      // Check if this sale belongs in this city
      if (cityKey === 'NewYork') {
        // Special handling for New York - check if city is in allowed list
        if (!NYC_ALLOWED_CITIES.some(allowed => 
          allowed.toLowerCase() === saleCity.toLowerCase() || 
          allowed.toLowerCase() === saleCity.split('(')[0].trim().toLowerCase()
        )) {
          wrongCitySales.push({
            address: sale.address,
            city: saleCity,
            price: sale.sale_price
          });
        }
      } else {
        // For all other cities, the sale city should match the target city
        // Handle case-insensitive comparison
        const targetCity = cityKey.replace(/([A-Z])/g, ' $1').trim(); // "LosAngeles" -> "Los Angeles"
        if (saleCity.toLowerCase() !== targetCity.toLowerCase() && 
            saleCity.toLowerCase() !== cityKey.toLowerCase()) {
          wrongCitySales.push({
            address: sale.address,
            city: saleCity,
            price: sale.sale_price
          });
        }
      }
    }
    
    // Display city breakdown
    console.log('\nCity breakdown:');
    Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([city, count]) => {
        const percentage = ((count / sales.length) * 100).toFixed(1);
        console.log(`  - ${city}: ${count} sales (${percentage}%)`);
      });
    
    // Report issues
    if (wrongCitySales.length > 0) {
      console.log(`\n❌ Found ${wrongCitySales.length} sales from wrong cities:`);
      wrongCitySales.slice(0, 5).forEach(sale => {
        console.log(`  - ${sale.address} in ${sale.city} ($${sale.price.toLocaleString()})`);
      });
      if (wrongCitySales.length > 5) {
        console.log(`  ... and ${wrongCitySales.length - 5} more`);
      }
      totalIssues += wrongCitySales.length;
    } else {
      console.log('\n✅ All sales are from the correct city');
    }
    
    results[cityKey] = {
      total: sales.length,
      cityCounts,
      wrongCitySales: wrongCitySales.length
    };
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  if (totalIssues === 0) {
    console.log('✅ City filtering is working correctly!');
    console.log('All cities contain only sales from the correct locations.');
  } else {
    console.log(`❌ Found ${totalIssues} total sales in wrong cities`);
    console.log('\nCities with issues:');
    Object.entries(results)
      .filter(([_, data]) => data.wrongCitySales > 0)
      .forEach(([city, data]) => {
        const percentage = ((data.wrongCitySales / data.total) * 100).toFixed(1);
        console.log(`  - ${city}: ${data.wrongCitySales}/${data.total} sales (${percentage}%)`);
      });
  }
  
  // Test competition period filtering
  console.log('\n' + '='.repeat(60));
  console.log('🗓️  COMPETITION PERIOD TEST');
  console.log('='.repeat(60));
  
  const competitionStart = '2025-06-23';
  const competitionEnd = '2025-07-06';
  
  for (const [cityKey, data] of Object.entries(results)) {
    const sales = await loadCitySales(cityKey);
    const competitionSales = sales.filter(sale => {
      const saleDate = sale.sale_timestamp_utc.split('T')[0];
      return saleDate >= competitionStart && saleDate <= competitionEnd;
    });
    
    console.log(`${cityKey}: ${competitionSales.length}/${sales.length} sales in competition period`);
  }
}

// Run the test
testCityFiltering().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
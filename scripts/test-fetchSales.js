#!/usr/bin/env node

// Test the exact fetchSalesByCity function to debug the issue
import { fetchSalesByCity } from '../lib/fetchSales.js';

async function testFetchSales() {
  console.log('🔍 Testing fetchSalesByCity function...\n');
  
  const testCities = ['New York', 'Nashville', 'Miami'];
  
  for (const city of testCities) {
    console.log(`📊 Testing "${city}":`);
    try {
      const sales = await fetchSalesByCity(city);
      console.log(`  - Found ${sales.length} sales`);
      
      if (sales.length > 0) {
        const sample = sales[0];
        console.log(`  - Sample: ${sample.address} - $${sample.sale_price}`);
      }
    } catch (error) {
      console.log(`  - Error: ${error.message}`);
    }
    console.log('');
  }
}

testFetchSales();
#!/usr/bin/env node

// Debug what the API is actually returning

import fetch from 'node-fetch';
import 'dotenv/config';
import { CITY_REGIONS } from './city-regions.js';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

async function debugAPIResponse() {
  console.log('🔍 Debugging API response for Houston...\n');
  
  const regionId = CITY_REGIONS['Houston, TX'];
  const url = `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=21&limit=10&offset=0`;
  
  console.log('API URL:', url);
  console.log('Expected: Sales from last 21 days only\n');
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });

    const data = await response.json();
    
    // Extract first 10 properties
    const properties = [];
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        if (item.homeData) {
          properties.push(item.homeData);
        }
      });
    }
    
    console.log(`Found ${properties.length} properties in first page\n`);
    
    // Analyze dates
    console.log('Sale dates from API:');
    properties.slice(0, 10).forEach((prop, i) => {
      const saleDate = prop.lastSaleData?.lastSoldDate;
      const date = saleDate ? new Date(saleDate) : null;
      const city = prop.addressInfo?.city || 'Unknown';
      const address = prop.addressInfo?.formattedStreetLine || 'Unknown';
      
      console.log(`${i + 1}. ${date ? date.toISOString().split('T')[0] : 'No date'} - ${city} - ${address}`);
    });
    
    // Check date range
    const dates = properties
      .map(p => p.lastSaleData?.lastSoldDate)
      .filter(Boolean)
      .map(d => new Date(d));
      
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const daySpan = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
      
      console.log(`\nDate range in response:`);
      console.log(`Earliest: ${minDate.toISOString().split('T')[0]}`);
      console.log(`Latest: ${maxDate.toISOString().split('T')[0]}`);
      console.log(`Span: ${daySpan} days`);
    }
    
    // Check cities
    const cities = {};
    properties.forEach(prop => {
      const city = prop.addressInfo?.city || 'Unknown';
      cities[city] = (cities[city] || 0) + 1;
    });
    
    console.log('\nCities in response:');
    Object.entries(cities).forEach(([city, count]) => {
      console.log(`${city}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugAPIResponse().catch(console.error);
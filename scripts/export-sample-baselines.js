#!/usr/bin/env node

// Export baseline calculations for a sample of cities (to test approach)
// Creates CSV files showing all sales data and calculation methodology

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = 'https://redfin-com-data.p.rapidapi.com';

if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY environment variable is required');
  process.exit(1);
}

// Configuration
const DAYS_FOR_BASELINE = 90;
const MIN_SALES_REQUIRED = 5;

// Sample cities to test with
const SAMPLE_CITIES = {
  'Nashville, TN': '6_13415',
  'Phoenix, AZ': '6_14240',
  'Miami, FL': '6_11458'
};

async function getSoldPropertiesForBaseline(regionId, cityName) {
  console.log(`🏠 Fetching ${DAYS_FOR_BASELINE}-day sales data for ${cityName} (region ${regionId})`);
  
  const response = await fetch(
    `${BASE_URL}/properties/search-sold?regionId=${regionId}&soldWithin=${DAYS_FOR_BASELINE}`,
    {
      headers: {
        'x-rapidapi-host': 'redfin-com-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get sold properties for ${cityName}: ${response.status}`);
  }

  const response_data = await response.json();
  
  // Extract properties from nested structure
  const properties = [];
  if (response_data.data && Array.isArray(response_data.data)) {
    response_data.data.forEach(item => {
      if (item.homeData) {
        properties.push(item.homeData);
      }
    });
  }
  
  console.log(`📊 Found ${properties.length || 0} sold properties in ${cityName}`);
  
  return properties;
}

function calculateBaselineWithDetails(properties, cityName) {
  if (!properties || properties.length === 0) {
    console.log(`⚠️  No properties available for ${cityName}`);
    return null;
  }

  // Extract all valid prices with property details
  const salesData = [];
  properties.forEach(property => {
    const price = parseInt(property.priceInfo?.amount || property.priceInfo?.homePrice?.int64Value || 0);
    if (price > 0) {
      salesData.push({
        address: property.addressInfo?.formattedStreetLine || 'Unknown',
        price: price,
        beds: property.beds || 0,
        baths: property.baths || 0,
        sqft: parseInt(property.sqftInfo?.amount || 0),
        lastSoldDate: property.lastSaleData?.lastSoldDate || '',
        url: property.url ? `https://www.redfin.com${property.url}` : ''
      });
    }
  });

  if (salesData.length < MIN_SALES_REQUIRED) {
    console.log(`⚠️  Insufficient sales data for ${cityName}: ${salesData.length} sales (need ${MIN_SALES_REQUIRED})`);
    return null;
  }

  // Sort by price for analysis
  salesData.sort((a, b) => a.price - b.price);
  
  // Apply same outlier filtering as baseline calculation
  const p1 = Math.floor(salesData.length * 0.01);
  const p99 = Math.floor(salesData.length * 0.99);
  const filteredSales = salesData.slice(p1, p99);
  
  // Mark outliers in original data
  salesData.forEach((sale, index) => {
    sale.included_in_baseline = index >= p1 && index < p99 ? 'YES' : 'NO (outlier)';
  });
  
  // Calculate median from filtered data
  const mid = Math.floor(filteredSales.length / 2);
  const median = filteredSales.length % 2 === 0
    ? (filteredSales[mid - 1].price + filteredSales[mid].price) / 2
    : filteredSales[mid].price;

  console.log(`📈 ${cityName} median: $${Math.round(median).toLocaleString()} (from ${filteredSales.length} sales, excluded ${salesData.length - filteredSales.length} outliers)`);
  
  return {
    salesData,
    filteredSales,
    median: Math.round(median),
    sampleSize: filteredSales.length,
    originalSampleSize: salesData.length,
    outliersRemoved: salesData.length - filteredSales.length,
    minPrice: filteredSales[0]?.price || 0,
    maxPrice: filteredSales[filteredSales.length - 1]?.price || 0,
    midIndex: mid
  };
}

function createCsvContent(salesData, cityName, baselineData) {
  const csvHeaders = 'address,price,beds,baths,sqft,lastSoldDate,included_in_baseline,url';
  const csvRows = salesData.map(sale => 
    `"${sale.address}",${sale.price},${sale.beds},${sale.baths},${sale.sqft},"${sale.lastSoldDate}","${sale.included_in_baseline}","${sale.url}"`
  );
  
  // Add summary header
  const summaryLines = [
    `# ${cityName} Baseline Calculation Summary`,
    `# Generated: ${new Date().toISOString()}`,
    `# Baseline Period: ${DAYS_FOR_BASELINE} days`,
    `# Total Sales Found: ${baselineData.originalSampleSize}`,
    `# Sales Used for Baseline: ${baselineData.sampleSize}`,
    `# Outliers Removed: ${baselineData.outliersRemoved}`,
    `# Calculated Baseline: $${baselineData.median.toLocaleString()}`,
    `# Price Range (after outliers): $${baselineData.minPrice.toLocaleString()} - $${baselineData.maxPrice.toLocaleString()}`,
    `# Median Calculation: ${baselineData.filteredSales.length % 2 === 0 ? 
      `Average of middle two values ($${baselineData.filteredSales[baselineData.midIndex-1].price.toLocaleString()} + $${baselineData.filteredSales[baselineData.midIndex].price.toLocaleString()}) ÷ 2` :
      `Middle value: $${baselineData.filteredSales[baselineData.midIndex].price.toLocaleString()}`}`,
    '#',
    csvHeaders
  ];
  
  return [...summaryLines, ...csvRows].join('\n');
}

async function exportSampleBaselines() {
  console.log('🎯 Starting baseline export for sample cities...\n');
  
  // Create output directory
  const outputDir = 'scripts/baseline-exports';
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Load current baselines for comparison
  let currentBaselines = {};
  try {
    const baselineData = JSON.parse(fs.readFileSync('public/baselines.json', 'utf8'));
    currentBaselines = baselineData.baselines;
  } catch (error) {
    console.log('⚠️  Could not load current baselines for comparison');
  }
  
  const results = [];
  const errors = [];
  
  for (const [cityName, regionId] of Object.entries(SAMPLE_CITIES)) {
    try {
      console.log(`\n🔍 Processing ${cityName}...`);
      
      // Get sales data
      const properties = await getSoldPropertiesForBaseline(regionId, cityName);
      
      // Calculate baseline with details
      const baselineData = calculateBaselineWithDetails(properties, cityName);
      
      if (baselineData) {
        const baseCityName = cityName.split(',')[0].trim();
        const sanitizedCityName = baseCityName.replace(/[^A-Za-z]/g, '');
        
        // Create CSV content
        const csvContent = createCsvContent(baselineData.salesData, cityName, baselineData);
        
        // Save CSV file
        const csvPath = path.join(outputDir, `${sanitizedCityName}-baseline.csv`);
        fs.writeFileSync(csvPath, csvContent);
        
        // Compare with current baseline
        const currentBaseline = currentBaselines[baseCityName];
        const difference = currentBaseline ? baselineData.median - currentBaseline : 0;
        const percentDiff = currentBaseline ? ((difference / currentBaseline) * 100).toFixed(1) : 'N/A';
        
        results.push({
          city: baseCityName,
          calculated: baselineData.median,
          current: currentBaseline || 'Not set',
          difference: difference,
          percentDiff: percentDiff,
          sampleSize: baselineData.sampleSize,
          dataQuality: baselineData.sampleSize >= MIN_SALES_REQUIRED * 2 ? 'High' : 'Moderate',
          csvFile: csvPath
        });
        
        console.log(`✅ ${baseCityName}: $${baselineData.median.toLocaleString()} (CSV: ${csvPath})`);
        
      } else {
        errors.push(`Failed to calculate baseline for ${cityName}: insufficient data`);
        console.log(`❌ ${cityName}: Insufficient data for baseline`);
      }

      // Rate limiting - 1 second delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error processing ${cityName}:`, error.message);
      errors.push(`${cityName}: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SAMPLE BASELINE EXPORT SUMMARY');
  console.log('='.repeat(80));
  
  results.forEach(result => {
    const diffDisplay = result.difference !== 0 ? 
      ` (${result.difference >= 0 ? '+' : ''}$${result.difference.toLocaleString()}, ${result.difference >= 0 ? '+' : ''}${result.percentDiff}%)` : 
      '';
    console.log(`✅ ${result.city}: $${result.calculated.toLocaleString()} vs current $${result.current.toLocaleString()}${diffDisplay}`);
  });
  
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} errors occurred:`)
    errors.forEach(error => console.log(`   ${error}`));
  }
  
  console.log(`\n📁 CSV files saved to: ${outputDir}/`);
  console.log(`\n🎯 Sample export complete! ${results.length} cities processed successfully.`);
  console.log(`💡 If this works well, run the full export script for all cities.`);
}

// Run the export
exportSampleBaselines().catch(error => {
  console.error('❌ Sample baseline export failed:', error);
  process.exit(1);
});
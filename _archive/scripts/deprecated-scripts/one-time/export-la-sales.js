#!/usr/bin/env node

// Export all Los Angeles sales within the competition period to CSV for manual verification

import 'dotenv/config';
import fs from 'fs';
import { fetchSalesByCity } from '../cron-worker/lib/fetchSales.js';
import { isSaleInPeriod, toPacificDateISO, extractSaleTimestamp } from '../cron-worker/lib/dateUtils.js';

// Load competition config to get actual dates
const competitionConfig = JSON.parse(fs.readFileSync('./cron-worker/competition-config.json', 'utf8'));
const COMPETITION_START = competitionConfig.pacific_start.split('T')[0]; // "2025-06-23"  
const COMPETITION_END = competitionConfig.pacific_end.split('T')[0]; // "2025-07-06"

function isSaleInCompetitionPeriod(sale) {
  return isSaleInPeriod(sale, COMPETITION_START, COMPETITION_END);
}

function extractPacificDate(sale) {
  return toPacificDateISO(extractSaleTimestamp(sale));
}

function formatSaleForCsv(sale) {
  const pacificDate = extractPacificDate(sale);
  const price = sale.sale_price || sale.price || 0;
  const address = sale.address || '';
  const beds = sale.bedrooms || sale.beds || 0;
  const baths = sale.bathrooms || sale.baths || 0;
  const sqft = sale.square_feet || sale.sqft || 0;
  const url = sale.url || '';
  
  // Escape quotes in address and URL
  const escapedAddress = `"${address.replace(/"/g, '""')}"`;
  const escapedUrl = `"${url.replace(/"/g, '""')}"`;
  
  return `${escapedAddress},${price},${beds},${baths},${sqft},${pacificDate},${escapedUrl}`;
}

async function exportLASales() {
  console.log('🔍 Fetching Los Angeles sales data...');
  
  try {
    // Fetch all LA sales from Supabase
    const allSales = await fetchSalesByCity('LosAngeles');
    console.log(`📊 Found ${allSales.length} total sales for Los Angeles`);
    
    // Filter to competition period only
    const competitionSales = allSales.filter(isSaleInCompetitionPeriod);
    console.log(`🏆 Found ${competitionSales.length} sales within competition period (${COMPETITION_START} to ${COMPETITION_END})`);
    
    if (competitionSales.length === 0) {
      console.log('❌ No sales found in competition period');
      return;
    }
    
    // Sort by price descending to see highest sales first
    competitionSales.sort((a, b) => {
      const priceA = a.sale_price || a.price || 0;
      const priceB = b.sale_price || b.price || 0;
      return priceB - priceA;
    });
    
    // Create CSV content
    const csvHeaders = 'address,price,beds,baths,sqft,sale_date,url';
    const csvRows = competitionSales.map(formatSaleForCsv);
    const csvContent = [
      '# Los Angeles Sales Data - Competition Period',
      `# Generated: ${new Date().toISOString()}`,
      `# Competition Period: ${COMPETITION_START} to ${COMPETITION_END}`,
      `# Total Sales: ${competitionSales.length}`,
      `# Highest Sale: $${Math.max(...competitionSales.map(s => s.sale_price || s.price || 0)).toLocaleString()}`,
      '#',
      csvHeaders,
      ...csvRows
    ].join('\n');
    
    // Save to file
    const outputPath = 'scripts/los-angeles-competition-sales.csv';
    fs.writeFileSync(outputPath, csvContent);
    
    // Show top 10 sales for quick verification
    console.log('\n📈 Top 10 highest sales:');
    competitionSales.slice(0, 10).forEach((sale, index) => {
      const price = sale.sale_price || sale.price || 0;
      const address = sale.address || 'Unknown address';
      const date = extractPacificDate(sale);
      console.log(`  ${index + 1}. $${price.toLocaleString()} - ${address} (${date})`);
    });
    
    console.log(`\n✅ CSV exported to: ${outputPath}`);
    console.log(`📊 Total sales in competition period: ${competitionSales.length}`);
    
    // Show the highest sale specifically
    const highestSale = competitionSales[0];
    const highestPrice = highestSale.sale_price || highestSale.price || 0;
    console.log(`\n🏆 HIGHEST SALE: $${highestPrice.toLocaleString()} - ${highestSale.address}`);
    console.log(`📍 URL: ${highestSale.url}`);
    console.log(`📅 Date: ${extractPacificDate(highestSale)}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the export
exportLASales();
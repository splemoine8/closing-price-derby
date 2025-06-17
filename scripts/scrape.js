import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read ZIP codes configuration
const zipsPath = path.join(__dirname, 'zips.json');
const outputPath = path.join(__dirname, '..', 'public', 'leaderboard.json');

async function scrapeRedfin() {
  console.log('Starting Redfin scrape...');
  
  try {
    // Read ZIP codes
    const zipsData = await fs.readFile(zipsPath, 'utf-8');
    const zips = JSON.parse(zipsData);
    
    const results = [];
    
    for (const zipInfo of zips) {
      const { zip, city, state, teamName } = zipInfo;
      
      try {
        console.log(`Scraping ${zip} (${city}, ${state})...`);
        
        // Construct Redfin CSV URL with proper parameters
        const url = `https://www.redfin.com/stingray/api/gis-csv?al=1&status=8&sold_within_days=14&ord=price-desc&num_homes=1&uipt=1&postal_code=${zip}`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/csv,application/csv,*/*',
            'Referer': 'https://www.redfin.com/'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        
        let price = 0;
        
        // Parse CSV - first line is headers, second line is data (if exists)
        if (lines.length > 1) {
          const dataLine = lines[1];
          const columns = dataLine.split(',');
          
          // Price is typically the first column, but let's be safe
          const priceStr = columns[0]?.replace(/[^0-9]/g, '');
          if (priceStr) {
            price = parseInt(priceStr, 10);
          }
        }
        
        results.push({
          zip,
          city,
          state,
          teamName,
          price,
          ts: Date.now()
        });
        
        console.log(`✓ ${zip}: $${price.toLocaleString()}`);
        
      } catch (error) {
        console.error(`✗ Failed to scrape ${zip}:`, error.message);
        
        // Add entry with price 0 on failure
        results.push({
          zip,
          city,
          state,
          teamName,
          price: 0,
          ts: Date.now()
        });
      }
      
      // Rate limiting - wait 300ms between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Write results to public/leaderboard.json
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`✓ Scrape complete! Wrote ${results.length} entries to ${outputPath}`);
    
    // Log summary
    const validPrices = results.filter(r => r.price > 0);
    const totalValue = validPrices.reduce((sum, r) => sum + r.price, 0);
    console.log(`Summary: ${validPrices.length}/${results.length} successful, total value: $${totalValue.toLocaleString()}`);
    
  } catch (error) {
    console.error('Scrape failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeRedfin();
}
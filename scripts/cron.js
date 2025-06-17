import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runScrape() {
  try {
    console.log('Starting scheduled scrape...');
    const { stdout, stderr } = await execAsync('node ./scripts/scrape.js');
    
    if (stdout) console.log(stdout);
    if (stderr) console.error('Scrape stderr:', stderr);
    
    console.log('Scrape run finished');
  } catch (error) {
    console.error('Scrape run failed:', error);
  }
}

// Schedule to run every 4 hours
console.log('Setting up cron job to run every 4 hours...');
cron.schedule('0 */4 * * *', runScrape);

// Run once immediately on startup
console.log('Running initial scrape...');
runScrape();

// Keep the process alive
console.log('Cron scheduler is running. Press Ctrl+C to stop.');
import { promises as fs } from 'fs';
import { isSaleInPeriod, extractSaleTimestamp, toPacificDateISO }
        from '../lib/dateUtils.js';

const START = '2025-06-23';
const END   = '2025-07-06';

// Load a few city partitions (pick any with recent volume)
const cities = ['Dallas','Miami','NewYork'];   // adjusted for actual file names

for (const city of cities) {
  const raw = await fs.readFile(`./data/sales-by-city/${city}.json`, 'utf8')
         .catch(() => '[]');
  const sales = JSON.parse(raw);

  const hits = sales.filter(s => isSaleInPeriod(s, START, END));

  console.log(`\n${city}: ${hits.length} sale(s) inside window`);
  hits.slice(0,5).forEach(({ address, lastSoldDate, sale_timestamp_utc }) => {
    const ts = extractSaleTimestamp({ lastSoldDate, sale_timestamp_utc });
    console.log('  •', address.padEnd(40), toPacificDateISO(ts));
  });
}
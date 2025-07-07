import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function testCompetitionExtension() {
  console.log('Testing Competition Date Extension...\n');

  // Test 1: Fetch competition config
  console.log('1. Checking competition configuration:');
  const { data: config, error: configError } = await supabase
    .from('competition_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (configError) {
    console.error('Error fetching config:', configError);
    return;
  }

  console.log('   Competition Name:', config.name);
  console.log('   Pacific Start:', config.pacific_start);
  console.log('   Pacific End:', config.pacific_end);
  console.log('   UTC Start:', config.utc_start);
  console.log('   UTC End:', config.utc_end);
  console.log('   Status:', config.status);

  // Test 2: Verify end date is July 13
  const endDate = new Date(config.pacific_end);
  const expectedEnd = new Date('2025-07-13T23:59:59');
  console.log('\n2. Verifying end date extension:');
  console.log('   Expected:', expectedEnd.toISOString());
  console.log('   Actual:', endDate.toISOString());
  console.log('   Extended correctly:', endDate.getTime() === expectedEnd.getTime() ? '✅ YES' : '❌ NO');

  // Test 3: Check for sales in extended period (July 7-13)
  console.log('\n3. Checking for sales in extended period (July 7-13):');
  const { data: extendedSales, error: salesError } = await supabase
    .from('city_sales_detail')
    .select('city_name, price, date')
    .gte('date', '2025-07-07')
    .lte('date', '2025-07-13')
    .order('price', { ascending: false })
    .limit(5);

  if (salesError) {
    console.error('Error fetching sales:', salesError);
  } else {
    console.log('   Found', extendedSales.length, 'sales in extended period');
    if (extendedSales.length > 0) {
      console.log('   Top sales in extended period:');
      extendedSales.forEach(sale => {
        console.log(`     ${sale.city_name}: $${sale.price.toLocaleString()} on ${sale.date}`);
      });
    }
  }

  // Test 4: Verify views are working
  console.log('\n4. Testing leaderboard view:');
  const { data: leaders, error: leaderError } = await supabase
    .from('leaderboard')
    .select('city, price, last_sold_date')
    .gt('price', 0)
    .order('price', { ascending: false })
    .limit(3);

  if (leaderError) {
    console.error('Error fetching leaderboard:', leaderError);
  } else {
    console.log('   Top 3 cities:');
    leaders.forEach(city => {
      console.log(`     ${city.city}: $${city.price.toLocaleString()} (${city.last_sold_date})`);
    });
  }

  // Test 5: Calculate competition status
  console.log('\n5. Competition status:');
  const now = new Date();
  const start = new Date(config.utc_start);
  const end = new Date(config.utc_end);
  
  let status;
  if (now < start) status = 'SETUP';
  else if (now <= end) status = 'LIVE';
  else status = 'COMPLETE';
  
  console.log('   Current time:', now.toISOString());
  console.log('   Competition status:', status);
  
  if (status === 'LIVE') {
    const remaining = end - now;
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    console.log(`   Time remaining: ${days} days, ${hours} hours`);
  }

  console.log('\n✅ Testing complete!');
}

testCompetitionExtension().catch(console.error);
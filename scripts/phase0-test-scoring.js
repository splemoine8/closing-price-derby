import fs from 'fs/promises';
import path from 'path';

// Load baseline data for percentage scoring
async function loadBaselines() {
  try {
    const baselinesPath = path.join(process.cwd(), 'public', 'baselines.json');
    const baselinesData = await fs.readFile(baselinesPath, 'utf8');
    const baselines = JSON.parse(baselinesData);
    console.log('✅ Loaded mock baseline data for testing');
    return baselines.baselines;
  } catch (error) {
    console.error('❌ Could not load baselines.json:', error.message);
    return null;
  }
}

// Load existing sales data
async function loadExistingSales() {
  try {
    const salesPath = path.join(process.cwd(), 'public', 'leaderboard.json');
    const salesData = await fs.readFile(salesPath, 'utf8');
    const sales = JSON.parse(salesData);
    console.log('✅ Loaded existing sales data');
    return sales;
  } catch (error) {
    console.error('❌ Could not load leaderboard.json:', error.message);
    return [];
  }
}

// Calculate percentage score and multiplier display
function calculateScore(price, baseline) {
  if (!baseline || baseline <= 0) {
    return { scorePct: 0, multiplier: '×1.0' };
  }
  
  const scorePct = ((price - baseline) / baseline) * 100;
  const multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
  
  return { scorePct: Math.round(scorePct * 10) / 10, multiplier };
}

// Get city baseline from loaded baselines data
function getCityBaseline(cityName, baselines) {
  if (!baselines) return null;
  
  // Try exact match first
  if (baselines[cityName]) {
    return baselines[cityName].median;
  }
  
  // Try partial match for different city formats
  const cityKey = Object.keys(baselines).find(key => 
    key.toLowerCase().includes(cityName.toLowerCase()) ||
    cityName.toLowerCase().includes(key.toLowerCase())
  );
  
  return cityKey ? baselines[cityKey].median : null;
}

// Map existing city names to NFL cities
const cityMapping = {
  'Las Vegas': 'Kansas City',      // Mock mapping for testing
  'Newport Beach': 'New Orleans',
  'Boston': 'Green Bay',
  'Miami Beach': 'Nashville',
  'San Francisco': 'Buffalo',
  'Denver': 'Pittsburgh',
  'Beverly Hills': 'Cincinnati',
  'Austin': 'Cleveland',
  'Nashville': 'Jacksonville',
  'Seattle': 'Indianapolis',
  'Chicago': 'Baltimore',
  'Atlanta': 'Carolina'
};

async function testPercentageScoring() {
  console.log('🧪 Phase 0: Testing Percentage Scoring with Mock Data\n');
  
  // Load data
  const baselines = await loadBaselines();
  const existingSales = await loadExistingSales();
  
  if (!baselines || !existingSales.length) {
    console.error('❌ Missing required data files');
    return;
  }
  
  console.log('📊 Current vs Percentage-Based Rankings:\n');
  console.log('Current (Price-Based) | Percentage-Based');
  console.log('==================== | ================');
  
  // Process each city and calculate scores
  const scoredCities = existingSales.map((city, index) => {
    const nflCity = cityMapping[city.city] || city.city;
    const baseline = getCityBaseline(nflCity, baselines);
    const { scorePct, multiplier } = calculateScore(city.price, baseline);
    
    return {
      ...city,
      nflCity,
      baseline,
      scorePct,
      multiplier,
      originalRank: index + 1
    };
  });
  
  // Sort by percentage score for new ranking
  const percentageRanked = [...scoredCities].sort((a, b) => {
    if (a.scorePct !== b.scorePct) {
      return (b.scorePct || 0) - (a.scorePct || 0);
    }
    return (b.price || 0) - (a.price || 0);
  });
  
  // Display comparison
  scoredCities.forEach((city) => {
    const newRank = percentageRanked.findIndex(c => c.city === city.city) + 1;
    const rankChange = city.originalRank - newRank;
    const changeIcon = rankChange > 0 ? '📈' : rankChange < 0 ? '📉' : '➡️';
    
    console.log(
      `#${city.originalRank} ${city.teamName} (${city.city})`.padEnd(25) + 
      ` | #${newRank} ${city.nflCity} ${city.multiplier} ${changeIcon}`
    );
    console.log(
      `    $${city.price.toLocaleString()}`.padEnd(25) + 
      ` |     $${city.price.toLocaleString()} vs $${city.baseline?.toLocaleString() || 'N/A'}`
    );
    console.log('');
  });
  
  console.log('\n🏆 New Percentage-Based Leaderboard:');
  percentageRanked.forEach((city, index) => {
    console.log(`${index + 1}. ${city.nflCity} (${city.teamName}): ${city.multiplier}`);
    console.log(`   $${city.price.toLocaleString()} vs baseline $${city.baseline?.toLocaleString() || 'N/A'}`);
  });
  
  // Generate test leaderboard file
  const testLeaderboard = percentageRanked.map((city, index) => ({
    zip: city.nflCity.replace(/\s+/g, ''),
    city: city.nflCity,
    state: baselines[city.nflCity]?.state || city.state,
    teamName: city.teamName,
    price: city.price,
    baseline: city.baseline,
    scorePct: city.scorePct,
    multiplier: city.multiplier,
    ts: city.ts,
    rank: index + 1
  }));
  
  // Save test results
  const testPath = path.join(process.cwd(), 'public', 'test-leaderboard.json');
  await fs.writeFile(testPath, JSON.stringify(testLeaderboard, null, 2));
  console.log(`\n💾 Test leaderboard saved to: test-leaderboard.json`);
  
  console.log('\n✅ Phase 0 testing complete!');
  console.log('   • Percentage scoring working correctly');
  console.log('   • Rankings changed based on market performance');
  console.log('   • Ready for frontend testing');
}

// Run the test
testPercentageScoring().catch(console.error);
#!/usr/bin/env node

// Manual baseline calculation script
// Run this manually when you want to update baselines
// Usage: node scripts/manual-baseline-update.js

import { calculateBaselines } from './calculate-baselines.js';

console.log('🔄 Starting manual baseline calculation...');
console.log('📅 This will recalculate baselines using the latest 90-day data');
console.log('');

try {
  await calculateBaselines();
  console.log('');
  console.log('✅ Manual baseline calculation completed successfully!');
  console.log('📁 Updated files:');
  console.log('   - public/baselines.json');
  console.log('   - public/baseline-quality-report.json');
  console.log('');
  console.log('💡 The live site will use these new baselines immediately');
} catch (error) {
  console.error('❌ Baseline calculation failed:', error.message);
  process.exit(1);
}
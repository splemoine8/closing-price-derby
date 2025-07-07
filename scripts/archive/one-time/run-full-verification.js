#!/usr/bin/env node

// Master test script that runs all verification scripts in sequence
// This provides a single command to verify data integrity across the entire pipeline

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test scripts to run
// Check for environment variable to determine verification mode
const QUICK_VERIFY = process.env.QUICK_VERIFY === '1' || process.argv.includes('--quick');

const testScripts = [
  {
    name: 'City Filtering Tests',
    script: 'test-city-filtering.js',
    critical: true
  },
  {
    name: 'Export All Sales Data',
    script: 'export-all-sales.js',
    critical: false,
    args: QUICK_VERIFY ? ['--mode', 'quick'] : []
  },
  {
    name: 'Verify Highest Sales',
    script: 'verify-highest-sales-fixed.js',
    critical: true
  }
];

// Run a single test script
function runScript(scriptName, scriptArgs = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, scriptName);
    console.log(`\n🚀 Running ${scriptName}...`);
    if (scriptArgs.length > 0) {
      console.log(`   Args: ${scriptArgs.join(' ')}`);
    }
    console.log('─'.repeat(60));
    
    const child = spawn('node', [scriptPath, ...scriptArgs], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error(`❌ Failed to start ${scriptName}:`, error);
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} completed successfully`);
        resolve({ script: scriptName, success: true, code });
      } else {
        console.error(`\n❌ ${scriptName} failed with exit code ${code}`);
        resolve({ script: scriptName, success: false, code });
      }
    });
  });
}

// Generate final report
function generateReport(results, startTime) {
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(80));
  console.log('FULL VERIFICATION REPORT');
  console.log('='.repeat(80));
  console.log(`Started: ${startTime.toISOString()}`);
  console.log(`Completed: ${endTime.toISOString()}`);
  console.log(`Duration: ${duration} seconds`);
  console.log('');
  
  // Summary
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = results.filter(r => !r.success).length;
  const criticalFailures = results.filter(r => !r.success && testScripts.find(t => t.script === r.script)?.critical).length;
  
  console.log('TEST RESULTS:');
  results.forEach(result => {
    const test = testScripts.find(t => t.script === result.script);
    const critical = test?.critical ? ' [CRITICAL]' : '';
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`  ${test.name}: ${status}${critical}`);
  });
  
  console.log('\nSUMMARY:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${successfulTests}`);
  console.log(`  Failed: ${failedTests}`);
  if (criticalFailures > 0) {
    console.log(`  Critical Failures: ${criticalFailures} ⚠️`);
  }
  
  // Create verification directory
  const verificationDir = join(__dirname, 'verification');
  mkdirSync(verificationDir, { recursive: true });
  
  const reportData = {
    timestamp: endTime.toISOString(),
    duration: duration,
    results: results.map(r => ({
      ...r,
      testName: testScripts.find(t => t.script === r.script)?.name
    })),
    summary: {
      totalTests,
      successfulTests,
      failedTests,
      criticalFailures,
      overallStatus: criticalFailures === 0 ? 'PASSED' : 'FAILED'
    }
  };
  
  // Write JSON report
  const jsonReportFile = join(verificationDir, 'report.json');
  writeFileSync(jsonReportFile, JSON.stringify(reportData, null, 2));
  console.log(`\n💾 JSON report saved to ${jsonReportFile}`);
  
  // Generate Markdown report
  let markdownContent = `# Verification Report\n\n`;
  markdownContent += `**Date:** ${endTime.toISOString()}\n`;
  markdownContent += `**Duration:** ${duration} seconds\n`;
  markdownContent += `**Overall Status:** ${reportData.summary.overallStatus} ${reportData.summary.overallStatus === 'PASSED' ? '✅' : '❌'}\n\n`;
  
  markdownContent += `## Summary\n\n`;
  markdownContent += `| Metric | Value |\n`;
  markdownContent += `|--------|-------|\n`;
  markdownContent += `| Total Tests | ${totalTests} |\n`;
  markdownContent += `| Passed | ${successfulTests} |\n`;
  markdownContent += `| Failed | ${failedTests} |\n`;
  markdownContent += `| Critical Failures | ${criticalFailures} |\n\n`;
  
  markdownContent += `## Test Results\n\n`;
  markdownContent += `| Test Name | Status | Critical |\n`;
  markdownContent += `|-----------|--------|----------|\n`;
  
  results.forEach(result => {
    const test = testScripts.find(t => t.script === result.script);
    const status = result.success ? 'PASSED ✅' : 'FAILED ❌';
    const critical = test?.critical ? 'Yes' : 'No';
    markdownContent += `| ${test.name} | ${status} | ${critical} |\n`;
  });
  
  markdownContent += `\n## Next Steps\n\n`;
  if (criticalFailures > 0) {
    markdownContent += `1. Review the failed test outputs\n`;
    markdownContent += `2. Check individual test logs for specific issues\n`;
    markdownContent += `3. Fix any data integrity issues identified\n`;
    markdownContent += `4. Re-run this verification after fixes\n`;
  } else if (failedTests > 0) {
    markdownContent += `1. Review non-critical failures for potential issues\n`;
    markdownContent += `2. Check exported CSV files in exports directory\n`;
    markdownContent += `3. Verify leaderboard displays match database\n`;
  } else {
    markdownContent += `1. Check exported CSV files for manual verification\n`;
    markdownContent += `2. Spot-check a few cities on the live leaderboard\n`;
    markdownContent += `3. Monitor for any user-reported discrepancies\n`;
  }
  
  // Write Markdown report
  const mdReportFile = join(verificationDir, 'report.md');
  writeFileSync(mdReportFile, markdownContent);
  console.log(`📝 Markdown report saved to ${mdReportFile}`);
  
  // Overall status
  if (criticalFailures === 0) {
    console.log('\n✅ OVERALL STATUS: PASSED');
    console.log('All critical tests passed. Data integrity verified!');
  } else {
    console.log('\n❌ OVERALL STATUS: FAILED');
    console.log(`${criticalFailures} critical test(s) failed. Investigation required!`);
  }
  
  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('NEXT STEPS');
  console.log('='.repeat(80));
  
  if (criticalFailures > 0) {
    console.log('\n1. Review the failed test outputs above');
    console.log('2. Check the individual test logs for specific issues');
    console.log('3. Fix any data integrity issues identified');
    console.log('4. Re-run this verification after fixes');
  } else if (failedTests > 0) {
    console.log('\n1. Review non-critical failures for potential issues');
    console.log('2. Check exported CSV files in exports directory');
    console.log('3. Verify leaderboard displays match database');
  } else {
    console.log('\n1. Check exported CSV files for manual verification');
    console.log('2. Spot-check a few cities on the live leaderboard');
    console.log('3. Monitor for any user-reported discrepancies');
  }
  
  return criticalFailures === 0;
}

// Main execution
async function main() {
  console.log('🏁 Starting Full Verification Suite');
  console.log('═'.repeat(80));
  console.log('This will run all verification scripts to ensure data integrity\n');
  
  const startTime = new Date();
  const results = [];
  
  // Run each test script
  for (const test of testScripts) {
    try {
      const result = await runScript(test.script, test.args || []);
      results.push(result);
      
      // Stop on critical failure if needed
      if (!result.success && test.critical) {
        console.log('\n⚠️  Critical test failed. Stopping further tests.');
        break;
      }
    } catch (error) {
      console.error(`\n❌ Unexpected error running ${test.script}:`, error);
      results.push({ script: test.script, success: false, error: error.message });
      
      if (test.critical) {
        console.log('\n⚠️  Critical test failed. Stopping further tests.');
        break;
      }
    }
  }
  
  // Generate report
  const overallSuccess = generateReport(results, startTime);
  
  // Exit with appropriate code after writing all files
  // This ensures CI can always capture the artifacts
  process.exit(overallSuccess ? 0 : 1);
}

// Run the verification
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
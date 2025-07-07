#!/usr/bin/env node

// Test the city filtering logic to ensure cross-city contamination is prevented
// This script tests known edge cases and problematic city combinations

import { CITY_REGIONS } from './city-regions.js';

// City filtering function (copied from scraper)
function propertyMatchesCity(property, targetCity) {
  const target = targetCity.split(',')[0].trim().toLowerCase();
  const apiCity = (property.addressInfo?.city || '').trim().toLowerCase();
  if (apiCity) return apiCity === target;
  const formatted = (property.addressInfo?.formattedStreetLine || '').trim().toLowerCase();
  return new RegExp(`,\\s*${target}\\b`).test(formatted);
}

// Test cases
const testCases = [
  // Dallas tests - should exclude Highland Park, University Park, etc.
  {
    targetCity: 'Dallas, TX',
    testProperties: [
      { addressInfo: { city: 'Dallas' }, expected: true, description: 'Dallas property' },
      { addressInfo: { city: 'DALLAS' }, expected: true, description: 'Dallas (uppercase)' },
      { addressInfo: { city: 'Highland Park' }, expected: false, description: 'Highland Park (separate city)' },
      { addressInfo: { city: 'University Park' }, expected: false, description: 'University Park (separate city)' },
      { addressInfo: { city: 'Irving' }, expected: false, description: 'Irving (suburb)' },
      { addressInfo: { city: 'Farmers Branch' }, expected: false, description: 'Farmers Branch (suburb)' },
      { addressInfo: { formattedStreetLine: '123 Main St, Dallas, TX' }, expected: true, description: 'Dallas via street line' },
      { addressInfo: { formattedStreetLine: '456 Oak Ave, Highland Park, TX' }, expected: false, description: 'Highland Park via street line' }
    ]
  },
  
  // Los Angeles tests - should exclude Beverly Hills, Santa Monica, etc.
  {
    targetCity: 'Los Angeles, CA',
    testProperties: [
      { addressInfo: { city: 'Los Angeles' }, expected: true, description: 'Los Angeles property' },
      { addressInfo: { city: 'Beverly Hills' }, expected: false, description: 'Beverly Hills (separate city)' },
      { addressInfo: { city: 'Santa Monica' }, expected: false, description: 'Santa Monica (separate city)' },
      { addressInfo: { city: 'West Hollywood' }, expected: false, description: 'West Hollywood (separate city)' },
      { addressInfo: { city: 'Culver City' }, expected: false, description: 'Culver City (separate city)' },
      { addressInfo: { formattedStreetLine: '789 Sunset Blvd, Los Angeles, CA' }, expected: true, description: 'LA via street line' },
      { addressInfo: { formattedStreetLine: '321 Rodeo Dr, Beverly Hills, CA' }, expected: false, description: 'Beverly Hills via street line' }
    ]
  },
  
  // Phoenix tests - should exclude Scottsdale, Tempe, etc.
  {
    targetCity: 'Phoenix, AZ',
    testProperties: [
      { addressInfo: { city: 'Phoenix' }, expected: true, description: 'Phoenix property' },
      { addressInfo: { city: 'Scottsdale' }, expected: false, description: 'Scottsdale (separate city)' },
      { addressInfo: { city: 'Tempe' }, expected: false, description: 'Tempe (separate city)' },
      { addressInfo: { city: 'Mesa' }, expected: false, description: 'Mesa (separate city)' },
      { addressInfo: { city: 'Glendale' }, expected: false, description: 'Glendale (separate city)' },
      { addressInfo: { city: 'Chandler' }, expected: false, description: 'Chandler (separate city)' }
    ]
  },
  
  // Miami tests - should exclude Miami Beach, Coral Gables, etc.
  {
    targetCity: 'Miami, FL',
    testProperties: [
      { addressInfo: { city: 'Miami' }, expected: true, description: 'Miami property' },
      { addressInfo: { city: 'Miami Beach' }, expected: false, description: 'Miami Beach (separate city)' },
      { addressInfo: { city: 'Coral Gables' }, expected: false, description: 'Coral Gables (separate city)' },
      { addressInfo: { city: 'Coconut Grove' }, expected: false, description: 'Coconut Grove (neighborhood)' },
      { addressInfo: { city: 'Key Biscayne' }, expected: false, description: 'Key Biscayne (separate city)' }
    ]
  },
  
  // Edge cases - spacing, case sensitivity, etc.
  {
    targetCity: 'Houston, TX',
    testProperties: [
      { addressInfo: { city: 'Houston' }, expected: true, description: 'Normal Houston' },
      { addressInfo: { city: 'HOUSTON' }, expected: true, description: 'Uppercase HOUSTON' },
      { addressInfo: { city: 'houston' }, expected: true, description: 'Lowercase houston' },
      { addressInfo: { city: 'Houston ' }, expected: true, description: 'Houston with trailing space' },
      { addressInfo: { city: ' Houston' }, expected: true, description: 'Houston with leading space' },
      { addressInfo: { city: 'Cypress' }, expected: false, description: 'Cypress (suburb)' },
      { addressInfo: { city: 'Katy' }, expected: false, description: 'Katy (suburb)' }
    ]
  },
  
  // NYC borough tests
  {
    targetCity: 'Brooklyn, NY',
    testProperties: [
      { addressInfo: { city: 'Brooklyn' }, expected: true, description: 'Brooklyn property' },
      { addressInfo: { city: 'BROOKLYN' }, expected: true, description: 'Brooklyn (uppercase)' },
      { addressInfo: { city: 'New York City' }, expected: false, description: 'NYC generic' },
      { addressInfo: { city: 'Manhattan' }, expected: false, description: 'Different borough' },
      { addressInfo: { formattedStreetLine: '123 Flatbush Ave, Brooklyn, NY' }, expected: true, description: 'Brooklyn via street line' }
    ]
  }
];

// Run tests
function runTests() {
  console.log('🧪 Running City Filtering Tests...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];
  
  testCases.forEach(testCase => {
    console.log(`\n📍 Testing ${testCase.targetCity}`);
    console.log('─'.repeat(50));
    
    testCase.testProperties.forEach(test => {
      totalTests++;
      const result = propertyMatchesCity(test, testCase.targetCity);
      const passed = result === test.expected;
      
      if (passed) {
        passedTests++;
        console.log(`✅ ${test.description}`);
      } else {
        failedTests.push({ testCase: testCase.targetCity, test, result });
        console.log(`❌ ${test.description}`);
        console.log(`   Expected: ${test.expected}, Got: ${result}`);
      }
    });
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests.length}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  // Show failures
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failedTests.forEach(failure => {
      console.log(`\n${failure.testCase}: ${failure.test.description}`);
      console.log(`Property: ${JSON.stringify(failure.test.addressInfo)}`);
      console.log(`Expected: ${failure.test.expected}, Got: ${failure.result}`);
    });
  }
  
  // Additional manual verification suggestions
  console.log('\n' + '='.repeat(60));
  console.log('MANUAL VERIFICATION SUGGESTIONS');
  console.log('='.repeat(60));
  console.log('\n1. Run export-all-sales.js and check CSV files for:');
  console.log('   - Any Highland Park addresses in Dallas file');
  console.log('   - Any Beverly Hills addresses in Los Angeles file');
  console.log('   - Any Scottsdale addresses in Phoenix file');
  console.log('\n2. Check the database directly:');
  console.log('   SELECT * FROM sales WHERE city_name = \'Dallas\' AND address LIKE \'%Highland Park%\';');
  console.log('   SELECT * FROM sales WHERE city_name = \'Los Angeles\' AND address LIKE \'%Beverly Hills%\';');
  console.log('\n3. Verify leaderboard shows correct highest sales without contamination');
  
  // Exit code
  process.exit(failedTests.length > 0 ? 1 : 0);
}

// Run the tests
runTests();
#!/usr/bin/env node

// Debug competition dates issue

const COMPETITION_START = new Date('2025-06-23T07:00:00Z');
const COMPETITION_END = new Date('2025-07-07T06:59:59Z');
const NOW = new Date();

console.log('🗓️ Date Analysis:\n');
console.log('Competition Start:', COMPETITION_START.toISOString());
console.log('Competition End:', COMPETITION_END.toISOString());
console.log('Current Date:', NOW.toISOString());

const msPerDay = 1000 * 60 * 60 * 24;
const competitionDays = Math.ceil((COMPETITION_END - COMPETITION_START) / msPerDay);
const daysFromStart = Math.floor((NOW - COMPETITION_START) / msPerDay);

console.log('\nCompetition Duration:', competitionDays, 'days');
console.log('Days Since Start:', daysFromStart, 'days');

console.log('\n⚠️ PROBLEM IDENTIFIED:');
console.log('We are in July 2025, but the current date is', NOW.toISOString().split('T')[0]);
console.log('The competition HASN\'T HAPPENED YET!');
console.log('We need to use 2024 dates, not 2025!');
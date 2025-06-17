// Static mapping of city names to Redfin region IDs
// These IDs are stable and rarely change, so we cache them to avoid unnecessary API calls

export const CITY_REGIONS = {
  'Beverly Hills, CA': '6_1669',
  'Newport Beach, CA': '6_13193',  // Corrected - was 6_13096 which mapped to South Carolina
  'Miami Beach, FL': '6_11467',
  'San Francisco, CA': '6_17151',
  'Boston, MA': '6_1826',
  'Chicago, IL': '6_29470',
  'Seattle, WA': '6_16163',
  'Austin, TX': '6_30818',
  'Denver, CO': '6_5155',
  'Nashville, TN': '6_13415',
  'Atlanta, GA': '6_30756',
  'Las Vegas, NV': '6_10201'
};

// Friend assignments for the fantasy league
export const FRIEND_ASSIGNMENTS = {
  'Beverly Hills, CA': 'Alice',
  'Newport Beach, CA': 'Bob', 
  'Miami Beach, FL': 'Charlie',
  'San Francisco, CA': 'David',
  'Boston, MA': 'Emma',
  'Chicago, IL': 'Frank',
  'Seattle, WA': 'Grace',
  'Austin, TX': 'Henry',
  'Denver, CO': 'Ivy',
  'Nashville, TN': 'Jack',
  'Atlanta, GA': 'Kate',
  'Las Vegas, NV': 'Leo'
};
// Static mapping of NFL city names to Redfin region IDs
// These IDs are stable and rarely change, so we cache them to avoid unnecessary API calls
// All IDs have been validated and are ready for production use

export const CITY_REGIONS = {
  'Kansas City, MO': '6_35751',    // Chiefs
  'New Orleans, LA': '6_14233',   // Saints
  'Green Bay, WI': '6_7928',      // Packers
  'Nashville, TN': '6_13415',     // Titans
  'Buffalo, NY': '6_2832',        // Bills
  'Pittsburgh, PA': '6_15702',    // Steelers
  'Cincinnati, OH': '6_3879',     // Bengals
  'Cleveland, OH': '6_4145',      // Browns
  'Jacksonville, FL': '6_8907',   // Jaguars
  'Indianapolis, IN': '6_9170',   // Colts
  'Baltimore, MD': '6_1073',      // Ravens
  'Charlotte, NC': '6_3105'       // Panthers (using Charlotte for Carolina)
,
  // --- NYC Boroughs & Sub-Regions ---
  'Manhattan, NY': '6_35948',
  'Brooklyn, NY': '1_219258',
  'Queens, NY': '1_43309',
  'Staten Island, NY': '1_34009',
  
  // Bronx Sub-Regions
  'East Bronx, NY': '1_207888',
  'West Bronx, NY': '1_208294',
  'South Bronx, NY': '1_207580',

  // Keep the main 'New York, NY' entry for any other logic that might use it
  'New York, NY': '6_30749',
  'Los Angeles, CA': '6_11203',
  'Las Vegas, NV': '6_10201',
  'Dallas, TX': '6_30794',
  'Miami, FL': '6_11458',
  'Phoenix, AZ': '6_14240',
  'San Francisco, CA': '6_17151',
  'Houston, TX': '6_8903',
  'Denver, CO': '6_5155',
  'Tampa, FL': '6_18142'       // Using Tampa for Tampa Bay
};

// Update the list of cities to be processed for the "New York" team
export const CITY_FILTER_CONFIG = {
  'New York': {
    type: 'include_boroughs',
    allowedCities: [
      'Manhattan, NY', 
      'Brooklyn, NY', 
      'Queens, NY', 
      'Staten Island, NY',
      'East Bronx, NY',
      'West Bronx, NY',
      'South Bronx, NY'
    ]
  }
};

// Friend assignments for the NFL fantasy league
export const FRIEND_ASSIGNMENTS = {
  'Kansas City, MO': 'Patrick',     // Chiefs QB
  'New Orleans, LA': 'Drew',        // Saints legend
  'Green Bay, WI': 'Aaron',         // Packers QB
  'Nashville, TN': 'Derrick',       // Titans RB
  'Buffalo, NY': 'Josh',            // Bills QB
  'Pittsburgh, PA': 'TJ',           // Steelers LB
  'Cincinnati, OH': 'Joe',          // Bengals QB
  'Cleveland, OH': 'Myles',         // Browns DE
  'Jacksonville, FL': 'Trevor',     // Jaguars QB
  'Indianapolis, IN': 'Anthony',    // Colts RB
  'Baltimore, MD': 'Lamar',         // Ravens QB
  'Charlotte, NC': 'Bryce'          // Panthers QB
};
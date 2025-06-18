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
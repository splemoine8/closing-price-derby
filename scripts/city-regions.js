// Static mapping of NFL city names to Redfin region IDs
// These IDs are stable and rarely change, so we cache them to avoid unnecessary API calls
// Note: Placeholder IDs for Phase 0 testing - will get real IDs in Phase 1

export const CITY_REGIONS = {
  'Kansas City, MO': '6_12345',    // Placeholder - Chiefs
  'New Orleans, LA': '6_23456',   // Placeholder - Saints
  'Green Bay, WI': '6_34567',     // Placeholder - Packers
  'Nashville, TN': '6_13415',     // Real ID - Titans (keeping from previous)
  'Buffalo, NY': '6_56789',       // Placeholder - Bills
  'Pittsburgh, PA': '6_67890',    // Placeholder - Steelers
  'Cincinnati, OH': '6_78901',    // Placeholder - Bengals
  'Cleveland, OH': '6_89012',     // Placeholder - Browns
  'Jacksonville, FL': '6_90123',  // Placeholder - Jaguars
  'Indianapolis, IN': '6_01234',  // Placeholder - Colts
  'Baltimore, MD': '6_12346',     // Placeholder - Ravens
  'Charlotte, NC': '6_23457'      // Placeholder - Panthers (using Charlotte for Carolina)
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
// Manhattan filtering utilities for NYC real estate data

/**
 * Determines if a property listing is in Manhattan based on Redfin URL patterns
 * @param {Object} listing - Property listing object with url field
 * @returns {boolean} - True if the listing is in Manhattan
 */
export function isManhattanListing(listing) {
  if (!listing || !listing.url) {
    return false;
  }
  
  // Manhattan URL patterns from Redfin
  const manhattanPatterns = [
    '/NY/New-York/',
    '/NY/Manhattan/'
  ];
  
  return manhattanPatterns.some(pattern => listing.url.includes(pattern));
}

/**
 * Filters an array of listings to only include Manhattan properties
 * @param {Array} listings - Array of property listing objects
 * @returns {Array} - Array containing only Manhattan listings
 */
export function filterManhattanListings(listings) {
  if (!Array.isArray(listings)) {
    return [];
  }
  
  return listings.filter(listing => isManhattanListing(listing));
}

/**
 * Get statistics about borough distribution in listings
 * @param {Array} listings - Array of property listing objects
 * @returns {Object} - Object with borough counts and Manhattan percentage
 */
export function getBoroughStats(listings) {
  const stats = {
    total: listings.length,
    manhattan: 0,
    brooklyn: 0,
    queens: 0,
    bronx: 0,
    statenIsland: 0,
    other: 0
  };
  
  listings.forEach(listing => {
    if (!listing.url) {
      stats.other++;
      return;
    }
    
    if (listing.url.includes('/NY/New-York/') || listing.url.includes('/NY/Manhattan/')) {
      stats.manhattan++;
    } else if (listing.url.includes('/NY/Brooklyn/')) {
      stats.brooklyn++;
    } else if (listing.url.includes('/NY/Queens/') || 
               listing.url.includes('/NY/Flushing/') || 
               listing.url.includes('/NY/Jamaica/') ||
               listing.url.includes('/NY/Astoria/')) {
      stats.queens++;
    } else if (listing.url.includes('/NY/Bronx/')) {
      stats.bronx++;
    } else if (listing.url.includes('/NY/Staten-Island/')) {
      stats.statenIsland++;
    } else {
      stats.other++;
    }
  });
  
  stats.manhattanPercentage = stats.total > 0 ? (stats.manhattan / stats.total * 100).toFixed(1) : 0;
  
  return stats;
}
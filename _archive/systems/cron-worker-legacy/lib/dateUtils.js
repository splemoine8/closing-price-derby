// Simple ESM date utilities for Pacific timezone handling
// Handles Redfin's standardized timestamps and DST changes

import { toZonedTime, format } from 'date-fns-tz';

export function toPacificDateISO(isoString) {
  if (!isoString) return null;
  
  try {
    const pac = toZonedTime(new Date(isoString), 'America/Los_Angeles');
    return format(pac, 'yyyy-MM-dd', { timeZone: 'America/Los_Angeles' });
  } catch (error) {
    console.warn(`Failed to parse timestamp "${isoString}":`, error.message);
    return null;
  }
}

export function extractSaleTimestamp(sale) {
  return sale.lastSoldDate || sale.sale_timestamp_utc || null;
}

export function isSaleInPeriod(sale, startISO, endISO) {
  const d = toPacificDateISO(extractSaleTimestamp(sale));
  return d && d >= startISO && d <= endISO;
}
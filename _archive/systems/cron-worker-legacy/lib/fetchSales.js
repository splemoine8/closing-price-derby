// lib/fetchSales.js (single copy in /lib)
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supa = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
); // read-only is fine

const cache = {}; // cheap in-memory cache

function sanitize(city) {
  return city.replace(/[^A-Za-z]/g, '');
}

export async function fetchSalesByCity(city) {
  const key = sanitize(city);
  if (cache[key]) return cache[key];

  // 1. First try the new per-city format
  const { data: newFormat, error: newError } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .eq('city', key)
    .single();

  if (newFormat && !newError) {
    cache[key] = newFormat.data || [];
    return cache[key];
  }

  // 2. Fall back to old blob format
  const { data: oldBlob, error: oldError } = await supa
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .is('city', null)
    .single();

  if (oldBlob && !oldError && oldBlob.data) {
    // Extract city data from the blob
    const cityData = oldBlob.data[key] || [];
    cache[key] = cityData;
    return cityData;
  }

  // 3. No data found in either format
  cache[key] = [];
  return [];
}
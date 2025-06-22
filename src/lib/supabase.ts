import { createClient } from '@supabase/supabase-js';

// These will come from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using JSON fallback mode.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for our data
export interface CompetitionData {
  id?: number;
  data_type: 'leaderboard' | 'sales_data' | 'baselines';
  data: any;
  updated_at?: string;
}
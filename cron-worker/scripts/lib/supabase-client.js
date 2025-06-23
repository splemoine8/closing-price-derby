import { createClient } from '@supabase/supabase-js';

// For Node.js scripts, we need to use process.env (not import.meta.env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to upsert competition data
export async function upsertCompetitionData(dataType, data) {
  try {
    // First, try to delete existing record
    await supabase
      .from('competition_data')
      .delete()
      .eq('data_type', dataType);

    // Then insert new record
    const { error } = await supabase
      .from('competition_data')
      .insert({ 
        data_type: dataType, 
        data: data,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`❌ Error upserting ${dataType} to Supabase:`, error);
      throw error;
    }

    console.log(`✅ Successfully saved ${dataType} to Supabase`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save ${dataType} to Supabase:`, error);
    throw error;
  }
}

// Helper function to fetch competition data
export async function fetchCompetitionData(dataType) {
  try {
    const { data, error } = await supabase
      .from('competition_data')
      .select('data')
      .eq('data_type', dataType)
      .single();

    if (error) {
      console.error(`❌ Error fetching ${dataType} from Supabase:`, error);
      return null;
    }

    return data?.data || null;
  } catch (error) {
    console.error(`❌ Failed to fetch ${dataType} from Supabase:`, error);
    return null;
  }
}
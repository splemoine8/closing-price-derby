import useSWR from 'swr';
import { supabase } from '../lib/supabase';

// New simplified hook that uses the database views
export function useCompetitionData() {
  // Single source of truth - the leaderboard view
  const { data, error, mutate } = useSWR(
    'competition-leaderboard-new',
    async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    { refreshInterval: 60000 }
  );
  
  return {
    leaderboard: data || [],
    isLoading: !data && !error,
    error,
    mutate
  };
}
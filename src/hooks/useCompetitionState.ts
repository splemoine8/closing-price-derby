import useSWR from 'swr';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface CompetitionConfig {
  id: string;
  name: string;
  pacific_start: string;
  pacific_end: string;
  utc_start: string;
  utc_end: string;
  draft_night: string;
  baseline_snapshot_date: string;
  start_from_zero: boolean;
  status: string;
  is_active: boolean;
}

interface TeamAssignments {
  lastUpdated: string;
  assignments: Record<string, string>;
}

export interface CompetitionState {
  mode: 'setup' | 'live' | 'complete';
  config: CompetitionConfig | null;
  teamAssignments: TeamAssignments | null;
  timeRemaining: number | null;
  startDate: Date;
  endDate: Date;
  isLoading: boolean;
  error: any;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useCompetitionState(): CompetitionState {
  // Fetch competition config from Supabase
  const { data: config, error: configError } = useSWR<CompetitionConfig>(
    'competition-config',
    async () => {
      const { data, error } = await supabase
        .from('competition_config')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (error) {
        // Fallback to JSON file if Supabase fails
        console.warn('Failed to fetch from Supabase, falling back to JSON:', error);
        const response = await fetch('/competition-config.json');
        const jsonConfig = await response.json();
        // Transform JSON format to match database format
        return {
          id: jsonConfig.competition_id,
          name: jsonConfig.name,
          pacific_start: jsonConfig.pacific_start,
          pacific_end: jsonConfig.pacific_end,
          // Generate UTC times for fallback
          utc_start: jsonConfig.pacific_start.replace('T06:00:00', 'T13:00:00.000Z'),
          utc_end: jsonConfig.pacific_end.replace('T23:59:59', 'T06:59:59.999Z').replace('2025-07-06', '2025-07-07'),
          draft_night: jsonConfig.draft_night,
          baseline_snapshot_date: jsonConfig.baseline_snapshot_date,
          start_from_zero: jsonConfig.start_from_zero,
          status: jsonConfig.status,
          is_active: true
        };
      }
      
      return data;
    },
    { refreshInterval: 60000 } // Refresh every minute
  );

  // Fetch team assignments
  const { data: teamAssignments, error: teamError } = useSWR<TeamAssignments>(
    '/team-names.json',
    fetcher,
    { refreshInterval: 60000 }
  );

  return useMemo(() => {
    const now = new Date();
    
    // Use UTC times directly from database (no conversion needed)
    const startDate = config 
      ? new Date(config.utc_start)
      : new Date('2025-06-23T13:00:00.000Z');
      
    const endDate = config
      ? new Date(config.utc_end)
      : new Date('2025-07-14T06:59:59.999Z'); // Updated fallback to July 13
    
    // Determine competition mode
    let mode: CompetitionState['mode'];
    if (now < startDate) {
      mode = 'setup';
    } else if (now <= endDate) {
      mode = 'live';
    } else {
      mode = 'complete';
    }
    
    // Calculate time remaining
    let timeRemaining: number | null = null;
    if (mode === 'setup') {
      timeRemaining = startDate.getTime() - now.getTime();
    } else if (mode === 'live') {
      timeRemaining = endDate.getTime() - now.getTime();
    }
    
    return {
      mode,
      config: config || null,
      teamAssignments: teamAssignments || null,
      timeRemaining,
      startDate,
      endDate,
      isLoading: !config || !teamAssignments,
      error: configError || teamError
    };
  }, [config, teamAssignments, configError, teamError]);
}
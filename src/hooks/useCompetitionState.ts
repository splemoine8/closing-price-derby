import useSWR from 'swr';
import { useMemo } from 'react';

interface CompetitionConfig {
  competition_id: string;
  name: string;
  pacific_start: string;
  pacific_end: string;
  draft_night: string;
  baseline_snapshot_date: string;
  start_from_zero: boolean;
  status: string;
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
  // Fetch competition config
  const { data: config, error: configError } = useSWR<CompetitionConfig>(
    '/competition-config.json',
    fetcher,
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
    
    // Convert Pacific times to UTC for frontend calculations
    // Pacific start "2025-06-23T06:00:00" = UTC "2025-06-23T13:00:00.000Z" (PDT)
    const startDate = config 
      ? new Date(config.pacific_start.replace('T06:00:00', 'T13:00:00.000Z'))
      : new Date('2025-06-23T13:00:00.000Z');
      
    const endDate = config
      ? new Date(config.pacific_end.replace('T23:59:59', 'T06:59:59.999Z').replace('2025-07-06', '2025-07-07'))
      : new Date('2025-07-07T06:59:59.999Z');
    
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
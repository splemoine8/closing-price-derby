import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'

// Types for data sources
type BaselineData = {
  generatedAt: string;
  daysUsed: number;
  minSalesRequired: number;
  baselines: Record<string, number>;
};

type TeamNamesData = {
  lastUpdated: string;
  assignments: Record<string, string>;
};

type ZipStat = {
  zip: string;
  city: string;
  state: string;
  price: number;
  teamName?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());


export function useCompetitionData() {
  // Dynamic data - needs refresh
  const { data: leaderboardData, mutate, isLoading: leaderboardLoading, error: leaderboardError } = useSWR<ZipStat[]>(
    '/leaderboard.json',
    fetcher,
    { 
      refreshInterval: 60000,
      onError: (error) => console.error('Failed to load leaderboard data:', error)
    }
  );

  // Static data - immutable during competition
  const { data: baselineData, error: baselineError } = useSWRImmutable<BaselineData>(
    '/baselines.json',
    fetcher
  );

  const { data: teamNamesData, error: teamNamesError } = useSWRImmutable<TeamNamesData>(
    '/team-names.json',
    fetcher
  );

  // Error handling with graceful degradation
  if (baselineError) {
    console.warn('Failed to load baseline data. Multipliers will be unavailable.', baselineError);
  }
  
  if (teamNamesError) {
    console.warn('Failed to load team names data. Using fallback team names.', teamNamesError);
  }

  const isLoading = leaderboardLoading || !leaderboardData;
  const hasAllData = leaderboardData && baselineData && teamNamesData;

  return {
    leaderboardData,
    baselineData,
    teamNamesData,
    mutate,
    isLoading,
    hasAllData,
    errors: {
      leaderboard: leaderboardError,
      baseline: baselineError,
      teamNames: teamNamesError
    }
  };
}
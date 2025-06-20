import React from 'react'
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

  // Create fallback leaderboard from team assignments if no data exists
  const processedLeaderboardData = React.useMemo(() => {
    if (leaderboardData && leaderboardData.length > 0) {
      return leaderboardData;
    }
    
    // DEMO: Disable fallback to prevent double rendering
    // Fallback: create empty leaderboard from team assignments
    // if (teamNamesData?.assignments) {
    //   return Object.entries(teamNamesData.assignments).map(([city, teamName]) => ({
    //     zip: "00000", // Placeholder ZIP
    //     city,
    //     state: getStateForCity(city), // Helper function to get state
    //     price: 0,
    //     teamName
    //   }));
    // }
    
    return [];
  }, [leaderboardData, teamNamesData]);

  const isLoading = leaderboardLoading || !teamNamesData;
  const hasAllData = processedLeaderboardData && baselineData && teamNamesData;

  return {
    leaderboardData: processedLeaderboardData,
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

// Helper function to get state abbreviation for each city
function getStateForCity(city: string): string {
  const cityStateMap: Record<string, string> = {
    "Kansas City": "MO",
    "New Orleans": "LA", 
    "Green Bay": "WI",
    "Nashville": "TN",
    "Buffalo": "NY",
    "Pittsburgh": "PA",
    "Cincinnati": "OH",
    "Cleveland": "OH",
    "Jacksonville": "FL",
    "Indianapolis": "IN",
    "Baltimore": "MD",
    "Charlotte": "NC"
  };
  return cityStateMap[city] || "US";
}
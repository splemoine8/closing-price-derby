import React from 'react'
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'
import { supabase } from '@/lib/supabase'

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

// Fetcher for JSON files (fallback)
const jsonFetcher = (url: string) => fetch(url).then((res) => res.json());

// Fetcher for Supabase
const supabaseFetcher = async (dataType: string) => {
  const { data, error } = await supabase
    .from('competition_data')
    .select('data')
    .eq('data_type', dataType)
    .single();
  
  if (error) throw error;
  return data?.data || null;
};

export function useCompetitionData() {
  // Try Supabase first, fallback to JSON files
  const useSupabase = !!import.meta.env.VITE_SUPABASE_URL;
  
  // Dynamic data - needs refresh
  const { 
    data: leaderboardData, 
    mutate, 
    isLoading: leaderboardLoading, 
    error: leaderboardError 
  } = useSWR<ZipStat[]>(
    useSupabase ? ['supabase-leaderboard', 'leaderboard'] : '/leaderboard.json',
    useSupabase ? () => supabaseFetcher('leaderboard') : jsonFetcher,
    { 
      refreshInterval: 60000,
      onError: (error) => {
        console.error('Failed to load leaderboard data:', error);
        // If Supabase fails, don't retry immediately
        if (useSupabase) {
          console.warn('Falling back to JSON files');
        }
      }
    }
  );

  // Static data - immutable during competition
  const { data: baselineData, error: baselineError } = useSWRImmutable<BaselineData>(
    useSupabase ? ['supabase-baselines', 'baselines'] : '/baselines.json',
    useSupabase ? () => supabaseFetcher('baselines') : jsonFetcher
  );

  const { data: teamNamesData, error: teamNamesError } = useSWRImmutable<TeamNamesData>(
    '/team-names.json',
    jsonFetcher // Always use JSON for team names (not migrated to Supabase)
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
    
    // Fallback: create empty leaderboard from team assignments
    if (teamNamesData?.assignments) {
      return Object.entries(teamNamesData.assignments).map(([city, teamName]) => ({
        zip: "00000", // Placeholder ZIP
        city,
        state: getStateForCity(city), // Helper function to get state
        price: 0,
        teamName
      }));
    }
    
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
    "Charlotte": "NC",
    // Add 32 NFL cities
    "Phoenix": "AZ",
    "Atlanta": "GA",
    "Boston": "MA",
    "Chicago": "IL",
    "Dallas": "TX",
    "Denver": "CO",
    "Detroit": "MI",
    "Houston": "TX",
    "Las Vegas": "NV",
    "Los Angeles": "CA",
    "Miami": "FL",
    "Minneapolis": "MN",
    "New Jersey": "NJ",
    "New York": "NY",
    "Philadelphia": "PA",
    "San Francisco": "CA",
    "Seattle": "WA",
    "Tampa Bay": "FL",
    "Washington DC": "DC"
  };
  return cityStateMap[city] || "US";
}

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useCompetitionData } from '@/hooks/useCompetitionDataWithSupabase';
import { useCompetitionState, type CompetitionState } from '@/hooks/useCompetitionState';
import { supabase } from '@/lib/supabase';
import { CompetitionBanner } from '@/components/CompetitionBanner';
import { CompetitionCountdown } from '@/components/CompetitionCountdown';
import LeaderboardHeader from '../components/LeaderboardHeader';
import LiveEventTicker from '../components/LiveEventTicker';
import Footer from '../components/Footer';
import ZipCodeCard from '../components/ZipCodeCard';
import FloatingRefreshButton from '../components/FloatingRefreshButton';
import ZipDetailModal from '../components/ZipDetailModal';

// Types

type ZipCodeData = {
  rank: number;
  zipCode: string;
  city: string;
  state: string;
  teamName: string;
  topPrice: number;
  priceDelta: number;
  lastSoldDate?: string;
  baseline?: number;        // NEW: For percentage scoring
  scorePct?: number;        // NEW: Percentage score
  multiplier?: string;      // NEW: Display format
};

// Fetcher function for sales data
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Failed to fetch sales data');
  }
  return res.json();
});

// Supabase fetcher for sales data
const supabaseSalesFetcher = async () => {
  const { data, error } = await supabase
    .from('competition_data')
    .select('data')
    .eq('data_type', 'sales_data')
    .single();
  
  if (error) throw error;
  return data?.data || {};
};

// Helper function to get highest sale data for competition scoring
const getHighestSaleData = (
  zipCode: string, 
  salesData: Record<string, any[]> | undefined,
  competitionState?: CompetitionState
): { price: number; delta: number; highestSaleDate?: string; mostRecentDate?: string } => {
  if (!salesData || !salesData[zipCode]) {
    return { price: 0, delta: 0 };
  }

  const sales = salesData[zipCode];
  if (sales.length < 1) {
    return { price: 0, delta: 0 };
  }

  // Filter out zero prices
  let validSales = sales.filter(sale => sale.price > 0);

  // If competition uses clean slate mode, filter based on competition state
  if (competitionState && competitionState.config?.start_from_zero) {
    if (competitionState.mode === 'setup') {
      // In setup mode with clean slate, return no data (show "—")
      return { price: 0, delta: 0 };
    } else {
      // In live/complete mode, filter to competition dates only
      validSales = validSales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= competitionState.startDate && saleDate <= competitionState.endDate;
      });
    }
  }

  if (validSales.length < 1) {
    return { price: 0, delta: 0 };
  }

  // Sort sales by price to get highest to lowest (for competition scoring)
  const sortedByPrice = [...validSales]
    .sort((a, b) => b.price - a.price);

  // Get the highest sale for scoring and ranking
  const highestSale = sortedByPrice[0];
  const price = highestSale.price;
  const highestSaleDate = highestSale.date;

  // Get the most recent sale date for activity tracking
  const sortedByDate = [...validSales]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const mostRecentSale = sortedByDate[0];
  const mostRecentDate = mostRecentSale.date;

  // Calculate delta between highest and second highest
  let delta = 0;
  if (sortedByPrice.length >= 2) {
    const secondHighest = sortedByPrice[1].price;
    delta = price - secondHighest;
    console.log(`Price delta for ${zipCode}: $${price.toLocaleString()} - $${secondHighest.toLocaleString()} = $${delta.toLocaleString()}`);
  }
  
  return { price, delta, highestSaleDate, mostRecentDate };
};

// Sales data will be fetched from API

const Index = () => {
  const [selectedZip, setSelectedZip] = useState<ZipCodeData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zipDataWithDeltas, setZipDataWithDeltas] = useState<ZipCodeData[]>([]);

  // Use custom hook for all competition data
  const { 
    leaderboardData, 
    baselineData, 
    teamNamesData, 
    mutate, 
    isLoading,
    errors 
  } = useCompetitionData();

  // Get competition state
  const competitionState = useCompetitionState();

  // Fetch sales data for modals (try Supabase first, fallback to JSON)
  const useSupabase = !!import.meta.env.VITE_SUPABASE_URL;
  const { data: salesData } = useSWR<Record<string, any[]>>(
    useSupabase ? 'supabase-sales-data' : '/sales-data.json',
    useSupabase ? supabaseSalesFetcher : fetcher,
    {
      refreshInterval: 60000,
      onError: (error) => {
        console.error('Failed to load sales data:', error);
        if (useSupabase) {
          console.warn('Falling back to JSON files for sales data');
        }
      }
    }
  );

  // Show toast notifications for data issues
  useEffect(() => {
    if (errors.leaderboard) {
      toast.error('Could not load leaderboard – retrying');
    }
    if (errors.baseline) {
      toast.warning('Baseline data unavailable – multipliers will show as "--"');
    }
  }, [errors]);

  // Centralized data processing with real data and baseline scoring
  const zipData = useMemo(() => {
    if (!leaderboardData) return [];
    
    const mapped = leaderboardData
      // Don't filter out zero prices in setup mode - show all cities with baselines
      .map((item): ZipCodeData => {
        // Get baseline for this city (graceful degradation)
        const cityName = item.city;
        const baseline = baselineData?.baselines[cityName] || 0;
        
        // Get team name from assignments (graceful degradation)
        const teamName = teamNamesData?.assignments[cityName] || item.teamName || 'Unknown';
        
        // In setup mode with clean slate, always show "—" regardless of data
        let scorePct = 0;
        let multiplier = '—';
        let displayPrice = 0;
        
        if (competitionState.mode === 'setup' && competitionState.config?.start_from_zero) {
          // Setup mode: always show "—" and zero price
          scorePct = 0;
          multiplier = '—';
          displayPrice = 0;
        } else {
          // Live/complete mode: calculate actual scores
          displayPrice = item.price;
          if (baseline > 0 && item.price > 0) {
            scorePct = ((item.price - baseline) / baseline) * 100;
            multiplier = `×${(scorePct / 100 + 1).toFixed(1)}`;
          } else if (!baselineData) {
            multiplier = '--'; // Indicates missing baseline data
          }
        }
        
        return {
          rank: 0, // Will be set after sorting
          zipCode: item.zip,
          city: item.city,
          state: item.state,
          teamName: teamName,
          topPrice: displayPrice,
          priceDelta: 0, // Will be calculated asynchronously
          baseline: baseline,
          scorePct: scorePct,
          multiplier: multiplier
        };
      });
    
    // Sort by score percentage, then by price
    const sorted = mapped.sort((a, b) => {
      if (a.scorePct !== b.scorePct) {
        return (b.scorePct || 0) - (a.scorePct || 0);
      }
      return (b.topPrice || 0) - (a.topPrice || 0);
    });
    
    // Assign ranks
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [leaderboardData, baselineData, teamNamesData]);

  // Calculate real prices and deltas using sales data
  React.useEffect(() => {
    if (!zipData.length || !salesData) {
      setZipDataWithDeltas(zipData);
      return;
    }
    
    const updatedData = zipData.map((zip) => {
      const { price, delta, highestSaleDate, mostRecentDate } = getHighestSaleData(zip.zipCode, salesData, competitionState);
      
      // Use real highest sale price if available, otherwise fallback to dummy data
      const actualPrice = price > 0 ? price : zip.topPrice;
      
      // Recalculate score and multiplier with highest sale price vs baseline
      // Preserve "-" multiplier from setup mode
      let actualScorePct = zip.scorePct;
      let actualMultiplier = zip.multiplier;
      
      if (price > 0 && zip.baseline && zip.multiplier !== '-') {
        actualScorePct = ((actualPrice - zip.baseline) / zip.baseline) * 100;
        actualMultiplier = `×${(actualScorePct / 100 + 1).toFixed(1)}`;
      }
      
      return { 
        ...zip, 
        topPrice: actualPrice,           // Highest sale price for scoring
        scorePct: actualScorePct,        // Score based on highest sale
        multiplier: actualMultiplier,    // Multiplier based on highest sale
        priceDelta: delta,               // Delta between highest and 2nd highest
        lastSoldDate: mostRecentDate     // Most recent activity for ticker
      };
    });
    
    // Sort by score percentage (highest first), fallback to price
    const sortedData = updatedData.sort((a, b) => {
      if (a.scorePct !== b.scorePct) {
        return (b.scorePct || 0) - (a.scorePct || 0);
      }
      return (b.topPrice || 0) - (a.topPrice || 0);
    });
    
    // Add ranks
    const rankedData = sortedData.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
    
    setZipDataWithDeltas(rankedData);
  }, [zipData, salesData, competitionState]);

  // Use zipDataWithDeltas for calculations and rendering
  const displayData = zipDataWithDeltas.length > 0 ? zipDataWithDeltas : zipData;
  const maxPrice = displayData.length > 0 ? Math.max(...displayData.map(zip => zip.topPrice)) : 0;
  const minPrice = displayData.length > 0 ? Math.min(...displayData.filter(zip => zip.topPrice > 0).map(zip => zip.topPrice)) : 0;
  
  // Calculate score range for relative color coding
  const validScores = displayData.filter(zip => zip.scorePct !== undefined && zip.scorePct !== null).map(zip => zip.scorePct as number);
  const maxScorePct = validScores.length > 0 ? Math.max(...validScores) : undefined;
  const minScorePct = validScores.length > 0 ? Math.min(...validScores) : undefined;
  
  // Calculate last update time in relative format
  const lastUpdate = useMemo(() => {
    if (!leaderboardData || leaderboardData.length === 0) return 'Never';
    const maxTs = Math.max(...leaderboardData.map(z => (z as any).ts || Date.now()));
    const now = Date.now();
    const diffMs = now - maxTs;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }, [leaderboardData]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    } else {
      return `$${price.toLocaleString()}`;
    }
  };

  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return 'recently';
    
    // Parse date like "Jun 16, 2025"
    const saleDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - saleDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'now';
    if (diffHours < 24) return `${diffHours}h ago`; // Show hours for anything under 24 hours
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  // Clear old rank change tracking since we're using real data now
  React.useEffect(() => {
    // Force clear old localStorage on component mount
    localStorage.removeItem('previousRankings');
  }, []); // Run once on mount

  // Generate live events for ticker
  const liveEvents = useMemo(() => {
    if (!displayData.length) return [];
    
    const events = [];
    const leader = displayData[0];
    
    // Current leader event with multiplier
    if (leader.multiplier && leader.multiplier !== '-' && leader.baseline) {
      events.push({
        text: `🔥 ${leader.city} leads with ${leader.multiplier}!`,
        timestamp: getRelativeTime(leader.lastSoldDate)
      });
    } else {
      // Fallback to price if no percentage scoring or in setup mode
      events.push({
        text: `🔥 ${leader.city} leads with ${formatPrice(leader.topPrice)}!`,
        timestamp: getRelativeTime(leader.lastSoldDate)
      });
    }
    
    // Recent big performance events
    if (displayData.length > 1) {
      const second = displayData[1];
      if (second.multiplier && second.multiplier !== '-' && second.scorePct && second.scorePct >= 200) {
        events.push({
          text: `🚀 ${second.city} hits ${second.multiplier} performance!`,
          timestamp: getRelativeTime(second.lastSoldDate)
        });
      } else if (second.multiplier && second.multiplier !== '-') {
        events.push({
          text: `📈 ${second.city} scores ${second.multiplier}`,
          timestamp: getRelativeTime(second.lastSoldDate)
        });
      } else {
        events.push({
          text: `💰 New ${second.city} sale for ${formatPrice(second.topPrice)}`,
          timestamp: getRelativeTime(second.lastSoldDate)
        });
      }
    }
    
    // Show current #3 position
    if (displayData.length > 2) {
      const third = displayData[2];
      if (third.multiplier && third.multiplier !== '-') {
        events.push({
          text: `🏆 ${third.city} holds #${third.rank} with ${third.multiplier}`,
          timestamp: getRelativeTime(third.lastSoldDate)
        });
      } else {
        events.push({
          text: `🏆 ${third.city} holds #${third.rank} position`,
          timestamp: getRelativeTime(third.lastSoldDate)
        });
      }
    }
    
    return events;
  }, [displayData]);

  const handleRefresh = () => {
    mutate(); // Trigger SWR revalidation
  };

  const handleZipClick = (zipData: ZipCodeData) => {
    setSelectedZip(zipData);
    setIsModalOpen(true);
  };

  // Get sales data and price history for selected zip
  const getZipSalesData = (zipCode: string) => {
    return salesData?.[zipCode] || [];
  };

  // Get the highest sale for modal display (consistent with card)
  const getHighestSaleForModal = (zipCode: string) => {
    const sales = salesData?.[zipCode] || [];
    if (sales.length === 0) return null;
    
    const validSales = sales.filter(sale => sale.price > 0);
    if (validSales.length === 0) return null;
    
    // Return the highest priced sale (same logic as scoring)
    return validSales.sort((a, b) => b.price - a.price)[0];
  };

  const getPriceHistory = (zipCode: string) => {
    const sales = salesData?.[zipCode] || [];
    if (sales.length === 0) return [];
    
    // Get all sales sorted by date (newest first)
    const sortedSales = [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Take the 7 most recent sales, then reverse to show chronological progression in chart
    const recentSales = sortedSales.slice(0, 7).reverse();
    
    return recentSales.map(sale => ({ price: sale.price, date: sale.date }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <LeaderboardHeader />
      
      {/* Competition State Banner - only shows when complete */}
      {competitionState.mode === 'complete' && (
        <div className="max-w-sm mx-auto px-4 py-2">
          <CompetitionBanner />
        </div>
      )}
      
      {/* Competition Countdown - only shows during setup */}
      {competitionState.mode === 'setup' && (
        <div className="max-w-sm mx-auto px-4 py-2">
          <CompetitionCountdown />
        </div>
      )}
      
      {/* Live Event Ticker - only shows during live mode */}
      {competitionState.mode === 'live' && <LiveEventTicker events={liveEvents} />}
      
      <div className="max-w-sm mx-auto px-4 py-6 space-y-3 pb-16">
        {isLoading && (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading leaderboard...</div>
          </div>
        )}
        
        
        {displayData.map((zipDataItem, index) => (
          <React.Fragment key={zipDataItem.zipCode}>
            {index === 0 && (
              <div className="mb-4">
                <img 
                  src="/derby-banner.webp" 
                  alt="Leaderboard banner"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            )}
            <ZipCodeCard
              data={zipDataItem}
              maxPrice={maxPrice}
              minPrice={minPrice}
              maxScorePct={maxScorePct}
              minScorePct={minScorePct}
              onClick={() => handleZipClick(zipDataItem)}
            />
          </React.Fragment>
        ))}
      </div>

      <FloatingRefreshButton 
        onRefresh={handleRefresh} 
        isRefreshing={isLoading}
      />

      {selectedZip && (
        <ZipDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          city={selectedZip.city}
          state={selectedZip.state}
          topSales={getZipSalesData(selectedZip.zipCode)}
          priceHistory={getPriceHistory(selectedZip.zipCode)}
          baseline={selectedZip.baseline}
          highestSale={getHighestSaleForModal(selectedZip.zipCode)}
          highestSaleMultiplier={selectedZip.multiplier}
        />
      )}
      
      <Footer lastUpdate={lastUpdate} />
    </div>
  );
};

export default Index;

import React, { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useCompetitionData } from '../hooks/useCompetitionData';
import { useCompetitionState } from '../hooks/useCompetitionState';
import { supabase } from '../lib/supabase';
import { CompetitionBanner } from '../components/CompetitionBanner';
import { CompetitionCountdown } from '../components/CompetitionCountdown';
import LeaderboardHeader from '../components/LeaderboardHeader';
import LiveEventTicker from '../components/LiveEventTicker';
import Footer from '../components/Footer';
import ZipCodeCard from '../components/ZipCodeCard';
import FloatingRefreshButton from '../components/FloatingRefreshButton';
import ZipDetailModal from '../components/ZipDetailModal';

// Simplified types - all data comes from the view
type LeaderboardEntry = {
  city: string;
  state: string;
  team_name: string;
  baseline_price: number;
  price: number;
  score_pct: number | null;
  multiplier: string;
  top_sale_address: string | null;
  last_sold_date: string | null;
  price_delta: number;
};

const Index = () => {
  const [selectedCity, setSelectedCity] = useState<LeaderboardEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Single data source - the leaderboard view
  const { leaderboard, isLoading, error, mutate } = useCompetitionData();
  
  // Get competition state
  const competitionState = useCompetitionState();

  // Show toast for errors
  React.useEffect(() => {
    if (error) {
      toast.error('Could not load leaderboard – retrying');
    }
  }, [error]);

  // Transform leaderboard data for display
  const displayData = React.useMemo(() => {
    if (!leaderboard) return [];
    
    // In setup mode with clean slate, show all cities with zero prices
    if (competitionState.mode === 'setup' && competitionState.config?.start_from_zero) {
      return leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        topPrice: 0,
        baseline: entry.baseline_price,
        priceDelta: 0,
        scorePct: 0,
        multiplier: '—',
        zipCode: '00000' // Placeholder
      }));
    }
    
    // Otherwise, use data from view with ranks
    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      topPrice: entry.price,
      // Map database column 'baseline_price' to component prop 'baseline'
      baseline: entry.baseline_price,
      priceDelta: entry.price_delta,
      scorePct: entry.score_pct || 0,
      multiplier: entry.multiplier || '—',
      zipCode: '00000', // Placeholder for compatibility
      teamName: entry.team_name,
      lastSoldDate: entry.last_sold_date
    }));
  }, [leaderboard, competitionState]);

  // Calculate display metrics
  const maxPrice = displayData.length > 0 ? Math.max(...displayData.map(d => d.topPrice)) : 0;
  const minPrice = displayData.length > 0 ? Math.min(...displayData.filter(d => d.topPrice > 0).map(d => d.topPrice)) : 0;
  const maxScorePct = displayData.length > 0 ? Math.max(...displayData.map(d => d.scorePct || 0)) : undefined;
  const minScorePct = displayData.length > 0 ? Math.min(...displayData.map(d => d.scorePct || 0)) : undefined;

  // Calculate last update time
  const lastUpdate = React.useMemo(() => {
    if (!leaderboard || leaderboard.length === 0) return 'Never';
    // Since views are real-time, we can use current time
    return 'just now';
  }, [leaderboard]);

  // Format price helper
  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    } else {
      return `$${price.toLocaleString()}`;
    }
  };

  // Get relative time
  const getRelativeTime = (dateString?: string | null) => {
    if (!dateString) return 'recently';
    
    const saleDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - saleDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  // Generate live events
  const liveEvents = React.useMemo(() => {
    if (!displayData.length) return [];
    
    const events = [];
    const leader = displayData[0];
    
    // Current leader event
    if (leader.multiplier && leader.multiplier !== '—') {
      events.push({
        text: `🔥 ${leader.city} leads with ${leader.multiplier}!`,
        timestamp: getRelativeTime(leader.lastSoldDate)
      });
    } else if (leader.topPrice > 0) {
      events.push({
        text: `🔥 ${leader.city} leads with ${formatPrice(leader.topPrice)}!`,
        timestamp: getRelativeTime(leader.lastSoldDate)
      });
    }
    
    // Add more events for top 3
    if (displayData.length > 1) {
      const second = displayData[1];
      if (second.multiplier && second.multiplier !== '—') {
        events.push({
          text: `📈 ${second.city} scores ${second.multiplier}`,
          timestamp: getRelativeTime(second.lastSoldDate)
        });
      }
    }
    
    if (displayData.length > 2) {
      const third = displayData[2];
      events.push({
        text: `🏆 ${third.city} holds #3 position`,
        timestamp: getRelativeTime(third.lastSoldDate)
      });
    }
    
    return events;
  }, [displayData]);

  // Refresh handler
  const handleRefresh = () => {
    mutate();
  };

  // Click handler for cards
  const handleCityClick = (data: any) => {
    // Map display data back to leaderboard entry
    const entry = leaderboard.find(e => e.city === data.city);
    if (entry) {
      setSelectedCity(entry);
      setIsModalOpen(true);
    }
  };

  // Fetch sales detail for modal
  const { data: salesDetail } = useSWR(
    selectedCity ? ['city-sales-detail', selectedCity.city] : null,
    async () => {
      if (!selectedCity) return [];
      
      const { data, error } = await supabase
        .from('city_sales_detail')
        .select('*')
        .eq('city_name', selectedCity.city)
        .limit(10);
        
      if (error) throw error;
      return data || [];
    }
  );

  // Transform sales detail for modal
  const modalSalesData = React.useMemo(() => {
    if (!salesDetail) return [];
    
    return salesDetail.map(sale => ({
      address: sale.address,
      date: new Date(sale.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      price: sale.price,
      beds: sale.beds,
      baths: sale.baths,
      sqft: sale.sqft,
      url: sale.url
    }));
  }, [salesDetail]);

  // Get price history for chart
  const priceHistory = React.useMemo(() => {
    if (!modalSalesData.length) return [];
    
    // Take last 7 sales for chart
    return modalSalesData.slice(0, 7).reverse().map(sale => ({
      price: sale.price,
      date: sale.date
    }));
  }, [modalSalesData]);

  return (
    <div className="min-h-screen bg-gray-50">
      <LeaderboardHeader />
      
      {/* Competition State Banner */}
      {competitionState.mode === 'complete' && (
        <div className="max-w-sm mx-auto px-4 py-2">
          <CompetitionBanner />
        </div>
      )}
      
      {/* Competition Countdown */}
      {competitionState.mode === 'setup' && (
        <div className="max-w-sm mx-auto px-4 py-2">
          <CompetitionCountdown />
        </div>
      )}
      
      {/* Live Event Ticker */}
      {competitionState.mode === 'live' && <LiveEventTicker events={liveEvents} />}
      
      <div className="max-w-sm mx-auto px-4 py-6 space-y-3 pb-16">
        {isLoading && (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading leaderboard...</div>
          </div>
        )}
        
        {displayData.map((item, index) => (
          <React.Fragment key={item.city}>
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
              data={item}
              maxPrice={maxPrice}
              minPrice={minPrice}
              maxScorePct={maxScorePct}
              minScorePct={minScorePct}
              onClick={() => handleCityClick(item)}
            />
          </React.Fragment>
        ))}
      </div>

      <FloatingRefreshButton 
        onRefresh={handleRefresh} 
        isRefreshing={isLoading}
      />

      {selectedCity && (
        <ZipDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          city={selectedCity.city}
          state={selectedCity.state}
          topSales={modalSalesData}
          priceHistory={priceHistory}
          baseline={selectedCity.baseline_price}
          highestSale={modalSalesData[0] || null}
          highestSaleMultiplier={selectedCity.multiplier}
          scorePct={selectedCity.score_pct}
        />
      )}
      
      <Footer lastUpdate={lastUpdate} />
    </div>
  );
};

export default Index;
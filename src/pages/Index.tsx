
import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import LeaderboardHeader from '../components/LeaderboardHeader';
import StatusBanner from '../components/StatusBanner';
import LiveEventTicker from '../components/LiveEventTicker';
import ZipCodeCard from '../components/ZipCodeCard';
import FloatingRefreshButton from '../components/FloatingRefreshButton';
import ZipDetailModal from '../components/ZipDetailModal';

// Types
type ZipStat = {
  zip: string;
  city: string;
  state: string;
  teamName: string;
  price: number;
  ts: number;
};

type ZipCodeData = {
  rank: number;
  zipCode: string;
  city: string;
  state: string;
  teamName: string;
  topPrice: number;
  priceDelta: number;
  lastSoldDate?: string;
};

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Failed to fetch leaderboard data');
  }
  return res.json();
});

// Helper function to calculate price delta from sales data
const calculatePriceDelta = (zipCode: string, currentPrice: number, salesData: Record<string, any[]> | undefined): { delta: number; lastSoldDate?: string } => {
  if (!salesData || !salesData[zipCode]) {
    return { delta: 0 };
  }

  const sales = salesData[zipCode];
  if (sales.length < 1) {
    return { delta: 0 };
  }

  // Filter out zero prices
  const validSales = sales.filter(sale => sale.price > 0);

  if (validSales.length < 1) {
    return { delta: 0 };
  }

  // Sort sales by price to get highest to lowest
  const sortedByPrice = [...validSales]
    .sort((a, b) => b.price - a.price);

  // Get the most recent sale date (from the highest priced sale)
  const highestSale = sortedByPrice[0];
  const lastSoldDate = highestSale.date;

  // Calculate delta if we have at least 2 sales
  let delta = 0;
  if (sortedByPrice.length >= 2) {
    const secondHighest = sortedByPrice[1].price;
    delta = currentPrice - secondHighest;
    console.log(`Price delta for ${zipCode}: $${currentPrice.toLocaleString()} - $${secondHighest.toLocaleString()} = $${delta.toLocaleString()}`);
  }
  
  return { delta, lastSoldDate };
};

// Sales data will be fetched from API

const Index = () => {
  const [selectedZip, setSelectedZip] = useState<ZipCodeData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zipDataWithDeltas, setZipDataWithDeltas] = useState<ZipCodeData[]>([]);

  // Fetch leaderboard data with SWR
  const { data: rawData, error, mutate, isLoading } = useSWR<ZipStat[]>(
    '/leaderboard.json',
    fetcher,
    {
      refreshInterval: 60000, // Auto-refresh every 60 seconds
      onError: (error) => {
        toast.error('Could not load leaderboard – retrying');
      }
    }
  );

  // Fetch sales data for modals
  const { data: salesData } = useSWR<Record<string, any[]>>(
    '/sales-data.json',
    fetcher,
    {
      refreshInterval: 60000
    }
  );

  // Transform and sort data
  const zipData = useMemo(() => {
    if (!rawData) return [];
    
    // Sort by price descending and add ranks
    const sorted = [...rawData]
      .filter(item => item.price > 0) // Filter out zero prices
      .sort((a, b) => b.price - a.price)
      .map((item, index): ZipCodeData => ({
        rank: index + 1,
        zipCode: item.zip,
        city: item.city,
        state: item.state,
        teamName: item.teamName,
        topPrice: item.price,
        priceDelta: 0 // Will be calculated asynchronously
      }));
    
    return sorted;
  }, [rawData]);

  // Calculate price deltas using sales data
  React.useEffect(() => {
    if (!zipData.length || !salesData) {
      setZipDataWithDeltas(zipData);
      return;
    }
    
    const updatedData = zipData.map((zip) => {
      const { delta, lastSoldDate } = calculatePriceDelta(zip.zipCode, zip.topPrice, salesData);
      return { ...zip, priceDelta: delta, lastSoldDate };
    });
    
    setZipDataWithDeltas(updatedData);
  }, [zipData, salesData]);

  // Use zipDataWithDeltas for calculations and rendering
  const displayData = zipDataWithDeltas.length > 0 ? zipDataWithDeltas : zipData;
  const maxPrice = displayData.length > 0 ? Math.max(...displayData.map(zip => zip.topPrice)) : 0;
  const minPrice = displayData.length > 0 ? Math.min(...displayData.filter(zip => zip.topPrice > 0).map(zip => zip.topPrice)) : 0;
  
  // Calculate last update time
  const lastUpdate = useMemo(() => {
    if (!rawData || rawData.length === 0) return 'Never';
    const maxTs = Math.max(...rawData.map(z => z.ts));
    return new Date(maxTs).toLocaleString();
  }, [rawData]);

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

  // Generate live events for ticker
  const liveEvents = useMemo(() => {
    if (!displayData.length) return [];
    
    const events = [];
    const leader = displayData[0];
    
    // Current leader event
    events.push({
      text: `🔥 ${leader.city} leads with ${formatPrice(leader.topPrice)}!`,
      timestamp: getRelativeTime(leader.lastSoldDate)
    });
    
    // Recent big sales
    if (displayData.length > 1) {
      const second = displayData[1];
      events.push({
        text: `💰 ${second.city} sold for ${formatPrice(second.topPrice)}`,
        timestamp: getRelativeTime(second.lastSoldDate)
      });
    }
    
    // Rank changes (sample)
    if (displayData.length > 2) {
      const third = displayData[2];
      events.push({
        text: `📈 ${third.city} moved up to #${third.rank}`,
        timestamp: getRelativeTime(third.lastSoldDate)
      });
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

  const getPriceHistory = (zipCode: string) => {
    const sales = salesData?.[zipCode] || [];
    if (sales.length === 0) return [];
    
    // Create a simple price history from the sales data
    // Sort by date and take the last 7 prices
    const sortedSales = [...sales]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);
    
    return sortedSales.map(sale => sale.price);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <LeaderboardHeader />
      <StatusBanner lastUpdate={lastUpdate} />
      <LiveEventTicker events={liveEvents} />
      
      <div className="max-w-sm mx-auto px-4 py-6 space-y-3 pb-20">
        {isLoading && (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading leaderboard...</div>
          </div>
        )}
        
        {error && (
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">Failed to load data</div>
            <button 
              onClick={handleRefresh}
              className="text-blue-600 hover:text-blue-800"
            >
              Try again
            </button>
          </div>
        )}
        
        {displayData.map((zipDataItem, index) => (
          <React.Fragment key={zipDataItem.zipCode}>
            {index === 0 && (
              <div className="mb-4">
                <img 
                  src="../public/derby-banner.webp" 
                  alt="Leaderboard banner"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            )}
            <ZipCodeCard
              data={zipDataItem}
              maxPrice={maxPrice}
              minPrice={minPrice}
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
          zipCode={selectedZip.zipCode}
          city={selectedZip.city}
          state={selectedZip.state}
          topSales={getZipSalesData(selectedZip.zipCode)}
          priceHistory={getPriceHistory(selectedZip.zipCode)}
        />
      )}
    </div>
  );
};

export default Index;

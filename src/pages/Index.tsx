
import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import LeaderboardHeader from '../components/LeaderboardHeader';
import StatusBanner from '../components/StatusBanner';
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

  // Sort sales by date to get chronological order
  const sortedSales = [...sales]
    .filter(sale => sale.price > 0) // Filter out zero prices
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sortedSales.length < 1) {
    return { delta: 0 };
  }

  // Get the most recent sale date
  const mostRecentSale = sortedSales[sortedSales.length - 1];
  const lastSoldDate = mostRecentSale.date;

  // Calculate delta if we have at least 2 sales
  let delta = 0;
  if (sortedSales.length >= 2) {
    const previousHighest = sortedSales[sortedSales.length - 2].price;
    delta = currentPrice - previousHighest;
    console.log(`Price delta for ${zipCode}: $${currentPrice.toLocaleString()} - $${previousHighest.toLocaleString()} = $${delta.toLocaleString()}`);
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
      
      <div className="max-w-sm mx-auto px-4 py-4 space-y-3 pb-20">
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
                  src="https://media.cleanshot.cloud/media/125514/6HilZS1l7LVTfKdsg90qWWTNKiDRo6ejNWlZi4I6.jpeg?Expires=1750153046&Signature=DQzc59b5Xj6dDF14wUsQf~KnY1lWMSCkXRkqGpyeXuOJiFvigvcqkX17lzS1VOC9w0U6a71-3-nDSt3RM9ymkFQcXX6u0TDg1u4oSAjYAgcHBnQo82GJ2MMyYnP8mqN7qZ9To48WclWhmOfENV8cPHEGzv9CDOgYfVsCV7QiNFR0ruTo-ENJQHZ1z05uUQz3l7F0LX5G65SHc9rOaRH23GgSZFuZWwej0ndu9lIMFu75P6Z5pmt9nbT3atFYRJcHu~nujWzeE5c-ndCFf8Y3x2uY1o62lSvibOui9OooYZrp0vLlCa-HEt6whrieRbN4SoO-H7VlqEBG3OVGX7XnGA__&Key-Pair-Id=K269JMAT9ZF4GZ" 
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

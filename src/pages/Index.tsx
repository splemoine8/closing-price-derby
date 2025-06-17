
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
};

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error('Failed to fetch leaderboard data');
  }
  return res.json();
});

const mockSalesData = {
  '90210': [
    { address: '123 Rodeo Dr', date: 'June 15, 2024', price: 12300000 },
    { address: '456 Beverly Dr', date: 'June 12, 2024', price: 11800000 },
    { address: '789 Canon Dr', date: 'June 10, 2024', price: 10500000 },
    { address: '321 Alpine Dr', date: 'June 8, 2024', price: 9200000 },
    { address: '654 Crescent Dr', date: 'June 5, 2024', price: 8900000 },
  ]
};

const mockPriceHistory = [8500000, 9200000, 10100000, 11200000, 12300000, 11800000, 12300000];

const Index = () => {
  const [selectedZip, setSelectedZip] = useState<ZipCodeData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        priceDelta: 0 // TODO: Calculate price delta from previous data
      }));
    
    return sorted;
  }, [rawData]);

  const maxPrice = zipData.length > 0 ? Math.max(...zipData.map(zip => zip.topPrice)) : 0;
  const minPrice = zipData.length > 0 ? Math.min(...zipData.filter(zip => zip.topPrice > 0).map(zip => zip.topPrice)) : 0;
  
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
        
        {zipData.map((zipDataItem, index) => (
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
          topSales={mockSalesData[selectedZip.zipCode as keyof typeof mockSalesData] || []}
          priceHistory={mockPriceHistory}
        />
      )}
    </div>
  );
};

export default Index;

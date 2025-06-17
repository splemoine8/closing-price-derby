
import React, { useState } from 'react';
import LeaderboardHeader from '../components/LeaderboardHeader';
import StatusBanner from '../components/StatusBanner';
import ZipCodeCard from '../components/ZipCodeCard';
import FloatingRefreshButton from '../components/FloatingRefreshButton';
import ZipDetailModal from '../components/ZipDetailModal';

// Mock data for demonstration
const mockZipData = [
  { rank: 1, zipCode: '90210', city: 'Beverly Hills', state: 'CA', teamName: 'Golden Gate Giants', topPrice: 12300000, priceDelta: 150000 },
  { rank: 2, zipCode: '10021', city: 'New York', state: 'NY', teamName: 'Empire State Eagles', topPrice: 11800000, priceDelta: -250000 },
  { rank: 3, zipCode: '33109', city: 'Miami Beach', state: 'FL', teamName: 'Sunset Sharks', topPrice: 9500000, priceDelta: 75000 },
  { rank: 4, zipCode: '94127', city: 'San Francisco', state: 'CA', teamName: 'Bay Area Bulls', topPrice: 8200000, priceDelta: -100000 },
  { rank: 5, zipCode: '02199', city: 'Boston', state: 'MA', teamName: 'Harbor Hawks', topPrice: 7800000, priceDelta: 0 },
  { rank: 6, zipCode: '90049', city: 'Los Angeles', state: 'CA', teamName: 'Hollywood Hustlers', topPrice: 7200000, priceDelta: 200000 },
  { rank: 7, zipCode: '98039', city: 'Medina', state: 'WA', teamName: 'Emerald City Elite', topPrice: 6900000, priceDelta: -50000 },
  { rank: 8, zipCode: '07620', city: 'Alpine', state: 'NJ', teamName: 'Garden State Gladiators', topPrice: 6500000, priceDelta: 125000 },
  { rank: 9, zipCode: '06830', city: 'Greenwich', state: 'CT', teamName: 'Constitution Crushers', topPrice: 6200000, priceDelta: -75000 },
  { rank: 10, zipCode: '33480', city: 'Palm Beach', state: 'FL', teamName: 'Tropical Titans', topPrice: 5800000, priceDelta: 300000 },
  { rank: 11, zipCode: '90272', city: 'Pacific Palisades', state: 'CA', teamName: 'Coastal Kings', topPrice: 5500000, priceDelta: 0 },
  { rank: 12, zipCode: '11962', city: 'Sagaponack', state: 'NY', teamName: 'Hamptons Heroes', topPrice: 5200000, priceDelta: -180000 },
  { rank: 13, zipCode: '94028', city: 'Portola Valley', state: 'CA', teamName: 'Silicon Stallions', topPrice: 4900000, priceDelta: 90000 },
  { rank: 14, zipCode: '33701', city: 'St. Petersburg', state: 'FL', teamName: 'Sunshine Speedsters', topPrice: 4600000, priceDelta: -40000 },
  { rank: 15, zipCode: '77019', city: 'Houston', state: 'TX', teamName: 'Lone Star Legends', topPrice: 4300000, priceDelta: 60000 },
  { rank: 16, zipCode: '80424', city: 'Breckenridge', state: 'CO', teamName: 'Mountain Mavericks', topPrice: 4100000, priceDelta: 25000 },
  { rank: 17, zipCode: '84060', city: 'Park City', state: 'UT', teamName: 'Powder Panthers', topPrice: 3800000, priceDelta: -85000 },
  { rank: 18, zipCode: '29928', city: 'Hilton Head', state: 'SC', teamName: 'Lowcountry Lions', topPrice: 3500000, priceDelta: 110000 },
  { rank: 19, zipCode: '37027', city: 'Brentwood', state: 'TN', teamName: 'Music City Mustangs', topPrice: 3200000, priceDelta: 0 },
  { rank: 20, zipCode: '85253', city: 'Paradise Valley', state: 'AZ', teamName: 'Desert Diamonds', topPrice: 2900000, priceDelta: -30000 },
  { rank: 21, zipCode: '30327', city: 'Atlanta', state: 'GA', teamName: 'Peach State Ponies', topPrice: 2600000, priceDelta: 45000 },
  { rank: 22, zipCode: '63124', city: 'Ladue', state: 'MO', teamName: 'Gateway Gallop', topPrice: 2400000, priceDelta: -20000 },
  { rank: 23, zipCode: '53217', city: 'Milwaukee', state: 'WI', teamName: 'Brew City Broncos', topPrice: 2100000, priceDelta: 35000 },
  { rank: 24, zipCode: '27104', city: 'Winston-Salem', state: 'NC', teamName: 'Tobacco Road Racers', topPrice: 1800000, priceDelta: -15000 },
  { rank: 25, zipCode: '46240', city: 'Indianapolis', state: 'IN', teamName: 'Hoosier Horses', topPrice: 1500000, priceDelta: 80000 },
  { rank: 26, zipCode: '73120', city: 'Oklahoma City', state: 'OK', teamName: 'Sooner Sprinters', topPrice: 1200000, priceDelta: 0 },
  { rank: 27, zipCode: '68154', city: 'Omaha', state: 'NE', teamName: 'Cornhusker Chargers', topPrice: 900000, priceDelta: -10000 },
  { rank: 28, zipCode: '50312', city: 'Des Moines', state: 'IA', teamName: 'Hawkeye Hurdles', topPrice: 600000, priceDelta: 5000 },
  { rank: 29, zipCode: '58104', city: 'Fargo', state: 'ND', teamName: 'Prairie Pacers', topPrice: 300000, priceDelta: 12000 },
  { rank: 30, zipCode: '59718', city: 'Bozeman', state: 'MT', teamName: 'Big Sky Bolts', topPrice: 0, priceDelta: 0 },
];

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedZip, setSelectedZip] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const maxPrice = Math.max(...mockZipData.map(zip => zip.topPrice));
  const minPrice = Math.min(...mockZipData.filter(zip => zip.topPrice > 0).map(zip => zip.topPrice));

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  const handleZipClick = (zipData: any) => {
    setSelectedZip(zipData);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <LeaderboardHeader />
      <StatusBanner lastUpdate="June 17, 12:04 PM" />
      
      <div className="max-w-sm mx-auto px-4 py-4 space-y-3 pb-20">
        {mockZipData.map((zipData, index) => (
          <React.Fragment key={zipData.zipCode}>
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
              data={zipData}
              maxPrice={maxPrice}
              minPrice={minPrice}
              onClick={() => handleZipClick(zipData)}
            />
          </React.Fragment>
        ))}
      </div>

      <FloatingRefreshButton 
        onRefresh={handleRefresh} 
        isRefreshing={isRefreshing}
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

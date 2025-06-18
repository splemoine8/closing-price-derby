
import React, { useState } from 'react';
import RankBadge from './RankBadge';
import PriceDisplay from './PriceDisplay';
import PriceDelta from './PriceDelta';

const stateNames: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

interface ZipCodeData {
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
}

interface ZipCodeCardProps {
  data: ZipCodeData;
  maxPrice: number;
  minPrice: number;
  onClick: () => void;
}

const ZipCodeCard = ({ data, maxPrice, minPrice, onClick }: ZipCodeCardProps) => {
  const [animate, setAnimate] = useState(false);

  const handleClick = () => {
    setAnimate(true);
    setTimeout(() => setAnimate(false), 150);
    onClick();
  };

  // Get border styling based on rank
  const getBorderStyling = (rank: number) => {
    switch (rank) {
      case 1:
        return "border-2 border-yellow-400 bg-yellow-50"; // Gold
      case 2:
        return "border-2 border-gray-400 bg-gray-50"; // Silver
      case 3:
        return "border-2 border-amber-600 bg-amber-50"; // Bronze
      default:
        return "border border-gray-200 bg-white"; // Default
    }
  };

  return (
    <div 
      className={`rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-98 ${getBorderStyling(data.rank)}`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RankBadge rank={data.rank} />
          <div>
            <div className="font-semibold text-gray-900 text-base">
              {data.city}
            </div>
            <div className="text-xs text-gray-500 font-normal">
              {stateNames[data.state] || data.state}
            </div>
            <div className="text-xs text-blue-600 font-medium">
              {data.teamName}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <PriceDisplay 
            price={data.topPrice} 
            maxPrice={maxPrice} 
            minPrice={minPrice}
            baseline={data.baseline}
            scorePct={data.scorePct}
            multiplier={data.multiplier}
          />
          <PriceDelta delta={data.priceDelta} animate={animate} lastSoldDate={data.lastSoldDate} />
        </div>
      </div>
    </div>
  );
};

export default ZipCodeCard;

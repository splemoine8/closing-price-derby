
import React, { useState } from 'react';
import RankBadge from './RankBadge';
import PriceDisplay from './PriceDisplay';
import PriceDelta from './PriceDelta';

interface ZipCodeData {
  rank: number;
  zipCode: string;
  city: string;
  state: string;
  teamName: string;
  topPrice: number;
  priceDelta: number;
  lastSoldDate?: string;
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

  return (
    <div 
      className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer active:scale-98"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RankBadge rank={data.rank} />
          <div>
            <div className="font-semibold text-gray-900 text-base">
              {data.city} {data.state}
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
          />
          <PriceDelta delta={data.priceDelta} animate={animate} lastSoldDate={data.lastSoldDate} />
        </div>
      </div>
    </div>
  );
};

export default ZipCodeCard;

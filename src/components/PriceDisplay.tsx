
import React from 'react';

interface PriceDisplayProps {
  price: number;
  maxPrice: number;
  minPrice: number;
}

const PriceDisplay = ({ price, maxPrice, minPrice }: PriceDisplayProps) => {
  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    } else {
      return `$${price.toLocaleString()}`;
    }
  };

  const getPriceColor = (price: number, maxPrice: number, minPrice: number) => {
    if (price === 0) return 'text-gray-400';
    
    const range = maxPrice - minPrice;
    const position = (price - minPrice) / range;
    
    if (position > 0.7) return 'text-green-600';
    if (position > 0.4) return 'text-blue-600';
    return 'text-red-500';
  };

  return (
    <div className={`text-right ${getPriceColor(price, maxPrice, minPrice)}`}>
      <span className="text-lg font-semibold">
        {price === 0 ? '$0' : formatPrice(price)}
      </span>
    </div>
  );
};

export default PriceDisplay;


import React from 'react';

interface PriceDisplayProps {
  price: number;
  maxPrice: number;
  minPrice: number;
  baseline?: number;
  scorePct?: number;
  multiplier?: string;
}

const PriceDisplay = ({ price, maxPrice, minPrice, baseline, scorePct, multiplier }: PriceDisplayProps) => {
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

  // Show multiplier if available (Phase 0 testing), fallback to price
  if (multiplier && baseline) {
    return (
      <div className="text-right">
        <div className="text-xl font-bold text-green-600">
          {multiplier}
        </div>
        <div className="text-sm text-gray-500">
          {formatPrice(price)}
        </div>
      </div>
    );
  }
  
  // Fallback to existing price display
  return (
    <div className={`text-right ${getPriceColor(price, maxPrice, minPrice)}`}>
      <span className="text-lg font-semibold">
        {price === 0 ? '$0' : formatPrice(price)}
      </span>
    </div>
  );
};

export default PriceDisplay;

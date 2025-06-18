
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PriceDisplayProps {
  price: number;
  maxPrice: number;
  minPrice: number;
  baseline?: number;
  scorePct?: number;
  multiplier?: string;
  maxScorePct?: number;  // NEW: For relative color coding
  minScorePct?: number;  // NEW: For relative color coding
}

const PriceDisplay = ({ price, maxPrice, minPrice, baseline, scorePct, multiplier, maxScorePct, minScorePct }: PriceDisplayProps) => {
  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    } else {
      return `$${price.toLocaleString()}`;
    }
  };

  // Enhanced color coding based on relative performance using green gradient
  const getScoreColor = (scorePct?: number) => {
    if (!scorePct) return 'text-gray-600';
    
    // Calculate average from min/max (approximation)
    if (maxScorePct !== undefined && minScorePct !== undefined && maxScorePct > minScorePct) {
      const average = (maxScorePct + minScorePct) / 2;
      const range = maxScorePct - minScorePct;
      
      // Calculate how far above/below average this score is
      const deviationFromAvg = scorePct - average;
      const normalizedDeviation = deviationFromAvg / (range / 2); // -1 to +1 scale
      
      if (normalizedDeviation >= 0.6) return 'text-green-600';      // Well above average
      if (normalizedDeviation >= 0.2) return 'text-green-500';    // Above average  
      if (normalizedDeviation >= -0.2) return 'text-yellow-600';  // Near average
      if (normalizedDeviation >= -0.6) return 'text-orange-500';  // Below average
      return 'text-red-500';                                      // Well below average
    }
    
    // Fallback to absolute thresholds with green-to-red heatmap if no relative data
    if (scorePct >= 200) return 'text-green-600';    // Exceptional ×3.0+
    if (scorePct >= 100) return 'text-green-500';    // Great ×2.0+
    if (scorePct >= 50) return 'text-yellow-600';    // Good ×1.5+
    if (scorePct >= 0) return 'text-orange-500';     // Break-even ×1.0+
    return 'text-red-500';                           // Below baseline
  };

  const getPriceColor = (price: number, maxPrice: number, minPrice: number) => {
    if (price === 0) return 'text-gray-400';
    
    const range = maxPrice - minPrice;
    const position = (price - minPrice) / range;
    
    if (position > 0.7) return 'text-green-600';
    if (position > 0.4) return 'text-blue-600';
    return 'text-red-500';
  };

  // Generate tooltip content for score explanation
  const getTooltipContent = () => {
    if (!baseline || !scorePct) return null;
    
    return (
      <div className="text-sm">
        <div className="font-semibold mb-1">Score Breakdown</div>
        <div>Sale Price: {formatPrice(price)}</div>
        <div>Market Baseline: {formatPrice(baseline)}</div>
        <div>Performance: +{scorePct.toFixed(1)}%</div>
        <div className="mt-1 text-xs text-gray-300">
          Score = (Price - Baseline) ÷ Baseline × 100
        </div>
      </div>
    );
  };

  // Show enhanced multiplier display with tooltip
  if (multiplier && baseline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-right cursor-help">
              <div className={`text-xl font-bold ${getScoreColor(scorePct)}`}>
                {multiplier}
              </div>
              <div className="text-sm text-gray-500">
                Highest Sale: {formatPrice(price)}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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

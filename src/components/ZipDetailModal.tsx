
import React, { useState } from 'react';
import { X, Share2 } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

interface SaleData {
  address: string;
  date: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  url?: string;
}

interface PriceHistoryData {
  price: number;
  date: string;
}

interface ZipDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  city: string;
  state: string;
  topSales: SaleData[];
  priceHistory: PriceHistoryData[];
  baseline?: number;     // NEW: For score breakdown
  highestSale?: SaleData | null; // NEW: The highest sale driving the score
}

const PriceTrendChart = ({ data, width = 300, height = 75 }: { data: PriceHistoryData[], width?: number, height?: number }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number, x: number, y: number, price: number, date: string } | null>(null);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-center text-gray-500">
        <div>
          <div className="text-2xl mb-2 opacity-50">📈</div>
          <div className="text-sm">Not enough data to show trend</div>
        </div>
      </div>
    );
  }

  const prices = data.map(d => d.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  
  // Add padding so points aren't on the edge
  const yPadding = (maxPrice - minPrice) * 0.2;
  const yMax = maxPrice + yPadding;
  const yMin = Math.max(0, minPrice - yPadding);

  // Add horizontal padding to prevent circles from being cut off
  const horizontalPadding = 6; // Slightly larger than circle radius
  const chartWidth = width - (horizontalPadding * 2);
  
  // Map data points to SVG coordinates
  const points = data.map((dataPoint, index) => {
    const x = horizontalPadding + (index / (data.length - 1)) * chartWidth;
    const y = height - ((dataPoint.price - yMin) / (yMax - yMin)) * height;
    return { x, y, price: dataPoint.price, date: dataPoint.date, index };
  });

  // Generate SVG path data
  const linePathD = "M" + points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" L");
  const areaPathD = linePathD + ` L ${points[points.length - 1].x.toFixed(2)},${height} L ${points[0].x.toFixed(2)},${height} Z`;

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    } else {
      return `$${price.toLocaleString()}`;
    }
  };

  return (
    <div className="relative h-full w-full">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full" 
        preserveAspectRatio="xMidYMid meet"
        aria-labelledby="chartTitle"
      >
        <title id="chartTitle">Price Trend Chart</title>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246 / 0.3)" />
            <stop offset="100%" stopColor="rgb(59 130 246 / 0)" />
          </linearGradient>
        </defs>

        {/* Gradient Area Fill */}
        <path d={areaPathD} fill="url(#areaGradient)" />

        {/* Trend Line */}
        <path 
          d={linePathD} 
          fill="none" 
          stroke="#3B82F6" 
          strokeWidth="2" 
          strokeLinejoin="round" 
          strokeLinecap="round" 
        />

        {/* Data Points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x.toFixed(2)}
            cy={point.y.toFixed(2)}
            r={hoveredPoint?.index === i ? "5" : "4"}
            fill="white"
            stroke="#3B82F6"
            strokeWidth="2"
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={() => setHoveredPoint(point)}
            onMouseLeave={() => setHoveredPoint(null)}
            onTouchStart={() => setHoveredPoint(point)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div 
          className="absolute bg-gray-800 text-white text-xs rounded py-1 px-2 pointer-events-none z-10 transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            marginTop: '-8px'
          }}
        >
          <div className="font-medium">{formatPrice(hoveredPoint.price)}</div>
          <div className="text-gray-300">{hoveredPoint.date}</div>
        </div>
      )}
    </div>
  );
};

const ZipDetailModal = ({ 
  isOpen, 
  onClose, 
  city, 
  state, 
  topSales, 
  priceHistory,
  baseline,
  highestSale
}: ZipDetailModalProps) => {
  if (!isOpen) return null;

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `$${(price / 1000).toFixed(0)}K`;
    } else {
      return `$${price.toLocaleString()}`;
    }
  };


  const hasData = topSales.length > 0;
  
  // Use the highest sale (passed from parent) for display and scoring
  const displaySale = highestSale;

  const saleMultiple = baseline && displaySale ? 
    `×${((displaySale.price - baseline) / baseline + 1).toFixed(1)}` : 
    null;

  // Score breakdown component
  const ScoreBreakdown = () => {
    if (!baseline || !displaySale) {
      return null;
    }

    // Calculate score for the highest sale being displayed
    const actualScorePct = ((displaySale.price - baseline) / baseline) * 100;
    const actualMultiple = `×${(actualScorePct / 100 + 1).toFixed(1)}`;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Score Breakdown</h3>
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Highest Sale Price:</span>
              <span className="font-medium">{formatPrice(displaySale.price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Market Baseline:</span>
              <span className="font-medium">{formatPrice(baseline)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">Performance:</span>
              <span className="font-medium text-green-600">+{actualScorePct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Multiple:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium text-green-600 cursor-help underline decoration-dotted">
                      {actualMultiple}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-semibold mb-1">Calculation Method</div>
                      <div>Score = (Sale Price - Baseline) ÷ Baseline × 100</div>
                      <div>Multiple = Score ÷ 100 + 1</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{city}</h2>
            <p className="text-sm text-gray-500">{stateNames[state] || state}</p>
          </div>
          <div className="flex items-center gap-2">
            <WeatherWidget city={city} state={state} />
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {!hasData ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-30">🐎</div>
              <p className="text-gray-500">No closings yet — keep watching!</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Price Trend</h3>
                <div className="h-32 bg-gray-50 rounded-lg p-4">
                  <PriceTrendChart data={priceHistory} />
                </div>
              </div>

              <ScoreBreakdown />

              {displaySale && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">💸</span>
                    Highest Sale
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">{displaySale.address}</div>
                        <div className="text-sm font-medium text-blue-700 mb-1">
                          Sold: {displaySale.date}
                        </div>
                        {(displaySale.beds || displaySale.baths || displaySale.sqft) && (
                          <div className="text-xs text-blue-600 mb-2">
                            {displaySale.beds && `${displaySale.beds} bed`}{displaySale.beds && displaySale.baths && ' • '}
                            {displaySale.baths && `${displaySale.baths} bath`}{(displaySale.beds || displaySale.baths) && displaySale.sqft && ' • '}
                            {displaySale.sqft && `${displaySale.sqft.toLocaleString()} sq ft`}
                          </div>
                        )}
                        {displaySale.url && (
                          <a 
                            href={displaySale.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-700 hover:text-blue-900 font-medium hover:underline"
                          >
                            View Listing →
                          </a>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-900">
                          {formatPrice(displaySale.price)}
                        </div>
                        <div className="text-xl font-bold text-gray-500 mt-1">
                          {saleMultiple}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Sales History</h3>
                <div className="space-y-3">
                  {topSales
                    .filter(sale => !displaySale || sale.address !== displaySale.address || sale.date !== displaySale.date) // Exclude the highest sale already shown
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date, newest first
                    .slice(0, 5) // Take top 5 remaining sales
                    .map((sale, index) => {
                      // Calculate multiple for this sale
                      const saleMultiple = baseline ? 
                        `×${((sale.price - baseline) / baseline + 1).toFixed(1)}` : 
                        null;
                      
                      return (
                        <div key={index} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{sale.address}</div>
                            <div className="text-sm text-gray-500">{sale.date}</div>
                            {(sale.beds || sale.baths || sale.sqft) && (
                              <div className="text-xs text-gray-400 mt-1">
                                {sale.beds && `${sale.beds} bed`}{sale.beds && sale.baths && ' • '}
                                {sale.baths && `${sale.baths} bath`}{(sale.beds || sale.baths) && sale.sqft && ' • '}
                                {sale.sqft && `${sale.sqft.toLocaleString()} sq ft`}
                              </div>
                            )}
                            {sale.url && (
                              <a 
                                href={sale.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline mt-1 inline-block"
                              >
                                View Listing →
                              </a>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-blue-600">
                              {formatPrice(sale.price)}
                            </div>
                            {saleMultiple && (
                              <div className="font-semibold text-gray-500 mt-1">
                                {saleMultiple}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZipDetailModal;

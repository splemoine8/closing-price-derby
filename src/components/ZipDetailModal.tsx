
import React, { useState } from 'react';
import { X, Share2 } from 'lucide-react';
import WeatherWidget from './WeatherWidget';

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

interface ZipDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  zipCode: string;
  city: string;
  state: string;
  topSales: SaleData[];
  priceHistory: number[];
}

const PriceTrendChart = ({ data, width = 300, height = 75 }: { data: number[], width?: number, height?: number }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number, x: number, y: number, price: number } | null>(null);

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

  const maxPrice = Math.max(...data);
  const minPrice = Math.min(...data);
  
  // Add padding so points aren't on the edge
  const yPadding = (maxPrice - minPrice) * 0.2;
  const yMax = maxPrice + yPadding;
  const yMin = Math.max(0, minPrice - yPadding);

  // Map data points to SVG coordinates
  const points = data.map((price, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((price - yMin) / (yMax - yMin)) * height;
    return { x, y, price, index };
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
            onMouseEnter={() => setHoveredPoint({ ...point, index: i })}
            onMouseLeave={() => setHoveredPoint(null)}
            onTouchStart={() => setHoveredPoint({ ...point, index: i })}
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
          <div className="text-gray-300">Period {hoveredPoint.index + 1}</div>
        </div>
      )}
    </div>
  );
};

const ZipDetailModal = ({ 
  isOpen, 
  onClose, 
  zipCode, 
  city, 
  state, 
  topSales, 
  priceHistory 
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

  const handleShare = () => {
    navigator.clipboard.writeText(`Check out ${zipCode} on Closing-Price Derby!`);
  };

  const hasData = topSales.length > 0;
  
  // Find the most recent sale by date
  const mostRecentSale = topSales.length > 0 ? 
    topSales.reduce((latest, sale) => {
      const saleDate = new Date(sale.date);
      const latestDate = new Date(latest.date);
      return saleDate > latestDate ? sale : latest;
    }) : null;

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

              {mostRecentSale && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-lg">🏠</span>
                    Most Recent Sale
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">{mostRecentSale.address}</div>
                        <div className="text-sm font-medium text-blue-700 mb-1">
                          Sold: {mostRecentSale.date}
                        </div>
                        {(mostRecentSale.beds || mostRecentSale.baths || mostRecentSale.sqft) && (
                          <div className="text-xs text-blue-600 mb-2">
                            {mostRecentSale.beds && `${mostRecentSale.beds} bed`}{mostRecentSale.beds && mostRecentSale.baths && ' • '}
                            {mostRecentSale.baths && `${mostRecentSale.baths} bath`}{(mostRecentSale.beds || mostRecentSale.baths) && mostRecentSale.sqft && ' • '}
                            {mostRecentSale.sqft && `${mostRecentSale.sqft.toLocaleString()} sq ft`}
                          </div>
                        )}
                        {mostRecentSale.url && (
                          <a 
                            href={mostRecentSale.url} 
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
                          {formatPrice(mostRecentSale.price)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Top 5 Closings</h3>
                <div className="space-y-3">
                  {topSales.slice(0, 5).map((sale, index) => (
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
                      </div>
                    </div>
                  ))}
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

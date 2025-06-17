
import React from 'react';
import { X, Share2 } from 'lucide-react';

interface SaleData {
  address: string;
  date: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl animate-slide-in-right">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{zipCode}</h2>
            <p className="text-sm text-gray-500">{city} {state}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto">
          {!hasData ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-30">🐎</div>
              <p className="text-gray-500">No closings yet — keep watching!</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Price Trend</h3>
                <div className="h-32 bg-gray-50 rounded-lg flex items-end justify-between p-4">
                  {priceHistory.map((price, index) => {
                    const maxPrice = Math.max(...priceHistory);
                    const height = maxPrice > 0 ? (price / maxPrice) * 80 : 0;
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <div 
                          className="w-4 bg-blue-600 rounded-t"
                          style={{ height: `${height}px` }}
                        />
                        <span className="text-xs text-gray-400 mt-1">
                          {index + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

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

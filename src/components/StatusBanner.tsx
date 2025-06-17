
import React from 'react';

interface StatusBannerProps {
  lastUpdate: string;
}

const StatusBanner = ({ lastUpdate }: StatusBannerProps) => {
  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
      <p className="text-xs text-gray-500 font-normal">
        Last update • {lastUpdate}
      </p>
    </div>
  );
};

export default StatusBanner;

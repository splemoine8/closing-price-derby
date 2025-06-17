
import React from 'react';

const LeaderboardHeader = () => {
  return (
    <div className="sticky top-0 z-50 bg-gray-900 text-white px-4 py-3 flex items-center justify-center shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏇</span>
        <h1 className="text-lg font-semibold tracking-tight">Closing Price Derby</h1>
      </div>
    </div>
  );
};

export default LeaderboardHeader;

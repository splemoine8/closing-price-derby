
import React from 'react';
import { Info } from 'lucide-react';

const LeaderboardHeader = () => {
  return (
    <div className="sticky top-0 z-50 bg-gray-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏇</span>
        <h1 className="text-lg font-semibold tracking-tight">Closing-Price Derby</h1>
      </div>
      <Info className="w-4 h-4 text-gray-400 hover:text-white transition-colors cursor-pointer" />
    </div>
  );
};

export default LeaderboardHeader;

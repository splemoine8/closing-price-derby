
import React from 'react';

interface RankBadgeProps {
  rank: number;
}

const RankBadge = ({ rank }: RankBadgeProps) => {
  const getBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500 text-white'; // Gold
      case 2:
        return 'bg-gray-400 text-white'; // Silver
      case 3:
        return 'bg-amber-600 text-white'; // Bronze
      default:
        return 'bg-gray-300 text-gray-700'; // Neutral
    }
  };

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${getBadgeColor(rank)}`}>
      {rank}
    </div>
  );
};

export default RankBadge;

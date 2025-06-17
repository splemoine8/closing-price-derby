
import React from 'react';
import { RefreshCcw } from 'lucide-react';

interface FloatingRefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

const FloatingRefreshButton = ({ onRefresh, isRefreshing }: FloatingRefreshButtonProps) => {
  return (
    <button
      onClick={onRefresh}
      className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 z-40"
      disabled={isRefreshing}
    >
      <RefreshCcw 
        className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
      />
    </button>
  );
};

export default FloatingRefreshButton;

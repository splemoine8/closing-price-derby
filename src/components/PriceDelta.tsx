
import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface PriceDeltaProps {
  delta: number;
  animate?: boolean;
}

const PriceDelta = ({ delta, animate = false }: PriceDeltaProps) => {
  const formatDelta = (delta: number) => {
    const absValue = Math.abs(delta);
    if (absValue >= 1000000) {
      return `$${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `$${(absValue / 1000).toFixed(0)}K`;
    } else {
      return `$${absValue.toLocaleString()}`;
    }
  };

  const getDeltaDisplay = () => {
    if (delta > 0) {
      return {
        icon: <ArrowUp size={14} />,
        text: `↑ ${formatDelta(delta)}`,
        color: '#4CAF50'
      };
    } else if (delta < 0) {
      return {
        icon: <ArrowDown size={14} />,
        text: `↓ ${formatDelta(delta)}`,
        color: '#F44336'
      };
    } else {
      return {
        icon: null,
        text: '—',
        color: '#9E9E9E'
      };
    }
  };

  const { icon, text, color } = getDeltaDisplay();

  return (
    <div 
      className={`flex items-center gap-1 text-sm font-medium ${animate ? 'animate-[scale_150ms_ease-out]' : ''}`}
      style={{ color }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
};

export default PriceDelta;

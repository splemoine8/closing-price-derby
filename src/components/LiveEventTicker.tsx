import React, { useState, useEffect } from 'react';

interface LiveEvent {
  text: string;
  timestamp: string;
}

interface LiveEventTickerProps {
  events: LiveEvent[];
}

const LiveEventTicker = ({ events }: LiveEventTickerProps) => {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (events.length === 0) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      
      setTimeout(() => {
        setCurrentEventIndex((prev) => (prev + 1) % events.length);
        setIsAnimating(false);
      }, 200);
    }, 10000); // Much slower cycle - 10 seconds

    return () => clearInterval(interval);
  }, [events.length]);

  if (events.length === 0) return null;

  const currentEvent = events[currentEventIndex];

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm">
      <div className="max-w-sm mx-auto px-6 py-3">
        <div className={`flex items-center justify-between text-sm transition-opacity duration-200 ${isAnimating ? 'opacity-50' : 'opacity-100'}`}>
          <div className="flex-1 font-medium">
            {currentEvent.text}
          </div>
          <span className="text-xs opacity-75 whitespace-nowrap ml-3">{currentEvent.timestamp}</span>
        </div>
      </div>
    </div>
  );
};

export default LiveEventTicker;
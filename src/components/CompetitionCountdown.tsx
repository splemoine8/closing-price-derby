import React, { useEffect, useState } from 'react';
import { useCompetitionState } from '@/hooks/useCompetitionState';

export function CompetitionCountdown() {
  const { mode, timeRemaining: initialTime } = useCompetitionState();
  const [timeRemaining, setTimeRemaining] = useState(initialTime);

  useEffect(() => {
    setTimeRemaining(initialTime);
  }, [initialTime]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1000) return 0;
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Only show countdown during setup mode
  if (mode !== 'setup') return null;

  if (timeRemaining === null || timeRemaining === 0) {
    return null;
  }

  // Calculate days, hours, minutes, seconds
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  return (
    <div className="text-center space-y-1">
      <div className="text-sm text-muted-foreground">Derby begins in</div>
      <div className="font-mono text-lg font-semibold">
        {days > 0 && `${days}d `}
        {hours.toString().padStart(2, '0')}:
        {minutes.toString().padStart(2, '0')}:
        {seconds.toString().padStart(2, '0')}
      </div>
    </div>
  );
}
import React from 'react';
import { useCompetitionState } from '../hooks/useCompetitionState';
import { Trophy } from 'lucide-react';

export function CompetitionBanner() {
  const { mode } = useCompetitionState();

  // Only show banner when competition is complete
  if (mode !== 'complete') return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 border rounded-lg bg-green-500/10 text-green-600 border-green-500/20">
      <Trophy className="w-4 h-4" />
      <span className="text-sm font-medium">The results are in</span>
    </div>
  );
}
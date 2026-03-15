import { useMemo } from 'react';
import { useMatchContext } from '../context/MatchContext';

export const useOsuMatch = (matchId?: number) => {
  const context = useMatchContext();

  const match = useMemo(() => {
    if (matchId == null) {
      return context.selectedMatch;
    }
    return context.matches.find((entry) => entry.id === matchId);
  }, [context.matches, context.selectedMatch, matchId]);

  return {
    ...context,
    match,
  };
};

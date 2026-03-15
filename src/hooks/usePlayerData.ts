import { useMemo } from 'react';
import { useMatchContext } from '../context/MatchContext';

export const usePlayerData = () => {
  const { players, personalUserId, setPersonalUserId } = useMatchContext();

  const personalPlayer = useMemo(() => {
    if (personalUserId == null) {
      return undefined;
    }
    return players.find((player) => player.id === personalUserId);
  }, [personalUserId, players]);

  return {
    players,
    personalPlayer,
    personalUserId,
    setPersonalUserId,
  };
};

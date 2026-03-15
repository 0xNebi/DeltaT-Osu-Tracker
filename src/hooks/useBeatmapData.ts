import { useMatchContext } from '../context/MatchContext';

export const useBeatmapData = () => {
  const { maps } = useMatchContext();
  return { maps };
};

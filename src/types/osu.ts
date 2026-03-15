export interface OsuPlayerSummary {
  id: number;
  username: string;
  countryCode?: string | null;
  avatarUrl?: string | null;
}

export interface OsuBeatmap {
  id: number;
  beatmapsetId?: number;
  title: string;
  artist?: string | null;
  creator?: string | null;
  difficulty?: string | null;
  starRating?: number | null;
  coverUrl?: string | null;
  bpm?: number | null;
  cs?: number | null;
  ar?: number | null;
  od?: number | null;
  hp?: number | null;
  totalLength?: number | null;
  hitLength?: number | null;
  url?: string | null;
}

export interface OsuScore {
  id: number | string;
  userId: number;
  username: string;
  accuracy: number;
  score: number;
  maxCombo?: number | null;
  rank?: string | null;
  grade?: string | null;
  passed?: boolean;
  perfect?: boolean;
  mods?: string[];
  createdAt?: string | null;
  statistics?: {
    count_50?: number;
    count_100?: number;
    count_300?: number;
    count_geki?: number;
    count_katu?: number;
    count_miss?: number;
  };
}

export interface OsuGame {
  id: number;
  mode?: string | null;
  modeInt?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  scoringType?: string | null;
  teamType?: string | null;
  mods?: string[];
  beatmap?: OsuBeatmap;
  scores: OsuScore[];
}

export interface OsuMatch {
  id: number;
  name: string;
  url?: string;
  startTime?: string | null;
  endTime?: string | null;
  players: OsuPlayerSummary[];
  games: OsuGame[];
}

export interface StoredMatchEntry {
  id: number;
  url?: string;
  importedAt: string;
  match: OsuMatch;
}

export interface AggregatedPlayer {
  id: number;
  username: string;
  countryCode?: string | null;
  avatarUrl?: string | null;
  matchesPlayed: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  totalScore: number;
  bestScore: number;
  totalAccuracy: number;
  bestAccuracy: number;
  averageAccuracy: number;
  averageScore: number;
  winRate: number;
  modsUsed: Record<string, number>;
  beatmapsPlayed: Record<number, number>;
  recentMatches: Array<{ matchId: number; matchName: string; date?: string | null }>;
  lastPlayedAt?: string | null;
}

export interface AggregatedMap {
  id: number;
  title: string;
  artist?: string | null;
  difficulty?: string | null;
  beatmapsetId?: number;
  totalPlays: number;
  totalScores: number;
  players: Record<number, number>;
  averageAccuracy: number;
  bestAccuracy: number;
  bestScore: number;
  lastPlayedAt?: string | null;
  starRating?: number | null;
  coverUrl?: string | null;
}

export interface GlobalStats {
  totalMatches: number;
  totalGames: number;
  totalMaps: number;
  uniquePlayers: number;
  totalScores: number;
  averageAccuracy: number;
  averageScore: number;
  bestAccuracy: number;
  bestScore: number;
}

export interface LeaderboardEntry {
  playerId: number;
  username: string;
  countryCode?: string | null;
  avatarUrl?: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  averageAccuracy: number;
  bestAccuracy: number;
  averageScore: number;
  bestScore: number;
}

export interface Leaderboards {
  accuracy: LeaderboardEntry[];
  wins: LeaderboardEntry[];
  score: LeaderboardEntry[];
}

export interface TimelinePoint {
  key: string;
  label: string;
  date: string;
  games: number;
  accuracy: number;
  uniquePlayers: number;
}

export interface ModUsageDatum {
  mod: string;
  count: number;
}

export interface HeatmapEntry {
  date: string;
  count: number;
}

export interface RecentGameSummary {
  id: number;
  matchId: number;
  matchName: string;
  startTime?: string | null;
  beatmapTitle: string;
  beatmapId?: number;
  beatmapsetId?: number;
  difficulty?: string | null;
  topPlayer: string;
  topPlayerId?: number;
  topAccuracy: number;
  topScore: number;
  mods?: string[];
}

export interface MatchSummary {
  id: number;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  url?: string;
  games: number;
  players: number;
  winner?: string;
  winnerId?: number;
  topScore?: number;
  averageAccuracy: number;
}

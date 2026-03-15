import { format } from 'date-fns';
import type {
  AggregatedMap,
  AggregatedPlayer,
  GlobalStats,
  HeatmapEntry,
  LeaderboardEntry,
  Leaderboards,
  MatchSummary,
  ModUsageDatum,
  OsuMatch,
  RecentGameSummary,
  TimelinePoint,
} from '../types/osu';

export interface AggregationOptions {
  useAccuracyForWins?: boolean;
  excludeNonRxWins?: boolean;
}

const DEFAULT_OPTIONS: Required<AggregationOptions> = {
  useAccuracyForWins: false,
  excludeNonRxWins: false,
};

interface PlayerAccumulator extends AggregatedPlayer {
  matchIds: Set<number>;
}

interface MapAccumulator {
  id: number;
  title: string;
  artist?: string | null;
  difficulty?: string | null;
  beatmapsetId?: number;
  totalPlays: number;
  totalScores: number;
  accuracySum: number;
  bestAccuracy: number;
  bestScore: number;
  players: Record<number, number>;
  lastPlayedAt?: string | null;
  starRating?: number | null;
  coverUrl?: string | null;
}

function ensurePlayerAccumulator(
  store: Map<number, PlayerAccumulator>,
  playerId: number,
  username: string,
  countryCode?: string | null,
  avatarUrl?: string | null,
): PlayerAccumulator {
  const existing = store.get(playerId);
  if (existing) {
    if (!existing.countryCode && countryCode) {
      existing.countryCode = countryCode;
    }
    if (!existing.avatarUrl && avatarUrl) {
      existing.avatarUrl = avatarUrl;
    }
    if (existing.username !== username) {
      existing.username = username;
    }
    return existing;
  }

  const accumulator: PlayerAccumulator = {
    id: playerId,
    username,
    countryCode,
    avatarUrl,
    matchesPlayed: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    totalScore: 0,
    bestScore: 0,
    totalAccuracy: 0,
    bestAccuracy: 0,
    averageAccuracy: 0,
    averageScore: 0,
    winRate: 0,
    modsUsed: {},
    beatmapsPlayed: {},
    recentMatches: [],
    lastPlayedAt: null,
    matchIds: new Set<number>(),
  };

  store.set(playerId, accumulator);
  return accumulator;
}

function ensureMapAccumulator(store: Map<number, MapAccumulator>, beatmapInfo: MapAccumulator): MapAccumulator {
  const existing = store.get(beatmapInfo.id);
  if (existing) {
    return existing;
  }

  store.set(beatmapInfo.id, { ...beatmapInfo });
  return store.get(beatmapInfo.id)!;
}

export function aggregatePlayers(matches: OsuMatch[], options: AggregationOptions = {}): AggregatedPlayer[] {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const store = new Map<number, PlayerAccumulator>();
  const playerMeta = new Map<number, { countryCode?: string | null; avatarUrl?: string | null; username: string }>();

  matches.forEach((match) => {
    match.players.forEach((player) => {
      playerMeta.set(player.id, {
        countryCode: player.countryCode,
        avatarUrl: player.avatarUrl,
        username: player.username,
      });
    });

    const participants = new Set<number>();

    match.games.forEach((game) => {
      if (!game?.scores?.length) {
        return;
      }

      const validScores = game.scores.filter((score) => score.passed !== false);
      const scoresForWins = config.excludeNonRxWins
        ? validScores.filter((score) => (score.mods ?? []).includes('RX'))
        : validScores;

      const metricAccessor = config.useAccuracyForWins
        ? (score: typeof validScores[number]) => score.accuracy ?? 0
        : (score: typeof validScores[number]) => score.score ?? 0;

      let topMetric = 0;
      scoresForWins.forEach((score) => {
        const metric = metricAccessor(score);
        if (metric > topMetric) {
          topMetric = metric;
        }
      });

      const consideredPlayerIds = new Set<number>(scoresForWins.map((score) => score.userId));

      const winners = new Set<number>(
        scoresForWins
          .filter((score) => {
            const metric = metricAccessor(score);
            return topMetric > 0 && Math.abs(metric - topMetric) < 1e-6;
          })
          .map((score) => score.userId),
      );

      game.scores.forEach((score) => {
        const meta = playerMeta.get(score.userId);
        
        const username = meta?.username ?? score.username;
        const accumulator = ensurePlayerAccumulator(
          store,
          score.userId,
          username,
          meta?.countryCode,
          meta?.avatarUrl,
        );

        accumulator.gamesPlayed += 1;
        participants.add(score.userId);

        accumulator.totalScore += score.score ?? 0;
        accumulator.totalAccuracy += score.accuracy ?? 0;
        accumulator.bestScore = Math.max(accumulator.bestScore, score.score ?? 0);
        accumulator.bestAccuracy = Math.max(accumulator.bestAccuracy, score.accuracy ?? 0);

        const shouldTrackWinLoss = !config.excludeNonRxWins || consideredPlayerIds.has(score.userId);

        if (shouldTrackWinLoss && winners.size > 0) {
          if (winners.has(score.userId)) {
            accumulator.wins += 1;
          } else if (consideredPlayerIds.has(score.userId) || !config.excludeNonRxWins) {
            accumulator.losses += 1;
          }
        }

        if (score.mods?.length) {
          score.mods.forEach((mod) => {
            accumulator.modsUsed[mod] = (accumulator.modsUsed[mod] ?? 0) + 1;
          });
        }

        if (game.beatmap?.id) {
          accumulator.beatmapsPlayed[game.beatmap.id] =
            (accumulator.beatmapsPlayed[game.beatmap.id] ?? 0) + 1;
        }

        const lastTime = game.endTime ?? game.startTime ?? match.endTime ?? match.startTime ?? null;
        if (lastTime) {
          if (!accumulator.lastPlayedAt || new Date(lastTime) > new Date(accumulator.lastPlayedAt)) {
            accumulator.lastPlayedAt = lastTime;
          }
        }

        const hasMatchLogged = accumulator.matchIds.has(match.id);
        if (!hasMatchLogged) {
          accumulator.recentMatches.unshift({
            matchId: match.id,
            matchName: match.name,
            date: match.startTime ?? match.endTime ?? null,
          });
          accumulator.matchIds.add(match.id);
        }

        if (accumulator.recentMatches.length > 10) {
          accumulator.recentMatches.length = 10;
        }
      });
    });

    participants.forEach((playerId) => {
      const accumulator = store.get(playerId);
      if (accumulator) {
        accumulator.matchesPlayed += 1;
      }
    });
  });

  const players: AggregatedPlayer[] = [];

  store.forEach((value) => {
    if (value.gamesPlayed > 0) {
      value.averageAccuracy = value.totalAccuracy / value.gamesPlayed;
      value.averageScore = value.totalScore / value.gamesPlayed;
    } else {
      value.averageAccuracy = 0;
      value.averageScore = 0;
    }

    if (value.gamesPlayed > 0) {
      value.winRate = value.wins / value.gamesPlayed;
    } else {
      value.winRate = 0;
    }

    const { matchIds, ...rest } = value;
    players.push({ ...rest });
  });

  return players.sort((a, b) => b.averageAccuracy - a.averageAccuracy);
}

export function aggregateMaps(matches: OsuMatch[]): AggregatedMap[] {
  const store = new Map<number, MapAccumulator>();

  matches.forEach((match) => {
    match.games.forEach((game) => {
      const beatmap = game.beatmap;
      if (!beatmap?.id) {
        return;
      }

      
      if (!game.scores || game.scores.length === 0) {
        return;
      }

      const accumulator = ensureMapAccumulator(store, {
        id: beatmap.id,
        title: beatmap.title ?? 'Unknown Beatmap',
        artist: beatmap.artist ?? null,
        difficulty: beatmap.difficulty ?? null,
        beatmapsetId: beatmap.beatmapsetId,
        starRating: beatmap.starRating ?? null,
        coverUrl: beatmap.coverUrl ?? null,
        totalPlays: 0,
        totalScores: 0,
        accuracySum: 0,
        bestAccuracy: 0,
        bestScore: 0,
        players: {},
        lastPlayedAt: match.startTime ?? match.endTime ?? null,
      });

      accumulator.totalPlays += 1;
      accumulator.totalScores += game.scores?.length ?? 0;

      (game.scores ?? []).forEach((score) => {
        accumulator.accuracySum += score.accuracy ?? 0;
        accumulator.bestAccuracy = Math.max(accumulator.bestAccuracy, score.accuracy ?? 0);
        accumulator.bestScore = Math.max(accumulator.bestScore, score.score ?? 0);

        accumulator.players[score.userId] = (accumulator.players[score.userId] ?? 0) + 1;

        const lastTime = game.endTime ?? game.startTime ?? match.endTime ?? match.startTime ?? null;
        if (lastTime) {
          if (!accumulator.lastPlayedAt || new Date(lastTime) > new Date(accumulator.lastPlayedAt)) {
            accumulator.lastPlayedAt = lastTime;
          }
        }
      });
    });
  });

  return Array.from(store.values())
    .map<AggregatedMap>((value) => ({
      id: value.id,
      title: value.title,
      artist: value.artist,
      difficulty: value.difficulty,
      beatmapsetId: value.beatmapsetId,
      starRating: value.starRating,
      coverUrl: value.coverUrl,
      totalPlays: value.totalPlays,
      totalScores: value.totalScores,
      players: value.players,
      averageAccuracy: value.totalScores > 0 ? value.accuracySum / value.totalScores : 0,
      bestAccuracy: value.bestAccuracy,
      bestScore: value.bestScore,
      lastPlayedAt: value.lastPlayedAt ?? null,
    }))
    .filter((map) => map.totalScores > 0) 
    .sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''));
}

export function calculateGlobalStats(matches: OsuMatch[]): GlobalStats {
  let totalScores = 0;
  let accuracySum = 0;
  let scoreSum = 0;
  let bestAccuracy = 0;
  let bestScore = 0;
  const playerSet = new Set<number>();
  let totalGames = 0;

  matches.forEach((match) => {
    match.players.forEach((player) => playerSet.add(player.id));

    match.games.forEach((game) => {
      totalGames += 1;
      (game.scores ?? []).forEach((score) => {
        totalScores += 1;
        accuracySum += score.accuracy ?? 0;
        scoreSum += score.score ?? 0;
        bestAccuracy = Math.max(bestAccuracy, score.accuracy ?? 0);
        bestScore = Math.max(bestScore, score.score ?? 0);
      });
    });
  });

  return {
    totalMatches: matches.length,
    totalGames,
    totalMaps: totalGames,
    uniquePlayers: playerSet.size,
    totalScores,
    averageAccuracy: totalScores > 0 ? accuracySum / totalScores : 0,
    averageScore: totalScores > 0 ? scoreSum / totalScores : 0,
    bestAccuracy,
    bestScore,
  };
}

export function buildLeaderboards(players: AggregatedPlayer[]): Leaderboards {
  const byAccuracy: LeaderboardEntry[] = players
    .filter((player) => player.gamesPlayed > 0)
    .map<LeaderboardEntry>((player) => ({
      playerId: player.id,
      username: player.username,
      countryCode: player.countryCode,
      avatarUrl: player.avatarUrl,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      winRate: player.winRate,
      averageAccuracy: player.averageAccuracy,
      bestAccuracy: player.bestAccuracy,
      averageScore: player.averageScore,
      bestScore: player.bestScore,
    }))
    .sort((a, b) => {
      if (b.averageAccuracy !== a.averageAccuracy) {
        return b.averageAccuracy - a.averageAccuracy;
      }
      return b.bestAccuracy - a.bestAccuracy;
    })
    .slice(0, 50);

  const byWins: LeaderboardEntry[] = players
    .filter((player) => player.gamesPlayed > 0)
    .map<LeaderboardEntry>((player) => ({
      playerId: player.id,
      username: player.username,
      countryCode: player.countryCode,
      avatarUrl: player.avatarUrl,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      winRate: player.winRate,
      averageAccuracy: player.averageAccuracy,
      bestAccuracy: player.bestAccuracy,
      averageScore: player.averageScore,
      bestScore: player.bestScore,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      return b.averageAccuracy - a.averageAccuracy;
    })
    .slice(0, 50);

  const byScore: LeaderboardEntry[] = players
    .filter((player) => player.gamesPlayed > 0)
    .map<LeaderboardEntry>((player) => ({
      playerId: player.id,
      username: player.username,
      countryCode: player.countryCode,
      avatarUrl: player.avatarUrl,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
      winRate: player.winRate,
      averageAccuracy: player.averageAccuracy,
      bestAccuracy: player.bestAccuracy,
      averageScore: player.averageScore,
      bestScore: player.bestScore,
    }))
    .sort((a, b) => {
      if (b.averageScore !== a.averageScore) {
        return b.averageScore - a.averageScore;
      }
      return b.bestScore - a.bestScore;
    })
    .slice(0, 50);

  return {
    accuracy: byAccuracy,
    wins: byWins,
    score: byScore,
  };
}

export function buildAccuracyTimeline(matches: OsuMatch[]): TimelinePoint[] {
  return matches
    .map<TimelinePoint>((match) => {
      let totalAccuracy = 0;
      let scoreCount = 0;

      match.games.forEach((game) => {
        (game.scores ?? []).forEach((score) => {
          totalAccuracy += score.accuracy ?? 0;
          scoreCount += 1;
        });
      });

      const averageAccuracy = scoreCount > 0 ? totalAccuracy / scoreCount : 0;
      const keyDate = match.startTime ?? match.endTime ?? new Date().toISOString();
      const label = format(new Date(keyDate), 'MMM d');

      return {
        key: `${match.id}`,
        label,
        date: keyDate,
        games: match.games.length,
        accuracy: averageAccuracy,
        uniquePlayers: match.players.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildModUsage(matches: OsuMatch[]): ModUsageDatum[] {
  const counter = new Map<string, number>();

  matches.forEach((match) => {
    match.games.forEach((game) => {
      (game.scores ?? []).forEach((score) => {
        (score.mods ?? []).forEach((mod) => {
          counter.set(mod, (counter.get(mod) ?? 0) + 1);
        });
      });
    });
  });

  return Array.from(counter.entries())
    .map<ModUsageDatum>(([mod, count]) => ({ mod, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export function buildHeatmap(matches: OsuMatch[]): HeatmapEntry[] {
  const counter = new Map<string, number>();

  matches.forEach((match) => {
    const keyDate = format(new Date(match.startTime ?? match.endTime ?? Date.now()), 'yyyy-MM-dd');
    counter.set(keyDate, (counter.get(keyDate) ?? 0) + 1);
  });

  return Array.from(counter.entries())
    .map<HeatmapEntry>(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function extractRecentGames(matches: OsuMatch[]): RecentGameSummary[] {
  const games: RecentGameSummary[] = [];

  matches.forEach((match) => {
    match.games.forEach((game) => {
      if (!game.beatmap) {
        return;
      }

      
      if (!game.scores || game.scores.length === 0) {
        return;
      }

      const topScore = (game.scores ?? []).reduce<{
        userId?: number;
        username: string;
        accuracy: number;
        score: number;
        mods?: string[];
      } | null>((current, score) => {
        if (!current || (score.score ?? 0) > current.score) {
          return {
            userId: score.userId,
            username: score.username,
            accuracy: score.accuracy ?? 0,
            score: score.score ?? 0,
            mods: score.mods,
          };
        }
        return current;
      }, null);

      games.push({
        id: game.id,
        matchId: match.id,
        matchName: match.name,
        startTime: game.startTime ?? match.startTime ?? null,
        beatmapTitle: game.beatmap.title ?? 'Unknown Beatmap',
        beatmapId: game.beatmap.id,
        beatmapsetId: game.beatmap.beatmapsetId,
        difficulty: game.beatmap.difficulty ?? null,
        topPlayer: topScore?.username ?? '—',
        topPlayerId: topScore?.userId,
        topAccuracy: topScore?.accuracy ?? 0,
        topScore: topScore?.score ?? 0,
        mods: topScore?.mods,
      });
    });
  });

  return games.sort((a, b) => {
    const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
    const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
    return dateB - dateA;
  });
}

export function buildMatchSummaries(matches: OsuMatch[], options: AggregationOptions = {}): MatchSummary[] {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  return matches
    .map<MatchSummary>((match) => {
      let totalAccuracy = 0;
      let scoreCount = 0;
      let topScoreValue = 0;
      let topAccuracyValue = 0;
      let winner: string | undefined;
      let winnerId: number | undefined;

      match.games.forEach((game) => {
        (game.scores ?? []).forEach((score) => {
          totalAccuracy += score.accuracy ?? 0;
          scoreCount += 1;

          
          if (config.useAccuracyForWins) {
            if ((score.accuracy ?? 0) > topAccuracyValue) {
              topAccuracyValue = score.accuracy ?? 0;
              topScoreValue = score.score ?? 0;
              winner = score.username;
              winnerId = score.userId;
            }
          } else {
            if ((score.score ?? 0) > topScoreValue) {
              topScoreValue = score.score ?? 0;
              topAccuracyValue = score.accuracy ?? 0;
              winner = score.username;
              winnerId = score.userId;
            }
          }
        });
      });

      const averageAccuracy = scoreCount > 0 ? totalAccuracy / scoreCount : 0;

      return {
        id: match.id,
        name: match.name,
        startTime: match.startTime ?? null,
        endTime: match.endTime ?? null,
        url: match.url,
        games: match.games.length,
        players: match.players.length,
        winner,
        winnerId,
        topScore: topScoreValue,
        averageAccuracy,
      };
    })
    .sort((a, b) => {
      const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return dateB - dateA;
    });
}

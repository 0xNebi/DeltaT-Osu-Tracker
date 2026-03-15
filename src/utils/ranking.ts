



import type { OsuMatch, OsuGame } from '../types/osu';


const STD_FLOOR = 1.0; 
const BASE_K = 40.0; 
const GAMES_FOR_STABLE = 20.0; 
const MIN_RD = 30.0; 
const RD_DECAY_PER_GAME = 0.95; 
const PRIOR_WEIGHT = 10.0; 
const S_BASE = 3.0; 
const S_SCALE = 10.0; 
const MAX_LOBBY_SIZE_FOR_WEIGHT = 12.0; 



export interface PlayerRatingState {
  userId: number;
  username: string;
  rating: number; 
  RD: number; 
  games: number; 
  perModRatings: Record<string, ModRatingState>; 
  modCounts: Record<string, number>; 
  lastPlayed?: string; 
}

export interface ModRatingState {
  rating: number;
  RD: number;
  games: number;
}

export interface MatchResult {
  userId: number;
  username: string;
  z: number; 
  perf: number; 
  matchContrib: number; 
  delta: number; 
  newRating: number; 
  mod: string; 
  newModRating: number; 
}

export interface MatchProcessResult {
  mapStar: number;
  meanAcc: number;
  stdAcc: number;
  lobbySize: number;
  results: MatchResult[];
}




export function mapMultiplier(star: number): number {
  return 1.0 + (star - S_BASE) / S_SCALE;
}


export function lobbyWeight(lobbySize: number, star: number): number {
  const sizeWeight = Math.sqrt(Math.min(lobbySize, MAX_LOBBY_SIZE_FOR_WEIGHT));
  const starWeight = Math.log(1.0 + Math.max(0.0, star));
  return sizeWeight * starWeight;
}


export function squashPerf(z: number): number {
  return Math.tanh(z / 1.5);
}


export function adaptiveK(games: number, RD: number): number {
  const gamesFactor = 1.0 / (1.0 + games / GAMES_FOR_STABLE);
  const rdFactor = 1.0 + RD / 150.0;
  return BASE_K * gamesFactor * rdFactor;
}


export function initPlayerState(userId: number, username: string): PlayerRatingState {
  return {
    userId,
    username,
    rating: 1500.0,
    RD: 350.0,
    games: 0,
    perModRatings: {},
    modCounts: {},
  };
}


function getModState(player: PlayerRatingState, mod: string): ModRatingState {
  if (!player.perModRatings[mod]) {
    player.perModRatings[mod] = {
      rating: 1500.0,
      RD: 350.0,
      games: 0,
    };
  }
  return player.perModRatings[mod];
}


export function normalizeMod(mods: string[]): string {
  if (!mods || mods.length === 0) return 'NM';
  
  return mods.sort().join('+');
}


export function processGame(
  game: OsuGame,
  players: Map<number, PlayerRatingState>
): MatchProcessResult {
  const star = game.beatmap?.starRating ?? 3.0;
  const scores = game.scores ?? [];
  
  
  const rxScores = scores.filter(s => {
    const mods = s.mods || [];
    return mods.some(mod => mod.toUpperCase() === 'RX' || mod.toUpperCase() === 'RELAX');
  });
  
  if (rxScores.length === 0) {
    return {
      mapStar: star,
      meanAcc: 0,
      stdAcc: 0,
      lobbySize: 0,
      results: [],
    };
  }

  
  const accs = rxScores.map(s => s.accuracy);
  const mean = accs.reduce((sum, a) => sum + a, 0) / accs.length;
  
  
  const variance = accs.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / accs.length;
  const std = Math.max(Math.sqrt(variance), STD_FLOOR);

  const lobbySize = rxScores.length;
  const m = mapMultiplier(star);
  const w = lobbyWeight(lobbySize, star);
  
  
  const lobbyScale = lobbySize <= 2 ? 0.6 : 1.0;

  const results: MatchResult[] = [];

  for (const score of rxScores) {
    const userId = score.userId;
    const username = score.username;
    const acc = score.accuracy;
    const mod = normalizeMod(score.mods || []);

    
    if (!players.has(userId)) {
      players.set(userId, initPlayerState(userId, username));
    }
    const player = players.get(userId)!;
    
    
    if (username && !username.startsWith('User ') && player.username.startsWith('User ')) {
      player.username = username;
    };

    
    const z = (acc - mean) / std;
    const perf = squashPerf(z);
    const matchContrib = perf * m * w * lobbyScale;

    
    const K = adaptiveK(player.games, player.RD);
    const delta = K * matchContrib;
    player.rating += delta;
    player.games += 1;
    player.RD = Math.max(MIN_RD, player.RD * RD_DECAY_PER_GAME);

    
    const modState = getModState(player, mod);
    const KMod = adaptiveK(modState.games, modState.RD);
    const deltaMod = KMod * matchContrib;
    modState.rating += deltaMod;
    modState.games += 1;
    modState.RD = Math.max(MIN_RD, modState.RD * RD_DECAY_PER_GAME);
    
    
    player.modCounts[mod] = (player.modCounts[mod] || 0) + 1;
    player.lastPlayed = game.endTime || undefined;

    results.push({
      userId,
      username,
      z,
      perf,
      matchContrib,
      delta,
      newRating: player.rating,
      mod,
      newModRating: modState.rating,
    });
  }

  return {
    mapStar: star,
    meanAcc: mean,
    stdAcc: std,
    lobbySize,
    results,
  };
}


export function calculateComposite(player: PlayerRatingState): number {
  let weightedSum = player.rating * PRIOR_WEIGHT;
  let totalWeight = PRIOR_WEIGHT;

  for (const [mod, count] of Object.entries(player.modCounts)) {
    const modState = player.perModRatings[mod];
    if (modState) {
      const weight = Math.sqrt(count);
      weightedSum += modState.rating * weight;
      totalWeight += weight;
    }
  }

  return weightedSum / Math.max(1e-9, totalWeight);
}


export function buildRatings(matches: OsuMatch[]): Map<number, PlayerRatingState> {
  const players = new Map<number, PlayerRatingState>();

  
  const sortedMatches = [...matches].sort((a, b) => {
    const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
    const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
    return timeA - timeB;
  });

  for (const match of sortedMatches) {
    
    for (const player of match.players) {
      if (!players.has(player.id)) {
        players.set(player.id, initPlayerState(player.id, player.username));
      } else {
        
        const existingPlayer = players.get(player.id)!;
        if (player.username && !player.username.startsWith('User ')) {
          existingPlayer.username = player.username;
        }
      }
    }

    
    const sortedGames = [...match.games].sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB;
    });

    for (const game of sortedGames) {
      processGame(game, players);
    }
  }

  return players;
}


export function getRankings(players: Map<number, PlayerRatingState>): PlayerRatingState[] {
  const rankedPlayers = Array.from(players.values())
    .filter(p => p.games > 0)
    .map(p => ({
      ...p,
      composite: calculateComposite(p),
    }))
    .sort((a, b) => b.composite - a.composite);

  return rankedPlayers;
}



export type RankingAlgorithm = 'glicko-z' | 'performance' | 'wilson' | 'elo' | 'bayesian';

export interface AlgorithmEntry {
  userId: number;
  username: string;
  score: number;        
  scoreDisplay: string; 
  games: number;
  uncertainty?: number; 
  details?: Record<string, string | number>;
}



export function buildPerformanceRankings(matches: OsuMatch[]): AlgorithmEntry[] {
  const zSums = new Map<number, { userId: number; username: string; total: number; count: number }>();

  const sortedMatches = [...matches].sort((a, b) =>
    (a.startTime ? new Date(a.startTime).getTime() : 0) - (b.startTime ? new Date(b.startTime).getTime() : 0)
  );

  for (const match of sortedMatches) {
    for (const game of match.games) {
      const rxScores = (game.scores ?? []).filter(s =>
        (s.mods ?? []).some(m => m.toUpperCase() === 'RX' || m.toUpperCase() === 'RELAX')
      );
      if (rxScores.length < 2) continue;

      const accs = rxScores.map(s => s.accuracy);
      const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
      const std = Math.max(
        Math.sqrt(accs.reduce((s, a) => s + (a - mean) ** 2, 0) / accs.length),
        STD_FLOOR
      );

      for (const score of rxScores) {
        const z = (score.accuracy - mean) / std;
        if (!zSums.has(score.userId)) {
          zSums.set(score.userId, { userId: score.userId, username: score.username, total: 0, count: 0 });
        }
        const entry = zSums.get(score.userId)!;
        entry.total += z;
        entry.count += 1;
        if (score.username && !score.username.startsWith('User ')) entry.username = score.username;
      }
    }

    
    for (const player of match.players) {
      if (!zSums.has(player.id)) {
        zSums.set(player.id, { userId: player.id, username: player.username, total: 0, count: 0 });
      }
    }
  }

  return Array.from(zSums.values())
    .filter(e => e.count > 0)
    .map(e => ({
      userId: e.userId,
      username: e.username,
      score: e.total / e.count,
      scoreDisplay: (e.total / e.count).toFixed(3),
      games: e.count,
      details: { 'Avg Z-Score': parseFloat((e.total / e.count).toFixed(3)), 'Maps Scored': e.count },
    }))
    .sort((a, b) => b.score - a.score);
}



export function buildWilsonRankings(matches: OsuMatch[], minGames = 3): AlgorithmEntry[] {
  const stats = new Map<number, { userId: number; username: string; wins: number; games: number }>();

  for (const match of matches) {
    for (const player of match.players) {
      if (!stats.has(player.id)) {
        stats.set(player.id, { userId: player.id, username: player.username, wins: 0, games: 0 });
      }
    }

    for (const game of match.games) {
      const rxScores = (game.scores ?? []).filter(s =>
        (s.mods ?? []).some(m => m.toUpperCase() === 'RX' || m.toUpperCase() === 'RELAX')
      );
      if (rxScores.length < 2) continue;

      const sorted = [...rxScores].sort((a, b) => b.accuracy - a.accuracy);
      const winnerId = sorted[0].userId;

      for (const score of rxScores) {
        if (!stats.has(score.userId)) {
          stats.set(score.userId, { userId: score.userId, username: score.username, wins: 0, games: 0 });
        }
        const s = stats.get(score.userId)!;
        s.games += 1;
        if (score.userId === winnerId) s.wins += 1;
        if (score.username && !score.username.startsWith('User ')) s.username = score.username;
      }
    }
  }

  const Z95 = 1.645; 
  return Array.from(stats.values())
    .filter(e => e.games >= minGames)
    .map(e => {
      const n = e.games;
      const p = e.wins / n;
      const z2 = Z95 * Z95;
      const lower = (p + z2 / (2 * n) - Z95 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n);
      return {
        userId: e.userId,
        username: e.username,
        score: lower,
        scoreDisplay: `${(lower * 100).toFixed(1)}%`,
        games: e.games,
        details: {
          'Wins': e.wins,
          'Win Rate': `${((e.wins / e.games) * 100).toFixed(1)}%`,
          'Wilson Lower': `${(lower * 100).toFixed(1)}%`,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}



export function buildEloRankings(matches: OsuMatch[], startElo = 1500): AlgorithmEntry[] {
  const ratings = new Map<number, { userId: number; username: string; elo: number; games: number }>();

  const init = (userId: number, username: string) => {
    if (!ratings.has(userId)) {
      ratings.set(userId, { userId, username, elo: startElo, games: 0 });
    }
    return ratings.get(userId)!;
  };

  const sortedMatches = [...matches].sort((a, b) =>
    (a.startTime ? new Date(a.startTime).getTime() : 0) - (b.startTime ? new Date(b.startTime).getTime() : 0)
  );

  for (const match of sortedMatches) {
    for (const player of match.players) init(player.id, player.username);

    for (const game of match.games) {
      const rxScores = (game.scores ?? []).filter(s =>
        (s.mods ?? []).some(m => m.toUpperCase() === 'RX' || m.toUpperCase() === 'RELAX')
      );
      if (rxScores.length < 2) continue;

      
      const ranked = [...rxScores].sort((a, b) => b.accuracy - a.accuracy);
      const n = ranked.length;

      
      for (let i = 0; i < n; i++) {
        const player = init(ranked[i].userId, ranked[i].username);
        if (ranked[i].username && !ranked[i].username.startsWith('User ')) player.username = ranked[i].username;
        const actualScore = 1 - i / (n - 1);

        
        let expectedSum = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const opp = init(ranked[j].userId, ranked[j].username);
          expectedSum += 1 / (1 + Math.pow(10, (opp.elo - player.elo) / 400));
        }
        const expectedScore = expectedSum / (n - 1);

        const K = player.games < 20 ? 40 : player.games < 50 ? 30 : 20;
        player.elo += K * (actualScore - expectedScore);
        player.games += 1;
      }
    }
  }

  return Array.from(ratings.values())
    .filter(e => e.games > 0)
    .map(e => ({
      userId: e.userId,
      username: e.username,
      score: e.elo,
      scoreDisplay: Math.round(e.elo).toString(),
      games: e.games,
      details: { 'Elo': Math.round(e.elo), 'Games': e.games },
    }))
    .sort((a, b) => b.score - a.score);
}



export function buildBayesianRankings(matches: OsuMatch[]): AlgorithmEntry[] {
  const states = new Map<number, { userId: number; username: string; mu: number; sigma: number; games: number }>();

  const INITIAL_MU = 0;
  const INITIAL_SIGMA = 8.33;
  const MIN_SIGMA = 0.5;
  const SIGMA_DECAY = 0.92;

  const init = (userId: number, username: string) => {
    if (!states.has(userId)) {
      states.set(userId, { userId, username, mu: INITIAL_MU, sigma: INITIAL_SIGMA, games: 0 });
    }
    return states.get(userId)!;
  };

  const sortedMatches = [...matches].sort((a, b) =>
    (a.startTime ? new Date(a.startTime).getTime() : 0) - (b.startTime ? new Date(b.startTime).getTime() : 0)
  );

  for (const match of sortedMatches) {
    for (const player of match.players) init(player.id, player.username);

    for (const game of match.games) {
      const rxScores = (game.scores ?? []).filter(s =>
        (s.mods ?? []).some(m => m.toUpperCase() === 'RX' || m.toUpperCase() === 'RELAX')
      );
      if (rxScores.length < 2) continue;

      const accs = rxScores.map(s => s.accuracy);
      const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
      const std = Math.max(
        Math.sqrt(accs.reduce((s, a) => s + (a - mean) ** 2, 0) / accs.length),
        STD_FLOOR
      );

      for (const score of rxScores) {
        const state = init(score.userId, score.username);
        if (score.username && !score.username.startsWith('User ')) state.username = score.username;
        const z = (score.accuracy - mean) / std;
        
        const lr = Math.min(state.sigma * 0.3, 2.0);
        state.mu += lr * z;
        state.sigma = Math.max(MIN_SIGMA, state.sigma * SIGMA_DECAY);
        state.games += 1;
      }
    }
  }

  return Array.from(states.values())
    .filter(e => e.games > 0)
    .map(e => ({
      userId: e.userId,
      username: e.username,
      score: e.mu - 2 * e.sigma,
      scoreDisplay: (e.mu - 2 * e.sigma).toFixed(2),
      games: e.games,
      uncertainty: e.sigma,
      details: {
        'μ (Skill)': e.mu.toFixed(2),
        'σ (Uncertainty)': e.sigma.toFixed(2),
        'Display (μ−2σ)': (e.mu - 2 * e.sigma).toFixed(2),
      },
    }))
    .sort((a, b) => b.score - a.score);
}


export function runAlgorithm(algorithm: RankingAlgorithm, matches: OsuMatch[]): AlgorithmEntry[] {
  switch (algorithm) {
    case 'performance': return buildPerformanceRankings(matches);
    case 'wilson':      return buildWilsonRankings(matches);
    case 'elo':         return buildEloRankings(matches);
    case 'bayesian':    return buildBayesianRankings(matches);
    case 'glicko-z':
    default: {
      const playersMap = buildRatings(matches);
      return getRankings(playersMap).map(p => ({
        userId: p.userId,
        username: p.username,
        score: calculateComposite(p),
        scoreDisplay: Math.round(calculateComposite(p)).toString(),
        games: p.games,
        uncertainty: p.RD,
        details: {
          'Composite': Math.round(calculateComposite(p)),
          'Global Rating': Math.round(p.rating),
          'RD': Math.round(p.RD),
        },
      }));
    }
  }
}

export const ALGORITHM_META: Record<RankingAlgorithm, { label: string; desc: string; scoreName: string }> = {
  'glicko-z': {
    label: 'Glicko-Z (Current)',
    desc: 'Z-score per lobby × map difficulty × lobby size, with Glicko-style rating deviation. Rewards consistent relative performance. Higher score = more dominant vs lobby.',
    scoreName: 'Composite',
  },
  'performance': {
    label: 'Performance Score',
    desc: 'Average z-score across all games. Pure skill measurement — unaffected by play count or rating drift. Great for comparing players with very different game counts.',
    scoreName: 'Avg Z',
  },
  'wilson': {
    label: 'Wilson Win Rate',
    desc: 'Wilson confidence interval lower bound on win rate (95%). Penalizes small sample sizes — a 3/3 new player ranks below a 40/60 veteran. Min 3 games required.',
    scoreName: 'Wilson Score',
  },
  'elo': {
    label: 'Elo Rating',
    desc: 'Classic Elo with multi-player generalization. Relative expected score from head-to-head comparisons within each game. Adaptive K-factor: 40 initially, 20 for veterans.',
    scoreName: 'Elo',
  },
  'bayesian': {
    label: 'Bayesian Skill (μ−2σ)',
    desc: 'TrueSkill-inspired. Tracks a skill mean μ and uncertainty σ. Score shown is μ−2σ (conservative lower bound). New players rank low until uncertainty reduces.',
    scoreName: 'Skill Floor',
  },
};

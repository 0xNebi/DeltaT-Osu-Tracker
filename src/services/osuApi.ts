import type { OsuBeatmap, OsuGame, OsuMatch, OsuPlayerSummary, OsuScore } from '../types/osu';
import { clearStoredToken, loadStoredToken, saveStoredToken } from '../utils/dataStorage';
import { starRatingCache } from './starRatingCache';

interface OAuthResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
}

interface ApiGame {
  id: number;
  beatmap_id?: number;
  start_time: string | null;
  end_time: string | null;
  mode: string | null;
  mode_int: number | null;
  scoring_type: string | null;
  team_type: string | null;
  mods?: string[] | Array<{ acronym: string }>;
  beatmap?: {
    id: number;
    beatmapset_id?: number;
    title?: string;
    artist?: string | null;
    creator?: string | null;
    version?: string | null;
    difficulty_rating?: number | null;
    bpm?: number | null;
    ar?: number | null;
    cs?: number | null;
    od?: number | null;
    drain?: number | null;
    total_length?: number | null;
    hit_length?: number | null;
    url?: string | null;
    beatmapset?: {
      artist?: string | null;
      title?: string | null;
      covers?: Record<string, string | null | undefined>;
    };
  };
  scores?: Array<{
    id: number;
    user_id: number;
    accuracy: number;
    score: number;
    max_combo: number;
    rank: string;
    mods: string[];
    perfect: boolean;
    passed: boolean;
    created_at: string | null;
    statistics?: {
      count_50?: number;
      count_100?: number;
      count_300?: number;
      count_geki?: number;
      count_katu?: number;
      count_miss?: number;
    };
    user?: {
      username: string;
      id?: number;
    };
  }>;
}

interface ApiMatchResponse {
  match: {
    id: number;
    name: string;
    start_time: string | null;
    end_time: string | null;
  };
  users?: Array<{
    id: number;
    username: string;
    country_code?: string | null;
    avatar_url?: string | null;
  }>;
  events?: Array<{
    id: number;
    detail?: {
      type: string;
      text?: string;
    };
    timestamp: string;
    user_id?: number | null;
    game?: ApiGame;
  }>;
  games?: Array<ApiGame>;
  cursor_string?: string | null;
}

function ensureEnvVariable(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

async function requestToken(): Promise<string> {
  console.log('[osuApi] 🔑 Requesting OAuth token...');
  
  const clientId = ensureEnvVariable(import.meta.env.VITE_OSU_CLIENT_ID, 'VITE_OSU_CLIENT_ID');
  const clientSecret = ensureEnvVariable(import.meta.env.VITE_OSU_CLIENT_SECRET, 'VITE_OSU_CLIENT_SECRET');
  
  console.log('[osuApi] Client ID:', clientId);

  const cached = loadStoredToken();
  if (cached) {
    console.log('[osuApi] ✅ Using cached token (expires:', new Date(cached.expiresAt).toLocaleString(), ')');
    return cached.accessToken;
  }

  console.log('[osuApi] No cached token found, requesting new token...');
  
  const form = new URLSearchParams();
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('grant_type', 'client_credentials');
  form.set('scope', 'public');

  
  const tokenUrl = import.meta.env.DEV 
    ? '/api/osu/oauth/token'
    : 'https://osu.ppy.sh/oauth/token';

  console.log('[osuApi] Token URL:', tokenUrl);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  console.log('[osuApi] OAuth response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[osuApi] ❌ OAuth request failed:', errorText);
    clearStoredToken();
    throw new Error(`Failed to obtain osu! API token: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as OAuthResponse;
  console.log('[osuApi] ✅ Token acquired successfully, expires in', payload.expires_in, 'seconds');
  
  const expiresAt = Date.now() + payload.expires_in * 1000 - 60_000;
  saveStoredToken({ accessToken: payload.access_token, expiresAt });

  return payload.access_token;
}

function transformBeatmap(apiBeatmap: ApiGame['beatmap']): OsuBeatmap | undefined {
  if (!apiBeatmap) {
    return undefined;
  }

  
  if (!apiBeatmap.difficulty_rating) {
    console.log('[osuApi] Beatmap missing difficulty_rating:', apiBeatmap);
  }

  const cover = apiBeatmap.beatmapset?.covers?.['cover@2x'] ?? apiBeatmap.beatmapset?.covers?.cover ?? null;

  return {
    id: apiBeatmap.id,
    beatmapsetId: apiBeatmap.beatmapset_id,
    title: apiBeatmap.title ?? apiBeatmap.beatmapset?.title ?? 'Unknown',
    artist: apiBeatmap.artist ?? apiBeatmap.beatmapset?.artist ?? null,
    creator: apiBeatmap.creator ?? null,
    difficulty: apiBeatmap.version ?? null,
    starRating: apiBeatmap.difficulty_rating ?? null,
    coverUrl: cover ?? null,
    bpm: apiBeatmap.bpm ?? null,
    ar: apiBeatmap.ar ?? null,
    cs: apiBeatmap.cs ?? null,
    od: apiBeatmap.od ?? null,
    hp: apiBeatmap.drain ?? null,
    totalLength: apiBeatmap.total_length ?? null,
    hitLength: apiBeatmap.hit_length ?? null,
    url: apiBeatmap.url ?? null,
  };
}

function transformScore(apiScore: NonNullable<ApiGame['scores']>[number]): OsuScore {
  
  const accuracyPercent = apiScore.accuracy * 100;
  
  return {
    id: apiScore.id,
    userId: apiScore.user_id,
    username: apiScore.user?.username ?? `User ${apiScore.user_id}`,
    accuracy: accuracyPercent,
    score: apiScore.score,
    maxCombo: apiScore.max_combo,
    rank: apiScore.rank,
    mods: apiScore.mods,
    passed: apiScore.passed,
    perfect: apiScore.perfect,
    createdAt: apiScore.created_at ?? null,
    statistics: apiScore.statistics,
    grade: apiScore.rank,
  };
}

function transformGame(apiGame: ApiGame): OsuGame {
  
  let mods: string[] = [];
  if (Array.isArray(apiGame.mods)) {
    if (apiGame.mods.length > 0) {
      if (typeof apiGame.mods[0] === 'string') {
        mods = apiGame.mods as string[];
      } else {
        mods = (apiGame.mods as Array<{ acronym: string }>).map(mod => mod.acronym);
      }
    }
  }

  return {
    id: apiGame.id,
    startTime: apiGame.start_time,
    endTime: apiGame.end_time,
    mode: apiGame.mode,
    modeInt: apiGame.mode_int,
    scoringType: apiGame.scoring_type,
    teamType: apiGame.team_type,
    mods,
    beatmap: transformBeatmap(apiGame.beatmap),
    scores: (apiGame.scores ?? []).map(transformScore),
  };
}

function transformMatch(response: ApiMatchResponse, url?: string): OsuMatch {
  console.log('[osuApi] 🔄 Transforming match data...');
  console.log('[osuApi] Response has users?', !!response.users);
  console.log('[osuApi] Response has games?', !!response.games);
  console.log('[osuApi] Response has events?', !!response.events);
  console.log('[osuApi] Response has match?', !!response.match);
  
  
  let games: ApiGame[] = [];
  
  if (response.games && response.games.length > 0) {
    
    games = response.games;
    console.log('[osuApi] Using games array directly:', games.length);
  } else if (response.events && response.events.length > 0) {
    
    const gameMap = new Map<number, ApiGame>();
    response.events
      .filter((event: any) => event.game != null)
      .forEach((event: any) => {
        const game = event.game as ApiGame;
        
        if (!gameMap.has(game.id)) {
          gameMap.set(game.id, game);
        }
      });
    games = Array.from(gameMap.values());
    console.log('[osuApi] Extracted games from events:', games.length, '(deduplicated)');
  }

  
  const playerMap = new Map<number, OsuPlayerSummary>();
  
  
  (response.users ?? []).forEach((user) => {
    playerMap.set(user.id, {
      id: user.id,
      username: user.username,
      countryCode: user.country_code ?? null,
      avatarUrl: user.avatar_url ?? null,
    });
  });

  
  let scoresWithoutUser = 0;
  games.forEach(game => {
    (game.scores ?? []).forEach(score => {
      if (!playerMap.has(score.user_id)) {
        if (score.user?.username) {
          playerMap.set(score.user_id, {
            id: score.user_id,
            username: score.user.username,
            countryCode: null,
            avatarUrl: null,
          });
        } else {
          scoresWithoutUser++;
        }
      }
    });
  });
  
  if (scoresWithoutUser > 0) {
    console.warn(`[osuApi] ${scoresWithoutUser} scores missing user.username`);
  }

  const players = Array.from(playerMap.values());
  console.log('[osuApi] Transformed players:', players.length);
  console.log('[osuApi] Player list:', players.map(p => `${p.username} (${p.id})`).join(', '));

  return {
    id: response.match.id,
    name: response.match.name,
    startTime: response.match.start_time,
    endTime: response.match.end_time,
    url,
    players,
    games: games.map(transformGame),
  };
}

export async function fetchMatchById(matchId: number, originUrl?: string): Promise<OsuMatch> {
  console.log('[osuApi] 📥 Fetching match data for ID:', matchId);
  console.log('[osuApi] Origin URL:', originUrl);
  
  const token = await requestToken();
  console.log('[osuApi] Token obtained, making API request...');

  
  let allEvents: any[] = [];
  let allUsers = new Map<number, any>();
  let matchInfo: ApiMatchResponse['match'] | null = null;
  let cursor: number | null = null;
  let pageCount = 0;
  const maxPages = 500; 
  const delayBetweenRequests = 100; 

  do {
    pageCount++;
    
    const baseUrl = import.meta.env.DEV
      ? `/api/osu/api/v2/matches/${matchId}`
      : `https://osu.ppy.sh/api/v2/matches/${matchId}`;
    
    
    const apiUrl = cursor !== null ? `${baseUrl}?limit=100&before=${cursor}` : `${baseUrl}?limit=100`;
    console.log(`[osuApi] Fetching page ${pageCount} from:`, apiUrl);

    
    let response: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        console.log(`[osuApi] Page ${pageCount} response status:`, response.status, response.statusText);

        if (response.status === 401) {
          console.warn('[osuApi] ⚠️ Token expired (401), clearing cache and retrying...');
          clearStoredToken();
          return fetchMatchById(matchId, originUrl);
        }

        
        if (response.status === 500 && attempt < maxRetries) {
          const backoffDelay = 1000 * attempt; 
          console.warn(`[osuApi] ⚠️ Server error (500), retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[osuApi] ❌ Match fetch failed:', errorText);
          
          
          if (response.status === 500) {
            console.warn(`[osuApi] ⚠️ Server error persists after ${maxRetries} attempts, stopping pagination at page ${pageCount - 1}`);
            cursor = null;
            break;
          }
          
          throw new Error(`Failed to fetch match ${matchId}: ${response.status} ${response.statusText}`);
        }

        
        break;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const backoffDelay = 1000 * attempt;
          console.warn(`[osuApi] ⚠️ Request failed, retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries}):`, error);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    
    if (!response || !response.ok) {
      console.error('[osuApi] ❌ Failed to fetch page after all retries:', lastError);
      console.warn(`[osuApi] ⚠️ Stopping pagination at page ${pageCount - 1}, returning partial data`);
      cursor = null;
      break;
    }

    const responseText = await response.text();
    
    let payload: ApiMatchResponse;
    try {
      payload = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[osuApi] ❌ Failed to parse JSON response:', parseError);
      console.error('[osuApi] Raw response:', responseText);
      throw new Error(`Failed to parse match data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    
    if (!matchInfo) {
      matchInfo = payload.match;
      console.log('[osuApi] Match name:', payload.match?.name);
      console.log('[osuApi] Start time:', payload.match?.start_time);
    }

    
    const pageEvents = payload.events ?? [];
    allEvents.push(...pageEvents);
    console.log(`[osuApi] Page ${pageCount}: ${pageEvents.length} events (total: ${allEvents.length})`);

    
    (payload.users ?? []).forEach(user => {
      if (!allUsers.has(user.id)) {
        allUsers.set(user.id, user);
      }
    });

    
    
    if (pageEvents.length > 0 && pageEvents.length === 100) {
      
      const oldestEvent = pageEvents[pageEvents.length - 1];
      cursor = oldestEvent.id;
      console.log(`[osuApi] Next cursor (oldest event ID):`, cursor);
    } else {
      
      cursor = null;
      console.log(`[osuApi] No more pages (got ${pageEvents.length} events)`);
    }

    
    if (pageCount >= maxPages) {
      console.warn(`[osuApi] ⚠️ Reached maximum page limit (${maxPages}), stopping pagination`);
      cursor = null;
    }

    
    if (cursor !== null) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }

  } while (cursor !== null);

  console.log(`[osuApi] ✅ Fetched ${pageCount} pages with ${allEvents.length} total events`);

  
  const combinedResponse: ApiMatchResponse = {
    match: matchInfo!,
    users: Array.from(allUsers.values()),
    events: allEvents,
  };

  const transformed = transformMatch(combinedResponse, originUrl);
  console.log('[osuApi] ✅ Match transformed successfully');
  console.log('[osuApi]   - Players:', transformed.players.length);
  console.log('[osuApi]   - Games:', transformed.games.length);
  
  return transformed;
}


export async function fetchModAdjustedStarRating(
  beatmapId: number,
  mods: string[]
): Promise<number | null> {
  try {
    
    if (!mods || mods.length === 0) {
      return null;
    }

    
    const cached = starRatingCache.get(beatmapId, mods);
    if (cached !== null) {
      console.log(`[osuApi] Using cached star rating for beatmap ${beatmapId} with mods ${mods.join(',')}: ${cached}`);
      return cached;
    }

    const token = await requestToken();
    
    
    const apiUrl = import.meta.env.DEV
      ? `/api/osu/api/v2/beatmaps/${beatmapId}/attributes`
      : `https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}/attributes`;

    const payload = {
      ruleset: 'osu', 
      mods: mods.map(mod => ({ acronym: mod }))
    };

    console.log(`[osuApi] Fetching mod-adjusted SR for beatmap ${beatmapId} with mods:`, mods);
    console.log('[osuApi] Payload:', JSON.stringify(payload));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      clearStoredToken();
      
      return fetchModAdjustedStarRating(beatmapId, mods);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[osuApi] Failed to fetch mod-adjusted SR for beatmap ${beatmapId}:`, response.statusText, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`[osuApi] Mod-adjusted SR response for beatmap ${beatmapId}:`, data);
    const starRating = data?.attributes?.star_rating ?? null;
    console.log(`[osuApi] Star rating: ${starRating}`);
    
    
    if (starRating !== null) {
      starRatingCache.set(beatmapId, mods, starRating);
    }
    
    return starRating;
  } catch (error) {
    console.error(`[osuApi] Error fetching mod-adjusted SR for beatmap ${beatmapId}:`, error);
    return null;
  }
}

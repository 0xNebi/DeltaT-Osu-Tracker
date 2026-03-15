import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import sampleBundle from '../../matches.json';
import { fetchMatchById } from '../services/osuApi';
import type {
  AggregatedMap,
  AggregatedPlayer,
  GlobalStats,
  HeatmapEntry,
  Leaderboards,
  MatchSummary,
  ModUsageDatum,
  OsuMatch,
  RecentGameSummary,
  TimelinePoint,
  StoredMatchEntry,
} from '../types/osu';
import {
  aggregateMaps,
  aggregatePlayers,
  buildAccuracyTimeline,
  buildHeatmap,
  buildLeaderboards,
  buildMatchSummaries,
  buildModUsage,
  calculateGlobalStats,
  extractRecentGames,
} from '../utils/statistics';
import {
  exportMatchesBlob,
  hydrateStoredEntry,
  isUsingServerStorage,
  loadPersonalUserId,
  loadStoredMatches,
  loadTrackerSettings,
  migrateFromLocalStorage,
  saveAllMatches,
  savePersonalUserId,
  saveTrackerSettings,
  seedBundleIfNeeded,
  type TrackerSettingsStorage,
} from '../utils/dataStorage';
import { parseMatchId } from '../utils/matchParser';

interface SampleFileShape {
  matches: StoredMatchEntry[];
}

export interface TrackerSettings {
  useAccuracyForWins: boolean;
  excludeNonRxWins: boolean;
  privacyMode: boolean;
  ownerUsername: string;
  dashboardName: string;
  githubUrl: string;
  rankingAlgorithm: string;
}

interface MatchContextValue {
  matches: OsuMatch[];
  storedMatches: StoredMatchEntry[];
  selectedMatch?: OsuMatch;
  selectMatch: (matchId: number | null) => void;
  players: AggregatedPlayer[];
  maps: AggregatedMap[];
  globalStats: GlobalStats;
  leaderboards: Leaderboards;
  accuracyTimeline: TimelinePoint[];
  modUsage: ModUsageDatum[];
  heatmap: HeatmapEntry[];
  recentGames: RecentGameSummary[];
  matchSummaries: MatchSummary[];
  personalUserId: number | null;
  setPersonalUserId: (userId: number | null) => void;
  importMatch: (input: string) => Promise<void>;
  refreshMatch: (matchId: number) => Promise<void>;
  removeMatch: (matchId: number) => void;
  clearData: () => void;
  exportData: () => string;
  isLoading: boolean;
  error: string | null;
  dismissError: () => void;
  playerLookup: Record<number, AggregatedPlayer>;
  settings: TrackerSettings;
  updateSettings: (patch: Partial<TrackerSettings>) => void;
  censorName: (username: string, userId: number) => string;
  censorMatchName: (name: string, matchId: number) => string;
  censorMatchId: (matchId: number) => string;
}

const MatchContext = createContext<MatchContextValue | undefined>(undefined);

function ensureUniquePlayers(players: OsuMatch['players']): OsuMatch['players'] {
  const seen = new Set<number>();
  return players.filter((player) => {
    if (seen.has(player.id)) {
      return false;
    }
    seen.add(player.id);
    return true;
  });
}

function normalizeMatch(match: OsuMatch): OsuMatch {
  const normalizedGames = match.games.map((game) => {
    const seenScoreKeys = new Set<string>();
    const deduped = (game.scores ?? []).filter((score) => {
      const key = `${score.userId}-${score.score}-${score.accuracy}-${(score.mods ?? []).join('+')}`;
      if (seenScoreKeys.has(key)) {
        return false;
      }
      seenScoreKeys.add(key);
      return true;
    });

    deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
      ...game,
      scores: deduped,
    };
  });

  return {
    ...match,
    players: ensureUniquePlayers(match.players),
    games: normalizedGames,
  };
}

function loadSampleMatches(): StoredMatchEntry[] {
  const data = sampleBundle as SampleFileShape;
  if (!data?.matches?.length) {
    return [];
  }

  return data.matches.map((entry) => ({
    ...entry,
    match: normalizeMatch(entry.match),
  }));
}

export const MatchProvider = ({ children }: { children: ReactNode }) => {
  const [storedMatches, setStoredMatches] = useState<StoredMatchEntry[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalUserId, setPersonalUserIdState] = useState<number | null>(() => loadPersonalUserId());
  const [settings, setSettings] = useState<TrackerSettings>(() => loadTrackerSettings());

  // Set to true after initial load so the auto-save effect does not fire during init.
  const isInitialized = useRef(false);

  useEffect(() => {
    async function initStorage() {
      await migrateFromLocalStorage();

      // Try file storage (Vite server) — port-independent disk persistence.
      // Fall back to IndexedDB if the server is not available (production build).
      let stored = await loadStoredMatches();

      if (!isUsingServerStorage()) {
        // No Vite server — seed IndexedDB from the bundled matches.json if empty.
        const bundleEntries = loadSampleMatches();
        await seedBundleIfNeeded(bundleEntries);
        stored = await loadStoredMatches();
      }

      const sorted = [...stored].sort((a, b) => {
        const dateA = a.match.startTime ? new Date(a.match.startTime).getTime() : 0;
        const dateB = b.match.startTime ? new Date(b.match.startTime).getTime() : 0;
        return dateB - dateA;
      });
      setStoredMatches(sorted.map((entry) => ({ ...entry, match: normalizeMatch(entry.match) })));
      isInitialized.current = true;
    }
    void initStorage();
  }, []);

  // Auto-persist whenever the match list changes (import, refresh, remove, clear).
  useEffect(() => {
    if (!isInitialized.current) return;
    void saveAllMatches(storedMatches);
  }, [storedMatches]);

  const matches = useMemo(() => storedMatches.map((entry) => entry.match), [storedMatches]);

  const selectedMatch = useMemo(() => {
    if (selectedMatchId == null) {
      return undefined;
    }
    return matches.find((match) => match.id === selectedMatchId);
  }, [matches, selectedMatchId]);

  const players = useMemo(() => aggregatePlayers(matches, settings), [matches, settings]);
  const maps = useMemo(() => aggregateMaps(matches), [matches]);
  const globalStats = useMemo(() => calculateGlobalStats(matches), [matches]);
  const leaderboards = useMemo(() => buildLeaderboards(players), [players]);
  const accuracyTimeline = useMemo(() => buildAccuracyTimeline(matches), [matches]);
  const modUsage = useMemo(() => buildModUsage(matches), [matches]);
  const heatmap = useMemo(() => buildHeatmap(matches), [matches]);
  const recentGames = useMemo(() => extractRecentGames(matches), [matches]);
  const matchSummaries = useMemo(() => buildMatchSummaries(matches, settings), [matches, settings]);
  const playerLookup = useMemo(() => {
    const lookup: Record<number, AggregatedPlayer> = {};
    players.forEach((player) => {
      lookup[player.id] = player;
    });
    return lookup;
  }, [players]);

  const updateSettings = (patch: Partial<TrackerSettings>) => {
    setSettings((prev) => {
      const next: TrackerSettings = { ...prev, ...patch };
      const storagePayload: TrackerSettingsStorage = {
        useAccuracyForWins: next.useAccuracyForWins,
        excludeNonRxWins: next.excludeNonRxWins,
        privacyMode: next.privacyMode,
        ownerUsername: next.ownerUsername,
        dashboardName: next.dashboardName,
        githubUrl: next.githubUrl,
        rankingAlgorithm: next.rankingAlgorithm,
      };
      saveTrackerSettings(storagePayload);
      return next;
    });
  };

  
  const playerNumberMap = useMemo(() => {
    const sorted = [...players].sort((a, b) => a.id - b.id);
    const map = new Map<number, number>();
    sorted.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [players]);

  
  const matchNumberMap = useMemo(() => {
    const sorted = [...matches].sort((a, b) => a.id - b.id);
    const map = new Map<number, number>();
    sorted.forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }, [matches]);

  const censorName = (username: string, userId: number): string => {
    if (!settings.privacyMode) return username;
    const num = playerNumberMap.get(userId) ?? userId;
    return `Player #${num}`;
  };

  const censorMatchName = (name: string, matchId: number): string => {
    if (!settings.privacyMode) return name;
    const num = matchNumberMap.get(matchId) ?? matchId;
    return `Room #${num}`;
  };

  const censorMatchId = (matchId: number): string => {
    if (!settings.privacyMode) return String(matchId);
    const num = matchNumberMap.get(matchId) ?? matchId;
    return `#${num}`;
  };

  const importMatch = async (input: string) => {
    console.log('[MatchContext] 📤 Import match requested with input:', input);
    
    const parsedId = parseMatchId(input);
    console.log('[MatchContext] Parsed match ID:', parsedId);
    
    if (!parsedId) {
      console.error('[MatchContext] ❌ Invalid match ID format');
      setError('Please provide a valid osu! match link or ID.');
      return;
    }

    if (storedMatches.some((entry) => entry.id === parsedId)) {
      console.log('[MatchContext] ℹ️ Match already exists, selecting it');
      setSelectedMatchId(parsedId);
      return;
    }

    console.log('[MatchContext] 🔄 Starting import process...');
    setIsLoading(true);
    setError(null);

    try {
      const matchUrl = input.startsWith('http') ? input : `https://osu.ppy.sh/community/matches/${parsedId}`;
      console.log('[MatchContext] Constructed match URL:', matchUrl);
      
      console.log('[MatchContext] Fetching match from API...');
      const fetchedMatch = await fetchMatchById(parsedId, matchUrl);
      
      console.log('[MatchContext] Normalizing match data...');
      const match = normalizeMatch(fetchedMatch);
      
      console.log('[MatchContext] Creating storage entry...');
      const entry = hydrateStoredEntry(match, matchUrl);

      setStoredMatches((prev) => {
        console.log('[MatchContext] Current matches count:', prev.length);
        const next = [...prev, entry].sort((a, b) => {
          const dateA = a.match.startTime ? new Date(a.match.startTime).getTime() : 0;
          const dateB = b.match.startTime ? new Date(b.match.startTime).getTime() : 0;
          return dateB - dateA;
        });
        console.log('[MatchContext] New matches count:', next.length);
        return next;
      });

      setSelectedMatchId(parsedId);
      console.log('[MatchContext] ✅ Import complete! Match ID:', parsedId);
    } catch (apiError) {
      console.error('[MatchContext] ❌ Import failed:', apiError);
      const message = apiError instanceof Error ? apiError.message : 'Something went wrong while fetching the match.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMatch = async (matchId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const existing = storedMatches.find((entry) => entry.id === matchId);
      if (!existing) {
        await importMatch(String(matchId));
        return;
      }

      const match = normalizeMatch(await fetchMatchById(matchId, existing.url));
      const updatedEntry = hydrateStoredEntry(match, existing.url);

      setStoredMatches((prev) => prev.map((entry) => (entry.id === matchId ? updatedEntry : entry)));
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : 'Unable to refresh match at this time.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const removeMatch = (matchId: number) => {
    setStoredMatches((prev) => prev.filter((entry) => entry.id !== matchId));
    if (selectedMatchId === matchId) {
      setSelectedMatchId(null);
    }
  };

  const clearData = () => {
    setStoredMatches([]);
    setSelectedMatchId(null);
  };

  const exportData = () => exportMatchesBlob(storedMatches);

  const setPersonalUserId = (userId: number | null) => {
    setPersonalUserIdState(userId);
    savePersonalUserId(userId);
  };

  const dismissError = () => setError(null);

  useEffect(() => {
    if (storedMatches.length && selectedMatchId == null) {
      setSelectedMatchId(storedMatches[0].id);
    }
  }, [storedMatches, selectedMatchId]);

  const value: MatchContextValue = {
    matches,
    storedMatches,
    selectedMatch,
    selectMatch: setSelectedMatchId,
    players,
    maps,
    globalStats,
    leaderboards,
    accuracyTimeline,
    modUsage,
    heatmap,
    recentGames,
    matchSummaries,
    personalUserId,
    setPersonalUserId,
    importMatch,
    refreshMatch,
    removeMatch,
    clearData,
    exportData,
    isLoading,
    error,
    dismissError,
    playerLookup,
    settings,
    updateSettings,
    censorName,
    censorMatchName,
    censorMatchId,
  };

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
};

export const useMatchContext = () => {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatchContext must be used within a MatchProvider');
  }
  return context;
};

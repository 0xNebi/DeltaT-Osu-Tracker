

interface StarRatingCacheEntry {
  starRating: number;
  timestamp: number;
}

class StarRatingCache {
  private cache: Map<string, StarRatingCacheEntry> = new Map();
  private readonly CACHE_DURATION = 1000 * 60 * 60; 

  
  private generateKey(beatmapId: number, mods: string[]): string {
    const sortedMods = [...mods].sort().join(',');
    return `${beatmapId}:${sortedMods}`;
  }

  
  get(beatmapId: number, mods: string[]): number | null {
    if (!mods || mods.length === 0) return null;
    
    const key = this.generateKey(beatmapId, mods);
    const entry = this.cache.get(key);

    if (!entry) return null;

    
    if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.starRating;
  }

  
  set(beatmapId: number, mods: string[], starRating: number): void {
    if (!mods || mods.length === 0 || !starRating) return;
    
    const key = this.generateKey(beatmapId, mods);
    this.cache.set(key, {
      starRating,
      timestamp: Date.now(),
    });
  }

  
  clear(): void {
    this.cache.clear();
  }

  
  getStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }
}


export const starRatingCache = new StarRatingCache();

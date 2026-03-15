

class AudioPlayerService {
  private audio: HTMLAudioElement | null = null;
  private currentBeatmapsetId: number | null = null;
  private listeners: Set<(isPlaying: boolean, beatmapsetId: number | null) => void> = new Set();

  constructor() {
    
    this.audio = new Audio();
    this.audio.volume = 0.5;
    
    
    this.audio.addEventListener('ended', () => {
      this.notifyListeners(false, this.currentBeatmapsetId);
    });
    
    this.audio.addEventListener('pause', () => {
      this.notifyListeners(false, this.currentBeatmapsetId);
    });
    
    this.audio.addEventListener('play', () => {
      this.notifyListeners(true, this.currentBeatmapsetId);
    });
  }

  
  subscribe(callback: (isPlaying: boolean, beatmapsetId: number | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  
  private notifyListeners(isPlaying: boolean, beatmapsetId: number | null) {
    this.listeners.forEach(callback => callback(isPlaying, beatmapsetId));
  }

  
  private getPreviewUrl(beatmapsetId: number): string {
    return `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;
  }

  
  async toggle(beatmapsetId: number): Promise<void> {
    if (!this.audio) return;

    
    if (this.currentBeatmapsetId === beatmapsetId && !this.audio.paused) {
      this.audio.pause();
      return;
    }

    
    const previewUrl = this.getPreviewUrl(beatmapsetId);
    
    
    if (!this.audio.paused) {
      this.audio.pause();
    }

    
    this.audio.src = previewUrl;
    this.currentBeatmapsetId = beatmapsetId;
    
    try {
      await this.audio.play();
    } catch (error) {
      console.error('[AudioPlayer] Failed to play preview:', error);
      this.notifyListeners(false, null);
    }
  }

  
  stop(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.currentBeatmapsetId = null;
  }

  
  isPlaying(beatmapsetId: number): boolean {
    return this.currentBeatmapsetId === beatmapsetId && 
           this.audio !== null && 
           !this.audio.paused;
  }

  
  getState(): { isPlaying: boolean; beatmapsetId: number | null } {
    return {
      isPlaying: this.audio !== null && !this.audio.paused,
      beatmapsetId: this.currentBeatmapsetId,
    };
  }

  
  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }
}


export const audioPlayer = new AudioPlayerService();

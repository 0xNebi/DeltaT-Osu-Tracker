import { useState, useEffect, useRef } from 'react';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMusic } from 'react-icons/fi';
import { audioPlayer } from '../services/audioPlayer';

interface MediaPlayerProps {
  isCollapsed?: boolean;
}

const MediaPlayer = ({ isCollapsed = false }: MediaPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentBeatmapsetId, setCurrentBeatmapsetId] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe((playing, beatmapsetId) => {
      setIsPlaying(playing);
      setCurrentBeatmapsetId(beatmapsetId);
      
      if (!playing) {
        setCurrentTime(0);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  
  useEffect(() => {
    if (isPlaying) {
      const audio = (audioPlayer as any).audio as HTMLAudioElement;
      
      
      if (audio && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }

      
      intervalRef.current = window.setInterval(() => {
        if (audio) {
          setCurrentTime(audio.currentTime);
          if (!isNaN(audio.duration)) {
            setDuration(audio.duration);
          }
        }
      }, 100);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isPlaying]);

  
  useEffect(() => {
    audioPlayer.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (currentBeatmapsetId) {
      audioPlayer.toggle(currentBeatmapsetId);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = (audioPlayer as any).audio as HTMLAudioElement;
    if (audio) {
      const newTime = parseFloat(e.target.value);
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!currentBeatmapsetId) {
    return null;
  }

  if (isCollapsed) {
    
    return (
      <div className="p-2 border-t border-white/10">
        <button
          onClick={handlePlayPause}
          className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <FiPause size={18} /> : <FiPlay size={18} />}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 p-3 space-y-2.5 bg-gradient-to-b from-white/[0.02] to-transparent">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
          <FiMusic size={14} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">Now Playing</p>
          <p className="text-[10px] text-zinc-500 truncate">osu! Preview</p>
        </div>
      </div>

      
      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer 
                     [&::-webkit-slider-thumb]:appearance-none 
                     [&::-webkit-slider-thumb]:w-3 
                     [&::-webkit-slider-thumb]:h-3 
                     [&::-webkit-slider-thumb]:rounded-full 
                     [&::-webkit-slider-thumb]:bg-gradient-to-r 
                     [&::-webkit-slider-thumb]:from-cyan-400 
                     [&::-webkit-slider-thumb]:to-cyan-500
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:shadow-lg
                     [&::-webkit-slider-thumb]:shadow-cyan-500/50
                     [&::-webkit-slider-thumb]:transition-all
                     hover:[&::-webkit-slider-thumb]:scale-110
                     [&::-moz-range-thumb]:w-3 
                     [&::-moz-range-thumb]:h-3 
                     [&::-moz-range-thumb]:rounded-full 
                     [&::-moz-range-thumb]:bg-gradient-to-r 
                     [&::-moz-range-thumb]:from-cyan-400 
                     [&::-moz-range-thumb]:to-cyan-500
                     [&::-moz-range-thumb]:border-0 
                     [&::-moz-range-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:shadow-lg
                     [&::-moz-range-thumb]:shadow-cyan-500/50"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      
      <div className="flex items-center gap-2">
        
        <button
          onClick={handlePlayPause}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/20 transition-all hover:scale-105"
        >
          {isPlaying ? <FiPause size={16} /> : <FiPlay size={16} className="ml-0.5" />}
        </button>

        
        <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-white/5 rounded-lg px-2 py-1.5 border border-white/10">
          <button
            onClick={toggleMute}
            className="flex-shrink-0 text-zinc-400 hover:text-cyan-400 transition-colors"
          >
            {isMuted || volume === 0 ? <FiVolumeX size={13} /> : <FiVolume2 size={13} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="flex-1 min-w-0 h-1 bg-white/10 rounded-full appearance-none cursor-pointer 
                       [&::-webkit-slider-thumb]:appearance-none 
                       [&::-webkit-slider-thumb]:w-2.5 
                       [&::-webkit-slider-thumb]:h-2.5 
                       [&::-webkit-slider-thumb]:rounded-full 
                       [&::-webkit-slider-thumb]:bg-cyan-400 
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:transition-all
                       hover:[&::-webkit-slider-thumb]:scale-110
                       [&::-moz-range-thumb]:w-2.5 
                       [&::-moz-range-thumb]:h-2.5 
                       [&::-moz-range-thumb]:rounded-full 
                       [&::-moz-range-thumb]:bg-cyan-400 
                       [&::-moz-range-thumb]:border-0 
                       [&::-moz-range-thumb]:cursor-pointer"
          />
          <span className="flex-shrink-0 text-[10px] text-zinc-400 font-medium tabular-nums">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;

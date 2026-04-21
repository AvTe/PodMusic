import { create } from 'zustand';
import { AudioTrack } from '@/types/audio';

interface PlayerState {
  tracks: AudioTrack[];
  playlistThumbnail: string;
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  backgroundVolume: number;
  playbackRate: number; // For pitch/speed
  isBackgroundPlaying: boolean;
  ambientYoutubeUrl: string;
  setTracks: (tracks: AudioTrack[]) => void;
  setPlaylistThumbnail: (url: string) => void;
  setCurrentTrackIndex: (index: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setBackgroundVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsBackgroundPlaying: (isPlaying: boolean) => void;
  setAmbientYoutubeUrl: (url: string) => void;
  nextTrack: () => void;
  prevTrack: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  tracks: [],
  playlistThumbnail: '',
  currentTrackIndex: 0,
  isPlaying: false,
  volume: 1,
  backgroundVolume: 0.5,
  playbackRate: 1,
  isBackgroundPlaying: false,
  ambientYoutubeUrl: 'https://www.youtube.com/watch?v=1zxO2oA9Pww', // Default rain sounds
  setTracks: (tracks) => set({ tracks }),
  setPlaylistThumbnail: (playlistThumbnail) => set({ playlistThumbnail }),
  setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setBackgroundVolume: (backgroundVolume) => set({ backgroundVolume }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setIsBackgroundPlaying: (isBackgroundPlaying) => set({ isBackgroundPlaying }),
  setAmbientYoutubeUrl: (ambientYoutubeUrl) => set({ ambientYoutubeUrl }),
  nextTrack: () =>
    set((state) => ({
      currentTrackIndex: Math.min(state.currentTrackIndex + 1, state.tracks.length - 1),
    })),
  prevTrack: () =>
    set((state) => ({
      currentTrackIndex: Math.max(state.currentTrackIndex - 1, 0),
    })),
}));

'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Play, Pause, SkipBack, SkipForward, Link as LinkIcon, Loader2, Music, Search, X, Moon } from 'lucide-react';
import { cachePlaylist, getCachedPlaylist, saveTrackCompletion, getPlaylistCompletions, type TrackCompletion } from '@/lib/db';
import { usePlaybackPersistence } from '@/hooks/usePlaybackPersistence';

/**
 * YTAmbientPlayer — native YouTube iframe + postMessage control.
 * Avoids react-player entirely (it falls back to <video> in production Turbopack builds
 * because the YouTube sub-module dynamic import never resolves).
 */
function YTAmbientPlayer({
  videoId, playing, volume,
}: { videoId: string; playing: boolean; volume: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  // Always hold the latest values so onLoad can read them without stale closure
  const latestRef = useRef({ playing, volume });
  latestRef.current = { playing, volume };

  const post = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*'
    );
  };

  const handleLoad = () => {
    readyRef.current = true;
    post('setVolume', [Math.round(latestRef.current.volume * 100)]);
    if (latestRef.current.playing) post('playVideo');
  };

  // Play / pause after ready
  useEffect(() => {
    if (!readyRef.current) return;
    playing ? post('playVideo') : post('pauseVideo');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Volume after ready
  useEffect(() => {
    if (!readyRef.current) return;
    post('setVolume', [Math.round(volume * 100)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  if (!videoId) return null;

  return (
    <iframe
      key={videoId}
      ref={iframeRef}
      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=0&loop=1&playlist=${videoId}&mute=0`}
      allow="autoplay; encrypted-media"
      onLoad={handleLoad}
      title="Ambient background music"
      style={{
        position: 'fixed', bottom: '-2px', left: '-2px',
        width: '2px', height: '2px',
        opacity: 0, border: 'none', pointerEvents: 'none',
      }}
    />
  );
}

export default function Home() {
  const [url, setUrl] = useState('https://oshoworld.com/maha-geeta-by-osho-01-91');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagesScraped, setPagesScraped] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');  // canonical key for DB
  const [cacheHit, setCacheHit] = useState(false);
  // ── YouTube-style per-track completion bars ────────────────────────────────
  const [trackProgress, setTrackProgress] = useState<Record<number, TrackCompletion>>({});
  const saveCompletionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sleepTimer, setSleepTimer] = useState<'off' | '15' | '30' | '60' | 'end'>('off');
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVolumeRef = useRef(1);
  const activeTrackRef = useRef<HTMLButtonElement>(null);
  // ── Seek bar drag ──────────────────────────────────────────────────────────
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  // ── Autoplay countdown toast ───────────────────────────────────────────────
  const [autoplayToast, setAutoplayToast] = useState<{ title: string; secondsLeft: number } | null>(null);
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayCancelRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    tracks,
    playlistThumbnail,
    currentTrackIndex,
    isPlaying,
    volume,
    backgroundVolume,
    isBackgroundPlaying,
    ambientYoutubeUrl,
    setTracks,
    setPlaylistThumbnail,
    setCurrentTrackIndex,
    setIsPlaying,
    setVolume,
    setBackgroundVolume,
    playbackRate,
    setPlaybackRate,
    setIsBackgroundPlaying,
    setAmbientYoutubeUrl,
    nextTrack,
    prevTrack,
  } = usePlayerStore();

  const currentTrack = tracks[currentTrackIndex];

  const [ytInput, setYtInput] = useState(ambientYoutubeUrl);
  const [mounted, setMounted] = useState(false);
  const [showSearch, setShowSearch] = useState(!tracks.length);

  useEffect(() => {
    setMounted(true);
    // Register Service Worker for audio caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* non-critical */ });
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);

  // ── Scroll active track into view ────────────────────────────────────────
  useEffect(() => {
    activeTrackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentTrackIndex]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); setIsPlaying(!isPlaying); break;
        case 'ArrowRight': e.preventDefault(); if (audioRef.current) audioRef.current.currentTime += 10; break;
        case 'ArrowLeft': e.preventDefault(); if (audioRef.current) audioRef.current.currentTime -= 10; break;
        case 'KeyN': nextTrack(); break;
        case 'KeyP': prevTrack(); break;
        case 'KeyM':
          if (volume > 0) { prevVolumeRef.current = volume; setVolume(0); }
          else setVolume(prevVolumeRef.current || 1);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, volume, nextTrack, prevTrack, setIsPlaying, setVolume]);

  // ── Sleep timer ──────────────────────────────────────────────────────────
  const handleSleepTimer = (opt: typeof sleepTimer) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    setSleepTimer(opt);
    if (opt === 'off' || opt === 'end') return;
    sleepTimerRef.current = setTimeout(() => {
      setIsPlaying(false); setSleepTimer('off');
    }, parseInt(opt) * 60_000);
  };

  useEffect(() => {
    if (audioRef.current && isPlaying && currentTrack) {
      audioRef.current.play().catch(e => console.error("Audio error", e));
    } else if (audioRef.current && !isPlaying) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrackIndex, currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    }
  }, [currentTrack]);

  // ── Drag-seek global listeners ─────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !seekBarRef.current || !duration) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (audioRef.current) audioRef.current.currentTime = pct * duration;
      setCurrentTime(pct * duration);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [duration]);

  // ── Autoplay next track countdown ─────────────────────────────────────────
  const cancelAutoplay = useCallback(() => {
    autoplayCancelRef.current = true;
    if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    setAutoplayToast(null);
    setIsPlaying(false);
  }, [setIsPlaying]);

  const triggerAutoplay = useCallback(() => {
    if (sleepTimer === 'end') { setIsPlaying(false); setSleepTimer('off'); return; }
    // Get fresh state via the store directly
    const { tracks: t, currentTrackIndex: idx } = usePlayerStore.getState();
    if (idx >= t.length - 1) { setIsPlaying(false); return; }
    const nextTitle = t[idx + 1]?.title ?? 'Next Track';
    autoplayCancelRef.current = false;
    let secs = 5;
    setAutoplayToast({ title: nextTitle, secondsLeft: secs });
    autoplayTimerRef.current = setInterval(() => {
      if (autoplayCancelRef.current) { clearInterval(autoplayTimerRef.current!); setAutoplayToast(null); return; }
      secs -= 1;
      if (secs <= 0) {
        clearInterval(autoplayTimerRef.current!);
        setAutoplayToast(null);
        usePlayerStore.getState().nextTrack();
        setIsPlaying(true);
      } else {
        setAutoplayToast({ title: nextTitle, secondsLeft: secs });
      }
    }, 1000);
  }, [sleepTimer, setSleepTimer, setIsPlaying]);

  // ── Playback persistence (save every 5 s, restore on load) ────────────────
  const handleRestore = useCallback((p: import('@/lib/db').PlaybackProgress) => {
    setCurrentTrackIndex(p.trackIndex);
    // Seek after a short delay to ensure audio element is ready
    setTimeout(() => {
      if (audioRef.current) audioRef.current.currentTime = p.currentTime;
    }, 400);
  }, [setCurrentTrackIndex]);

  usePlaybackPersistence({
    playlistUrl,
    trackIndex: currentTrackIndex,
    audioRef,
    onRestore: handleRestore,
  });

  // ── Track completion: save progress like YouTube's red bar ────────────────
  useEffect(() => {
    if (!playlistUrl || !duration || duration < 1) return;
    const pct = Math.min(100, (currentTime / duration) * 100);
    // Debounce — write to IndexedDB at most once every 3 seconds
    if (saveCompletionTimerRef.current) clearTimeout(saveCompletionTimerRef.current);
    saveCompletionTimerRef.current = setTimeout(() => {
      const entry: TrackCompletion = {
        id:          `${playlistUrl}::${currentTrackIndex}`,
        playlistUrl,
        trackIndex:  currentTrackIndex,
        percentage:  pct,
        completed:   pct >= 95,
        savedAt:     Date.now(),
      };
      saveTrackCompletion(entry).catch(() => {});
      setTrackProgress(prev => ({ ...prev, [currentTrackIndex]: entry }));
    }, 3000);
    return () => { if (saveCompletionTimerRef.current) clearTimeout(saveCompletionTimerRef.current); };
  }, [currentTime, duration, playlistUrl, currentTrackIndex]);

  // ── Track completion: load stored bars when playlist changes ─────────────
  useEffect(() => {
    if (!playlistUrl) return;
    getPlaylistCompletions(playlistUrl)
      .then(map => setTrackProgress(map))
      .catch(() => {});
  }, [playlistUrl]);

  const fetchTracks = async () => {
    setLoading(true);
    setError('');
    setPagesScraped(0);
    setCacheHit(false);
    setShowSearch(false); // Close modal immediately — show skeleton in main area

    // ── Check IndexedDB cache first ──────────────────────────────────────────
    try {
      const cached = await getCachedPlaylist(url);
      if (cached) {
        setTracks(cached.tracks as import('@/types/audio').AudioTrack[]);
        if (cached.thumbnail) setPlaylistThumbnail(cached.thumbnail);
        setCurrentTrackIndex(0);
        setIsPlaying(false);
        setPlaylistUrl(url);
        setCacheHit(true);
        setShowSearch(false);
        setLoading(false);
        return;
      }
    } catch { /* fall through to network */ }

    // ── Network scrape ────────────────────────────────────────────────────────
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setShowSearch(true); // reopen modal to show error
      } else if (data.tracks?.length > 0) {
        setTracks(data.tracks);
        if (data.thumbnail) setPlaylistThumbnail(data.thumbnail);
        setCurrentTrackIndex(0);
        setIsPlaying(false);
        setPagesScraped(data.pagesScraped ?? 1);
        setPlaylistUrl(url);
        setShowSearch(false);
        // Persist to IndexedDB so next load is instant
        cachePlaylist({
          url,
          tracks: data.tracks,
          thumbnail: data.thumbnail ?? null,
          cachedAt: Date.now(),
        }).catch(() => {/* best-effort */ });
      } else {
        setError('No tracks found on this URL.');
        setShowSearch(true);
      }
    } catch {
      setError('Failed to fetch data.');
      setShowSearch(true);
    }
    setLoading(false);
  };


  // Filtered playlist (preserves original index for playback)
  const filteredTracks = useMemo(() =>
    filterQuery
      ? tracks.map((t, i) => ({ ...t, _i: i })).filter(t =>
        t.title.toLowerCase().includes(filterQuery.toLowerCase()))
      : tracks.map((t, i) => ({ ...t, _i: i }))
    , [tracks, filterQuery]);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  const ytId = getYoutubeId(ambientYoutubeUrl);
  // mqdefault is more universally available than hqdefault (which 404s on some videos)
  const ytThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  };

  const handleSeekBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current) audioRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const handleSeekBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  };


  return (
    <main className="h-[100dvh] w-full bg-[#09090b] text-gray-200 font-sans overflow-hidden flex flex-col relative">
      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col flex-1 min-h-0">

        <header className="mb-6 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">PodMixer</h1>
            <p className="text-gray-400 text-xs md:text-sm">Extract audio & mix ambient sounds</p>
          </div>
          <button
            onClick={() => setShowSearch(true)}
            className="w-10 h-10 rounded-full bg-[#18181b] hover:bg-[#27272a] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#818CF8]/50"
          >
            <Search className="w-5 h-5" />
          </button>
        </header>

        {showSearch && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-[#121214] w-full max-w-lg p-6 sm:p-8 rounded-2xl border border-white/10 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => { if (tracks.length > 0) setShowSearch(false); }}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                {tracks.length > 0 && <X className="w-5 h-5" />}
              </button>
              <h3 className="text-xl font-bold text-white mb-4">Load URL</h3>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <input
                    type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste audiobook URL (e.g. Oshoworld)"
                    onKeyDown={(e) => e.key === 'Enter' && fetchTracks()}
                    className="w-full bg-[#18181b] text-white rounded-xl pl-12 pr-4 py-3 outline-none border border-white/5 focus:border-[#818CF8]/50 transition-colors"
                  />
                </div>
                <button
                  onClick={fetchTracks} disabled={loading}
                  className="flex justify-center items-center gap-2 bg-[#818CF8] hover:bg-[#6366f1] text-black w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning pages...
                    </span>
                  ) : 'Load Playlist'}
                </button>
                {loading && (
                  <p className="text-center text-xs text-gray-500 animate-pulse">
                    Scraping all paginated pages — this may take a moment
                  </p>
                )}
                {cacheHit && !loading && (
                  <p className="text-center text-xs text-emerald-400 flex items-center justify-center gap-1.5">
                    <span>⚡</span> Loaded from cache — instantly!
                  </p>
                )}
              </div>
              {error && <p className="text-red-400 mt-4 text-sm text-center">{error}</p>}
            </div>
          </div>
        )}

        {tracks.length === 0 && !showSearch && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
            <Music className="w-16 h-16 opacity-10" />
            <span className="text-lg">Click the search icon to load a playlist</span>
          </div>
        )}

        {/* Loading Skeleton — shown while scraping, before tracks arrive */}
        {loading && tracks.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] md:gap-6 flex-1 min-h-0 items-stretch overflow-hidden">
            {/* Left: playlist skeleton */}
            <div className="bg-[#121214] rounded-2xl border border-white/5 p-4 sm:p-5 flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="h-3 w-14 bg-[#2a2a2d] rounded animate-pulse" />
                <div className="h-3 w-10 bg-[#2a2a2d] rounded animate-pulse" />
              </div>
              <div className="h-8 bg-[#1a1a1d] rounded-lg mb-3 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2 overflow-hidden">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[#18181b]"
                    style={{ opacity: 1 - i * 0.08, animation: `pulse 1.5s ease-in-out ${i * 60}ms infinite` }}>
                    <div className="w-5 h-3 bg-[#222] rounded" />
                    <div className="h-3 bg-[#222] rounded flex-1" style={{ width: `${55 + (i * 13) % 40}%` }} />
                    <div className="w-10 h-2.5 bg-[#222] rounded" />
                  </div>
                ))}
              </div>
            </div>
            {/* Right: player skeleton */}
            <div className="hidden lg:flex flex-col gap-3 mt-0">
              <div className="bg-[#121214] rounded-2xl border border-white/5 p-5 flex gap-5 animate-pulse">
                <div className="w-28 h-28 rounded-xl bg-[#1a1a1d] shrink-0" />
                <div className="flex-1 flex flex-col gap-3 pt-2">
                  <div className="h-5 bg-[#1a1a1d] rounded w-3/4" />
                  <div className="h-3 bg-[#1a1a1d] rounded w-1/3" />
                  <div className="h-1.5 bg-[#1a1a1d] rounded-full mt-4" />
                  <div className="flex justify-center gap-6 mt-2">
                    <div className="w-4 h-4 bg-[#1a1a1d] rounded-full" />
                    <div className="w-10 h-10 bg-[#1a1a1d] rounded-full" />
                    <div className="w-4 h-4 bg-[#1a1a1d] rounded-full" />
                  </div>
                </div>
              </div>
              <div className="bg-[#121214] rounded-2xl border border-white/5 p-4 h-36 animate-pulse" />
            </div>
          </div>
        )}



        {tracks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] md:gap-6 flex-1 min-h-0 items-stretch overflow-hidden">

            {/* PLAYLIST LEFT COLUMN */}
            <div className="bg-[#121214] rounded-2xl border border-white/5 p-4 sm:p-5 flex flex-col shadow-2xl overflow-hidden min-h-0 h-full max-h-full">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-[0.15em]">Playlist</h2>
                <span className="text-[10px] text-gray-500 font-medium">{tracks.length} tracks</span>
              </div>

              {/* Filter input */}
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter tracks..."
                  className="w-full bg-[#18181b] text-white text-[12px] rounded-lg pl-9 pr-4 py-2 outline-none border border-white/5 focus:border-[#818CF8]/40 transition-colors placeholder:text-gray-600"
                />
                {filterQuery && (
                  <button onClick={() => setFilterQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-2 -mx-1 px-1 min-h-0">
                {filteredTracks.map((track) => {
                  const i = track._i;
                  const isActive = i === currentTrackIndex;
                  return (
                    <button
                      key={track.id}
                      ref={isActive ? activeTrackRef : null}
                      onClick={() => { setCurrentTrackIndex(i); setIsPlaying(true); }}
                      className={`relative w-full text-left px-5 py-4 rounded-xl transition-all flex items-center gap-4 overflow-hidden ${isActive
                        ? 'bg-[#18192b] border border-[#2b2d4f] text-[#818CF8]'
                        : 'bg-transparent border border-transparent text-gray-300 hover:bg-[#1a1a1d]'
                        }`}
                    >
                      {/* YouTube-style red track completion bar */}
                      {(() => {
                        let pct = 0;
                        if (isActive && duration > 0) {
                          pct = Math.min(100, (currentTime / duration) * 100);
                        } else if (trackProgress[i]) {
                          pct = trackProgress[i].percentage;
                        }
                        if (pct > 0) {
                          return (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
                              <div
                                className="absolute top-0 left-0 h-full bg-red-600 rounded-r-full transition-all duration-1000"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {isActive ? (
                        <span className="w-6 shrink-0 flex items-center justify-center">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        </span>
                      ) : (
                        <span className="text-sm w-6 font-medium text-gray-400 shrink-0">{i + 1}</span>
                      )}
                      <span className="truncate max-w-full font-medium text-[15px] flex-1">{track.title}</span>
                      {track.duration && (
                        <span className={`text-[13px] tracking-wide ml-4 shrink-0 ${isActive ? 'text-[#818CF8]/80' : 'text-gray-500'}`}>
                          {track.duration}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filterQuery && filteredTracks.length === 0 && (
                  <p className="text-center text-gray-600 text-sm pt-8">No tracks match "{filterQuery}"</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: PLAYER & MIXER */}
            <div className="flex flex-col gap-4 sm:gap-3 mt-6 lg:mt-0 w-full min-w-0 h-full max-h-full overflow-y-auto lg:overflow-y-hidden pr-1">

              {/* AUDIO PLAYER MODULE */}
              {currentTrack && (
                <div className="bg-[#121214] rounded-2xl border border-white/5 p-4 sm:p-5 flex flex-col shadow-2xl min-w-0">
                  <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start min-w-0">
                    <div className="w-35 h-35 sm:w-35 sm:h-35 rounded-xl bg-cover bg-center shrink-0 border border-white/10 shadow-lg" style={{ backgroundImage: playlistThumbnail ? 'url(' + playlistThumbnail + ')' : 'none' }}></div>

                    <div className="flex-1 flex flex-col justify-center w-full min-w-0 mt-2 sm:mt-0">
                      <h2 className="text-base sm:text-lg font-bold text-white mb-1.5 truncate text-center sm:text-left">{currentTrack.title}</h2>
                      <p className="text-[10px] text-gray-400 tracking-[0.2em] uppercase mb-4 text-center sm:text-left font-semibold">Currently Playing</p>

                      <div className="flex items-center gap-3 mb-5 w-full">
                        <span className="text-[11px] text-gray-500 tabular-nums font-medium opacity-80 shrink-0">{formatTime(currentTime)}</span>
                        {/* Feature 2: draggable seek bar with tooltip */}
                        <div
                          ref={seekBarRef}
                          className="relative flex-1 cursor-pointer group select-none"
                          onMouseDown={handleSeekBarMouseDown}
                          onMouseMove={handleSeekBarHover}
                          onMouseLeave={() => setHoverTime(null)}
                        >
                          {/* Track */}
                          <div className="relative w-full h-1.5 group-hover:h-3 bg-[#222] rounded-full transition-all duration-150">
                            {/* Filled */}
                            <div
                              className="absolute top-0 left-0 h-full bg-[#818CF8] rounded-full"
                              style={{ width: (duration ? (currentTime / duration) * 100 : 0) + '%' }}
                            />
                            {/* Thumb */}
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ left: (duration ? (currentTime / duration) * 100 : 0) + '%' }}
                            />
                          </div>
                          {/* Tooltip */}
                          {hoverTime !== null && (
                            <div
                              className="absolute -top-8 bg-[#1e1e24] text-white text-[10px] font-mono px-2 py-1 rounded-md shadow-lg border border-white/10 pointer-events-none -translate-x-1/2 whitespace-nowrap"
                              style={{ left: hoverX }}
                            >
                              {formatTime(hoverTime)}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums font-medium opacity-80 shrink-0">{formatTime(duration)}</span>
                      </div>

                      <div className="flex items-center justify-center sm:justify-start gap-8">
                        <button onClick={prevTrack} disabled={currentTrackIndex === 0} className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                          <SkipBack className="w-4 h-4 fill-current" />
                        </button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white text-black hover:bg-gray-200 hover:scale-105 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
                        </button>
                        <button onClick={nextTrack} disabled={currentTrackIndex === tracks.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                          <SkipForward className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <audio ref={audioRef} src={currentTrack.src} onEnded={triggerAutoplay} />
                </div>
              )}

              {/* MIXER MODULE */}
              <div className="flex flex-col w-full min-w-0 shrink-0">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1 pl-1">Mixer</h2>

                <div className="flex flex-col gap-3">
                  {/* Row 1: Volume Sliders */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Audio Volume Block */}
                    <div className="bg-[#121214] p-4 rounded-xl border border-white/5 flex flex-col justify-center min-h-[100px] shadow-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[#818CF8] font-medium text-[12px]">Audio Volume</span>
                        <span className="text-white text-[11px] font-bold">{Math.round(volume * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-full accent-[#818CF8] h-1 bg-[#222] rounded-full appearance-none cursor-pointer"
                      />
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-purple-400 font-medium text-[12px]">Pitch / Speed</span>
                          <span className="text-white text-[11px] font-bold">{playbackRate.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range" min="0.5" max="2" step="0.1" value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                          className="w-full accent-purple-400 h-1 bg-[#222] rounded-full appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Ambient Volume Block */}
                    <div className="bg-[#121214] p-4 rounded-xl border border-white/5 flex flex-col shadow-lg min-h-[100px]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[#2dd4bf] font-medium text-[12px]">Ambient Vol.</span>
                        <span className="text-white text-[11px] font-bold">{Math.round(backgroundVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max="1" step="0.01" value={backgroundVolume} onChange={(e) => setBackgroundVolume(parseFloat(e.target.value))}
                        className="w-full accent-[#2dd4bf] h-1 bg-[#222] rounded-full appearance-none cursor-pointer mb-4"
                      />
                      <div className="mt-auto relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3 h-3" />
                        <input
                          type="url"
                          value={ytInput}
                          onChange={(e) => setYtInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && setAmbientYoutubeUrl(ytInput)}
                          placeholder="YouTube URL"
                          className="w-full bg-[#18181b] text-white text-[11px] rounded-lg pl-8 pr-12 py-2 outline-none border border-white/5 focus:border-[#2dd4bf]/50 transition-colors"
                        />
                        <button
                          onClick={() => setAmbientYoutubeUrl(ytInput)}
                          className="absolute right-1 top-[3px] text-[10px] bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/40 text-[#2dd4bf] px-2 py-0.5 rounded"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sleep Timer — compact inline row */}
                  <div className="bg-[#121214] px-4 py-3 rounded-xl border border-white/5 shadow-lg flex items-center gap-3">
                    <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-indigo-400 font-medium text-[12px] shrink-0">Sleep Timer</span>
                    <div className="ml-auto relative">
                      <select
                        value={sleepTimer}
                        onChange={(e) => handleSleepTimer(e.target.value as typeof sleepTimer)}
                        className="appearance-none bg-[#18181b] text-[11px] text-gray-300 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-indigo-400/50 cursor-pointer transition-colors hover:border-white/20"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                      >
                        <option value="off">Off</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="end">End of track</option>
                      </select>
                    </div>
                    {sleepTimer !== 'off' && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                    )}
                  </div>


                  {/* Ambient Status */}
                  <div className="bg-[#121214] rounded-xl border border-white/5 flex flex-col relative shadow-lg group overflow-hidden min-h-[120px] cursor-pointer" onClick={() => setIsBackgroundPlaying(!isBackgroundPlaying)}>
                    {ytThumbnail && (
                      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${ytThumbnail})` }}>
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
                      </div>
                    )}
                    <div className="relative z-10 flex items-center justify-between h-full p-4">
                      <div className="flex flex-col">
                        <span className="text-[#2dd4bf] font-bold text-[11px] uppercase tracking-wider mb-1">Ambient Status</span>
                        <span className="text-white/40 text-[10px]">Tap to Play/Pause ambient sound</span>
                      </div>

                      <div className={`flex items-center gap-2 px-4 py-2 border rounded-full backdrop-blur-md transition-all ${isBackgroundPlaying ? 'bg-[#2dd4bf]/20 border-[#2dd4bf]/30 text-[#2dd4bf] shadow-[0_0_15px_rgba(45,212,191,0.2)]' : 'bg-black/60 border-white/10 text-gray-400'}`}>
                        <Music className={`w-3.5 h-3.5 ${isBackgroundPlaying ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase">{isBackgroundPlaying ? 'Playing' : 'Paused'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* YTAmbientPlayer — tiny invisible iframe, controlled via postMessage */}
        {ytId && (
          <YTAmbientPlayer
            videoId={ytId}
            playing={isBackgroundPlaying}
            volume={backgroundVolume}
          />
        )}

      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
      {/* Feature 4: Autoplay countdown toast */}
      {autoplayToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 bg-[#18181b] border border-white/10 rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-300 max-w-[320px]">
          {/* Countdown ring */}
          <div className="relative w-10 h-10 shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#222" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#818CF8" strokeWidth="3"
                strokeDasharray={`${(autoplayToast.secondsLeft / 5) * 100} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-white">
              {autoplayToast.secondsLeft}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Up Next</p>
            <p className="text-[13px] font-semibold text-white truncate">{autoplayToast.title}</p>
          </div>
          <button
            onClick={cancelAutoplay}
            className="shrink-0 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            title="Cancel autoplay"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </main>

  );
}

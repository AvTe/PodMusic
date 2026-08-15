'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search, Settings2, X } from 'lucide-react';

import { usePlayerStore } from '@/store/usePlayerStore';
import { usePlaybackPersistence } from '@/hooks/usePlaybackPersistence';
import { usePlaylistLoader } from '@/hooks/usePlaylistLoader';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useTrackCompletion } from '@/hooks/useTrackCompletion';
import { useSleepTimer } from '@/hooks/useSleepTimer';
import { useAutoplayCountdown } from '@/hooks/useAutoplayCountdown';
import { useSubtitles } from '@/hooks/useSubtitles';
import { getYoutubeId, getYoutubeThumbnail } from '@/lib/youtube';
import { getSeriesLabel } from '@/lib/series';
import type { PlaybackProgress } from '@/lib/db';

import { Backdrop } from './_components/Backdrop';
import { HeroTitle } from './_components/HeroTitle';
import { PlayerPill } from './_components/PlayerPill';
import { PlaylistDrawer } from './_components/PlaylistDrawer';
import { AmbientChip } from './_components/AmbientChip';
import { AmbientPlayer } from './_components/AmbientPlayer';
import { SettingsSheet } from './_components/SettingsSheet';
import { UrlSheet } from './_components/UrlSheet';
import { WaveBar } from './_components/WaveBar';
import { Subtitles } from './_components/Subtitles';
import { ColophonTab } from './_components/ColophonTab';
import { Tour, type TourStep } from './_components/Tour';

/** Atmospheric lines for the hero — descriptive, not attributed quotations. */
const HERO_LINES = [
  'Listen. Pause. Go inward.',
  'Every discourse is a doorway.',
  'At your own pace, with ambient sound beneath.',
];

const DEFAULT_URL = 'https://oshoworld.com/maha-geeta-by-osho-01-91';

/** Last series the user loaded. Its presence is what marks a return visit. */
const LAST_URL_KEY = 'podmixer:last-playlist-url';
/** Set once the walkthrough has been completed or skipped. */
const TOUR_KEY = 'podmixer:tour-done';
/** Manual subtitle sync nudge, in seconds. */
const SUBTITLE_OFFSET_KEY = 'podmixer:subtitle-offset';

/**
 * Subtitles are built and working, but the generated VTT timings are not yet
 * accurate enough to ship — Whisper ran without word-level alignment, so cue
 * boundaries sit a second or two off the speech. Flip to true once the files
 * have been regenerated with `word_timestamps=True`
 * (see docs/subtitles-colab.md). Nothing else needs changing.
 */
const SUBTITLES_ENABLED = false;

const DEFAULT_AMBIENT_URL    = 'https://youtu.be/sjkrrmBnpGE';
const DEFAULT_AMBIENT_VOLUME = 0.25;
/** The shared store's own default — only overridden while it is untouched. */
const STORE_AMBIENT_DEFAULT  = 'https://www.youtube.com/watch?v=1zxO2oA9Pww';

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title:  'Welcome',
    body:   'This is a player for long-form Osho discourses. Pick a series once and it picks up where you left off every time you come back.',
  },
  {
    target: 'series',
    title:  'Load an audiobook',
    body:   'Paste the address of any page that hosts audio and every track on it is pulled in automatically — all 91 discourses of a series in one go.',
  },
  {
    target: 'playlist',
    title:  'Your discourses',
    body:   'Opens the full list. Search by title, and a red bar under each row shows how far through it you are.',
  },
  {
    target: 'transport',
    title:  'Play and skip',
    body:   'Play, pause and move between discourses. Drag the bar above to scrub, or use Space and the arrow keys.',
  },
  {
    target: 'ambient',
    title:  'Ambient sound',
    body:   'A separate background track that plays underneath the discourse. Tap to start it, and use the chevron to change the source or its volume.',
  },
  {
    target: 'settings',
    title:  'Settings and sleep timer',
    body:   'Narration volume, playback speed, and a sleep timer that stops playback after a set time. You can replay this tour from here too.',
  },
];

export default function OshoPage() {
  const {
    tracks, playlistThumbnail, currentTrackIndex, isPlaying,
    volume, backgroundVolume, playbackRate,
    isBackgroundPlaying, ambientYoutubeUrl,
    setTracks, setPlaylistThumbnail, setCurrentTrackIndex, setIsPlaying,
    setVolume, setBackgroundVolume, setPlaybackRate,
    setIsBackgroundPlaying, setAmbientYoutubeUrl,
    nextTrack, prevTrack,
  } = usePlayerStore();

  const currentTrack = tracks[currentTrackIndex];

  const audioRef      = useRef<HTMLAudioElement>(null);
  const prevVolumeRef = useRef(1);

  const [url, setUrl]                   = useState(DEFAULT_URL);
  // Starts closed for everyone — the bootstrap below opens it only if there is
  // no remembered series, so a returning visitor never sees it flash.
  const [urlOpen, setUrlOpen]           = useState(false);
  const [booting, setBooting]           = useState(true);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colophonOpen, setColophonOpen] = useState(false);
  const [clock, setClock]               = useState<string | null>(null);
  const [lineIndex, setLineIndex]       = useState(0);
  const [tourOpen, setTourOpen]         = useState(false);
  const [subtitlesOn, setSubtitlesOn]   = useState(true);
  const [subtitleOffset, setSubtitleOffset] = useState(0);

  const { load, loading, error, cacheHit, playlistUrl } = usePlaylistLoader();
  const { currentTime, duration, progressRef, seekToRatio, nudge } =
    useAudioPlayback(audioRef, currentTrack?.src);
  const trackProgress = useTrackCompletion({ playlistUrl, trackIndex: currentTrackIndex, progressRef });
  const { cues, available: subtitlesAvailable } = useSubtitles({
    playlistUrl,
    trackIndex: currentTrackIndex,
    enabled:    SUBTITLES_ENABLED,
  });

  const { sleepTimer, setSleepTimer } = useSleepTimer(
    useCallback(() => setIsPlaying(false), [setIsPlaying]),
  );

  const { toast, trigger: triggerAutoplay, cancel: cancelAutoplay, totalSeconds } = useAutoplayCountdown({
    getNextTitle: useCallback(() => {
      const { tracks: list, currentTrackIndex: index } = usePlayerStore.getState();
      return index >= list.length - 1 ? null : (list[index + 1]?.title ?? 'Next discourse');
    }, []),
    onAdvance: useCallback(() => {
      usePlayerStore.getState().nextTrack();
      setIsPlaying(true);
    }, [setIsPlaying]),
    onCancel: useCallback(() => setIsPlaying(false), [setIsPlaying]),
  });

  // ── Subtitle sync offset, remembered across sessions ─────────────────────
  useEffect(() => {
    const stored = parseFloat(localStorage.getItem(SUBTITLE_OFFSET_KEY) ?? '');
    if (!Number.isNaN(stored)) {
      // Deferred so this is not a synchronous setState inside an effect.
      const t = setTimeout(() => setSubtitleOffset(stored), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const changeSubtitleOffset = useCallback((seconds: number) => {
    const clamped = Math.max(-15, Math.min(15, Math.round(seconds * 100) / 100));
    setSubtitleOffset(clamped);
    localStorage.setItem(SUBTITLE_OFFSET_KEY, String(clamped));
  }, []);

  // ── Ambient defaults ──────────────────────────────────────────────────────
  // Applied only while the shared store still holds its factory URL, so a
  // source chosen on the other page is never clobbered.
  useEffect(() => {
    if (usePlayerStore.getState().ambientYoutubeUrl !== STORE_AMBIENT_DEFAULT) return;
    setAmbientYoutubeUrl(DEFAULT_AMBIENT_URL);
    setBackgroundVolume(DEFAULT_AMBIENT_VOLUME);
  }, [setAmbientYoutubeUrl, setBackgroundVolume]);

  // ── Walkthrough — first visit only, once a series is on screen ───────────
  useEffect(() => {
    if (booting || urlOpen || tracks.length === 0) return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setTourOpen(true), 800);
    return () => clearTimeout(t);
  }, [booting, urlOpen, tracks.length]);

  const closeTour = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1');
    setTourOpen(false);
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  // First visit: open the URL sheet. Return visit: silently reload the last
  // series. `load` checks IndexedDB first, so a cached series appears instantly
  // and the network is only touched once the 7-day cache has expired.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const saved = localStorage.getItem(LAST_URL_KEY);

      if (!saved) {
        if (!cancelled) { setUrlOpen(true); setBooting(false); }
        return;
      }

      if (!cancelled) setUrl(saved);

      const result = await load(saved);
      if (cancelled) return;

      if (!result) {
        // Cache miss and the scrape failed — fall back to asking.
        setUrlOpen(true);
        setBooting(false);
        return;
      }

      setTracks(result.tracks);
      if (result.thumbnail) setPlaylistThumbnail(result.thumbnail);
      // Track index and position are restored by usePlaybackPersistence.
      setIsPlaying(false);
      setBooting(false);
    };

    void bootstrap();
    return () => { cancelled = true; };
  }, [load, setTracks, setPlaylistThumbnail, setIsPlaying]);

  // ── Service worker ────────────────────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* non-critical */});
    }
  }, []);

  // ── Clock (first tick is deferred so it never renders during hydration) ──
  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(),
    );
    const first = setTimeout(tick, 0);
    const id    = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  // ── Rotating hero line ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setLineIndex(i => (i + 1) % HERO_LINES.length), 12_000);
    return () => clearInterval(id);
  }, []);

  // ── Mirror store volume/rate onto the element ────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume       = volume;
    audio.playbackRate = playbackRate;
  }, [volume, playbackRate]);

  // ── Drive play/pause ──────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && currentTrack) audio.play().catch(e => console.error('Audio error', e));
    else if (!isPlaying) audio.pause();
  }, [isPlaying, currentTrackIndex, currentTrack]);

  // ── Resume position ───────────────────────────────────────────────────────
  const handleRestore = useCallback((progress: PlaybackProgress) => {
    setCurrentTrackIndex(progress.trackIndex);
    // Seek once the element has had a moment to pick up the new src.
    setTimeout(() => {
      if (audioRef.current) audioRef.current.currentTime = progress.currentTime;
    }, 400);
  }, [setCurrentTrackIndex]);

  usePlaybackPersistence({ playlistUrl, trackIndex: currentTrackIndex, audioRef, onRestore: handleRestore });

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':      e.preventDefault(); setIsPlaying(!isPlaying); break;
        case 'ArrowRight': e.preventDefault(); nudge(10); break;
        case 'ArrowLeft':  e.preventDefault(); nudge(-10); break;
        case 'KeyN':       nextTrack(); break;
        case 'KeyP':       prevTrack(); break;
        case 'KeyM':
          if (volume > 0) { prevVolumeRef.current = volume; setVolume(0); }
          else setVolume(prevVolumeRef.current || 1);
          break;
        case 'BracketLeft':  changeSubtitleOffset(subtitleOffset - 0.25); break;
        case 'BracketRight': changeSubtitleOffset(subtitleOffset + 0.25); break;
        case 'Escape':
          setPlaylistOpen(false);
          setSettingsOpen(false);
          setColophonOpen(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, volume, nudge, nextTrack, prevTrack, setIsPlaying, setVolume,
      subtitleOffset, changeSubtitleOffset]);

  // ── Load a series ─────────────────────────────────────────────────────────
  const handleLoad = async () => {
    setPlaylistOpen(false);
    const result = await load(url);
    if (!result) return;                    // error stays visible in the sheet
    setTracks(result.tracks);
    if (result.thumbnail) setPlaylistThumbnail(result.thumbnail);
    setCurrentTrackIndex(0);
    setIsPlaying(false);
    setUrlOpen(false);
    // Remember it, so the next visit restores straight into this series.
    localStorage.setItem(LAST_URL_KEY, url);
  };

  const handleEnded = () => {
    if (sleepTimer === 'end') { setIsPlaying(false); setSleepTimer('off'); return; }
    triggerAutoplay();
  };

  const ambientId        = getYoutubeId(ambientYoutubeUrl);
  const ambientThumbnail = ambientId ? getYoutubeThumbnail(ambientId) : null;

  const series = useMemo(
    () => (playlistUrl ? getSeriesLabel(playlistUrl) : undefined),
    [playlistUrl],
  );

  return (
    <main
      className="relative h-[100dvh] w-full overflow-hidden text-white"
      style={{ fontFamily: 'var(--font-poppins)' }}
    >
      <Backdrop />
      <WaveBar playing={isPlaying} playbackRate={playbackRate} />

      {/* ── Top chrome ──────────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-7">
        <span className="w-24 font-mono text-[12px] text-white/55">{clock ?? ''}</span>

        <span className="flex items-center gap-2 text-[12px]">
          <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? 'animate-pulse bg-[#7ee787]' : 'bg-white/30'}`} />
          <span className="font-mono text-white/80">{tracks.length || '—'}</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/45">discourses</span>
        </span>

        <div className="flex w-24 items-center justify-end gap-1">
          <Link
            href="/v1"
            title="Original design"
            className="rounded-full px-2 py-1 text-[10px] uppercase tracking-widest text-white/35 transition-colors hover:text-white"
          >
            v1
          </Link>
          <button
            onClick={() => setUrlOpen(true)}
            aria-label="Change series"
            data-tour="series"
            className="rounded-full p-2 text-white/55 transition-colors hover:text-white"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            data-tour="settings"
            className="rounded-full p-2 text-white/55 transition-colors hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Hero — sits above the portraits, per the reference composition ── */}
      <div className="flex h-full flex-col items-center justify-start px-4 pt-[12vh] sm:pt-[10vh]">
        <HeroTitle quote={HERO_LINES[lineIndex]} series={series} />
      </div>

      {/* ── Ambient chip ────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-32 left-4 z-20 sm:bottom-7 sm:left-7">
        <AmbientChip
          playing={isBackgroundPlaying}
          onToggle={() => setIsBackgroundPlaying(!isBackgroundPlaying)}
          url={ambientYoutubeUrl}
          onCommitUrl={setAmbientYoutubeUrl}
          volume={backgroundVolume}
          onVolume={setBackgroundVolume}
          thumbnail={ambientThumbnail}
        />
      </div>

      <Subtitles
        cues={cues}
        currentTime={currentTime}
        visible={SUBTITLES_ENABLED && subtitlesOn}
        offset={subtitleOffset}
      />

      {/* ── Player pill ─────────────────────────────────────────────────── */}
      {currentTrack && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
          <PlayerPill
            track={currentTrack}
            thumbnail={playlistThumbnail || null}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            canPrev={currentTrackIndex > 0}
            canNext={currentTrackIndex < tracks.length - 1}
            playlistOpen={playlistOpen}
            subtitlesAvailable={subtitlesAvailable}
            subtitlesOn={subtitlesOn}
            onToggleSubtitles={() => setSubtitlesOn(v => !v)}
            onToggle={() => setIsPlaying(!isPlaying)}
            onPrev={prevTrack}
            onNext={nextTrack}
            onSeekRatio={seekToRatio}
            onTogglePlaylist={() => setPlaylistOpen(v => !v)}
          />
        </div>
      )}

      {/* ── Restoring the remembered series ─────────────────────────────── */}
      {booting && tracks.length === 0 && (
        <div className="absolute inset-x-0 bottom-10 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/40 px-5 py-2.5 text-[12px] text-white/50 backdrop-blur-xl">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Restoring your series…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!booting && tracks.length === 0 && !urlOpen && (
        <button
          onClick={() => setUrlOpen(true)}
          className="absolute inset-x-0 bottom-10 z-20 mx-auto w-fit rounded-full border border-white/15 bg-black/40 px-6 py-3 text-[13px] text-white/70 backdrop-blur-xl transition-colors hover:text-white"
        >
          Choose a series
        </button>
      )}

      <PlaylistDrawer
        open={playlistOpen}
        tracks={tracks}
        currentIndex={currentTrackIndex}
        trackProgress={trackProgress}
        currentTime={currentTime}
        duration={duration}
        onSelect={(index) => { setCurrentTrackIndex(index); setIsPlaying(true); setPlaylistOpen(false); }}
        onClose={() => setPlaylistOpen(false)}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        volume={volume}
        onVolume={setVolume}
        playbackRate={playbackRate}
        onPlaybackRate={setPlaybackRate}
        sleepTimer={sleepTimer}
        onSleepTimer={setSleepTimer}
        onRestartTour={() => { setSettingsOpen(false); setTourOpen(true); }}
        subtitlesAvailable={subtitlesAvailable}
        subtitleOffset={subtitleOffset}
        onSubtitleOffset={changeSubtitleOffset}
      />

      <ColophonTab
        open={colophonOpen}
        onOpen={() => setColophonOpen(true)}
        onClose={() => setColophonOpen(false)}
      />

      <Tour steps={TOUR_STEPS} open={tourOpen} onClose={closeTour} />

      <UrlSheet
        open={urlOpen}
        url={url}
        onUrlChange={setUrl}
        onSubmit={handleLoad}
        onClose={() => setUrlOpen(false)}
        dismissible={tracks.length > 0}
        loading={loading}
        error={error}
        cacheHit={cacheHit}
      />

      {/* ── Autoplay countdown ──────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-28 right-5 z-50 flex max-w-[320px] items-center gap-4 rounded-2xl border border-white/12 bg-black/70 px-5 py-4 backdrop-blur-2xl sm:bottom-28">
          <div className="relative h-10 w-10 shrink-0">
            <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#f0a33c" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(toast.secondsLeft / totalSeconds) * 100} 100`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold">
              {toast.secondsLeft}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">Up next</p>
            <p className="truncate text-[13px] font-semibold">{toast.title}</p>
          </div>
          <button
            onClick={cancelAutoplay}
            aria-label="Cancel autoplay"
            className="shrink-0 rounded-lg p-1 text-white/45 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {currentTrack && (
        <audio ref={audioRef} src={currentTrack.src} onEnded={handleEnded} />
      )}

      {ambientId && (
        <AmbientPlayer
          videoId={ambientId}
          playing={isBackgroundPlaying}
          volume={backgroundVolume}
        />
      )}
    </main>
  );
}

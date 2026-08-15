export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** `HH:MM:SS.mmm` or `MM:SS.mmm` → seconds. NaN if unparseable. */
function parseTimestamp(value: string): number {
  const parts = value.split(':');
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return NaN;
}

/**
 * Minimal WebVTT parser — enough for the cue blocks Whisper emits.
 * Ignores styling blocks, regions and cue settings, none of which appear here.
 */
export function parseVtt(input: string): Cue[] {
  const cues: Cue[] = [];

  for (const block of input.replace(/\r/g, '').split('\n\n')) {
    const lines = block.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) continue;

    const timingIndex = lines.findIndex(line => line.includes('-->'));
    if (timingIndex === -1) continue;

    const [rawStart, rawEnd] = lines[timingIndex].split('-->');
    // Trailing cue settings (align, position…) are split off by the space.
    const start = parseTimestamp(rawStart.trim().split(/\s+/)[0]);
    const end   = parseTimestamp(rawEnd.trim().split(/\s+/)[0]);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    const text = lines.slice(timingIndex + 1).join(' ').trim();
    if (text) cues.push({ start, end, text });
  }

  return cues;
}

/**
 * Index of the last cue that has started by `time`, or -1 before the first.
 *
 * Unlike findCue this does not return null in the silence between cues — the
 * teleprompter keeps the previous line on screen rather than blinking out.
 */
export function findActiveIndex(cues: Cue[], time: number): number {
  let low = 0;
  let high = cues.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

/**
 * Cue covering `time`, or null in a gap. Binary search — cues are sorted and
 * this runs on every timeupdate.
 */
export function findCue(cues: Cue[], time: number): Cue | null {
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (time < cue.start)    high = mid - 1;
    else if (time > cue.end) low  = mid + 1;
    else return cue;
  }

  return null;
}

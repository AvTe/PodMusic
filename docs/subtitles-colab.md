# Generating English subtitles on Google Colab (free)

Turns the Hindi discourse audio into **English** WebVTT subtitle files, using
Whisper's `translate` task on Colab's free GPU. No API key, no billing.

The output goes into `public/subtitles/<slug>/NN.vtt` and is served as static
files — so once generated, subtitles cost nothing at runtime, forever.

---

## Before you start

- A Google account (for Colab + Drive).
- **Transcribe 2–3 discourses first and read the output.** Whisper paraphrases,
  and Sanskrit/philosophical terms come out inconsistently. Decide whether the
  quality is worth ~15 hours of GPU time before committing to all 91.

Colab's free GPU has a daily quota. If you are cut off, wait a day and rerun —
the script skips work that is already done.

---

## Step 1 — Open a notebook with a GPU

1. Go to <https://colab.research.google.com> → **New notebook**
2. **Runtime → Change runtime type → T4 GPU → Save**

Paste each block below into its own cell (`+ Code`) and run them in order.

---

## Step 2 — Confirm the GPU is attached

```python
!nvidia-smi
```

You should see a **Tesla T4**. If this errors, the runtime type did not save —
redo step 1. Running on CPU is not worth it; it takes days rather than hours.

---

## Step 3 — Install faster-whisper

```python
!pip -q install faster-whisper==1.1.0 requests
print("ok")
```

`faster-whisper` is a CTranslate2 reimplementation — same weights as OpenAI's
Whisper, several times quicker, and it fits `large-v3` on a free T4.

---

## Step 4 — Mount Google Drive

```python
from google.colab import drive
drive.mount('/content/drive')

import os
OUT_DIR = '/content/drive/MyDrive/osho-subtitles'
os.makedirs(OUT_DIR, exist_ok=True)
print('writing to', OUT_DIR)
```

**Do not skip this.** Colab disconnects after idling and wipes local disk.
Writing to Drive means a dropped session costs you one discourse, not all of
them.

---

## Step 5 — Fetch the track list

Pulls the same list the site uses, straight from the deployed scraper.

```python
import requests

SITE   = 'https://podmusic-vert.vercel.app'
SERIES = 'https://oshoworld.com/maha-geeta-by-osho-01-91'
SLUG   = SERIES.rstrip('/').split('/')[-1]

r = requests.post(f'{SITE}/api/scrape', json={'url': SERIES}, timeout=180)
r.raise_for_status()
tracks = r.json()['tracks']

print(f'{len(tracks)} tracks, slug = {SLUG}')
print(tracks[0]['title'], '|', tracks[0]['src'])
```

---

## Step 6 — Load the model

```python
from faster_whisper import WhisperModel

# large-v3 gives noticeably better Hindi than medium, and fits a free T4.
# Swap to "medium" if you want roughly 2x the speed for lower quality.
model = WhisperModel('large-v3', device='cuda', compute_type='float16')
print('model ready')
```

First run downloads ~3GB. That is re-downloaded each new session; it takes a
couple of minutes and is not worth caching.

---

## Step 7 — Transcribe

Set `LIMIT = 3` for your first run. Once you are happy with the output, set it
to `None` and rerun — finished files are skipped automatically.

```python
import os, requests, gc

LIMIT = 3          # None = every track
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

series_dir = os.path.join(OUT_DIR, SLUG)
os.makedirs(series_dir, exist_ok=True)

def ts(t):
    h = int(t // 3600); m = int((t % 3600) // 60); s = t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'

todo = tracks if LIMIT is None else tracks[:LIMIT]

for i, track in enumerate(todo):
    name     = f'{i + 1:02d}'
    vtt_path = os.path.join(series_dir, f'{name}.vtt')

    if os.path.exists(vtt_path):
        print(f'[{name}] already done, skipping')
        continue

    mp3_path = f'/content/{name}.mp3'
    print(f'[{name}] downloading {track["title"]}')
    with requests.get(track['src'], headers={'User-Agent': UA},
                      stream=True, timeout=600) as resp:
        resp.raise_for_status()
        with open(mp3_path, 'wb') as fh:
            for chunk in resp.iter_content(1 << 20):
                fh.write(chunk)

    print(f'[{name}] transcribing → English')
    segments, info = model.transcribe(
        mp3_path,
        task='translate',       # Hindi speech straight to English text
        language='hi',          # skip detection: faster and more reliable
        beam_size=5,
        vad_filter=True,        # drops long silences
        word_timestamps=True,   # REQUIRED for cue times that track the speech
    )

    lines = ['WEBVTT', '']
    count = 0
    for seg in segments:            # generator — work happens here
        text = seg.text.strip()
        if not text:
            continue
        lines += [f'{ts(seg.start)} --> {ts(seg.end)}', text, '']
        count += 1

    # Written only after a clean pass, so a crash never leaves a partial file.
    with open(vtt_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))

    os.remove(mp3_path)
    gc.collect()
    print(f'[{name}] done — {count} cues → {vtt_path}\n')

print('finished')
```

Roughly 10 minutes per 100-minute discourse on a T4. Keep the browser tab open;
Colab disconnects idle sessions.

---

## Step 8 — Check the output before doing all 91

```python
print(open(os.path.join(series_dir, '01.vtt'), encoding='utf-8').read()[:1500])
```

Read it properly. If the English is usable, go back to step 7, set
`LIMIT = None`, and let it run. Rerun after any disconnect — it resumes.

---

## Step 9 — Download

```python
import shutil
from google.colab import files

shutil.make_archive('/content/subtitles', 'zip', OUT_DIR)
files.download('/content/subtitles.zip')
```

Unzip into the repo so the layout is:

```
public/subtitles/maha-geeta-by-osho-01-91/01.vtt
public/subtitles/maha-geeta-by-osho-01-91/02.vtt
...
```

Commit and push. ~14MB of text for a full series, and Vercel serves it gzipped.

---

## Why `word_timestamps=True` matters

Without it, Whisper's segment times are a by-product of decoding: cues come out
tiling the timeline back to back, with a median duration of almost exactly 2.00s
and no gaps between them. The total span is right, but individual boundaries sit
a second or two away from the speech, which reads as subtitles that never quite
land.

With it, faster-whisper aligns the transcript against the audio using
cross-attention (DTW) and emits boundaries that follow the words. It costs
roughly 20–30% more GPU time and is the difference between usable and annoying.

To check any generated file:

```python
c = [l for l in open(path, encoding='utf-8') if '-->' in l]
# Cues that all end exactly where the next begins, with a ~2.00s median
# duration, mean the alignment pass did not run.
```

## Notes

- **Resumable by design.** Existing `.vtt` files are skipped, so disconnects and
  quota limits cost you at most the discourse in flight.
- **A glossary pass is worth it.** Recurring terms (*sannyas*, *samadhi*, sutra
  names) come back spelled inconsistently. A find-and-replace across the
  finished VTTs fixes most of it in one go.
- **Other series** — change `SERIES` in step 5 and rerun. The slug, and so the
  output folder, follows automatically.

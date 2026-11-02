#!/usr/bin/env python3
"""Render a ForceFinder Daily Briefing episode from a two-host script.

Usage:  python3 podcast/make_episode.py podcast/scripts/YYYY-MM-DD.json

The script JSON looks like:
  {
    "date": "YYYY-MM-DD",
    "title": "Short episode title",
    "summary": "One or two sentences for the episode description.",
    "segments": [ { "speaker": "Avery", "text": "..." }, { "speaker": "Cole", "text": "..." } ],
    "sources": [ { "label": "...", "url": "https://..." } ]
  }

Speech is synthesized locally with Kokoro (open-weight TTS, Apache-2.0), using
one voice per host. The voice model is downloaded from the kokoro-onnx GitHub
release on first run and cached in ~/.cache/forcefinder-tts.

Outputs:
  podcast/episodes/YYYY-MM-DD.mp3   mono MP3
  podcast/episodes.json             episode index used by the app (newest first)
  podcast/feed.xml                  podcast RSS feed
Older MP3s beyond KEEP_AUDIO episodes are deleted from the working tree (their
scripts stay), so the repository doesn't grow without bound.

Requires: pip install kokoro-onnx soundfile ; ffmpeg on PATH.
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

SITE_URL = "https://rwaynewhite15.github.io/ForceFinder/"  # GitHub Pages root, used for absolute feed links
SHOW_TITLE = "ForceFinder Daily Briefing"
SHOW_DESC = ("A short daily conversation about the conflict events, US carrier movements and military "
             "developments on the ForceFinder globe. AI-generated from public open-source reporting; "
             "check the linked sources.")
VOICES = {"Avery": "af_heart", "Cole": "am_michael"}  # host name -> Kokoro voice
SPEED = 1.05
PAUSE_SAME, PAUSE_TURN = 0.25, 0.45  # seconds of silence between sentences / speaker turns
KEEP_AUDIO = 14
BITRATE = "48k"

MODEL_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL_FILES = ["kokoro-v1.0.int8.onnx", "voices-v1.0.bin"]
CACHE = Path(os.environ.get("FF_TTS_CACHE", Path.home() / ".cache" / "forcefinder-tts"))

ROOT = Path(__file__).resolve().parent
EPISODES_DIR = ROOT / "episodes"
INDEX = ROOT / "episodes.json"
FEED = ROOT / "feed.xml"


def fetch_models():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name in MODEL_FILES:
        dest = CACHE / name
        if dest.exists() and dest.stat().st_size > 1_000_000:
            continue
        print(f"Downloading {name} …", flush=True)
        tmp = dest.with_suffix(".part")
        urllib.request.urlretrieve(MODEL_BASE + name, tmp)
        tmp.rename(dest)
    return [CACHE / n for n in MODEL_FILES]


def validate(script):
    for key in ("date", "title", "summary", "segments"):
        if not script.get(key):
            raise SystemExit(f"script is missing '{key}'")
    datetime.strptime(script["date"], "%Y-%m-%d")
    for i, seg in enumerate(script["segments"]):
        if seg.get("speaker") not in VOICES:
            raise SystemExit(f"segment {i}: speaker must be one of {list(VOICES)}")
        if not seg.get("text", "").strip():
            raise SystemExit(f"segment {i}: empty text")


def synthesize(script, wav_path):
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro

    model, voices = fetch_models()
    tts = Kokoro(str(model), str(voices))
    sr = 24000
    chunks, prev = [], None
    for i, seg in enumerate(script["segments"], 1):
        audio, sr = tts.create(seg["text"].strip(), voice=VOICES[seg["speaker"]], speed=SPEED, lang="en-us")
        if prev is not None:
            chunks.append(np.zeros(int(sr * (PAUSE_TURN if seg["speaker"] != prev else PAUSE_SAME)), dtype=audio.dtype))
        chunks.append(audio)
        prev = seg["speaker"]
        print(f"  segment {i}/{len(script['segments'])} ({seg['speaker']})", flush=True)
    audio = np.concatenate(chunks)
    sf.write(wav_path, audio, sr)
    return len(audio) / sr


def encode(wav_path, mp3_path, script):
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "24000", "-b:a", BITRATE,
        "-metadata", f"title={script['title']}", "-metadata", f"artist={SHOW_TITLE}",
        "-metadata", f"date={script['date']}", str(mp3_path),
    ], check=True)


def update_index(script, duration, mp3_path):
    episodes = json.loads(INDEX.read_text()) if INDEX.exists() else []
    episodes = [e for e in episodes if e["date"] != script["date"]]
    episodes.append({
        "date": script["date"],
        "title": script["title"],
        "summary": script["summary"],
        "audio": f"podcast/episodes/{mp3_path.name}",
        "script": f"podcast/scripts/{script['date']}.json",
        "duration": round(duration),
        "bytes": mp3_path.stat().st_size,
        "sources": script.get("sources", []),
    })
    episodes.sort(key=lambda e: e["date"], reverse=True)
    # Keep audio for the newest KEEP_AUDIO episodes only; older entries stay listed without audio.
    for e in episodes[KEEP_AUDIO:]:
        old = ROOT.parent / e["audio"] if e.get("audio") else None
        if old and old.exists():
            old.unlink()
        e["audio"] = None
    INDEX.write_text(json.dumps(episodes, indent=2, ensure_ascii=False) + "\n")
    return episodes


def write_feed(episodes):
    def fmt_dur(s):
        return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"
    items = []
    for e in episodes:
        if not e.get("audio"):
            continue
        pub = format_datetime(datetime.strptime(e["date"], "%Y-%m-%d").replace(hour=18, tzinfo=timezone.utc))
        url = SITE_URL + e["audio"]
        src = "".join(f"<li><a href=\"{escape(s['url'])}\">{escape(s['label'])}</a></li>" for s in e.get("sources", []))
        desc = escape(e["summary"]) + (escape(f"<p>Sources:</p><ul>{src}</ul>") if src else "")
        items.append(f"""    <item>
      <title>{escape(e['title'])}</title>
      <description>{desc}</description>
      <pubDate>{pub}</pubDate>
      <guid isPermaLink="false">forcefinder-{e['date']}</guid>
      <enclosure url="{escape(url)}" length="{e['bytes']}" type="audio/mpeg"/>
      <itunes:duration>{fmt_dur(e['duration'])}</itunes:duration>
    </item>""")
    FEED.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>{escape(SHOW_TITLE)}</title>
    <link>{SITE_URL}</link>
    <description>{escape(SHOW_DESC)}</description>
    <language>en-us</language>
    <itunes:author>ForceFinder</itunes:author>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="News"/>
{chr(10).join(items)}
  </channel>
</rss>
""")


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    script = json.loads(Path(sys.argv[1]).read_text())
    validate(script)
    EPISODES_DIR.mkdir(exist_ok=True)
    mp3 = EPISODES_DIR / f"{script['date']}.mp3"
    words = sum(len(s["text"].split()) for s in script["segments"])
    print(f"Rendering {script['date']}: {len(script['segments'])} segments, {words} words", flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "episode.wav"
        duration = synthesize(script, wav)
        encode(wav, mp3, script)
    episodes = update_index(script, duration, mp3)
    write_feed(episodes)
    print(f"Wrote {mp3.relative_to(ROOT.parent)} ({duration / 60:.1f} min, {mp3.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()

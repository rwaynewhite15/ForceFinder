#!/usr/bin/env python3
"""Build a ForceFinder video briefing from a briefing JSON.

Usage:
  cd briefings/tools && npm install            # map tooling (d3-geo, world-atlas)
  pip install kokoro-onnx soundfile             # ffmpeg and Playwright are also required
  python3 briefings/tools/build.py briefings/2026-11-08-western-hemisphere.json

The briefing JSON holds `date`, `title`, `scenes` (map extent, highlighted countries as ISO
3166 numeric codes, labelled markers and a facts panel per scene), `segments` (each
{ scene, speaker, text }, speakers "Avery" or "Cole") and `sourcesCard` (lines for the
closing card). Each segment is spoken with Kokoro TTS and shown as one 1280x720 frame (map,
facts and caption); ffmpeg joins the frames and narration into <same name>.mp4 next to the
JSON, plus a .jpg poster frame.
"""
import json, os, subprocess, sys, urllib.request
from datetime import datetime
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).resolve().parent
VOICES = {"Avery": "af_heart", "Cole": "am_michael"}  # same hosts as the daily podcast
SPEED, PAUSE_SAME, PAUSE_TURN, SOURCES_SECS = 1.05, 0.25, 0.45, 7.0
MODEL_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL_FILES = ["kokoro-v1.0.int8.onnx", "voices-v1.0.bin"]
CACHE = Path(os.environ.get("FF_TTS_CACHE", Path.home() / ".cache" / "forcefinder-tts"))


def fetch_models():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name in MODEL_FILES:
        dest = CACHE / name
        if not (dest.exists() and dest.stat().st_size > 1_000_000):
            print(f"Downloading {name} …", flush=True)
            urllib.request.urlretrieve(MODEL_BASE + name, dest.with_suffix(".part"))
            dest.with_suffix(".part").rename(dest)
    return [str(CACHE / n) for n in MODEL_FILES]


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1]).resolve()
    b = json.loads(src.read_text())
    for i, seg in enumerate(b["segments"]):
        if seg["speaker"] not in VOICES or seg["scene"] not in b["scenes"] or not seg["text"].strip():
            raise SystemExit(f"segment {i}: bad speaker/scene/text")
    out, poster = src.with_suffix(".mp4"), src.with_suffix(".jpg")
    date_label = datetime.strptime(b["date"], "%Y-%m-%d").strftime("%b %-d, %Y")
    work = HERE / "build" / src.stem
    work.mkdir(parents=True, exist_ok=True)

    tts = Kokoro(*fetch_models())
    chunks, frames, durations, sr, prev = [], [], [], 24000, None
    for i, seg in enumerate(b["segments"]):
        audio, sr = tts.create(seg["text"], voice=VOICES[seg["speaker"]], speed=SPEED, lang="en-us")
        if prev is not None:  # the pause belongs to the previous frame, so captions switch with the voice
            gap = PAUSE_TURN if seg["speaker"] != prev else PAUSE_SAME
            chunks.append(np.zeros(int(sr * gap), dtype=audio.dtype))
            durations[-1] += gap
        chunks.append(audio)
        durations.append(len(audio) / sr)
        prev = seg["speaker"]
        frames.append({"scene": seg["scene"], "speaker": seg["speaker"], "text": seg["text"], "dateLabel": date_label})
        print(f"  segment {i + 1}/{len(b['segments'])}", flush=True)
    chunks.append(np.zeros(int(sr * SOURCES_SECS), dtype=chunks[-1].dtype))
    durations.append(SOURCES_SECS)
    frames.append({"scene": b["segments"][-1]["scene"], "speaker": "", "dateLabel": date_label,
                   "text": "Claims are attributed as reported. Full source links are on the ForceFinder site. Not for operational use.",
                   "sources": b.get("sourcesCard") or [s["label"] for s in b.get("sources", [])][:12]})
    sf.write(work / "narration.wav", np.concatenate(chunks), sr)
    (work / "frames.json").write_text(json.dumps({"scenes": b["scenes"], "frames": frames}))

    subprocess.run(["node", str(HERE / "render_frames.js"), str(work / "frames.json"), str(work / "frames")], check=True)
    lines = []
    for i, d in enumerate(durations):
        lines += [f"file 'frames/f{i:03d}.png'", f"duration {d:.3f}"]
    lines.append(f"file 'frames/f{len(durations) - 1:03d}.png'")  # concat demuxer needs the last file repeated
    (work / "concat.txt").write_text("\n".join(lines) + "\n")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", str(work / "concat.txt"), "-i", str(work / "narration.wav"),
                    "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-tune", "stillimage", "-crf", "22",
                    "-c:a", "aac", "-b:a", "96k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-shortest",
                    "-movflags", "+faststart", str(out)], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "20", "-i", str(out),
                    "-frames:v", "1", "-q:v", "4", str(poster)], check=True)
    print(f"Wrote {out} ({sum(durations) / 60:.1f} min) and {poster.name}")


if __name__ == "__main__":
    main()

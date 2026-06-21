#!/usr/bin/env python3
"""
Build synthetic OmniVoice reference WAVs from edge-tts (for local cloning tests).

  python scripts/omnivoice-build-refs.py
  python scripts/omnivoice-build-refs.py --manifest samples/omnivoice/manifest.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path

_scripts_dir = Path(__file__).resolve().parent
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import edge_tts

log = logging.getLogger("omnivoice-refs")
ROOT = _scripts_dir.parent
DEFAULT_MANIFEST = ROOT / "samples" / "omnivoice" / "manifest.json"
TARGET_SR = 24_000


async def synthesize_mp3(text: str, voice: str, out_mp3: Path) -> None:
    communicate = edge_tts.Communicate(text, voice)
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    await communicate.save(str(out_mp3))


def resolve_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def mp3_to_wav_24k(mp3: Path, wav: Path) -> None:
    ffmpeg = resolve_ffmpeg()
    if ffmpeg:
        wav.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(mp3),
                "-ar",
                str(TARGET_SR),
                "-ac",
                "1",
                "-sample_fmt",
                "s16",
                str(wav),
            ],
            check=True,
            capture_output=True,
        )
        return
    try:
        import torchaudio
    except ImportError as e:
        raise RuntimeError(
            "Need ffmpeg (PATH), imageio-ffmpeg (pip install imageio-ffmpeg), "
            "or torchaudio to convert MP3 → 24 kHz WAV."
        ) from e

    waveform, sr = torchaudio.load(str(mp3))
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != TARGET_SR:
        waveform = torchaudio.functional.resample(waveform, sr, TARGET_SR)
    wav.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(wav), waveform, TARGET_SR)


async def build_refs(manifest_path: Path, only: list[str] | None) -> None:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    base = manifest_path.parent
    refs = data.get("refs", [])
    if only:
        refs = [r for r in refs if r.get("id") in only]
    if not refs:
        log.warning("No refs to build")
        return

    for ref in refs:
        ref_id = ref["id"]
        edge_voice = ref["edge_voice"]
        ref_text = ref["ref_text"].strip()
        rel = ref["audio"]
        wav_path = base / rel
        mp3_path = wav_path.with_suffix(".mp3")

        log.info("Building ref %s (%s) …", ref_id, edge_voice)
        await synthesize_mp3(ref_text, edge_voice, mp3_path)
        mp3_to_wav_24k(mp3_path, wav_path)
        try:
            mp3_path.unlink()
        except OSError:
            pass
        log.info("  → %s", wav_path.relative_to(ROOT))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="Path to manifest.json",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        help="Only build these ref ids",
    )
    args = parser.parse_args()
    asyncio.run(build_refs(args.manifest.resolve(), args.only))


if __name__ == "__main__":
    main()

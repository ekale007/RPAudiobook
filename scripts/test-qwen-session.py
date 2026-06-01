#!/usr/bin/env python3
"""Mini RP session samples — run: npm run tts:qwen:session"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

CHARACTER_INSTRUCT = {
    "narrator": (
        "Clear, immersive third-person audiobook narration. "
        "Natural pacing, subtle tension when the scene calls for it."
    ),
    "naya": (
        "Young woman, warm and expressive. "
        "Clear diction, emotional but controlled."
    ),
    "lucifer": (
        "Charismatic low male voice. Smooth, charming, "
        "a hint of danger beneath politeness."
    ),
}

SCENE = (
    "Quiet, suspenseful tone. Low volume, measured pacing, "
    "hold tension between phrases."
)

SAMPLES = {
    "de": {
        "narrator": (
            "Ryan",
            "German",
            "Die Gasse war leer, bis auf das Prasseln des Regens. "
            "Elias blieb stehen und lauschte.",
        ),
        "naya": (
            "Serena",
            "German",
            "Du hättest mir sagen können, dass es gefährlich wird.",
        ),
        "lucifer": (
            "Eric",
            "German",
            "Gefahr ist nur eine andere Form von Einladung.",
        ),
    },
    "en": {
        "narrator": (
            "Ryan",
            "English",
            "The alley was empty except for the rain. "
            "Elias stopped and listened.",
        ),
        "naya": (
            "Serena",
            "English",
            "You could have told me it would be dangerous.",
        ),
        "lucifer": (
            "Eric",
            "English",
            "Danger is merely another kind of invitation.",
        ),
    },
}


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:5125")
    parser.add_argument("--locale", choices=("de", "en"), default="de")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    out_dir = root / "test-output" / "qwen-session"
    out_dir.mkdir(parents=True, exist_ok=True)

    with urllib.request.urlopen(f"{base}/health", timeout=10) as res:
        print("Health:", res.read().decode()[:100], "...")

    for key, (voice, lang, text) in SAMPLES[args.locale].items():
        instruct = CHARACTER_INSTRUCT[key]
        if key == "narrator":
            instruct = f"{instruct} {SCENE}"
        body = json.dumps(
            {"text": text, "voice": voice, "language": lang, "instruct": instruct}
        ).encode()
        req = urllib.request.Request(
            f"{base}/speak",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        print(f"=== {key} ({voice}) ===")
        with urllib.request.urlopen(req, timeout=300) as res:
            path = out_dir / f"{args.locale}-{key}.wav"
            path.write_bytes(res.read())
            print(f"  OK {path.name} ({path.stat().st_size} bytes)")

    print("Done:", out_dir)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(e, file=sys.stderr)
        raise SystemExit(1) from e

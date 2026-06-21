#!/usr/bin/env python3
"""
Generate OmniVoice probe clips from samples/omnivoice/manifest.json.

Requires: npm run tts:omnivoice:install  and  python scripts/omnivoice-build-refs.py

  python scripts/omnivoice-probe.py
  python scripts/omnivoice-probe.py --only de_clone_story_01
  python scripts/omnivoice-probe.py --device cpu --num-step 16
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import soundfile as sf
import torch

_scripts_dir = Path(__file__).resolve().parent
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))
from load_env import apply_repo_env

log = logging.getLogger("omnivoice-probe")
ROOT = _scripts_dir.parent
DEFAULT_MANIFEST = ROOT / "samples" / "omnivoice" / "manifest.json"
DEFAULT_MODEL = "k2-fsa/OmniVoice"
OUT_DIR = ROOT / "samples" / "omnivoice" / "probes"

_model = None


def resolve_device(requested: str) -> tuple[str, torch.dtype]:
    if requested == "auto":
        if torch.cuda.is_available():
            return "cuda:0", torch.float16
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps", torch.float16
        return "cpu", torch.float32
    if requested.startswith("cuda"):
        return requested, torch.float16
    if requested == "mps":
        return "mps", torch.float16
    return "cpu", torch.float32


def get_model(model_id: str, device: str, dtype: torch.dtype):
    global _model
    if _model is not None:
        return _model
    from omnivoice import OmniVoice

    apply_repo_env()
    log.info("Loading %s on %s (%s) …", model_id, device, dtype)
    _model = OmniVoice.from_pretrained(model_id, device_map=device, dtype=dtype)
    log.info("OmniVoice ready.")
    return _model


def ref_index(manifest: dict, base: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for ref in manifest.get("refs", []):
        rid = ref["id"]
        audio = base / ref["audio"]
        out[rid] = {**ref, "_audio_path": audio}
    return out


def run_probe(
    model,
    probe: dict,
    refs: dict[str, dict],
    base: Path,
    out_dir: Path,
    num_step: int,
    speed: float,
) -> Path:
    probe_id = probe["id"]
    text = probe["text"].strip()
    mode = probe.get("mode", "clone")
    out_path = out_dir / f"{probe_id}.wav"

    gen_kwargs: dict = {"text": text, "num_step": num_step, "speed": speed}

    if mode == "clone":
        ref_id = probe.get("ref_id")
        if not ref_id or ref_id not in refs:
            raise ValueError(f"Probe {probe_id}: missing or unknown ref_id {ref_id!r}")
        ref = refs[ref_id]
        audio_path = ref["_audio_path"]
        if not audio_path.is_file():
            raise FileNotFoundError(
                f"Missing ref audio {audio_path}. Run: python scripts/omnivoice-build-refs.py"
            )
        gen_kwargs["ref_audio"] = str(audio_path)
        gen_kwargs["ref_text"] = ref["ref_text"].strip()
    elif mode == "design":
        instruct = probe.get("instruct", "").strip()
        if not instruct:
            raise ValueError(f"Probe {probe_id}: design mode needs instruct")
        gen_kwargs["instruct"] = instruct
    elif mode == "auto":
        pass
    else:
        raise ValueError(f"Unknown mode {mode!r}")

    log.info("Probe %s (%s) …", probe_id, mode)
    audio = model.generate(**gen_kwargs)
    if not audio:
        raise RuntimeError(f"Probe {probe_id}: no audio returned")
    out_dir.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), audio[0], 24_000)
    log.info("  → %s", out_path.relative_to(ROOT))
    return out_path


def write_probe_readme(out_dir: Path, manifest_path: Path, results: list[dict]) -> None:
    lines = [
        "# OmniVoice probe outputs",
        "",
        f"Manifest: `{manifest_path.relative_to(ROOT).as_posix()}`",
        "",
        "| File | Mode | Ref / instruct |",
        "|------|------|----------------|",
    ]
    for r in results:
        extra = r.get("ref_id") or r.get("instruct") or "—"
        lines.append(f"| `{r['file']}` | {r['mode']} | {extra} |")
    (out_dir / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--device", default="auto", help="auto | cpu | cuda:0 | mps")
    parser.add_argument("--only", nargs="*", help="Probe ids to run")
    parser.add_argument("--num-step", type=int, default=32)
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    base = manifest_path.parent
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    probes = data.get("probes", [])
    if args.only:
        probes = [p for p in probes if p.get("id") in args.only]
    if not probes:
        log.error("No probes selected")
        sys.exit(1)

    device, dtype = resolve_device(args.device)
    model = get_model(args.model, device, dtype)
    refs = ref_index(data, base)
    out_dir = args.out_dir.resolve()
    results: list[dict] = []

    for probe in probes:
        path = run_probe(
            model,
            probe,
            refs,
            base,
            out_dir,
            args.num_step,
            args.speed,
        )
        results.append(
            {
                "file": path.name,
                "mode": probe.get("mode"),
                "ref_id": probe.get("ref_id"),
                "instruct": probe.get("instruct"),
            }
        )

    write_probe_readme(out_dir, manifest_path, results)
    log.info("Done — %d probe(s) in %s", len(results), out_dir.relative_to(ROOT))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate missing audiobook library covers locally (SDXL-Turbo).

Reads prompts from libraryTemplates.ts + libraryTemplatesExtra.ts.
Writes WebP to public/library-covers/{id}.webp (2:3 portrait).

Usage (from repo root, after install-covers.ps1):
  .venv-covers\\Scripts\\python.exe scripts/generate-library-covers.py --list-missing
  .venv-covers\\Scripts\\python.exe scripts/generate-library-covers.py --missing
  .venv-covers\\Scripts\\python.exe scripts/generate-library-covers.py --id guild-last-light
  .venv-covers\\Scripts\\python.exe scripts/generate-library-covers.py --all --force
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COVER_DIR = ROOT / "public" / "library-covers"
TEMPLATE_FILES = (
    ROOT / "src" / "lib" / "story" / "libraryTemplates.ts",
    ROOT / "src" / "lib" / "story" / "libraryTemplatesExtra.ts",
)

DEFAULT_MODEL = "stabilityai/sdxl-turbo"
DEFAULT_WIDTH = 768
DEFAULT_HEIGHT = 1152
DEFAULT_STEPS = 4


def load_env() -> None:
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        from load_env import apply_repo_env

        apply_repo_env()
    except ImportError:
        pass


def parse_cover_jobs() -> list[tuple[str, str]]:
    """Return [(template_id, prompt), ...] in file order."""
    pattern = re.compile(
        r'id:\s*"([^"]+)"[\s\S]*?coverImagePrompt:\s*\n\s*"((?:[^"\\]|\\.)*)"',
        re.MULTILINE,
    )
    jobs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for path in TEMPLATE_FILES:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for match in pattern.finditer(text):
            template_id, prompt = match.group(1), match.group(2)
            if template_id in seen:
                continue
            seen.add(template_id)
            jobs.append((template_id, prompt))
    return jobs


def cover_path(template_id: str) -> Path:
    return COVER_DIR / f"{template_id}.webp"


def list_missing(jobs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    return [(i, p) for i, p in jobs if not cover_path(i).is_file()]


def pick_device(requested: str):
    import torch

    if requested == "cpu":
        return torch.device("cpu"), torch.float32
    if requested == "cuda":
        if not torch.cuda.is_available():
            print("CUDA not available — use --device cpu", file=sys.stderr)
            sys.exit(1)
        return torch.device("cuda"), torch.float16
    # auto
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        print(f"GPU: {name}", flush=True)
        return torch.device("cuda"), torch.float16
    print("No GPU — running on CPU (very slow, ~15-30 min per image)", flush=True)
    return torch.device("cpu"), torch.float32


def generate_one(
    pipe,
    prompt: str,
    *,
    width: int,
    height: int,
    steps: int,
    seed: int | None,
):
    import torch

    generator = None
    if seed is not None:
        generator = torch.Generator(device=pipe.device.type).manual_seed(seed)

    kwargs = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
        "guidance_scale": 0.0,
    }
    if generator is not None:
        kwargs["generator"] = generator

    result = pipe(**kwargs)
    return result.images[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate library cover WebP files locally")
    parser.add_argument("--list-missing", action="store_true", help="Print templates without a .webp file")
    parser.add_argument("--missing", action="store_true", help="Generate only missing covers")
    parser.add_argument("--all", action="store_true", help="Generate all templates")
    parser.add_argument("--id", action="append", dest="ids", metavar="ID", help="Generate one template (repeatable)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Diffusers model id (default: {DEFAULT_MODEL})")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    parser.add_argument("--steps", type=int, default=DEFAULT_STEPS)
    parser.add_argument("--seed", type=int, default=None, help="Fixed seed for reproducibility")
    parser.add_argument(
        "--device",
        choices=("auto", "cuda", "cpu"),
        default="auto",
    )
    parser.add_argument("--quality", type=int, default=88, help="WebP quality 1–100")
    args = parser.parse_args()

    load_env()
    jobs = parse_cover_jobs()
    if not jobs:
        print("No cover prompts found in library template files.", file=sys.stderr)
        return 1

    if args.list_missing:
        missing = list_missing(jobs)
        if not missing:
            print("All library covers present under public/library-covers/")
            return 0
        print(f"Missing ({len(missing)}):")
        for template_id, _ in missing:
            print(f"  - {template_id}  ->  {cover_path(template_id).name}")
        return 0

    if args.ids:
        id_set = set(args.ids)
        selected = [(i, p) for i, p in jobs if i in id_set]
        unknown = id_set - {i for i, _ in selected}
        if unknown:
            print(f"Unknown template id(s): {', '.join(sorted(unknown))}", file=sys.stderr)
            return 1
    elif args.all:
        selected = jobs
    elif args.missing:
        selected = list_missing(jobs)
        if not selected:
            print("Nothing missing — all covers exist.")
            return 0
    else:
        parser.print_help()
        print("\nTip: --list-missing  then  --missing", file=sys.stderr)
        return 1

    COVER_DIR.mkdir(parents=True, exist_ok=True)

    to_run: list[tuple[str, str]] = []
    for template_id, prompt in selected:
        out = cover_path(template_id)
        if out.is_file() and not args.force:
            print(f"Skip (exists): {out.name}")
            continue
        to_run.append((template_id, prompt))

    if not to_run:
        print("No images to generate.")
        return 0

    import torch
    from diffusers import AutoPipelineForText2Image

    device, dtype = pick_device(args.device)
    print(f"Loading {args.model} … (first run downloads ~6–7 GB)", flush=True)

    pipe = AutoPipelineForText2Image.from_pretrained(
        args.model,
        torch_dtype=dtype,
        variant="fp16" if dtype == torch.float16 else None,
    )
    pipe = pipe.to(device)
    if device.type == "cuda":
        pipe.enable_attention_slicing()

    print(f"Generating {len(to_run)} cover(s) at {args.width}x{args.height}, {args.steps} steps …", flush=True)

    for n, (template_id, prompt) in enumerate(to_run, 1):
        out = cover_path(template_id)
        print(f"[{n}/{len(to_run)}] {template_id} …", flush=True)
        image = generate_one(
            pipe,
            prompt,
            width=args.width,
            height=args.height,
            steps=args.steps,
            seed=args.seed,
        )
        image.save(out, format="WEBP", quality=args.quality, method=6)
        print(f"  -> {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)", flush=True)

    print("Done. Add coverImageSrc in libraryTemplates if not set, then commit public/library-covers/*.webp")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

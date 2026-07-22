#!/usr/bin/env python3
"""
Convert MP4/MOV videos to web-optimized WebM (VP9 + Opus) for the slideshow.

Uses the ffmpeg binary via subprocess, so there are no pip dependencies.
Encodes with constant-quality VP9 (-crf, -b:v 0), which is the recommended
mode for web delivery. Accepts a single .mp4/.mov file or a directory of them.

Usage:
    python3 scripts/mp4_to_webm.py path/to/video.mp4
    python3 scripts/mp4_to_webm.py path/to/video.mov
    python3 scripts/mp4_to_webm.py input/videos            # convert a folder
    python3 scripts/mp4_to_webm.py input/videos --crf 33 --width 1440 --no-audio
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Project root is the parent of this script's directory.
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_IN = ROOT / "input" / "videos"
DEFAULT_OUT = ROOT / "output" / "videos"

# VP9 constant-quality default. Lower crf = higher quality/bigger file.
# 30-34 is a good range for web; 32 is a reasonable middle ground.
QUALITY = 32
SUPPORTED_INPUT_EXTENSIONS = {".mp4", ".mov"}


def require(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        sys.exit(
            f"error: '{tool}' not found on PATH.\n"
            f"Install it with Homebrew: brew install ffmpeg"
        )
    return path


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"error running {cmd[0]}:\n{result.stderr.strip()}")


def gather(src: Path) -> list[Path]:
    """Return the list of supported video files to convert from a file or directory."""
    if src.is_file():
        if src.suffix.lower() not in SUPPORTED_INPUT_EXTENSIONS:
            sys.exit(f"error: {src.name} is not a supported video file")
        return [src]
    if src.is_dir():
        mp4s = sorted(
            p
            for p in src.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED_INPUT_EXTENSIONS
        )
        if not mp4s:
            sys.exit(f"error: no supported video files found in {src}")
        return mp4s
    sys.exit(f"error: no such file or directory: {src}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert MP4/MOV videos to WebM (VP9 + Opus)."
    )
    parser.add_argument(
        "src",
        type=Path,
        default=DEFAULT_IN,
        nargs="?",
        help=f"Source .mp4/.mov file or directory (default: {DEFAULT_IN})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output directory (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--crf",
        type=int,
        default=QUALITY,
        help=f"VP9 quality, lower = better/bigger (default: {QUALITY})",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=None,
        help="Scale to this width, preserving aspect ratio (default: keep original)",
    )
    parser.add_argument(
        "--no-audio",
        action="store_true",
        help="Drop the audio track (useful for muted autoplay backgrounds)",
    )
    args = parser.parse_args()

    ffmpeg = require("ffmpeg")

    src = args.src.expanduser().resolve()
    sources = gather(src)

    out_dir: Path = args.out.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"Converting {len(sources)} video(s) to WebM (VP9, crf {args.crf}) "
        f"-> {out_dir} ..."
    )

    for i, mp4 in enumerate(sources, start=1):
        dest = out_dir / f"{mp4.stem}.webm"

        cmd = [
            ffmpeg,
            "-y",
            "-i",
            str(mp4),
            "-c:v",
            "libvpx-vp9",
            "-crf",
            str(args.crf),
            "-b:v",
            "0",
            "-row-mt",
            "1",
        ]  # multithreaded VP9 encoding
        if args.width:
            cmd += ["-vf", f"scale={args.width}:-2"]  # -2 keeps even height
        if args.no_audio:
            cmd += ["-an"]
        else:
            cmd += ["-c:a", "libopus", "-b:a", "128k"]
        cmd.append(str(dest))

        run(cmd)

        in_mb = mp4.stat().st_size / (1024 * 1024)
        out_mb = dest.stat().st_size / (1024 * 1024)
        print(
            f"  [{i}/{len(sources)}] {mp4.name} ({in_mb:.1f} MB) "
            f"-> {dest.name} ({out_mb:.1f} MB)"
        )

    print("\nDone.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Convert a PDF into per-page web-optimized images for the slideshow.

Renders each PDF page to a 1440x809 (16:9) WebP image in static/slides/ and
writes a manifest.json the Svelte app reads. Uses the already-installed poppler
(pdftocairo) + ImageMagick binaries, so there are no pip dependencies.

Usage:
    python3 scripts/pdf_to_slides.py path/to/deck.pdf
"""

import argparse
import csv
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Project root is the parent of this script's directory.
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "input" / "slides"

# Fixed slide dimensions (16:9). Every page is rendered to exactly this size.
WIDTH = 1440
HEIGHT = 809
QUALITY = 82


def require(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        sys.exit(
            f"error: '{tool}' not found on PATH.\n"
            f"Install it with Homebrew: brew install "
            f"{'poppler' if tool.startswith('pdf') else 'imagemagick'}"
        )
    return path


def load_ids(config_path: Path) -> dict[int, str]:
    """Map slide number -> id from the config CSV.

    The header row has duplicate column names ("Slide" appears twice), so we
    match by the FIRST column named "Slide" (the continuous 1..N numbering that
    lines up with PDF pages) and the "id" column.
    """
    if not config_path.is_file():
        return {}

    with config_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            return {}

        headers = [h.strip().lower() for h in header]
        try:
            slide_col = headers.index("slide")
            id_col = headers.index("id")
        except ValueError:
            sys.exit("error: config CSV must have 'Slide' and 'id' columns.")

        mapping: dict[int, str] = {}
        for row in reader:
            if len(row) <= max(slide_col, id_col):
                continue
            slide_cell = row[slide_col].strip()
            id_cell = row[id_col].strip()
            if not slide_cell or not id_cell:
                continue
            try:
                mapping[int(slide_cell)] = id_cell
            except ValueError:
                continue  # skip non-numeric slide values
    return mapping


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"error running {cmd[0]}:\n{result.stderr.strip()}")


def identify_size(magick: str, img: Path) -> tuple[int, int]:
    """Return (width, height) in pixels for an image."""
    out = subprocess.run(
        [magick, "identify", "-format", "%w %h", str(img)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        # ImageMagick 6 exposes `identify` as its own binary.
        alt = shutil.which("identify")
        if alt:
            out = subprocess.run(
                [alt, "-format", "%w %h", str(img)],
                capture_output=True, text=True,
            )
    w, h = out.stdout.strip().split()
    return int(w), int(h)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a PDF into slideshow images.")
    parser.add_argument("pdf", type=Path, help="Path to the source PDF")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help=f"Output directory (default: {DEFAULT_OUT})")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG,
                        help=f"CSV mapping slide numbers to ids (default: {DEFAULT_CONFIG})")
    args = parser.parse_args()

    pdf = args.pdf.expanduser().resolve()
    if not pdf.is_file():
        sys.exit(f"error: no PDF at {pdf}")

    pdftocairo = require("pdftocairo")
    magick = require("magick") if shutil.which("magick") else require("convert")

    ids = load_ids(args.config)
    if ids:
        print(f"Loaded {len(ids)} slide ids from {args.config.name}")

    out_dir: Path = args.out
    # Start fresh so removed pages don't linger.
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    print(f"Rendering {pdf.name} at {WIDTH}x{HEIGHT} ...")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        prefix = tmp_dir / "page"
        # pdftocairo renders crisp PNGs, forced to the fixed 16:9 dimensions.
        run([
            pdftocairo, "-png",
            "-scale-to-x", str(WIDTH),
            "-scale-to-y", str(HEIGHT),
            str(pdf), str(prefix),
        ])

        pages = sorted(tmp_dir.glob("page-*.png"),
                       key=lambda p: int(p.stem.split("-")[-1]))
        if not pages:
            sys.exit("error: pdftocairo produced no pages.")

        manifest = []
        pad = max(3, len(str(len(pages))))
        for i, png in enumerate(pages, start=1):
            name = f"slide-{i:0{pad}d}.webp"
            dest = out_dir / name
            run([magick, str(png), "-strip", "-quality", str(QUALITY), str(dest)])
            w, h = identify_size(magick, dest)
            size_kb = dest.stat().st_size / 1024
            entry = {"src": f"slides/{name}", "w": w, "h": h, "id": ids.get(i)}
            manifest.append(entry)
            id_note = f"  #{entry['id']}" if entry["id"] else ""
            print(f"  slide {i:>3}/{len(pages)}  {name}  {w}x{h}  {size_kb:.0f} KB{id_note}")

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps({
        "source": pdf.name,
        "count": len(manifest),
        "slides": manifest,
    }, indent=2))

    total_mb = sum((out_dir / Path(s["src"]).name).stat().st_size
                   for s in manifest) / (1024 * 1024)
    print(f"\nDone: {len(manifest)} slides, {total_mb:.1f} MB total -> {out_dir}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()

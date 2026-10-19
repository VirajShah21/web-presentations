#!/usr/bin/env python3
"""Create a presentation workspace from the reusable HTML shell."""

from __future__ import annotations

import argparse
import html
import re
import shutil
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = PLUGIN_ROOT / "assets" / "template"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path, help="New directory for the editable presentation")
    parser.add_argument("--title", default="Web Presentation", help="Presentation title")
    parser.add_argument("--mode", choices=("light", "dark"), required=True, help="Required user-selected theme mode")
    parser.add_argument("--accent-color", required=True, help="Required six-digit hex accent color, e.g. #4F46E5")
    args = parser.parse_args()
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", args.accent_color):
        parser.error("--accent-color must be a six-digit hex color such as #4F46E5")
    destination = args.output_dir.expanduser().resolve()
    if destination.exists() and any(destination.iterdir()):
        parser.error(f"Output directory is not empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    for child in TEMPLATE.iterdir():
        target = destination / child.name
        if child.is_dir():
            shutil.copytree(child, target, dirs_exist_ok=True)
        else:
            shutil.copy2(child, target)
    index = destination / "index.html"
    source = index.read_text(encoding="utf-8")
    safe_title = html.escape(args.title, quote=True)
    source = source.replace("<title>Web Presentation</title>", f"<title>{safe_title}</title>")
    source = source.replace('data-title="Web Presentation"', f'data-title="{safe_title}"')
    source = source.replace('data-theme="dark"', f'data-theme="{args.mode}"')
    source = re.sub(
        r'style="--wp-accent:\s*#[0-9a-fA-F]{6}"',
        f'style="--wp-accent: {args.accent_color.upper()}"',
        source,
        count=1,
    )
    source = re.sub(r"YOUR BRAND", html.escape(args.title.upper()), source)
    index.write_text(source, encoding="utf-8")
    print(f"Created presentation workspace: {destination}")
    print(f"Entry point: {index}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

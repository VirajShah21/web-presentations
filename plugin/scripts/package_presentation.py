#!/usr/bin/env python3
"""Validate and package an index.html/assets presentation as a portable ZIP."""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


REMOTE_SCHEMES = {"http", "https", "mailto", "tel", "data", "blob", "javascript"}
URL_ATTRS = {"src", "href", "poster", "data"}


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for attr in URL_ATTRS:
            value = values.get(attr)
            if value:
                self.references.append((value.strip(), f"<{tag} {attr}>") )
        srcset = values.get("srcset")
        if srcset:
            for candidate in srcset.split(","):
                if candidate.strip():
                    self.references.append((candidate.strip().split()[0], f"<{tag} srcset>"))
        style = values.get("style")
        if style:
            self.references.extend((url, "inline style url()") for url in re.findall(r"url\(['\"]?(.*?)['\"]?\)", style, re.I))


def local_path(root: Path, value: str, relative_to: Path | None = None) -> Path | None:
    value = value.strip()
    if not value or value.startswith("#"):
        return None
    parsed = urlsplit(value)
    if parsed.scheme.lower() in REMOTE_SCHEMES or parsed.netloc:
        return None
    raw_path = unquote(parsed.path)
    if not raw_path:
        return None
    anchor = root if raw_path.startswith("/") or relative_to is None else relative_to
    target = (anchor / raw_path.lstrip("/")).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        raise ValueError(f"Reference escapes presentation directory: {value}") from None
    return target


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    index = root / "index.html"
    assets = root / "assets"
    if not index.is_file():
        errors.append("index.html is missing")
        return errors
    if not assets.is_dir():
        errors.append("assets/ directory is missing")
    unexpected = sorted(p.name for p in root.iterdir() if p.name not in {"index.html", "assets", ".DS_Store"})
    if unexpected:
        errors.append("Only index.html and assets/ may be at the ZIP root; found: " + ", ".join(unexpected))
    try:
        parser = ReferenceParser()
        parser.feed(index.read_text(encoding="utf-8"))
    except (OSError, UnicodeError) as exc:
        errors.append(f"Could not read index.html: {exc}")
        return errors
    for ref, context in parser.references:
        try:
            target = local_path(root, ref)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if target is not None and not target.exists():
            errors.append(f"Missing local file referenced by {context}: {ref}")
    if assets.is_dir():
        for file in sorted(assets.rglob("*")):
            if file.is_symlink():
                errors.append(f"Symbolic links are not allowed in assets/: {file.relative_to(root)}")
            if file.is_file() and file.suffix.lower() in {".css", ".html"}:
                try:
                    content = file.read_text(encoding="utf-8")
                except (OSError, UnicodeError) as exc:
                    errors.append(f"Could not read {file.relative_to(root)}: {exc}")
                    continue
                for ref in re.findall(r"url\(['\"]?(.*?)['\"]?\)", content, re.I):
                    try:
                        target = local_path(root, ref, file.parent)
                    except ValueError as exc:
                        errors.append(str(exc))
                        continue
                    if target is not None and not target.exists():
                        errors.append(f"Missing local file referenced in {file.relative_to(root)}: {ref}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("presentation_dir", type=Path, help="Directory containing index.html and assets/")
    parser.add_argument("--output", type=Path, help="ZIP destination (defaults to <directory>.zip)")
    args = parser.parse_args()
    root = args.presentation_dir.expanduser().resolve()
    if not root.is_dir():
        parser.error(f"Presentation directory does not exist: {root}")
    errors = validate(root)
    if errors:
        print("Presentation validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    output = (args.output or root.with_suffix(".zip")).expanduser().resolve()
    if output == root or root in output.parents:
        parser.error("ZIP output must be outside the presentation directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        archive.writestr("assets/", "")
        for file in sorted(root.rglob("*")):
            if file.name == ".DS_Store" or "__MACOSX" in file.parts:
                continue
            if file.is_symlink():
                continue
            if file.is_file():
                archive.write(file, file.relative_to(root).as_posix())
    print(f"Packaged {root} -> {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

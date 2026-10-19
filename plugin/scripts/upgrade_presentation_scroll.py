#!/usr/bin/env python3
"""Upgrade a compatible existing deck to the installed plugin's scroll shell."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit


TEMPLATE_ASSETS = Path(__file__).resolve().parents[1] / "assets/template/assets"
VOID_TAGS = set("area base br col embed hr img input link meta param source track wbr".split())
ATTR = re.compile(r"""(?P<name>[^\s=/>]+)(?:\s*=\s*(?:"(?P<double>[^"]*)"|'(?P<single>[^']*)'|(?P<bare>[^\s>]+)))?""")
MAX_ZIP_BYTES = 1024 * 1024 * 1024
MAX_ZIP_FILES = 10000


def no_symlinks(path: Path) -> Path:
    path = Path(os.path.abspath(path.expanduser()))
    for part in [*reversed(path.parents), path]:
        if part.is_symlink():
            raise ValueError(f"Symbolic links are not supported: {part}")
    return path


def inspect_tree(root: Path) -> None:
    no_symlinks(root)
    if not root.is_dir():
        raise ValueError(f"Presentation directory does not exist: {root}")
    for folder, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            child = Path(folder) / name
            if child.is_symlink() or not (child.is_dir() or child.is_file()):
                raise ValueError(f"Unsupported filesystem entry: {child}")


def local_asset(value: str | None, expected: str) -> bool:
    parsed = urlsplit(value or "")
    return (
        not parsed.scheme and not parsed.netloc
        and parsed.path in (expected, "./" + expected)
    )


class ShellParser(HTMLParser):
    """Use the parser for structure; keep original tokens for byte-preserving edits."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", source)]
        self.stack: list[dict] = []
        self.nodes: list[dict] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        raw = self.get_starttag_text()
        names = [name for name, _ in attrs]
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        relevant = bool(classes & {"wp-root", "wp-stage", "wp-slide", "wp-states", "wp-state"})
        if (relevant or tag in {"script", "link"}) and len(names) != len(set(names)):
            raise ValueError("Duplicate attributes in a shell or asset tag are ambiguous")
        if tag == "base":
            raise ValueError("Decks with a <base> URL require manual migration")
        line, column = self.getpos()
        node = {
            "tag": tag, "attrs": values, "classes": classes,
            "parent": self.stack[-1] if self.stack else None,
            "raw": raw, "offset": self.line_starts[line - 1] + column,
        }
        self.nodes.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                # Shell containers cannot be implicitly closed by another tag.
                skipped = self.stack[i + 1:]
                if any(n["classes"] & {"wp-root", "wp-stage", "wp-slide", "wp-states", "wp-state"} for n in skipped):
                    raise ValueError("Malformed presentation shell nesting")
                del self.stack[i:]
                return

    def validate(self) -> list[dict]:
        self.feed(self.source)
        self.close()
        shell_classes = {"wp-root", "wp-stage", "wp-slide", "wp-states", "wp-state"}
        if any(n["classes"] & shell_classes for n in self.stack):
            raise ValueError("Presentation shell has unclosed containers")
        groups = {name: [n for n in self.nodes if name in n["classes"]] for name in shell_classes}
        if len(groups["wp-root"]) != 1 or len(groups["wp-stage"]) != 1:
            raise ValueError("Expected exactly one .wp-root and one .wp-stage")
        root, stage = groups["wp-root"][0], groups["wp-stage"][0]
        if "data-web-presentation" not in root["attrs"] or stage["parent"] is not root:
            raise ValueError("Expected .wp-root[data-web-presentation] > .wp-stage")
        slides = groups["wp-slide"]
        if not slides or any(n["parent"] is not stage for n in slides):
            raise ValueError("Expected .wp-slide children of .wp-stage")
        if any(n["parent"] not in slides for n in groups["wp-states"]):
            raise ValueError("A .wp-states container is outside its slide")
        if any(n["parent"] not in groups["wp-states"] for n in groups["wp-state"]):
            raise ValueError("A .wp-state is outside its .wp-states container")
        for slide in slides:
            states = [n for n in groups["wp-states"] if n["parent"] is slide]
            if len(states) != 1 or not any(n["parent"] is states[0] for n in groups["wp-state"]):
                raise ValueError("Every slide must contain one .wp-states with at least one .wp-state")
        scripts = [n for n in self.nodes if n["tag"] == "script" and local_asset(n["attrs"].get("src"), "assets/presentation-runtime.js")]
        styles = [n for n in self.nodes if n["tag"] == "link" and local_asset(n["attrs"].get("href"), "assets/presentation.css") and "stylesheet" in (n["attrs"].get("rel") or "").lower().split()]
        if len(scripts) != 1 or len(styles) != 1:
            raise ValueError("Expected one local assets/presentation-runtime.js script and presentation.css stylesheet")
        if "integrity" in scripts[0]["attrs"] or "integrity" in styles[0]["attrs"]:
            raise ValueError("Asset integrity hashes require manual migration")
        return slides


def normalize_transitions(source: str, slides: list[dict]) -> str:
    replacements: list[tuple[int, int, str]] = []
    for node in slides:
        raw, offset = node["raw"], node["offset"]
        if raw.rstrip().endswith("/>"):
            raise ValueError("Self-closing slide containers are not supported")
        head = re.match(r"<\s*[^\s/>]+", raw)
        assert head
        found = False
        for match in ATTR.finditer(raw, head.end(), len(raw) - 1):
            if match.group("name").lower() != "data-transition":
                continue
            found = True
            group = next((g for g in ("double", "single", "bare") if match.group(g) is not None), None)
            if group is None:
                end = offset + match.end("name")
                replacements.append((end, end, '="scroll"'))
            elif match.group(group) != "scroll":
                replacements.append((offset + match.start(group), offset + match.end(group), "scroll"))
        if not found:
            end = offset + len(raw) - 1
            replacements.append((end, end, ' data-transition="scroll"'))
    for start, end, value in sorted(replacements, reverse=True):
        source = source[:start] + value + source[end:]
    return source


def plan(root: Path, keep_transitions: bool = False, template: Path = TEMPLATE_ASSETS) -> dict[Path, bytes]:
    inspect_tree(root)
    index = root / "index.html"
    original = index.read_bytes()
    source = original.decode("utf-8")
    slides = ShellParser(source).validate()
    edited = source if keep_transitions else normalize_transitions(source, slides)
    desired = {index: edited.encode("utf-8")}
    for name in ("presentation-runtime.js", "presentation.css"):
        target = root / "assets" / name
        if not target.is_file():
            raise ValueError(f"Required existing asset is missing: {target}")
        desired[target] = (template / name).read_bytes()
    return {path: content for path, content in desired.items() if path.read_bytes() != content}


def atomic_write(path: Path, content: bytes, mode: int) -> None:
    fd, temporary = tempfile.mkstemp(prefix=".scroll-upgrade-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def apply_plan(root: Path, changes: dict[Path, bytes], backup: Path) -> None:
    if not changes:
        return
    backup = no_symlinks(backup)
    if backup == root or root in backup.parents or backup in root.parents:
        raise ValueError("Backup must be a separate directory outside the presentation")
    if backup.exists():
        raise ValueError(f"Backup directory already exists; choose a new path: {backup}")
    originals = {p: (p.read_bytes(), stat.S_IMODE(p.stat().st_mode)) for p in changes}
    backup.mkdir(parents=True)
    for path, (content, mode) in originals.items():
        destination = backup / path.relative_to(root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        destination.chmod(mode)
    (backup / "upgrade-manifest.json").write_text(json.dumps({
        "presentation": str(root),
        "files": {str(p.relative_to(root)): hashlib.sha256(b).hexdigest() for p, (b, _) in originals.items()},
    }, indent=2) + "\n", encoding="utf-8")
    written: list[Path] = []
    try:
        for path, content in changes.items():
            no_symlinks(path)
            if path.read_bytes() != originals[path][0]:
                raise ValueError(f"Presentation changed during upgrade: {path}")
            written.append(path)
            atomic_write(path, content, originals[path][1])
    except BaseException as exc:
        errors = []
        for path in reversed(written):
            try:
                atomic_write(path, *originals[path])
            except OSError as rollback:
                errors.append(f"{path}: {rollback}")
        if errors:
            raise RuntimeError(f"Upgrade failed; restore from {backup}. Rollback errors: {'; '.join(errors)}") from exc
        raise


def extract_zip(archive_path: Path, destination: Path) -> None:
    """Extract into a private temporary directory only after validating every name."""
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        if len(members) > MAX_ZIP_FILES or sum(i.file_size for i in members) > MAX_ZIP_BYTES:
            raise ValueError("ZIP exceeds 10,000 entries or 1 GiB uncompressed")
        seen: set[str] = set()
        for item in members:
            name = item.filename
            parts = PurePosixPath(name).parts
            mode = item.external_attr >> 16
            kind = stat.S_IFMT(mode)
            if (
                not name or "\x00" in name or "\\" in name or ":" in name
                or name.startswith("/") or ".." in parts or "." in name.split("/")
                or not parts or parts[0] not in {"index.html", "assets"}
                or (parts[0] == "index.html" and (len(parts) != 1 or item.is_dir()))
                or (parts == ("assets",) and not item.is_dir())
                or (kind not in {0, stat.S_IFREG, stat.S_IFDIR})
                or item.flag_bits & 1
            ):
                raise ValueError(f"Unsafe or unsupported ZIP entry: {name!r}")
            key = name.rstrip("/").casefold()
            if key in seen:
                raise ValueError(f"Duplicate ZIP path: {name!r}")
            seen.add(key)
        for item in members:
            target = destination.joinpath(*PurePosixPath(item.filename).parts)
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(item) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)
        if not (destination / "index.html").is_file():
            raise ValueError("ZIP must have index.html and assets/ at its root")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("presentation", type=Path, help="Existing deck directory or portable ZIP")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Read-only compatibility and change report")
    mode.add_argument("--apply", action="store_true", help="Apply after creating an external backup")
    parser.add_argument("--backup-dir", type=Path, help="New external directory; required with --apply")
    parser.add_argument("--output-dir", type=Path, help="New destination for an upgraded ZIP input")
    parser.add_argument("--keep-transitions", action="store_true", help="Preserve slide transition attributes")
    args = parser.parse_args(argv)
    if args.apply and args.backup_dir is None:
        parser.error("--apply requires --backup-dir outside the presentation")
    try:
        source = no_symlinks(args.presentation)
        is_zip = source.is_file() and zipfile.is_zipfile(source)
        if args.output_dir and not is_zip:
            raise ValueError("--output-dir is only supported with ZIP input")
        if is_zip and args.apply and not args.output_dir:
            raise ValueError("ZIP input requires a new --output-dir with --apply")
        output = no_symlinks(args.output_dir) if args.output_dir else None
        if output and output.exists():
            raise ValueError(f"ZIP output directory must not exist: {output}")
        if is_zip:
            with tempfile.TemporaryDirectory(prefix="presentation-scroll-check-") as scratch:
                root = Path(scratch).resolve() / "deck"
                root.mkdir()
                extract_zip(source, root)
                changes = plan(root, args.keep_transitions)
                names = [str(p.relative_to(root)) for p in changes]
                if args.apply:
                    assert output is not None
                    # Check the complete deck before making the requested output.
                    backup = no_symlinks(args.backup_dir)
                    if backup == output or output in backup.parents or backup in output.parents:
                        raise ValueError("Backup must be separate from the ZIP output directory")
                    if backup == source or source in backup.parents:
                        raise ValueError("Backup cannot overwrite the source ZIP")
                    output.parent.mkdir(parents=True, exist_ok=True)
                    created_output = False
                    try:
                        output.mkdir()
                        created_output = True
                        shutil.copytree(root, output, dirs_exist_ok=True)
                        apply_plan(output, {output / p.relative_to(root): b for p, b in changes.items()}, backup)
                    except BaseException:
                        if created_output:
                            shutil.rmtree(output)
                        raise
                report = {"compatible": True, "changes": names, "applied": bool(args.apply), "output": str(output) if args.apply else None}
        else:
            changes = plan(source, args.keep_transitions)
            if args.apply:
                apply_plan(source, changes, args.backup_dir)
            report = {"compatible": True, "changes": [str(p.relative_to(source)) for p in changes], "applied": bool(args.apply and changes)}
        print(json.dumps(report, indent=2))
        return 0
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError) as exc:
        print(f"Upgrade refused or failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

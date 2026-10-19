"""Behavioral regression checks for the existing-deck migration."""

import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/upgrade_presentation_scroll.py"
spec = importlib.util.spec_from_file_location("upgrade_scroll", SCRIPT)
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)

HTML = """<!doctype html>
<html><head><title>A real deck</title>
<link rel="stylesheet" href="./assets/presentation.css?v=old">
<link rel="stylesheet" href="assets/custom.css">
</head><body>
<main class="wp-root" data-web-presentation data-theme="light" style="--wp-accent:#123456">
<div class="wp-stage">
<SECTION class='wp-slide custom' STYLE="--label: 'data-transition=fade'; --x:'>'" DATA-TRANSITION = 'zoom'>
<div class="wp-states"><article class="wp-state"><h1>Keep me &amp; my title</h1>
<button onclick="test()">Try it</button></article><article class="wp-state">Two</article></div></SECTION>
<section data-transition=fade class="wp-slide"><div class="wp-states"><article class="wp-state">Three</article></div></section>
<section class="wp-slide"><div class="wp-states"><article class="wp-state">Four</article></div></section>
</div><div class="wp-persistent-layer">BRAND</div></main>
<!-- data-transition="fade" must remain here -->
<script>const x = 'data-transition="fade"';</script>
<script src="assets/custom-transitions.js"></script>
<SCRIPT SRC="./assets/presentation-runtime.js?v=1#entry"></SCRIPT>
</body></html>
"""


class UpgradeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.deck = self.base / "deck"
        (self.deck / "assets").mkdir(parents=True)
        (self.deck / "index.html").write_bytes(HTML.replace("\n", "\r\n").encode())
        (self.deck / "assets/presentation.css").write_bytes(b"old baseline css")
        (self.deck / "assets/presentation-runtime.js").write_bytes(b"old runtime")
        (self.deck / "assets/custom.css").write_bytes(b".custom { font-family: Local; }")
        (self.deck / "assets/custom-transitions.js").write_bytes(b"custom transition")
        (self.deck / "assets/font.woff").write_bytes(b"custom-font")
        self.template = self.base / "template"
        self.template.mkdir()
        (self.template / "presentation.css").write_bytes(b"new baseline css")
        (self.template / "presentation-runtime.js").write_bytes(b"new runtime")
        self.backup = self.base / "backup"

    def snapshot(self):
        return {str(p.relative_to(self.deck)): p.read_bytes() for p in self.deck.rglob("*") if p.is_file()}

    def plan(self, keep=False):
        return upgrade.plan(self.deck, keep, self.template)

    def test_surgical_upgrade_backup_and_noop(self):
        before = self.snapshot()
        changes = self.plan()
        self.assertEqual(len(changes), 3)
        upgrade.apply_plan(self.deck, changes, self.backup)
        after = self.snapshot()
        expected = before["index.html"].replace(b"DATA-TRANSITION = 'zoom'", b"DATA-TRANSITION = 'scroll'").replace(b"data-transition=fade class", b"data-transition=scroll class").replace(b'<section class="wp-slide">', b'<section class="wp-slide" data-transition="scroll">')
        self.assertEqual(after["index.html"], expected)
        self.assertEqual(after["assets/presentation.css"], b"new baseline css")
        self.assertEqual(after["assets/presentation-runtime.js"], b"new runtime")
        for file in ("assets/custom.css", "assets/custom-transitions.js", "assets/font.woff"):
            self.assertEqual(after[file], before[file])
        for file in ("index.html", "assets/presentation.css", "assets/presentation-runtime.js"):
            self.assertEqual((self.backup / file).read_bytes(), before[file])
        self.assertEqual(self.plan(), {})
        unused = self.base / "unused-backup"
        upgrade.apply_plan(self.deck, {}, unused)
        self.assertFalse(unused.exists())

    def test_keep_transitions_preserves_html_exactly(self):
        changes = self.plan(True)
        self.assertNotIn(self.deck / "index.html", changes)
        self.assertEqual(len(changes), 2)

    def test_unrelated_or_broken_shell_refused_without_change(self):
        for source in (
            "<html><body><h1>Ordinary page</h1></body></html>",
            HTML.replace('class="wp-states"', 'class="different"'),
            HTML.replace('SRC="./assets/presentation-runtime.js?v=1#entry"', 'SRC="https://example.com/assets/presentation-runtime.js"'),
            HTML.replace("<head>", '<head><base href="https://example.com/">'),
            HTML.replace("DATA-TRANSITION = 'zoom'", "data-transition='zoom' data-transition='fade'"),
            HTML.replace("</article>", ""),
        ):
            with self.subTest(source=source[:80]):
                (self.deck / "index.html").write_text(source)
                before = self.snapshot()
                with self.assertRaises(ValueError):
                    self.plan()
                self.assertEqual(self.snapshot(), before)
                self.assertFalse(self.backup.exists())

    def test_symlinks_refused(self):
        outside = self.base / "outside.js"
        outside.write_bytes(b"do not touch")
        runtime = self.deck / "assets/presentation-runtime.js"
        runtime.unlink()
        runtime.symlink_to(outside)
        with self.assertRaises(ValueError):
            self.plan()
        self.assertEqual(outside.read_bytes(), b"do not touch")

    def test_backup_must_be_external_new_and_not_symlinked(self):
        for target in (self.deck / "backup", self.base):
            with self.assertRaises(ValueError):
                upgrade.apply_plan(self.deck, self.plan(), target)
        symlink = self.base / "alias"
        symlink.symlink_to(self.base, target_is_directory=True)
        with self.assertRaises(ValueError):
            upgrade.apply_plan(self.deck, self.plan(), symlink / "backup")

    def test_failure_rolls_back_all_changed_files(self):
        before = self.snapshot()
        real = upgrade.atomic_write
        calls = 0

        def fail_once(path, content, mode):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("injected disk failure")
            return real(path, content, mode)

        with patch.object(upgrade, "atomic_write", side_effect=fail_once):
            with self.assertRaises(OSError):
                upgrade.apply_plan(self.deck, self.plan(), self.backup)
        self.assertEqual(self.snapshot(), before)
        self.assertTrue((self.backup / "upgrade-manifest.json").is_file())
        self.assertFalse(list(self.deck.rglob(".scroll-upgrade-*")))

    def test_check_and_apply_explicit_modes(self):
        before = self.snapshot()
        self.assertEqual(upgrade.main([str(self.deck), "--check"]), 0)
        self.assertEqual(self.snapshot(), before)
        with self.assertRaises(SystemExit):
            upgrade.main([str(self.deck), "--apply"])

    def test_zip_roundtrip_and_original_preserved(self):
        archive = self.base / "deck.zip"
        with zipfile.ZipFile(archive, "w") as zipped:
            for path in self.deck.rglob("*"):
                if path.is_file():
                    zipped.write(path, path.relative_to(self.deck))
        original = archive.read_bytes()
        extracted = self.base / "upgraded"
        self.assertEqual(upgrade.main([str(archive), "--check"]), 0)
        self.assertFalse(extracted.exists())
        self.assertEqual(upgrade.main([str(archive), "--apply", "--output-dir", str(extracted), "--backup-dir", str(self.backup)]), 0)
        self.assertEqual(archive.read_bytes(), original)
        self.assertEqual(upgrade.plan(extracted), {})
        self.assertEqual((extracted / "assets/custom.css").read_bytes(), (self.deck / "assets/custom.css").read_bytes())

    def test_unsafe_zip_entries_are_rejected_before_extraction(self):
        for name, mode in (
            ("../escape", 0),
            ("/absolute", 0),
            ("assets/../../escape", 0),
            ("assets\\escape", 0),
            ("assets/link", stat.S_IFLNK | 0o777),
            ("assets", 0),
            ("C:/escape", 0),
        ):
            with self.subTest(name=name):
                archive = self.base / "bad.zip"
                with zipfile.ZipFile(archive, "w") as zipped:
                    zipped.writestr("index.html", HTML)
                    info = zipfile.ZipInfo(name)
                    info.external_attr = mode << 16
                    zipped.writestr(info, "bad")
                destination = self.base / "extract"
                destination.mkdir(exist_ok=True)
                with self.assertRaises(ValueError):
                    upgrade.extract_zip(archive, destination)
                self.assertEqual(list(destination.iterdir()), [])

    def test_duplicate_casefold_zip_paths_rejected(self):
        archive = self.base / "duplicate.zip"
        with zipfile.ZipFile(archive, "w") as zipped:
            zipped.writestr("index.html", HTML)
            zipped.writestr("assets/A.js", "one")
            zipped.writestr("assets/a.js", "two")
        with self.assertRaises(ValueError):
            upgrade.extract_zip(archive, self.base / "extract")


if __name__ == "__main__":
    unittest.main()

---
name: upgrade-presentation-scroll
description: Apply the current scroll and gesture behavior to an existing Web Presentations deck or ZIP while preserving its slide content, theme, and custom assets. Use for older decks with oversensitive scrolling or repeated slide advances.
---

# Upgrade presentation scrolling

Use the current installed plugin's migration helper. Resolve the plugin root two directories above this SKILL.md; do not hard-code a cache version or copy scripts from an older deck. This upgrades an existing presentation, so keep its theme and accent without asking the new-deck theme questions.

## Scope and authorization

This changes the shared presentation shell. If the warning has not already been shown for this authorized change, show: **Changing the presentation shell can corrupt the presentation. I’ll back up the affected files and verify the upgraded deck.**

An explicit request to apply this scroll fix authorizes the migration; do not ask for another confirmation. A request to inspect or recommend remains read-only. If the user already received the warning and authorized the change in this task, do not repeat it.

Only compatible Web Presentations shells are supported. The helper checks the root, stage, slide/state hierarchy, and local runtime/stylesheet references. It refuses unrelated HTML, ambiguous references, asset integrity hashes, unsafe ZIP paths, and symbolic links. Do not force the migration or reconstruct an unrelated deck when these checks fail.

## Preflight and apply

For a directory:

    python3 <plugin-root>/scripts/upgrade_presentation_scroll.py <deck-directory> --check
    python3 <plugin-root>/scripts/upgrade_presentation_scroll.py <deck-directory> --apply --backup-dir <new-external-backup-directory>

For an existing ZIP:

    python3 <plugin-root>/scripts/upgrade_presentation_scroll.py <deck.zip> --check
    python3 <plugin-root>/scripts/upgrade_presentation_scroll.py <deck.zip> --apply --output-dir <new-deck-directory> --backup-dir <new-external-backup-directory>

The ZIP must contain index.html and assets/ at its root. The original archive stays unchanged. The helper validates archive entries before extraction, rejects links and traversal, and limits archives to 10,000 entries and 1 GiB uncompressed. A ZIP check uses temporary extraction and does not write the source or a delivery directory. For a differently packaged archive, inspect and safely extract its presentation directory first; do not relax archive path checks.

Application requires an explicit --apply and a new backup directory outside the deck. A no-op directory upgrade creates no backup. Backups contain the changed original files and a checksum manifest. Changes are rolled back if a write fails; retain the backup until verification completes.

The only intended changes are:

- Replace assets/presentation-runtime.js and assets/presentation.css with the current plugin's bundled versions.
- Set each slide's data-transition attribute to scroll. Use --keep-transitions only when the user explicitly wants to retain fade, zoom, or custom transitions.

HTML is edited by original token offsets, preserving unrelated markup, metadata, inline styles, text, links, and scripts. Custom content stylesheets, fonts, media, interactions, and custom-transitions.js stay untouched. The baseline presentation.css and bundled runtime are replaced in full: inspect those files for deck-specific modifications during preflight. If custom styling was added there, preserve those specific rules in the deck's custom stylesheet before migration and verify their cascade; do not silently discard them or copy old shell rules over the fix.

## Expected behavior

The current scroll defaults require movement equal to 30% of the viewport along the gesture's axis, clamped to 120–360 CSS pixels. Axis selection begins after 10 CSS pixels of intent. One wheel gesture can advance at most one slide/state; a 260 ms idle interval separates gestures. A gesture that starts scrolling overflow content stays with that content through its boundary, so its momentum does not also change slides. These are runtime constants, not public HTML configuration attributes. Preserve them unless the user requests different sensitivity.

Wheel and touch gestures always use spatial scrolling. Preserved explicit fade, zoom, or custom transitions apply to buttons, keys, and API navigation. The runtime exposes its release through WebPresentations.version; the scroll fix was introduced in 2026.09.25-scroll-snap.1. Always migrate from the current installed assets rather than pinning this historical version.

Keep the two-axis structure: vertical navigation changes main slides; horizontal navigation changes sub-slides. Preserve labels, keyboard controls, persistent elements, and custom interactions. This helper does not authorize changes to content or unrelated shell behavior.

## Verify and package

Compare the changed files and confirm only the intended shell assets and transition attributes changed. Run --check again; it should report an empty changes list.

Open the upgraded deck at desktop and narrow widths. Check long content scrolling, a single long wheel gesture, a fresh gesture after idle, both slide axes, keyboard navigation, controls, labels, custom interactions, and reduced-motion behavior. Confirm custom styling and media still render. Static validation alone cannot establish that the gesture behavior works.

Package the upgraded directory with:

    python3 <plugin-root>/scripts/package_presentation.py <deck-directory> --output <new-output.zip>

Inspect the ZIP root and local references. Return the upgraded ZIP and a concise account of verification, retaining the original ZIP and external backup. Hosting or publication is separate: use the user's existing authorization and hosting workflow, and never claim a local upgrade has been deployed.

---
name: create-web-presentation
description: Create, edit, animate, and package polished two-axis web presentations from natural-language requests. Use for browser-playable slide decks exported as a ZIP.
---

# Create web presentations

Create and update browser-playable presentations using the fixed shell in this plugin. The deliverable is a ZIP whose root contains `index.html` and `assets/`. Use the shell for navigation and keep presentation-specific work in slide content, local assets, and custom transition definitions.

## Start or continue

- Before creating any brand-new deck, make sure the user has answered both theme questions: light or dark mode, and the accent color. If either answer is missing, ask for it and wait before creating files. An explicit “choose for me” counts as an answer; report the selected values. Do not ask again when editing an existing deck unless the user requests a theme change.
- Ask for the accent as a six-digit hex color (for example `#4357C5`). If the user gives a color name, confirm or translate it to a specific hex value in your question before proceeding.
- For a new deck, choose an output directory and run `python3 <plugin-root>/scripts/new_presentation.py <output-dir> --title "<title>" --mode dark --accent-color "#4357C5"`, substituting the user's answers. Resolve `<plugin-root>` relative to this skill's containing plugin. The command copies the shared shell, applies the answered theme, and creates `assets/`.
- For edits, locate the existing `index.html` and keep its established visual direction and shell contract. Match slide references by their displayed number/label, not just their current DOM order.
- Make the requested content change directly: insert or reorder `.wp-slide` sections for main slides; add, remove, or reorder `.wp-state` articles inside a slide's `.wp-states` to edit horizontal sub-slides. The first state is numbered `1`, `2`, etc.; following states are `1a`, `1b`, `2a`, and so on.
- Keep each main slide self-contained in its `<section class="wp-slide">`. Preserve one first `.wp-state` per slide. The default transition is a full viewport scroll with no fade; set `data-transition="scroll|fade|zoom"` when the user specifies another effect. Custom named Motion transitions can be defined in `assets/custom-transitions.js`. `data-duration="0.6"` sets the fixed keyboard/custom transition duration in seconds.
- Edit the visible counter, controls, root shell, and bundled runtime only when the user explicitly asks to change shell behavior. Content and layout changes inside slide states do not count as shell changes.

## Refine an existing deck

For a focused typography, diagram, spacing, or interaction-design pass, use the bundled [refine-web-presentation](../refine-web-presentation/SKILL.md) skill. Keep the current shell and content boundaries intact.

## Editorial and visual quality

- Build one clear argument or story for the intended audience. Give every slide one job and a specific takeaway; write titles as concise claims or questions, not generic section labels.
- Use direct, concrete wording. Remove filler, repeated summaries, inflated claims, generic corporate phrasing, and stock AI transitions. Prefer named people, places, dates, quantities, examples, and consequences when the source supports them.
- Never invent facts, quotations, statistics, citations, or product capabilities. For research-led decks, cite claims close to where they appear and include a source slide or links when useful.
- Establish a deliberate art direction that fits the topic and the user's light/dark choice and accent color. Use a strong grid, consistent spacing, purposeful type scale, and restrained color. Avoid repetitive card grids and decorative gradients unless they serve the story.
- Keep explanatory body text at least 18px at the presentation viewport and secondary controls/labels at least 14px. Use the viewport generously; split dense material across sub-slides or enable content scrolling instead of shrinking text or cramming the canvas.

## Interaction and overflow

- Use browser-native interactions where they make the explanation clearer: click-to-open popovers for optional detail, hover/focus tooltips for short definitions, buttons that reveal a comparison or example, and media controls. Interaction should add context, not hide essential information.
- Keep every interactive element keyboard reachable and labelled. Hover effects must also work on focus; do not make meaning available only on hover. Close open popovers when moving to another slide.
- A state that exceeds the viewport scrolls internally. Wheel/trackpad and up/down arrows scroll that content until its top or bottom; only then does vertical input navigate to another main slide. Horizontal gestures and left/right arrows navigate sub-slides. Do not shrink text to avoid the scroll behavior.
- Wheel and single-finger touch gestures always move slides spatially. They snap forward only after deliberate travel: 30% of the viewport on the gesture axis, bounded to 120–360 CSS pixels. Short or reversed gestures return to the current slide. A wheel burst ends after 260 ms of quiet; one burst can advance at most once. A gesture that starts scrolling long or nested content stays with that content, even at its edge; start a fresh gesture there to change slides. Buttons and keys also use full scroll transitions by default. Explicit fade, zoom, or custom transitions apply only to buttons, keys, and API navigation, never wheel or touch.

## Author content and media

- Treat each slide as a web canvas: use semantic HTML, responsive CSS, diagrams, tables, charts, code, forms, and other browser-native content when it helps the story. Keep the deck coherent and visually deliberate.
- Put every supplied or generated local asset under `assets/` and reference it with a relative path. Use meaningful, stable filenames. Common patterns include `<img src="assets/...">`, `<video controls src="assets/...">`, `<iframe src="assets/...pdf">` for local PDFs, and `<a href="assets/..." download>` for downloadable files.
- Use remote embeds only when the user requests or supplies a URL. External video and document services require a network connection and remain subject to their embedding rules. Never silently replace an unavailable local file with an unrelated remote asset.
- Keep content within the shell’s viewport and preserve readable layouts on mobile. Use `prefers-reduced-motion` friendly transitions and keep meaningful content available without animation.

## Sub-slides, persistent elements, and Motion

- Horizontal states are native parts of a main slide: each `.wp-state` is one full-viewport state. Up/down arrows and vertical wheel/touch gestures navigate main slides; left/right arrows and horizontal gestures navigate sub-slides. The shell assigns labels, snaps to each state, and updates progress.
- The bottom-right slide counter is one button. It opens an outline above the controls listing every main slide and every sub-slide with labels (`1`, `1a`, `1b`, `2`); sub-slides are indented. Give slides meaningful `h1`/`h2` headings or an explicit `data-slide-title` so the outline has useful titles. The shell reads titles from the first heading in each state, then falls back to its accessible label.
- When the current main slide has horizontal states, show the second pill above the main controls. It navigates through the main state and its sub-slides. Keep the states' headings specific so users can identify them from the outline.
- Control-pill contrast follows the visible slide background, independently of the deck's light/dark theme. The shell samples opaque background colors in the viewport. If a large background image/video or unusual layered artwork makes that estimate unreliable, set `data-wp-controls-tone="dark"` or `data-wp-controls-tone="light"` on the relevant `.wp-slide` or `.wp-state` to choose a dark or light pill surface.
- Place elements that should remain during transitions in `.wp-persistent-layer` outside `.wp-stage`, marked with `data-wp-persistent`. Add `data-show-on="1 2a"` to limit visibility to labels, or use `all` to keep it present throughout.
- Use matching `data-magic-move="key"` values on elements in the outgoing and incoming states for a shared-element transition. Keep each key unique within a state.
- The shell exposes `window.WebPresentations.next()`, `.previous()`, `.nextSubslide()`, `.previousSubslide()`, `.goTo(slideNumber, subslideLetter)`, `.getState()`, and the bundled Motion `animate` function.
- For transitions beyond `slide`, `fade`, or `zoom`, add a handler to `window.webPresentationTransitions` in `assets/custom-transitions.js` and set that name in `data-transition`. A handler receives `from`, `to`, `axis`, `direction`, `kind`, `duration`, `animate`, and `reducedMotion`. Keep custom animation content-scoped; the shell API and navigation contract remain stable.

## Shell boundary

Never change the shared shell, keyboard/wheel routing, numbering, persistent layer, outline, controls, or bundled runtime unless the user explicitly asks to go beyond the shell. Before doing so, show a **bold warning** in your response that changing the shell can corrupt the presentation. Make the explicitly requested shell change only after that warning is visible, then recheck the complete deck.

## Upgrade an existing shell

For older decks with accidental scroll navigation, use [upgrade-presentation-scroll](../upgrade-presentation-scroll/SKILL.md). Preserve content, assets, and interactions while replacing only compatible shell files and normalizing transitions.

## Package and verify

1. Ensure the root has only `index.html` and `assets/`; keep all local dependencies and presentation media inside `assets/`.
2. Run `python3 <plugin-root>/scripts/package_presentation.py <presentation-dir> --output <output.zip>`. It checks local references and packages the expected root layout.
3. Inspect the ZIP listing and confirm its `index.html` references bundled files. Open the extracted `index.html` in a browser and inspect the deck at desktop and narrow widths. Check keyboard navigation, both scroll axes, labels, persistent/shared elements, media controls or links, transitions, and reduced-motion behavior as relevant to the changes.
4. Return the ZIP path and describe the navigation or external media requirements that affect playback.

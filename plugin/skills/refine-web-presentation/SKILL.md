---
name: refine-web-presentation
description: Refine an existing HTML/web presentation’s typography, diagrams, spacing, and interaction design. Use when slides feel box-heavy, rely on text-art diagrams, waste the canvas, or need visual polish while retaining their content and navigation shell.
---

# Refine Web Presentation

Improve the existing deck through intentional typography, meaningful web-native visuals, and content-aware layouts. Match its brand and audience; do not impose a universal visual theme or turn an educational briefing into a sales pitch.

## Establish the boundary

- Locate the editable source and generated deliverable. If a generator exists, edit that source so a rebuild retains the work. For a ZIP-only deck, extract into a separate working directory and retain the original.
- Inspect the rendered deck and its slide/state structure before editing. Inventory headings, key claims, evidence, citations, qualifications, interactions, and parent/detail relationships.
- Preserve meaning, numbers, dependencies, source links, and distinctions such as proposed versus implemented. Improve wording only when needed for clarity; do not silently remove content to make a composition fit.
- Keep the existing theme, fonts, colors, and brand assets unless the user requests a change. Use existing tokens rather than baking a particular brand into this workflow.
- Preserve the shell: navigation, numbering, outline, keyboard/wheel/touch routing, state hierarchy, persistent elements, fullscreen, and runtime. Record shell-file hashes and relevant markup before editing. Work in slide content, inner layout wrappers, presentation-specific styles, and content-only interactions. Do not copy an older deck’s shell or replace the framework to obtain its visual style.
- A style request does not authorize a shell upgrade, publishing, or changes to unrelated decks. Follow the user’s requested scope; an audit-only request ends with findings.

## Inspect, then compose

Review representative short, dense, parent, detail, diagram, and interactive states at desktop and narrow widths. Identify the highest-impact repeated problems, then use the appropriate treatments below. If changes are deck-wide, inspect every slide afterward; a good cover does not establish a good deck.

### Typography replaces decorative callouts

Treat both semantic blockquotes and quote-like callout boxes as candidates. A tinted rectangle with a left rule is not automatically a useful hierarchy.

- Reserve `blockquote` for an actual quotation or excerpt, with attribution when available. Keep these rare and purposeful.
- Use a concise lead, a large takeaway sentence, a heading with supporting prose, a comparison, or a definition list for ordinary explanations. Establish emphasis through size, weight, line length, spacing, and selective color before adding a container.
- Use an `aside` or a distinct panel only when separation has meaning: a consequential warning, an optional note, an interactive control, or a self-contained result. Do not put every conclusion in one. Replacing every quote box with the same card merely repeats the problem.
- Retain genuine tabular comparisons. Avoid turning unrelated paragraphs into rows solely to get alignment.
- Develop a small type scale from the deck’s fonts. At the presentation viewport, keep explanatory text at least 18px and secondary labels at least 14px unless an established accessible design calls for larger sizes. Keep body measures readable, often around 45–75 characters. Dense content should flow or move into an appropriate detail state rather than shrink.
- Use accent color selectively and with contrast. Do not depend on color, all-caps labels, or bolding whole paragraphs to explain hierarchy.

### Diagrams express relationships

Replace code-fenced or `<pre>` text art when its purpose is to explain a process, hierarchy, branch, sequence, comparison, or system. Retain real code, commands, JSON, and exact syntax when readers need to inspect or copy them.

Before drawing, identify the actual nodes, direction, branches, groupings, and edge meanings. Preserve them; a row of attractive cards without the relationships is not a diagram.

- Use semantic HTML and CSS Grid/Flexbox for simple flows and comparisons. Use SVG for connectors, branches, spatial relationships, and scalable geometry. Use interactive diagrams only when interaction helps explain a state or choice.
- Inherit the deck’s typography, palette, stroke style, spacing, and surfaces. Use a few visual roles consistently. Make primary paths obvious without boxing every label.
- Give edges labels when their meaning is not self-evident. Never invent a causal edge or ordering merely because the old text listed items together.
- Keep text readable and selectable where possible. Let nodes grow with their labels; keep connectors clear of text. On narrow screens, reflow to a logical reading order or use a deliberate scrollable diagram region rather than shrinking the entire drawing.
- Provide an accessible name and concise equivalent explanation for complex SVG/canvas diagrams. Hide decorative connectors from assistive technology. Essential information must be available without hover, animation, or a pointer.
- Prefer local HTML/CSS/SVG over screenshots, remote embeds, or large libraries for a small diagram. If a renderer already exists, use its styled output rather than displaying its source syntax.

Read [Composition patterns](references/composition-patterns.md) when choosing a replacement for repeated callouts, text art, or a top-heavy layout. These are options, not a mandatory template.

### Use the full canvas deliberately

Give each slide one dominant idea and a clear entry point. Adjust heading scale, diagram scale, column proportions, spacing, and padding together.

- Short slides can use a centered or optically balanced composition with generous space around the main idea. A key number or diagram may deserve more area than its explanation.
- Medium slides can use a title band plus a substantial visual, an asymmetric split, or a clearly spaced sequence. Vary composition when the information changes; do not force every state into the same grid.
- Long slides should flow from the top and scroll within the shell’s existing content area. Use minimum sizes and natural document flow, not fixed heights that clip content. Preserve comfortable text sizes and breathing room.
- Distinguish intentional negative space from accidentally unused space. Do not stretch a tiny paragraph across the viewport, center a long document, or distribute unrelated elements to the four corners just to fill the frame.
- Account for logos, citations, persistent controls, and safe areas. The last paragraph, diagram node, and focused control must be reachable without sitting permanently behind navigation.
- Do not fix content overflow by changing wheel handlers, trapping gestures, hiding overflow, or reducing the entire slide with a transform. Preserve the existing handoff between content scrolling and slide navigation.

### Interaction serves understanding

Keep useful demonstrations and links. If adding progressive disclosure or a state selector, make it keyboard operable, visibly focused, labeled, and understandable without hover. Essential conclusions stay visible. Prefer restrained motion that reinforces a relationship; support reduced motion and a usable static state. Do not add animation just to signal polish.

## Verify and deliver

1. Inspect every changed state in a real browser at the intended presentation size and a narrow viewport. Check representative intermediate widths when layouts change there. Scroll tall states to the bottom; inspect diagrams, labels, and fixed-control overlap rather than relying solely on overflow measurements.
2. Test the affected demonstrations, links, focus behavior, outline entries, parent/detail navigation, both scroll axes, and reduced-motion behavior. Verify long content scrolls before navigation where the shell supports it. Check text contrast on the actual surfaces.
3. Compare the content inventory and shell hashes/markup with the original. Confirm preserved claims, citations, state order, and navigation behavior. Inspect new dependency requests and keep local assets bundled where the deck is intended to work offline.
4. Rebuild and package using the deck’s existing workflow. Verify the packaged copy, not just the source directory. For a Web Presentations ZIP, keep only `index.html` and `assets/` at the archive root; keep working files and QA images outside it.
5. Return the updated artifact and a brief account of the improvements and checks. State any unverified behavior accurately. If browser validation is unavailable, do not call static checks a visual pass.

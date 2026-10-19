# Composition patterns

Use these patterns selectively. Preserve the deck’s visual language and the content’s meaning; do not copy one layout across every slide.

## From boxed emphasis to typography

| Content role | Useful treatment | Preserve |
| --- | --- | --- |
| Main takeaway | Standalone sentence with larger type and generous space above | The actual conclusion and its qualification |
| Supporting explanation | Short lead or paragraph close to the visual it explains | Cause, context, and caveats |
| Two alternatives | Aligned comparison with a clear shared axis | What is being compared and any unequal conditions |
| Terms and definitions | Semantic `dl` with spacing and modest labels | Exact terminology |
| Genuine quotation | `figure`, `blockquote`, and `figcaption` attribution | Quoted wording and source |
| Consequential warning | Named `aside` with a restrained visual distinction | The consequence and required action |
| Interactive result | Bounded result area beside its controls | Selected state, units, and explanation |

Do not turn a plain explanatory note into a warning merely to justify a box. Decorative quotation marks and a left rule do not make something a quotation.

## From text art to a diagram

Choose a visual grammar before styling:

- **Sequence:** numbered stages with directional connectors. Use an ordered list for the underlying reading order.
- **Branch or decision:** a shared entry, clearly named conditions, separate paths, and an explicit rejoin only if one exists.
- **Shared input, multiple outputs:** one source feeding visibly distinct destinations. Do not accidentally imply that the destinations run sequentially.
- **Hierarchy:** parent/child grouping with alignment or connectors; distinguish containment from a dependency.
- **Lifecycle:** states and labeled transitions. Keep repeated actions separate from one-way progression.
- **Comparison:** shared dimensions, aligned values, and units. Arrows are unnecessary unless they represent a real transformation.

A useful implementation is HTML labels laid out with Grid and an SVG connector layer. For simple linear flows, CSS connectors can suffice. Keep a single semantic reading order and mark decorative lines `aria-hidden="true"`. For a complex SVG, use `role="img"` with a unique `title`/`desc` association and provide a nearby textual equivalent if the structure needs more explanation.

Connectors should track their nodes. Prefer layout-derived positions or an appropriate responsive SVG viewBox. Fixed pixel lines that happen to align at one viewport are fragile. On a narrow layout, stack stages and reroute connections rather than leaving horizontal arrows between vertically stacked nodes.

Do not animate a loop, completion state, or progress indicator unless it accurately represents the explanation. A static diagram with clear labels is often sufficient.

## Content-aware spacing

A useful inner content structure is a heading region, a primary explanation/visual region, and a source region. It does not require changing the shell’s slide containers.

For a short state, the primary region may expand and center its content vertically. For a long state, let the inner wrapper grow naturally and retain top alignment. Avoid a fixed `height: 100vh` on the content wrapper: browser chrome, shell controls, and wrapped text may leave less usable space.

If tokens are missing, introduce presentation-scoped roles such as `--refine-ink`, `--refine-muted`, `--refine-accent`, and `--refine-gap`, derived from the current theme. Scope rules to content classes. Do not style all `div`, `section`, `button`, or `pre` elements indiscriminately; that can damage the shell or genuine code examples.

Use responsive typography with bounds, but solve density with composition first. Examples of meaningful adjustments:

- Enlarge the main visual and narrow the supporting paragraph on a sparse slide.
- Separate a title and a three-step process with a larger gap, then keep each step’s heading and explanation close together.
- Put a short takeaway beside a large diagram instead of adding another full-width banner beneath it.
- Let a dense reference state scroll with section rhythm and a reachable source link.

## Review questions

- Is emphasis still clear if borders and tinted panels are removed?
- Can the reader explain the diagram’s relationships without guessing what an arrow means?
- Does the slide use its available area intentionally at the actual presentation viewport?
- Does the mobile reading order match the desktop meaning?
- Can a keyboard user reach every interactive state and the final content below the fold?
- Are the content, shell, and source relationships preserved?

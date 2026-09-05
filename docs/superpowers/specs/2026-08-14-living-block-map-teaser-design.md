# Living Block Map Teaser Design

**Status:** Approved direction; implementation in PR #9

**Date:** August 14, 2026

**Repositories:**

- Official WCUS site: `henryperkins/wcus-ai.github.io`
- Living Block Map: `henryperkins/core-ai-wcus`

## Objective

Add a compact promotional teaser immediately after the six Core AI project
cards on the WCUS site. The teaser must help visitors discover the Living
Block Map without embedding or imitating its full-screen kiosk interaction.
It launches the independently deployed map in a separate tab and sets an
honest expectation for the initial WordPress Playground load.

## Decision

Use the structural direction shown by Prototype A, with a production-specific
implementation:

- Render a static, non-interactive preview derived from the real 3.2.0 map.
- Link to the complete exhibit in a separate tab.
- Do not include the prototype's modal, mock map, or client-side behavior.
- Do not embed the live map or a WordPress Playground iframe.

Prototype B is intentionally rejected because it creates a dense nested
interaction region, duplicates kiosk behavior, increases page length, and
scales poorly on phones.

## Placement and Page Structure

Create `src/components/LivingBlockMapTeaser.astro` and render it in
`src/pages/index.astro` inside the existing `.projects` section. It appears
immediately after `.project-grid` and before the closing `</section>`, so the
page order is:

1. Projects heading and lead
2. Six project cards
3. Living Block Map teaser
4. Who We Are
5. Slack CTA
6. Feedback

The teaser is a nested semantic `<section>` labelled by its own `<h3>`.

## Content

Use this exact visible copy:

**Heading**

> See how WordPress and AI connect

**Description**

> Choose from four interactive flows. Follow the numbered path, then tap a
> highlighted component to understand the role it plays.

**CTA**

> Explore the Living Block Map

**Operational disclosure**

> Runs a real WordPress 7.0 site in your browser. The first load can take a
> minute or more. Best viewed in landscape.

The language must not call the map "a map of our six projects." The map uses
an architectural taxonomy that includes supporting components and external
actors in addition to the six projects listed on the official site.

## Outbound Link and Tracking

The CTA is a normal anchor so navigation still works when JavaScript or the
tracking endpoint is unavailable:

```astro
<a
  class="living-map-teaser__cta"
  href="https://wcus.hperkins.com/"
  target="_blank"
  rel="noopener noreferrer"
  data-track-event="click_outbound"
  data-track-project="site"
  data-track-target="living-block-map"
  aria-describedby="living-map-disclosure"
>
  Explore the Living Block Map
  <span aria-hidden="true">→</span>
  <span class="living-map-teaser__new-tab"> (opens in a new tab)</span>
</a>
```

The hidden new-tab text is included in the accessible name. The arrow is
decorative. Give the visible operational disclosure
`id="living-map-disclosure"` so it is also programmatically associated with
the CTA. No worker change is required: the existing front-end tracker accepts
a stable arbitrary target when `project` is `site`, and navigation already
continues when tracking is unset or fails.

Add `living-block-map` to the target vocabulary table in `README.md`.

## Preview Artwork

Create `public/images/living-block-map-preview.webp` as a 1366 x 1024,
4:3 WebP image derived from the visual grammar of the live 3.2.0 exhibit.
Target a file size no greater than 150 KB.

The poster contains only the elements needed to communicate the first guided
flow at teaser size:

- The map's pale neutral grid
- A labelled WordPress boundary
- A strong blue active path
- Simplified cards for AI Plugin, AI Client, and provider layer
- An external AI service card beyond the WordPress boundary
- Restrained inactive context, if it remains legible at small sizes

The poster must not contain fake buttons, controls, QR codes, inspectors, or
text too small to read. It is an explanatory image, not a screenshot-shaped
interactive affordance. Its palette and geometry should be recognizably
derived from the current map while remaining visually subordinate to the
official site's WCUS branding.

Render it with intrinsic `width="1366"` and `height="1024"`, `loading="lazy"`,
and `decoding="async"`. Use this alternative text:

> Simplified Living Block Map path from AI Plugin through AI Client and a
> provider layer to an external AI service.

Do not prefetch or preload the kiosk URL. The site's initial page load must
not trigger WordPress Playground downloads.

## Visual Design

The teaser uses the existing WCUS design system rather than copying the
prototype's approximated header or map chrome.

- Maximum width: existing `--max-width` (`72rem`)
- Horizontal padding: existing `--container-padding`
- Background: a light blend of `--color-peach` and `--color-surface`
- Border: `1px solid var(--color-border)`
- Leading accent: `6px solid var(--color-accent)`
- Radius: existing `--radius`
- Heading: Anton display face, uppercase, `--color-text-strong`
- Body/disclosure: Poppins, using existing text and muted colors
- CTA: existing plum header color with white text; magenta hover state
- Focus: repository-wide `:focus-visible` outline remains visible
- Touch target: at least `--tap-min` (`48px`), with a preferred CTA height of
  `56px`

Visually hide `.living-map-teaser__new-tab` with the standard one-pixel
clipped technique (`position: absolute`, `width` and `height: 1px`, negative
margin, hidden overflow, clipped rectangle, and no wrapping). Do not use
`display: none`, `visibility: hidden`, or `aria-hidden`, because assistive
technology must include this phrase in the link name.

Do not introduce new global color, type, or spacing tokens.

## Responsive Layout

### Mobile: below 600px

- Stack preview, copy, CTA, and disclosure vertically.
- Make the preview width 100% with `aspect-ratio: 4 / 3`.
- Make the CTA width 100% and center its label.
- Preserve at least the existing `--space-md` between interactive and text
  regions.
- Avoid horizontal scrolling at a 320px viewport.

### Tablet: 600px through 899px

- Use a two-column preview-and-copy layout when space permits.
- Keep CTA and disclosure in the copy column.
- Allow a single-column stack if text enlargement makes two columns cramped.

### Desktop: 900px and above

- Use three regions: poster, copy, and action.
- Keep the poster near 240 x 180 CSS pixels while preserving its 4:3 ratio.
- Align the action vertically with the content without shrinking the CTA
  below its readable intrinsic width.

The attached booth device is an iPad Pro 12.9-inch, fifth generation. Its
2732 x 2048 hardware display maps to a nominal 1366 x 1024 point canvas at
the usual 2x scale, but this official-site component must remain responsive;
Safari chrome and safe areas may reduce the live viewport.

## Accessibility

- Preserve the existing page's single `h1` and Projects `h2`; use an `h3` for
  the teaser subsection.
- Give the preview meaningful alternative text.
- Expose the separate-tab behavior in the CTA's accessible name.
- Keep all meaningful copy as HTML text, not baked into the image.
- Maintain WCAG AA contrast for heading, body, disclosure, CTA, hover, and
  focus states.
- Keep the CTA at least 48 x 48 CSS pixels.
- Do not add animation. Existing reduced-motion behavior therefore requires
  no special teaser override.
- Do not create a dialog, focus trap, hidden focusable subtree, or nested
  browsing context.

## Performance and Failure Behavior

- The only new runtime asset is the lazy-loaded WebP poster.
- No new package or client-side script is added.
- The external kiosk is not requested until the visitor activates the CTA.
- If tracking is unavailable, the link still opens normally.
- If the preview image fails, its alternative text still identifies the map
  path and the text/CTA remain usable.
- The kiosk's one-minute-or-more load happens in the new tab, leaving the
  official site available as the durable reference.

## Files

Create:

- `src/components/LivingBlockMapTeaser.astro`
- `public/images/living-block-map-preview.webp`
- `tests/living-block-map-teaser.test.ts`

Modify:

- `src/pages/index.astro`
- `src/styles/global.css`
- `README.md`

No changes are expected in:

- `src/scripts/track.ts`
- `worker/index.ts`
- Project content files
- Service worker or web manifest

## Verification

### Automated source contract

`tests/living-block-map-teaser.test.ts` reads the component, home page,
README, and preview asset. It verifies:

- The component is imported and rendered after `.project-grid`.
- The approved heading, description, CTA, and disclosure are present.
- The CTA URL is exactly `https://wcus.hperkins.com/`.
- `target="_blank"` and both `noopener` and `noreferrer` are present.
- Tracking emits `click_outbound`, `site`, and `living-block-map`.
- The accessible new-tab copy is present.
- The component contains no iframe, button, script, modal, or dialog.
- The image has the expected path, intrinsic dimensions, lazy loading,
  async decoding, and alternative text.
- The WebP has `RIFF`/`WEBP` signatures, is non-empty, and is no larger than
  150 KB.
- README documents the new target vocabulary.

### Repository checks

Run all existing checks:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm check
pnpm check:scripts
pnpm test
pnpm build
```

### Visual and browser review

Review the production build at minimum at:

- 390 x 844 mobile
- 768 x 1024 portrait tablet
- 1024 x 768 compatibility landscape
- 1366 x 1024 target landscape

Verify:

- The teaser follows the final project card without crowding it.
- Who We Are retains clear section separation.
- The CTA is visible, keyboard focusable, and names the new-tab behavior.
- No horizontal clipping occurs.
- The poster remains legible without being mistaken for an embedded map.
- Activating the CTA opens `https://wcus.hperkins.com/` in a separate tab.
- No kiosk resources load before activation.
- No console errors, page errors, failed requests, or HTTP errors are added.

The repository's PR Preview workflow then provides the public preview and
mobile visual comparison for reviewer approval.

## Acceptance Criteria

The feature is complete when:

1. The teaser appears after all six project cards and before Who We Are.
2. It matches the WCUS site's existing design system at mobile, tablet, and
   desktop sizes.
3. It uses the approved simplified authentic Flow 01 poster.
4. It launches the current full-screen exhibit in a separate tab.
5. The one-minute-or-more and landscape disclosure is directly associated
   with the CTA.
6. Tracking vocabulary is implemented and documented without a worker change.
7. No map, iframe, modal, or new client-side JavaScript is embedded.
8. All automated repository checks pass.
9. The PR preview and visual report are available for final review.

## Out of Scope

- Modifying the Living Block Map repository or deployment
- Resolving the kiosk's remaining startup accessibility gate
- Physical iPad booth acceptance
- Changing Cloudflare deployment configuration
- Adding analytics dashboards or new worker behavior
- Reworking the six existing project cards
- Changing unrelated official-site content

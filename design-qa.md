# Living Block Map teaser design QA

## Evidence

- Source visual truth: `C:\Users\htper\AppData\Local\Temp\wcus-living-map-reference\prototype-a-cta.png`
  - Source pixels: 1366 × 1024
  - Intended CSS viewport: 1366 × 1024
  - Density normalization: treated as a 1× reference capture
- Authentic map reference: `C:\Users\htper\AppData\Local\Temp\wcus-living-map-reference\prototype-a-map-open.png`
  - Source pixels: 1366 × 1024
  - Used to ground the generated preview poster's route, boundary, and labels
- Final desktop implementation: `C:\Users\htper\AppData\Local\Temp\wcus-site-design-qa\implementation-desktop-1366x1024-compact.png`
  - Screenshot pixels: 1366 × 1024
  - CSS viewport: 1366 × 1024
  - Device scale factor: 1
- Final iPad-sized implementation: `C:\Users\htper\AppData\Local\Temp\wcus-site-design-qa\implementation-ipad-1024x768-compact.png`
  - Screenshot pixels: 1024 × 768
  - CSS viewport: 1024 × 768
  - Device scale factor: 1
- Final mobile implementation: `C:\Users\htper\AppData\Local\Temp\wcus-site-design-qa\implementation-mobile-390x844-final.png`
  - Screenshot pixels: 390 × 844
  - CSS viewport: 390 × 844
  - Device scale factor: 1
- Normalized focused comparison: `C:\Users\htper\AppData\Local\Temp\wcus-site-design-qa\desktop-component-comparison-final.png`
  - Top: source teaser crop, normalized from 1166 px to 1152 px wide
  - Bottom: implementation teaser crop, normalized from 1153 px to 1152 px wide

The implementation state is the production static build of `/`, scrolled until the teaser and its immediate project/Who We Are context are visible. The sticky header is active; no hover or focus styling is forced.

## Full-view comparison

The 1366 × 1024 source and implementation captures preserve the same information hierarchy: six project cards remain primary, the teaser follows the grid, and Who We Are follows the teaser. The prototype recreates the page at a shorter overall height, so its full-page position is not suitable for a literal pixel diff. The focused comparison normalizes the teaser itself to a common 1152 px content width.

The final implementation intentionally differs from the prototype in three approved ways:

- It uses the real site's Anton/Poppins typography and WCUS color tokens rather than the prototype's approximate type treatment.
- It uses an authentic, simplified Flow 01 map poster instead of the prototype's generic diagram icon.
- It includes the required WordPress runtime/startup disclosure beneath the CTA, making the final band about 27 px taller than the prototype crop.

## Focused comparison and required fidelity surfaces

### Fonts and typography

- The heading uses the site's existing Anton display face, uppercase treatment, optical weight, and line height.
- Body, disclosure, and CTA copy use the existing Poppins family and tokenized responsive sizes.
- At 1366 px the heading and CTA each remain on one line. At 1024 px the longer heading and CTA wrap cleanly without truncation or overflow. At 390 px the CTA remains on one line.

### Spacing and layout rhythm

- Desktop teaser: 1152 × 207 CSS px with a 210 × 158 preview, aligned to the existing project grid.
- iPad-sized teaser: 952 × 205 CSS px, fully contained with zero horizontal overflow.
- Mobile teaser: 341 × 520 CSS px with approximately 17 px side gutters and zero horizontal overflow.
- The mobile CTA is exactly 48 CSS px high. All card edges, padding, gaps, radii, and the magenta edge stripe follow existing site tokens and patterns.

### Colors and visual tokens

- The surface uses the existing `#fff0e0` cream, warm border, plum text, and magenta accent family.
- The CTA uses `#a13a5b` behind white text for a 6.42:1 contrast ratio. Its hover background uses `#4a1a3c`, which provides 13.96:1 contrast against white.
- The poster's pale grid and cobalt route intentionally retain the Living Block Map's visual grammar while remaining subordinate to the project cards.

### Image quality and asset fidelity

- `public/images/living-block-map-preview.webp` is a real generated raster asset grounded in the supplied map screenshot, not CSS/div/SVG art.
- Browser verification confirmed a loaded natural size of 1366 × 1024. The committed WebP is 24,040 bytes and remains sharp at all three tested sizes.
- The desktop poster is deliberately preview-like; its structure is visually readable while its full semantic path is also supplied in the image alt text.

### Copy and content

- Heading, explanatory copy, explicit launch label, startup disclosure, and landscape recommendation match the approved design specification.
- The copy describes four guided flows without falsely claiming that the map is a one-to-one diagram of the six project cards.

### Accessibility and behavior

- Browser DOM inspection exposed the teaser as a named section with a level-three heading, informative image alt text, and a real link.
- The link's accessible name includes “opens in a new tab,” and `aria-describedby` associates the runtime disclosure.
- Rendered link attributes are `target="_blank"`, `rel="noopener noreferrer"`, and the documented outbound tracking tuple.
- The teaser contains no iframe and introduces no client-side script or prefetch.
- The rendered page produced zero browser console warnings or errors during desktop, iPad-sized, and mobile checks.
- CTA activation was exercised, but the in-app browser does not expose the new target-blank tab. The rendered navigation/security attributes and the production-build regression test independently verify the handoff contract.

## Comparison history

1. Initial 1366 × 1024 pass found a P2 desktop polish issue: “Map” wrapped onto a second CTA line while the source used a compact action. A wide-layout no-wrap rule corrected the desktop state.
2. The first no-wrap rule exposed a P2 at 1024 × 768: the wider intrinsic CTA escaped the action track. Scoping no-wrap to viewports at least 1200 px restored the contained, two-line iPad state.
3. The normalized source/implementation comparison found a P2 density mismatch: the first implementation band was 284 px tall versus the source's 180 px crop. Constraining the desktop poster track to 210 px and retaining the base medium padding reduced the final band to 207 px without removing the required disclosure.
4. Post-fix captures at 1366 × 1024, 1024 × 768, and 390 × 844 show no remaining P0, P1, or P2 mismatch. There is no viewport overflow, clipped copy, broken hierarchy, or token drift.

## Findings

No actionable P0, P1, or P2 findings remain.

## Residual test gaps

- Physical iPad Pro Safari, touch behavior, and external-tab behavior still require the repository's device check.
- The fork currently exposes no registered GitHub Actions workflows through the Actions API, so the local browser evidence was used instead of the repository's PR-preview artifact.

## Implementation checklist

- [x] Preserve the project grid as the primary content.
- [x] Place the teaser before Who We Are.
- [x] Use a static, authentic preview rather than an embed.
- [x] Provide explicit startup and landscape disclosure.
- [x] Verify responsive layout, contrast, semantics, console health, and built output.
- [ ] Confirm physical iPad/Safari behavior before event-day release.

final result: passed

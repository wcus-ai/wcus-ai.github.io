# Living Block Map Native Parity Evidence

**Result:** PASS — all 15 approved states are below the shared `0.005` (0.5%) pixel-diff threshold.

## Capture provenance

- Captured: `2026-08-17T07:04:38.540Z`
- Reference: `https://wcus.hperkins.com/`
- Reference source snapshot: `C:\Users\htper\core-ai-wcus` at `c24af9f473fcc7be97715da2c99f3d6b9e81c533`
- Candidate: `http://127.0.0.1:4326/living-block-map/`
- Candidate parent revision: `90add0823cdb9772125091e6a8df3f692b831c6e` plus the final gate-policy and evidence changes retained with this report
- Browser: one headless Chromium process; fresh isolated context per capture
- Viewport: `1366 × 1024`, device scale factor `1`, light color scheme, `en-US`, reduced motion
- Reference service workers: allowed only because the public URL is a WordPress Playground launcher whose nested map cannot boot without its scoped worker
- Candidate service workers: blocked

Command:

```powershell
pnpm verify:map-parity -- --reference https://wcus.hperkins.com/ --candidate http://127.0.0.1:4326 --out artifacts/living-block-map-parity
```

## Results

| ID     | Approved state              | Diff pixels | Diff ratio | Status |
| ------ | --------------------------- | ----------: | ---------: | ------ |
| VIS-01 | settled attract screen      |           0 |    0.0000% | pass   |
| VIS-02 | settled uses-ai flow        |         209 |    0.0149% | pass   |
| VIS-03 | settled uses-wp flow        |         913 |    0.0653% | pass   |
| VIS-04 | settled learns flow         |           0 |    0.0000% | pass   |
| VIS-05 | settled tests flow          |       1,099 |    0.0786% | pass   |
| VIS-06 | browse-all canvas           |           0 |    0.0000% | pass   |
| VIS-07 | Abilities Overview details  |       1,326 |    0.0948% | pass   |
| VIS-08 | Abilities Anatomy details   |       1,815 |    0.1298% | pass   |
| VIS-09 | external AI service details |          10 |    0.0007% | pass   |
| VIS-10 | About screen                |       1,161 |    0.0830% | pass   |
| VIS-11 | WP-Bench prompt stage       |       3,053 |    0.2183% | pass   |
| VIS-12 | WP-Bench agent stage        |       3,053 |    0.2183% | pass   |
| VIS-13 | WP-Bench sandbox stage      |       3,743 |    0.2676% | pass   |
| VIS-14 | WP-Bench checks stage       |       3,432 |    0.2454% | pass   |
| VIS-15 | applied suggestion state    |         215 |    0.0154% | pass   |

The largest measured delta is VIS-13 at `0.2676%`, leaving `0.2324` percentage points of margin below the blocking threshold. The generated reference, candidate, and diff PNGs remain local under `artifacts/living-block-map-parity/` and are intentionally not versioned.

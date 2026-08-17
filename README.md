# WCUS 2026 Core AI Booth Site

Static PWA for the WordPress Core AI Prompt Bar booth at WordCamp US 2026.
Hosts a scannable index of Core AI Team projects, with aggregate cookieless click tracking via a Cloudflare Worker writing to Analytics Engine.

## Repo structure

```text
src/
  content.config.ts          Zod schema for project frontmatter
  content/projects/          one .md per project (source of truth)
  layouts/Base.astro         shared <head>, PWA meta, view transitions
  components/                shared UI and native Living Block Map feature
  pages/
    index.astro              landing: hero + 6-card grid
    living-block-map/        native full-screen Living Block Map exhibit
    p/[slug]/index.astro     project detail page
    privacy.astro
  styles/global.css          design tokens and all component styles
worker/
  index.ts                   Cloudflare Worker: POST /track writes to Analytics Engine
  wrangler.toml              Analytics Engine binding
public/                      static assets, manifest, service worker
.omo/                        plan, evidence, notepads (not shipped)
```

## Develop

Requires Node 24 and pnpm 11.

```bash
pnpm install
pnpm dev          # astro dev server on http://localhost:4321
pnpm build        # static build into dist/
pnpm preview      # serve dist/ locally
pnpm check        # astro check (typecheck)

# linting (oxlint)
pnpm lint
pnpm lint:fix

# formatting (oxfmt)
pnpm format:check
pnpm format
```

## Deploy

### Static site (GitHub Pages)

Push to `main`. The `Build and Deploy` workflow at `.github/workflows/deploy.yml`
builds the static site and publishes it to GitHub Pages.

The site is served from the repository root. The GitHub repo must be a user or
org page (`<name>.github.io`) or use a custom domain. A project page
(`<name>.github.io/<repo>/`) is not supported: `astro.config.mjs` sets `site`
to a root origin, and absolute paths assume root.

### Worker (Cloudflare)

```bash
pnpm exec wrangler deploy --config worker/wrangler.toml
```

The `--config` flag is required. The Wrangler config lives at
`worker/wrangler.toml`, not at the repo root, so a bare `wrangler deploy` from
the repo root fails to find it. The `pnpm worker:deploy` script wraps this
exact command.

Run `wrangler login` once before the first deploy.

## Tracking (Analytics Engine)

Click events are beamed from the static site to a Cloudflare Worker via `navigator.sendBeacon`. The worker writes one data point per click to a Cloudflare Analytics Engine dataset (`WCUS_AI_Booth`); stats are queried from the Cloudflare dashboard or GraphQL API. No KV, no cookies, no PII, no public stats endpoint (data is viewed by the Core AI Team in the dashboard).

Three event kinds, written into Analytics Engine blobs:

- `click_outbound` — any link to another site (project repo/docs/demo, team blog, Slack, etc.)
- `click_internal` — any link that navigates within this site (project card, back link, header brand, footer Privacy, share-feedback anchor)
- `click_feedback` — feedback CTA in ShareFeedback component

Blob layout (positional, must stay stable across all writes):

- `blob1` = event (`click_outbound` | `click_internal` | `click_feedback`)
- `blob2` = project slug (one of six, or `site` for site-wide links)
- `blob3` = target (stable identifier — see vocabulary below)

Target vocabulary (group by this in SQL):

| Event            | Target                                                | Where                                   |
| ---------------- | ----------------------------------------------------- | --------------------------------------- |
| `click_outbound` | `repo` `docs` `demo`                                  | project detail page                     |
| `click_outbound` | `team-blog`                                           | footer "Core AI Team", home "Team blog" |
| `click_outbound` | `handbook`                                            | home "Handbook"                         |
| `click_outbound` | `building-blocks-post`                                | home inline "building blocks" link      |
| `click_outbound` | `slack` `meetings` `contribute`                       | home Slack CTA section                  |
| `click_outbound` | `schedule` `code-of-conduct`                          | footer                                  |
| `click_outbound` | `mdn-sendbeacon` `worker-source` `cloudflare-privacy` | privacy page                            |
| `click_internal` | `project-card`                                        | home project grid                       |
| `click_internal` | `back-to-projects`                                    | project detail "← All projects"         |
| `click_internal` | `home`                                                | header brand                            |
| `click_internal` | `share-feedback`                                      | header "Share Feedback →" anchor        |
| `click_internal` | `privacy`                                             | footer "Privacy"                        |
| `click_internal` | `living-block-map`                                    | home Living Block Map teaser            |
| `click_feedback` | `form`                                                | ShareFeedback CTA                       |

Skip links (`#main`) are intentionally untracked — accessibility mechanism, not engagement.

### Worker deploy

```bash
wrangler login   # one-time OAuth
pnpm worker:deploy
```

The `WCUS_AI_Booth` dataset is created automatically on first write. No namespace creation step is required.

### Site build env vars

Astro exposes any `PUBLIC_*` var to client code at build time. Vite inlines the value into the JS bundle; an unset var causes the tracking code to be tree-shaken to a no-op stub (links still work, no beacons fire).

- `PUBLIC_TRACKING_ENDPOINT` — absolute URL of the worker's `/track` route,
  e.g., `https://wcus-site.<account>.workers.dev/track`. Required for click
  tracking.
- `PUBLIC_FEEDBACK_FORM_ID` — Google Form ID for the shared feedback form.
  Optional until the form exists; when unset, the feedback CTA renders as a
  non-interactive placeholder.

For local dev, place these in `.env` (gitignored). For GitHub Pages deploys,
`PUBLIC_TRACKING_ENDPOINT` is hardcoded in `.github/workflows/deploy.yml`
because the URL is public (it ends up in the client bundle anyway).
`PUBLIC_FEEDBACK_FORM_ID` can be added the same way once the form exists.

### Querying the data

In the Cloudflare dashboard: Analytics & Logs → Analytics Engine → `WCUS_AI_Booth`.
SQL example:

```sql
SELECT blob1 AS event, blob2 AS project, blob3 AS target,
       SUM(_sample_interval) AS clicks
FROM WCUS_AI_Booth
GROUP BY event, project, target
ORDER BY clicks DESC;
```

### Per-project feedback entry IDs

Each project's `src/content/projects/*.md` frontmatter has a `feedback_entry`
field (Google Form's `entry.XYZ` parameter). When the form exists, fill these
in so the feedback CTA preselects the project on click. Until then, the field
can stay `entry.TBD` and the feedback CTA renders as a placeholder.

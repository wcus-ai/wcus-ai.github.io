# WCUS 2026 Core AI Booth Site

Static PWA for the WordPress Core AI Prompt Bar booth at WordCamp US 2026.
Hosts a scannable index of Core AI Team projects, with aggregate cookieless
click tracking via a Cloudflare Worker.

## Repo structure

```text
src/
  content.config.ts          Zod schema for project frontmatter
  content/projects/          one .md per project (source of truth)
  layouts/Base.astro         shared <head>, PWA meta, view transitions
  components/                UI: ProjectCard, ShareFeedback, header, footer, Hero
  pages/
    index.astro              landing: hero + 6-card grid
    p/[slug]/index.astro     project detail page
    privacy.astro
  styles/global.css          design tokens and all component styles
worker/
  index.ts                   Cloudflare Worker: /r/*, /feedback/*, /stats
  projects.json              project URLs and form IDs (consumed by worker)
  wrangler.toml              KV namespace binding
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

## Tracking (KV)

The Worker increments two counter kinds, `click_outbound` and `click_feedback`,
into a Cloudflare KV namespace bound as `COUNTERS` in `worker/wrangler.toml`.

1. Create the namespace and paste the returned `id` into `worker/wrangler.toml`
   (replacing `TODO_KV_NAMESPACE_ID`):

   ```bash
   pnpm exec wrangler kv namespace create COUNTERS
   ```

2. Set `FORM_ID` in `worker/index.ts` to the Google Form ID that receives
   feedback entries (replacing `TODO_FORM_ID`).

3. Set each `feedback_entry` field ID in `src/content/projects/*.md`
   frontmatter to the matching Google Form entry, so the
   `/feedback/<slug>` redirect preselects the right project.

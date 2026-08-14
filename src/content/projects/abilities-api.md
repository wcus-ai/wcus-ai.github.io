---
slug: abilities-api
name: Abilities API
tagline: A central registry that lets a WordPress site describe what it can do.
links:
  - {
      type: docs,
      label: Add abilities to your plugin,
      url: https://developer.wordpress.org/apis/abilities-api/,
    }
  - {
      type: repo,
      label: Follow development on Trac,
      url: https://core.trac.wordpress.org/component/abilities-api,
    }
feedback_entry: entry.TBD
accent_color: '#9d246b'
order: 1
---

## What becomes possible

**AI agent:** Imagine asking, “Back up my site, find the posts that need the most SEO
help, improve their metadata, optimize their featured images,
and report what changed.” An agent can discover the available abilities, chain the
right ones across plugins, and act only within the current user permissions.

**Automation:** When a new order is created in Woocommerce, a workflow could enroll the customer in a
LearnPress onboarding course then add the customer to a mailing list without any code needed. Each
step uses a documented, permission-checked ability instead of a bespoke integration.

The Abilities API makes these workflows possible by giving WordPress one discoverable
registry of what a site can do. Available in WordPress core since 6.9, it lets AI tools,
automation platforms, and other plugins understand an ability’s inputs, outputs, and
permissions before calling it.

## Add your plugin to the ecosystem

Plugin developers register a category and an ability on the dedicated Abilities API
hooks. Each ability describes its inputs and outputs with JSON Schema, provides an
execution callback, and checks whether the current user has permission to run it. The
result is a self-documenting capability that other plugins and tools can discover and
use safely.

The official developer guide includes the complete registration pattern and a working
example. Use it to make your plugin features available to the growing WordPress AI and
automation ecosystem.

## Plugins already shipping abilities

Here are some popular plugins that have added abilities already and some ideas of what they could be used for.

- **[All in One SEO](https://github.com/awesomemotive/all-in-one-seo-pack)** — Reads and updates post SEO data, finds missing metadata and low TruSEO scores, manages robots.txt rules, and returns site audits. **Use it to:** let an agent find under-optimized content and apply a focused SEO cleanup.
- **[Rank Math SEO](https://github.com/rankmath/seo-by-rank-math)** — Audits and fixes site SEO, inspects post metadata, and exposes schema, analytics, content-analysis, link, and AI-visibility tools. **Use it to:** turn a site audit into a prioritized remediation plan with supported fixes applied automatically.
- **[WordPress AI](https://github.com/WordPress/ai)** — Reads site content and offers abilities for titles, excerpts, summaries, translations, alt text, slugs, editorial notes, replies, and comment moderation. **Use it to:** prepare a complete editorial pass on a draft while keeping every action inside WordPress.
- **[WP Mail SMTP](https://github.com/awesomemotive/WP-Mail-SMTP)** — Exposes permission-gated SMTP debug events, with email log and statistics abilities available in supported editions. **Use it to:** diagnose why a transactional or welcome email failed without searching through admin screens.
- **[WP Rocket](https://github.com/wp-media/wp-rocket)** — Clears a URL or the whole site cache, checks cache health and status, manages supported options, and exposes performance scores and recommendations. **Use it to:** purge only pages changed by an automation and then verify cache health.
- **[BackWPup](https://github.com/wp-media/backwpup)** — Lists, runs, and cancels backup jobs and returns backup history and logs. **Use it to:** create a recovery point before an agent makes changes and confirm that the backup succeeded.
- **[Imagify](https://github.com/wp-media/imagify-plugin)** — Optimizes individual or bulk media, generates missing next-generation formats, reports coverage and usage, updates settings, and restores originals. **Use it to:** optimize a new campaign’s image library and roll back an asset if visual review fails.
- **[Meta Box](https://github.com/wpmetabox/meta-box)** — Reads, writes, and deletes custom-field values and explains the expected value format for each field. **Use it to:** populate structured product, directory, or event data from an approved external source.
- **[Secure Custom Fields](https://github.com/WordPress/secure-custom-fields)** — Lists, creates, updates, duplicates, exports, and imports fields, field groups, post types, taxonomies, and options pages. **Use it to:** let an agent scaffold a complete content model from a plain-language brief.
- **[Page Builder by SiteOrigin](https://github.com/siteorigin/siteorigin-panels)** — Reads and safely updates classic and block-stored Page Builder layouts. **Use it to:** rearrange a landing page while passing the result through the plugin’s widget sanitizer.
- **[LearnPress](https://github.com/LearnPress/learnpress)** — Manages courses, sections, lessons, quizzes, questions, enrollments, and student progress. **Use it to:** generate an onboarding course, enroll a new customer, and monitor completion from one workflow.
- **[Disable Comments](https://github.com/WPDevelopers/disable-comments)** — Reports where comments are disabled, which post types are affected, and whether REST or XML-RPC comments are blocked. **Use it to:** verify that a regulated or campaign site still matches its comment policy.
- **[Ultimate Multisite](https://github.com/Ultimate-Multisite/ultimate-multisite)** — Provides permission-gated CRUD abilities for customers, sites, products, memberships, and other platform entities, plus tenant frontend availability diagnostics. **Use it to:** provision a new tenant and explain whether its mapped domain and frontend are actually ready.

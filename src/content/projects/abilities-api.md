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

The Abilities API gives WordPress a single, discoverable place to declare what a site
can do. Available in WordPress core since 6.9, it enables AI tools, external
integrations, and other plugins to find and call capabilities without bespoke wiring
for each one.

Before this, every plugin that wanted to expose capabilities to AI had to invent its
own discovery mechanism. The Abilities API provides one standard registry so that any
MCP client, AI assistant, or external tool can ask "what can this site do?" and get a
consistent answer.

## Build an ability

Plugin developers register a category and an ability on the dedicated Abilities API
hooks. Each ability describes its inputs and outputs with JSON Schema, provides an
execution callback, and checks whether the current user has permission to run it. The
result is a self-documenting capability that other plugins and tools can discover and
use safely.

The official developer guide includes the complete registration pattern and a working
example. Use it to make your plugin features available to the growing WordPress AI and
automation ecosystem.

## Plugins already adding abilities

Some of the most widely installed WordPress.org plugins with published Abilities API
integrations include (rounded active-install figures, checked August 2026):

- [Rank Math SEO](https://github.com/rankmath/seo-by-rank-math) — 4+ million active installations
- [WP Mail SMTP](https://github.com/awesomemotive/WP-Mail-SMTP) — 4+ million active installations
- [All in One SEO](https://github.com/awesomemotive/all-in-one-seo-pack) — 3+ million active installations
- [Disable Comments](https://github.com/WPDevelopers/disable-comments) — 1+ million active installations
- [Imagify](https://github.com/wp-media/imagify-plugin) — 1+ million active installations

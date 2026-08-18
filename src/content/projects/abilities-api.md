---
slug: abilities-api
name: Abilities API
tagline: A central registry that lets a WordPress site describe what it can do.
links:
  - { type: docs, label: Docs, url: https://developer.wordpress.org/apis/abilities-api/ }
  - { type: repo, label: Trac, url: https://core.trac.wordpress.org/component/abilities-api }
feedback_entry: entry.TBD
accent_color: '#9d246b'
order: 1
---

The Abilities API is a developer feature that gives WordPress a single, discoverable registry of what a site can do. Like hooks but for consumable APIs, Abilities are a functional primitive that allow 3rd party code to integrate with plugin and custom functionality as if it were a first-party feature.

Available since WordPress 6.9, Abilities are _not_ AI-specific, but meant to help stabilize fragile plugin ecostems. The Core AI Team uses Abilities in the <a href="../mcp-adapter">MCP Adapter</a> - a narrow compatibility shim that allows AI tools to call Abilities via the MCP protocol - and in our other canonical plugins to ensure ecosystem stability for users while iterating quickly on implementation details.

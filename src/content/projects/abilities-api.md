---
slug: abilities-api
name: Abilities API
tagline: A central registry that lets a WordPress site describe what it can do.
links:
  - { type: repo, label: Trac, url: 'https://core.trac.wordpress.org/component/abilities-api' }
accent_color: '#9d246b'
order: 1
---

The Abilities API gives WordPress a single, discoverable place to declare what the
site can do — enabling AI tools, external integrations, and other plugins to find and
call those capabilities without bespoke wiring for each one.

Before this, every plugin that wanted to expose capabilities to AI had to invent its
own discovery mechanism. The Abilities API provides one standard registry so that any
MCP client, AI assistant, or external tool can ask "what can this site do?" and get a
consistent answer.

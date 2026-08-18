---
slug: abilities-api
name: Abilities API
tagline: A central registry that that lets external integrations discover and use site functionality regardless of implementation details.
links:
  - { type: docs, label: Docs, url: https://developer.wordpress.org/apis/abilities-api/ }
  - { type: repo, label: Trac, url: https://core.trac.wordpress.org/component/abilities-api }
feedback_entry: entry.TBD
accent_color: '#9d246b'
order: 1
---

The Abilities API is a developer feature that gives WordPress a single, discoverable registry of what a site can do. Like hooks but for consumable APIs, Abilities are a functional primitive that allow 3rd party code to integrate with plugin and custom functionality as if it were a first-party feature.

Available since WordPress 6.9, Abilities are _not_ AI-specific, but meant to help stabilize fragile plugin ecostems. The Core AI Team uses Abilities in the <a href="../mcp-adapter" data-track-event="click_internal" data-track-project="abilities-api" data-track-target="mcp-adapter">MCP Adapter</a> - a narrow compatibility shim that allows AI tools to call Abilities via the MCP protocol - and in our other canonical plugins to ensure ecosystem stability for users while iterating quickly on implementation details.

<section class="talk-promo">
  <a
    href="https://us.wordcamp.org/2026/session/abilities-api-for-humans/"
    class="talk-promo__image-link"
    data-track-event="click_outbound"
    data-track-project="abilities-api"
    data-track-target="wcus-talk"
  >
    <img
      src="https://us.wordcamp.org/2026/files/2026/07/Nik-McLaughlin-16X9.png"
      alt="Nik McLaughlin"
      class="talk-promo__image"
      loading="lazy"
    />
  </a>
  <p class="talk-promo__cta">
    Learn more about the Abilities API at Nik McLaughlin's talk: <a
      href="https://us.wordcamp.org/2026/session/abilities-api-for-humans/"
      data-track-event="click_outbound"
      data-track-project="abilities-api"
      data-track-target="wcus-talk"
    >"Abilities API for Humans"</a>
  </p>
  <p class="talk-promo__meta">Tuesday (today!), August 18, 2026 · 1:45 PM MST · North 222, Phoenix Convention Center, Phoenix, AZ</p>
</section>

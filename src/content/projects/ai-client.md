---
slug: ai-client
name: AI Client
tagline: The provider-agnostic framework for talking to AI models from PHP.
links:
  - { type: repo, label: GitHub, url: 'https://github.com/WordPress/PHP-AI-Client' }
  - {
      type: docs,
      label: Handbook,
      url: 'https://make.wordpress.org/core/2026/03/24/introducing-the-ai-client-in-wordpress-7-0/',
    }
feedback_entry: entry.1564689905
accent_color: '#3f3dc4'
order: 2
---

The AI Client is the foundation for AI functionality in WordPress. It provides a
provider-agnostic PHP SDK for talking to any AI model — OpenAI, Anthropic, Google,
local models, and more — plus the in-core wrapper shipped in WordPress 7.0.

Plugins and themes build on top of it without locking themselves into a specific AI
vendor. Swap providers without rewriting consumer code; the API stays the same.

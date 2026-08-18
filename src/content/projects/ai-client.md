---
slug: ai-client
name: AI Client
tagline: The provider-agnostic framework for talking to AI models from PHP and WordPress.
links:
  - { type: repo, label: GitHub, url: 'https://github.com/WordPress/PHP-AI-Client' }
  - {
      type: docs,
      label: Announcement Post,
      url: 'https://make.wordpress.org/core/2026/03/24/introducing-the-ai-client-in-wordpress-7-0/',
    }
accent_color: '#3f3dc4'
order: 2
---

The AI Client is the foundation for AI functionality in WordPress. It provides a
provider-agnostic PHP SDK for talking to any AI model — OpenAI, Anthropic, Google,
local models, and more — plus the in-core wrapper shipped in WordPress 7.0.

The AI Client pairs with individual AI Providers - WordPress Connector plugins that provide the authentication and configuration for specific AI services - allowing the canonical <a href="../ai-plugin" data-track-event="click_internal" data-track-project="ai-client" data-track-target="ai-plugin">AI plugin</a> and ecosystem code to use AI functionality without needing to know the implementation details of each provider.

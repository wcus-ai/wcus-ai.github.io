import type { MapModel } from './types';

export const MAP_MODEL = {
  content: {
    title: 'What is WordPress Core AI?',
    eyebrow: 'WordPress Core AI',
    reviewedDate: 'Reviewed 14 Aug 2026',
    intro: [
      'WordPress Core AI is a set of open building blocks that let WordPress use AI services and work with outside assistants—without tying WordPress to one provider.',
      'Explore four flows to see what happens inside WordPress, what happens outside it, and how the projects connect.',
    ],
    labels: {
      railEmptyLabel: 'Choose a flow',
      railActiveLabel: 'Choose another flow',
      browseLabel: 'Browse all components',
      browseDescription: 'Every component on one canvas, with no flow selected.',
      takeawayHeading: 'What this flow shows',
      roleHeading: 'Its role in this flow',
      lessonHeading: 'Why that matters',
      definitionHeading: 'What it is',
      technicalHeading: 'Under the hood',
      exploreHeading: 'Keep exploring',
      tapCue: 'Tap for its role',
      receivesLabel: 'Receives',
      doesLabel: 'Does',
      returnsLabel: 'Passes on',
    },
    guidance: {
      attract: 'Choose a flow to begin.',
      flow: 'Follow %1$s. Highlighted components take part in this flow. Tap one to learn what it contributes.',
      inspect: 'You are viewing this component’s role in “%1$s.”',
      browse: 'Tap any component to learn what it is and where it belongs.',
      cardAction: '%1$s — view its role in “%2$s.”',
      cardActionStep: 'Step %1$s: %2$s — view its role in “%3$s.”',
      cardInactive: '%1$s — not part of this flow.',
      cardActionBrowse: '%1$s — open its details.',
    },
    announcements: {
      flowSelected: '%1$s.',
      flowReplayed: '%1$s replayed.',
      takeaway: '%1$s: %2$s',
      browse:
        'Every component is on the canvas with no flow selected. Tap any component to learn what it is and where it belongs.',
      nextSuggestion: 'The AI Plugin shows the next suggestion.',
      detailsInFlow: '%1$s details open in %2$s.',
      detailsBrowse: '%1$s details open.',
    },
    blocks: [
      {
        id: 'plugin',
        name: 'AI Plugin',
        tagline: 'Turn the foundations into useful features',
        badge: 'Experimental reference plugin',
      },
      {
        id: 'client',
        name: 'AI Client',
        tagline: 'Request AI through one common interface',
        badge: 'Core API · 7.0',
      },
      {
        id: 'connectors',
        name: 'Connectors',
        tagline: 'Configure provider plugins and credentials',
        badge: 'Core API · 7.0',
      },
      {
        id: 'mcp',
        name: 'MCP Adapter',
        tagline: 'Let authorized assistants work with WordPress',
        badge: 'WordPress plugin · not in Core',
      },
      {
        id: 'abilities',
        name: 'Abilities API',
        tagline: 'Describe what WordPress can do',
        badge: 'Core API · 6.9',
      },
      {
        id: 'bench',
        name: 'WP-Bench',
        tagline: 'See whether the code an agent writes actually runs',
        badge: 'Early benchmark',
      },
    ],
    actors: [
      {
        id: 'assistant',
        name: 'AI assistant',
        tagline: 'Speaks MCP',
        badge: 'Not WordPress',
      },
      {
        id: 'skills',
        name: 'Agent Skills',
        tagline: 'Instruction bundles',
        badge: 'Guidance',
      },
      {
        id: 'agent',
        name: 'Coding agent',
        tagline: 'Writes the code',
        badge: 'Not WordPress',
      },
      {
        id: 'task',
        name: 'A WordPress task',
        tagline: 'Plugin or theme work',
        badge: 'Not WordPress',
      },
      {
        id: 'provider',
        name: 'External AI service',
        tagline: 'Selected from site configuration',
        badge: 'Not WordPress',
      },
    ],
    flows: [
      {
        id: 'uses-ai',
        title: 'WordPress uses AI',
        copy: 'A plugin asks the AI Client for a capability. The Client routes through a configured provider plugin to an external AI service; Connectors supplies discovery, configuration, and credentials beside the request path.',
        situation: 'A feature inside WordPress needs an AI-generated result.',
        takeaway:
          'A WordPress feature uses a common AI interface instead of integrating directly with every provider. Provider configuration supports the request, while the AI service remains outside WordPress.',
        outcome: 'WordPress requests an AI result',
      },
      {
        id: 'uses-wp',
        title: 'AI uses WordPress',
        copy: 'An authorized assistant calls in through the MCP Adapter, which translates the call into a WordPress ability. Permission still belongs to WordPress.',
        situation: 'An outside assistant asks WordPress to perform an allowed action.',
        takeaway:
          'The assistant does not bypass WordPress. The MCP Adapter translates the request, and the selected ability still applies WordPress permissions.',
        outcome: 'An assistant requests a WordPress action',
      },
      {
        id: 'learns',
        title: 'An agent learns WordPress',
        copy: 'Agent Skills attaches current WordPress guidance to a coding agent, which then starts the task. All of this happens outside the site — nothing inside WordPress runs.',
        situation: 'A coding agent receives WordPress-specific guidance before writing code.',
        takeaway:
          'Agent Skills changes the information available to the coding agent. Nothing runs on the WordPress site during this flow.',
        outcome: 'A coding agent receives WordPress guidance',
      },
      {
        id: 'tests',
        title: 'WordPress tests the result',
        copy: 'WP-Bench runs what the agent produced inside a sandboxed WordPress, and WordPress itself decides whether it passed. Evidence, not vibes.',
        situation: 'Code written by an agent needs to be tested against real WordPress behavior.',
        takeaway:
          "The generated code runs in a disposable WordPress environment and is judged by WordPress tests, not by another model's opinion.",
        outcome: 'WordPress evaluates generated code',
      },
    ],
    panels: [
      {
        id: 'abilities',
        badge: 'Core API · 6.9',
        title: 'Abilities API',
        lede: 'Abilities are the list of things this site can do. Each one declares its inputs, its outputs, who is allowed to run it, and what happens when it runs.',
        roles: {
          'uses-wp': {
            receives:
              'The translated request, naming the WordPress action and supplying its inputs.',
            does: 'Validates the inputs, checks whether the current user is allowed to perform the action, then runs its registered callback.',
            returns: 'A typed result, or a refusal.',
            lesson:
              'Connecting an outside assistant does not give it unrestricted access. WordPress still controls execution.',
          },
        },
        connectHeading: 'How it connects',
        connectLayout: 'chain',
        connect: [
          {
            label: 'Input',
          },
          {
            label: 'Permission',
          },
          {
            label: 'Run',
          },
          {
            label: 'Typed output',
            accent: true,
          },
        ],
        notes: [
          {
            heading: 'Under the hood',
            text: 'The PHP API landed in WordPress 6.9. WordPress 7.0 added a client-side counterpart for editor actions such as navigation and block insertion. A public default for client exposure, filtering in wp_get_abilities(), and filters around execution arrive in WordPress 7.1 on August 19, 2026. This exhibit runs a 7.1 release candidate, so the Anatomy panel describes the version you are looking at.',
          },
        ],
        href: 'https://developer.wordpress.org/apis/abilities-api/',
        linkLabel: 'developer.wordpress.org/apis/abilities-api',
        qr: 'qr/abilities.svg',
      },
      {
        id: 'client',
        badge: 'Core API · 7.0',
        title: 'AI Client',
        lede: 'A plugin asks for a capability and the kind of result it needs. The AI Client routes through an installed provider plugin to a compatible external service; Connectors supplies that plugin’s configuration and credentials.',
        roles: {
          'uses-ai': {
            receives: 'A capability request from a WordPress feature.',
            does: 'Sends the request through a compatible configured provider plugin.',
            returns: 'The provider’s response in a consistent WordPress format.',
            lesson:
              'WordPress features can request AI capabilities without integrating every external provider separately.',
          },
        },
        connectHeading: 'How it connects',
        connectLayout: 'chain',
        connect: [
          {
            label: 'Text, image, speech or video request',
          },
          {
            label: 'AI Client',
            accent: true,
          },
          {
            label: 'Normalized result',
          },
        ],
        notes: [
          {
            heading: 'Under the hood',
            text: 'A WordPress wrapper around the provider-agnostic PHP AI Client, which handles provider communication, model selection, and normalized results. Consuming plugins never integrate a provider directly. There is a JavaScript prompt API too, but it is administrator-gated and can send any prompt to any configured provider — so for editor features, register a REST endpoint scoped to that one feature. Check support before showing any AI interface — the checks are free, and a 7.0 site may have no provider configured at all.',
          },
          {
            heading: 'Calling back into WordPress',
            text: 'A request can name registered abilities the model is allowed to call. When it calls one, WordPress runs that ability — permission check and all — and folds the result back into the same request. This is where the two halves of the map meet: WordPress asking AI for something can end with WordPress doing the work itself.',
          },
        ],
        href: 'https://developer.wordpress.org/reference/functions/wp_ai_client_prompt/',
        linkLabel: 'developer.wordpress.org/reference/functions/wp_ai_client_prompt',
        qr: 'qr/client.svg',
      },
      {
        id: 'connectors',
        badge: 'Core API · 7.0',
        title: 'Connectors',
        lede: 'Where a site owner installs provider plugins, supplies credentials, and sees connection status — one setup shared by every plugin that needs it. It supports the request path; it is not the request executor.',
        roles: {
          'uses-ai': {
            receives: 'Nothing in the request path — it sits beside it.',
            does: 'Provides provider-plugin installation, credentials, configuration, and connection status beside the active request path.',
            returns: 'The provider configuration the AI Client uses when it chooses a route.',
            lesson:
              'Provider setup is centralized instead of being rebuilt inside every AI-powered feature. Connectors supports the path; it does not execute the request.',
          },
        },
        connectHeading: 'Connection states',
        connectLayout: 'grid',
        connect: [
          {
            label: 'Available',
          },
          {
            label: 'Needs plugin',
          },
          {
            label: 'Needs credentials',
            tone: 'warning',
          },
          {
            label: 'Connected',
            accent: true,
          },
        ],
        notes: [
          {
            heading: 'Providers',
            text: 'Provider plugins register with the AI Client. Connectors auto-discovers them, and one button installs and activates the plugin before asking for its key. Keys are read from an environment variable first, then a wp-config constant, then the database — where they sit unencrypted by default. The map stays vendor-neutral: no provider owns a position on the canvas.',
          },
          {
            heading: 'Under the hood',
            text: 'Introduced in WordPress 7.0 as a standardized framework for registering and managing connections to external services. AI providers are the first users of it, not the only intended ones — the framework is built for outside connections generally.',
          },
        ],
        href: 'https://make.wordpress.org/core/2026/03/18/introducing-the-connectors-api-in-wordpress-7-0/',
        linkLabel: 'make.wordpress.org/core → Connectors API in 7.0',
        qr: 'qr/connectors.svg',
      },
      {
        id: 'plugin',
        badge: 'Experimental reference plugin',
        title: 'AI Plugin',
        lede: 'Where the foundations become things people can use: alt text, summaries, titles, editorial notes, image generation. Nothing is on by default: you enable one experiment at a time.',
        roles: {
          'uses-ai': {
            receives: 'A person’s request in the editor — alt text, a summary, a title.',
            does: 'Turns it into a capability request and hands that to the AI Client.',
            returns: 'A suggestion the person reviews before anything is applied.',
            lesson: 'The feature decides what to ask for. A person still decides what to keep.',
          },
        },
        connectHeading: 'How it connects',
        connectLayout: 'chain',
        connect: [
          {
            label: 'Request',
          },
          {
            label: 'Preview',
          },
          {
            label: 'A person reviews',
            accent: true,
          },
          {
            label: 'Apply',
          },
        ],
        notes: [
          {
            heading: 'Under the hood',
            text: 'Also a reference implementation: it shows plugin authors how Abilities, the AI Client, and Connectors fit together. Requires WordPress 7.0. Connector approvals, request logging, and encrypting provider keys at rest are experimental governance features of this plugin, not of Connectors itself.',
          },
        ],
        href: 'https://wordpress.org/plugins/ai/',
        linkLabel: 'wordpress.org/plugins/ai',
        qr: 'qr/plugin.svg',
      },
      {
        id: 'mcp',
        badge: 'WordPress plugin · not in Core',
        title: 'MCP Adapter',
        lede: 'Translation at the edge of the site. It exposes the abilities their authors marked public to authorized outside assistants — as MCP resources and prompts automatically, and as individual tools on a custom server — and translates their calls back into WordPress work.',
        roles: {
          'uses-wp': {
            receives: 'An MCP tool call from an authorized outside assistant.',
            does: 'Translates the call into a WordPress ability and hands it to WordPress to run.',
            returns: 'The ability’s typed result, translated back into MCP.',
            lesson:
              'The adapter is a translator at the edge of the site. It does not create the action, and it does not grant the permission.',
          },
        },
        connectHeading: 'How it connects',
        connectLayout: 'chain',
        connect: [
          {
            label: 'MCP tool call',
          },
          {
            label: 'Transport check',
          },
          {
            label: 'Meta-tool',
          },
          {
            label: 'Permission',
          },
          {
            label: 'Run',
            accent: true,
          },
        ],
        notes: [
          {
            heading: 'Under the hood',
            text: 'An official WordPress package installed as a plugin, not part of Core: HTTP and STDIO transports, configurable servers, validation, permission checks, error handling, and observability. The default server supports multiple MCP protocol versions; its HTTP transport implements MCP 2025-11-25. Today it answers calls; it does not make them. It does not create the underlying action, and it is not the model — WordPress still owns execution.',
          },
        ],
        href: 'https://github.com/WordPress/mcp-adapter',
        linkLabel: 'github.com/WordPress/mcp-adapter',
        qr: 'qr/mcp.svg',
      },
      {
        id: 'bench',
        badge: 'Early benchmark',
        title: 'WP-Bench',
        lede: 'A test bench, not part of any live request. It measures whether the code an agent writes for WordPress actually runs.',
        roles: {
          tests: {
            receives: 'The code the agent produced.',
            does: 'Runs it inside a real WordPress created for this one test, then throws that install away.',
            returns: 'Pass or fail, decided by WordPress assertions rather than by another model.',
            lesson: 'Generated code is judged by WordPress tests, not by another AI model.',
          },
        },
        connectHeading: 'How it connects',
        connectLayout: 'chain',
        connect: [
          {
            label: 'Task',
          },
          {
            label: 'Sandbox',
          },
          {
            label: 'Lint and runtime checks',
          },
          {
            label: 'Evidence',
            accent: true,
          },
        ],
        notes: [
          {
            heading: 'Under the hood',
            text: 'One suite, one dimension: code generation tasks graded by static checks and runtime assertions in a real WordPress environment. WordPress itself runs the assertions. Passing is all-or-nothing: a partially correct result still fails. Run --check-reference-solution first to prove the grader accepts the canonical solution, then --check-exploits to prove trivial stubs fail.',
          },
        ],
        href: 'https://github.com/WordPress/wp-bench',
        linkLabel: 'github.com/WordPress/wp-bench',
        qr: 'qr/bench.svg',
      },
      {
        id: 'skills',
        badge: 'Contributor guidance',
        title: 'Agent Skills',
        lede: 'Portable instruction bundles — guidance, checklists, references — that help a coding assistant follow current WordPress practice. Nothing here runs on a live site.',
        roles: {
          learns: {
            receives: 'A selection of WordPress guidance — checklists, references, procedures.',
            does: 'Supplies those instructions to the coding agent before it writes the requested code.',
            returns: 'An agent that follows current WordPress practice.',
            lesson:
              'The guidance affects the agent’s work outside the site; it does not execute on a live WordPress installation.',
          },
        },
        connectHeading: 'How it connects',
        connectLayout: 'chain',
        connect: [
          {
            label: 'Select guidance',
          },
          {
            label: 'Attach to the agent',
            accent: true,
          },
          {
            label: 'Follow the procedure',
          },
        ],
        notes: [
          {
            heading: 'Under the hood',
            text: 'Covers blocks, themes, plugins, REST, the Interactivity API, Abilities, performance, and security. Three of the skills are about Abilities alone: how to register one, how to audit an existing REST surface for candidates, and how to verify a registration against what it claims. Installable for several coding assistants, or committed alongside an individual project.',
          },
        ],
        href: 'https://github.com/WordPress/agent-skills',
        linkLabel: 'github.com/WordPress/agent-skills',
        qr: 'qr/skills.svg',
      },
      {
        id: 'assistant',
        badge: 'Not WordPress',
        title: 'AI assistant',
        lede: 'A program outside WordPress — a chat assistant, an editor, an agent — that speaks MCP. It holds no privileges of its own — it acts as a WordPress user it was given credentials for, and never gets more reach than that user has.',
        roles: {
          'uses-wp': {
            receives: 'A person’s instruction, outside WordPress.',
            does: 'Decides a WordPress action is needed and issues an MCP tool call.',
            returns: 'Whatever WordPress allows back — nothing more.',
            lesson: 'The assistant is a client, not an authority. It asks; it does not decide.',
          },
        },
      },
      {
        id: 'agent',
        badge: 'Not WordPress',
        title: 'Coding agent',
        lede: 'A coding assistant that writes plugin and theme code. It works outside the site — on a developer’s machine or in a hosted environment — and never runs against a live install.',
        roles: {
          learns: {
            receives: 'The attached guidance, plus the task it was asked to do.',
            does: 'Writes plugin or theme code, outside the site.',
            returns: 'Code a person still has to review and install.',
            lesson: 'Nothing here touches a running site. The agent produces text, not changes.',
          },
          tests: {
            receives: 'One task and its requirements, as a single message.',
            does: 'Writes PHP. It gets no conversation, no retry, and no sight of the assertions.',
            returns: 'Whatever it wrote, parsed out of the reply and passed on unrepaired.',
            lesson:
              'Every model gets exactly the same task, so a difference in the result is a difference in the model.',
          },
        },
      },
      {
        id: 'provider',
        badge: 'Not WordPress',
        title: 'External AI service',
        lede: 'The model provider a site owner configured: an API run by someone else, on someone else’s infrastructure. WordPress sends it a request and receives a result.',
        roles: {
          'uses-ai': {
            receives: 'The request, once it has crossed out of WordPress.',
            does: 'Runs the model on infrastructure WordPress does not control.',
            returns: 'A result the provider plugin hands back to the AI Client.',
            lesson:
              'The model and AI service remain outside WordPress; WordPress owns the integration and request path around them.',
          },
        },
      },
      {
        id: 'task',
        badge: 'Not WordPress',
        title: 'A WordPress task',
        lede: 'The actual work someone wants done: a plugin, a theme, a fix. On this map it stands for the job itself, not for any code running on a site.',
        roles: {
          learns: {
            receives: 'The agent’s attention, once the guidance is attached.',
            does: 'Stands for the real work — a plugin, a theme, a fix.',
            returns: 'Finished code, still outside WordPress.',
            lesson: 'The site is not involved until a person installs what the agent wrote.',
          },
        },
      },
      {
        id: 'provider-plugin',
        badge: 'WordPress plugin',
        title: 'AI provider plugin',
        lede: 'A provider-specific integration installed as a WordPress plugin. It speaks one external service’s protocol using the credentials Connectors resolved for it.',
        roles: {
          'uses-ai': {
            receives: 'The routed request from the AI Client.',
            does: 'Speaks one external service’s protocol, using the credentials Connectors resolved.',
            returns: 'That service’s reply, handed back to the AI Client.',
            lesson:
              'The provider-specific part is a plugin. Swapping providers does not change the feature that asked.',
          },
        },
      },
    ],
    suggestions: [
      {
        label: 'Alt text',
        text: 'Two people reviewing a site on a laptop',
      },
      {
        label: 'Post title',
        text: 'A quieter way to explain WordPress and AI',
      },
      {
        label: 'Summary',
        text: 'Three sentences, plain language, no jargon',
      },
      {
        label: 'Editorial note',
        text: 'Tighten the opening paragraph',
      },
    ],
  },
  layouts: {
    'uses-ai': {
      members: {
        plugin: 1,
        client: 2,
        provider: 0,
      },
      sidecars: ['connectors'],
      providerPlugin: {
        step: 3,
        position: [824, 214],
        restPosition: [824, 332],
      },
      place: {
        plugin: [268, 192],
        client: [556, 192],
        connectors: [836, 360],
        provider: [1180, 206],
      },
      park: ['mcp', 'abilities', 'bench'],
      shelfY: 512,
      shelfStart: 3,
      edges: ['M504 266 L556 266', 'M792 266 L824 266', 'M1024 266 L1180 266'],
      rest: [
        'M504 234 L556 234',
        'M792 234 C810 234 806 384 824 384',
        'M1024 384 C1080 384 1094 390 1150 390',
      ],
      sidecarEdges: ['M924 360 L924 318'],
      sidecarRest: ['M924 332 C954 318 1012 320 1030 308'],
      dur: ['1.5s', '1.9s', '1.7s'],
      crosses: ['right'],
    },
    'uses-wp': {
      members: {
        assistant: 1,
        mcp: 2,
        abilities: 3,
      },
      place: {
        assistant: [24, 156],
        mcp: [122, 318],
        abilities: [556, 318],
        skills: [1150, 112],
        agent: [1150, 462],
        provider: [1150, 330],
        task: [1150, 594],
      },
      park: ['plugin', 'client', 'connectors', 'bench'],
      shelfY: 512,
      strips: {
        mcp: [0, -57],
        abilities: [0, -82],
      },
      edges: ['M114 262 L114 392 L118 392', 'M358 392 L556 392'],
      rest: ['M114 276 C114 342 162 372 230 395', 'M358 474 L556 474'],
      dur: ['2.1s', '1.9s'],
      crosses: ['left'],
      tokens: true,
    },
    learns: {
      members: {
        skills: 1,
        agent: 2,
        task: 3,
      },
      place: {
        skills: [24, 150],
        agent: [24, 320],
        task: [24, 490],
        assistant: [1150, 112],
        provider: [1150, 330],
      },
      park: ['plugin', 'client', 'connectors', 'mcp', 'abilities', 'bench'],
      shelfY: 512,
      edges: ['M114 276 L114 314', 'M114 446 L114 484'],
      rest: ['M114 278 L114 312', 'M114 448 L114 482'],
      dur: ['1.4s', '1.4s'],
      crosses: [],
      zone: 'outside',
    },
    tests: {
      members: {
        agent: 1,
        bench: 2,
      },
      place: {
        agent: [24, 318],
        bench: [556, 678],
        assistant: [1150, 252],
        skills: [1150, 384],
        provider: [1150, 516],
        task: [1150, 648],
      },
      park: ['plugin', 'client', 'connectors', 'mcp', 'abilities'],
      noStrip: ['bench'],
      shelfY: 140,
      edges: [
        'M114 422 L114 450 Q114 470 134 470 L440 470 Q460 470 460 490 L460 732 Q460 752 480 752 L546 752',
      ],
      rest: ['M114 402 C114 630 176 748 336 748 L546 748'],
      dur: ['2.8s'],
      crosses: ['left', 'bottom'],
    },
  },
  previews: [
    {
      storyId: 'uses-ai',
      scale: 0.8,
      ids: ['plugin', 'client', 'provider'],
      steps: {
        plugin: 1,
        client: 2,
        provider: 0,
      },
      sidecars: ['connectors'],
      providerPlugin: {
        step: 3,
        position: [716, 200],
        scale: 0.8,
      },
      at: {
        plugin: [260, 200],
        client: [488, 200],
        connectors: [728, 340],
        provider: [1060, 211],
      },
      paths: ['M449 259 L488 259', 'M677 259 L716 259', 'M876 259 L1060 259'],
      sidecarPaths: ['M798 340 L798 284'],
    },
    {
      storyId: 'uses-wp',
      scale: 0.8,
      ids: ['assistant', 'mcp', 'abilities'],
      at: {
        assistant: [30, 214],
        mcp: [222, 200],
        abilities: [520, 200],
      },
      paths: ['M180 257 L216 257', 'M369 259 L514 259'],
    },
    {
      storyId: 'learns',
      scale: 0.72,
      ids: ['skills', 'agent', 'task'],
      at: {
        skills: [36, 150],
        agent: [36, 272],
        task: [36, 394],
      },
      paths: ['M108 242 L108 266', 'M108 364 L108 388'],
    },
    {
      storyId: 'tests',
      scale: 0.8,
      ids: ['agent', 'bench'],
      at: {
        agent: [36, 196],
        bench: [430, 320],
      },
      paths: ['M186 240 C280 244 300 320 424 372'],
    },
  ],
  neutral: {
    plugin: [268, 160],
    client: [556, 160],
    connectors: [912, 160],
    mcp: [268, 400],
    abilities: [556, 400],
    bench: [556, 672],
    assistant: [24, 112],
    skills: [24, 244],
    agent: [24, 376],
    provider: [1150, 330],
    task: [24, 508],
    'provider-plugin': [912, 400],
  },
  loose: {
    plugin: [-38, 26, -1.4],
    client: [20, -18, 1.1],
    connectors: [28, 34, -0.9],
    mcp: [120, -36, 1.6],
    abilities: [-26, 28, -1.2],
    bench: [32, -44, 0.9],
    assistant: [-6, -30, -1.3],
    skills: [12, 96, 1.4],
    agent: [16, 92, -1],
    provider: [-18, 90, 1.2],
    task: [6, 54, -1.1],
  },
  shelfX: [250, 436, 622, 808, 994, 1170],
  about: {
    badge: 'Transparency',
    title: 'About this exhibit',
    backLabel: 'Back to the exhibit',
    disclosures: [
      {
        term: 'AI assistance:',
        description: 'Yes',
      },
      {
        term: 'Tool:',
        description: 'OpenAI Codex',
      },
      {
        term: 'Used for:',
        description: 'implementation, tests, and deployment preparation.',
      },
    ],
    responsibility:
      'Final work was human-reviewed and tested; the human contributor remains responsible for it.',
  },
  bench: {
    titles: {
      task: 'One task, one message',
      model: 'Whatever the model wrote',
      sandbox: 'A real WordPress, thrown away after',
      checks: 'WordPress is the grader',
      evidence: 'Pass or fail. Never a percentage',
    },
    paths: [
      'M204 200 C420 132 940 128 1148 194',
      'M1240 286 C1240 348 1088 322 986 300',
      'M654 266 L626 266',
      'M330 358 C296 418 254 438 208 462',
    ],
    stages: {
      task: {
        number: '01',
        badge: 'The harness',
        label: 'The task',
        summary: 'One prompt, one set of requirements',
        kicker: 'Stage 01 · outside the site',
        title: 'One task, one message',
        body: 'A prompt and its requirements, handed to the model as a single message. Every model gets exactly the same text, so a difference in the result is a difference in the model.',
        rows: [
          ['prompt', 'Write the code that does this. One task, one message.'],
          ['requirements', 'Named functions and hooks, and the shape of what they return.'],
          ['never sent', 'No conversation, no follow-up, no hint about the assertions.'],
        ],
      },
      model: {
        number: '02',
        badge: 'Not WordPress',
        label: 'The model answers',
        summary: 'PHP, parsed out of the reply',
        kicker: 'Stage 02 · outside the site',
        title: 'Whatever the model wrote',
        body: 'The harness takes the reply and parses the PHP out of it. If the answer does not parse, that is the answer — nothing is repaired on the way in.',
        rows: [
          ['reply', 'Whatever the model wrote, in full.'],
          ['parsed out', 'The PHP the harness could find in it.'],
          ['not repaired', 'Nothing is patched and nothing is retried before it runs.'],
        ],
      },
      sandbox: {
        number: '03',
        badge: 'Inside WordPress',
        label: 'WordPress runs it',
        summary: 'A real 7.0, thrown away after',
        flow: [
          {
            label: 'setup',
          },
          {
            label: 'the model’s code',
            accent: true,
          },
          {
            label: 'assertions',
          },
          {
            label: 'teardown',
          },
        ],
        kicker: 'Stage 03 · inside WordPress',
        title: 'A real WordPress, thrown away after',
        body: 'The code runs inside a WordPress that exists only for this one test. That makes the result a fact about WordPress rather than a fact about a fixture.',
        rows: [
          ['the install', 'A real WordPress 7.0, created for this one test.'],
          ['the run', 'Setup, then the model’s code, then the assertions, then teardown.'],
          ['afterwards', 'The install is thrown away. No live site is ever involved.'],
        ],
      },
      checks: {
        number: '04',
        badge: 'Inside WordPress',
        label: 'WordPress checks it',
        summary: 'WordPress code inspects WordPress state',
        flow: [
          {
            label: 'every assertion',
            accent: true,
          },
          {
            label: 'pass',
          },
        ],
        kicker: 'Stage 04 · inside WordPress',
        title: 'WordPress is the grader',
        body: 'The assertions are WordPress code inspecting WordPress state — not a model judging another model’s answer. Passing is all or nothing.',
        note: 'Two of three assertions is a fail. A number between 0 and 1 is a bug in the harness, not partial credit.',
        rows: [
          ['3 of 3', 'Pass.'],
          ['2 of 3', 'Fail. There is no partial credit.'],
          [
            'static analysis',
            'A diagnostic only — unless the code trips a forbidden pattern, which fails the test outright.',
          ],
        ],
      },
      evidence: {
        number: '05',
        badge: 'Back to the harness',
        label: 'The verdict',
        summary: 'Pass or fail. Never a percentage',
        kicker: 'Stage 05 · back in the harness',
        title: 'Pass or fail. Never a percentage',
        body: 'Three inputs go through the same verifier, and each one proves a different thing. Run them in this order.',
        note: 'A broken grader still reports a number. If the sandbox never started, every test scores zero and the run still exits clean — which looks exactly like a model that failed everything.',
        rows: [
          [
            '--check-reference-solution',
            'Proves the grader works. The canonical solution goes in, no model is called. Run it first: if this fails, no other number means anything.',
          ],
          [
            'a normal run',
            'Proves the model works. What the model actually wrote goes in — the only number worth reporting, and only once the other two hold.',
          ],
          [
            '--check-exploits',
            'Proves the test is specified. An empty function goes in, then a bare return. Every one must fail — a test a stub can pass was checking a fixture, not WordPress.',
          ],
        ],
      },
    },
  },
  abilityTabs: [
    {
      id: 'overview',
      label: 'Overview',
    },
    {
      id: 'anatomy',
      label: 'Anatomy',
    },
    {
      id: 'permissions',
      label: 'Who is allowed',
    },
  ],
} as const satisfies MapModel;

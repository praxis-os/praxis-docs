import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/first-invocation',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core-concepts/architecture',
        'core-concepts/state-machine',
        'core-concepts/provider-abstraction',
        'core-concepts/policy-hooks',
        'core-concepts/budget',
        'core-concepts/error-taxonomy',
        'core-concepts/zero-wiring',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/overview',
        'api-reference/orchestrator',
        'api-reference/llm',
        'api-reference/tools',
        'api-reference/hooks',
        'api-reference/budget',
        'api-reference/credentials',
        'api-reference/identity',
        'api-reference/errors',
        'api-reference/state',
        'api-reference/event',
        'api-reference/telemetry',
        'api-reference/mcp',
        'api-reference/skills',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/custom-provider',
        'guides/policy-hook',
        'guides/tool-invoker',
        'guides/filter-chains',
        'guides/otel-setup',
        'guides/budget-config',
        'guides/identity-signing',
        'guides/streaming',
        'guides/mcp-integration',
        'guides/skills-authoring',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/overview',
        'examples/minimal',
        'examples/filters',
        'examples/policy',
        'examples/streaming',
        'examples/tools',
        'examples/mcp-stdio',
        'examples/mcp-http',
        'examples/skills',
      ],
    },
    {
      type: 'category',
      label: 'Design Decisions',
      items: [
        'design-decisions/overview',
        'design-decisions/positioning-and-principles',
        'design-decisions/state-machine-design',
        'design-decisions/interface-contracts',
        'design-decisions/observability-model',
        'design-decisions/security-and-trust',
        'design-decisions/release-governance',
      ],
    },
    'contributing',
  ],
};

export default sidebars;

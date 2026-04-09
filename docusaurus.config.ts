import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'praxis',
  tagline: 'Enterprise agent orchestration for Go',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://praxis-docs.vercel.app',
  baseUrl: '/',

  organizationName: 'praxis-os',
  projectName: 'praxis-docs',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/praxis-os/praxis-docs/tree/main/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/praxis-os/praxis-docs/tree/main/',
          onInlineTags: 'warn',
          onInlineAuthors: 'ignore',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'v0x_unstable',
      content:
        'These docs cover the <strong>development version</strong> (v0.x). APIs may change before v1.0. <a href="/docs/getting-started/introduction#versioning-and-stability">Learn more</a>',
      backgroundColor: '#fff3cd',
      textColor: '#856404',
      isCloseable: true,
    },
    navbar: {
      title: 'praxis',
      logo: {
        alt: 'praxis logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://pkg.go.dev/github.com/praxis-os/praxis',
          label: 'pkg.go.dev',
          position: 'right',
        },
        {
          href: 'https://github.com/praxis-os/praxis',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/introduction',
            },
            {
              label: 'Core Concepts',
              to: '/docs/core-concepts/architecture',
            },
            {
              label: 'Guides',
              to: '/docs/guides/custom-provider',
            },
          ],
        },
        {
          title: 'Reference',
          items: [
            {
              label: 'API Reference',
              to: '/docs/api-reference/overview',
            },
            {
              label: 'pkg.go.dev',
              href: 'https://pkg.go.dev/github.com/praxis-os/praxis',
            },
            {
              label: 'Design Decisions',
              to: '/docs/design-decisions/overview',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/praxis-os/praxis',
            },
            {
              label: 'Contributing',
              to: '/docs/contributing',
            },
            {
              label: 'Releases',
              href: 'https://github.com/praxis-os/praxis/releases',
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} praxis contributors. Apache 2.0 License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['go', 'bash', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

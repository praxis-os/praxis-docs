import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroDescription}>
          A production-grade Go library for orchestrating LLM agents with
          enterprise guardrails built in: multi-provider LLM support (Anthropic, OpenAI),
          typed state machine, policy hooks, budget enforcement, structured
          telemetry, and identity signing.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/introduction">
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            href="https://github.com/praxis-os/praxis"
            style={{marginLeft: '1rem', color: '#fff', borderColor: '#fff'}}>
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function QuickStartSnippet() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">Zero-wiring start</Heading>
            <p>
              Create an orchestrator with just an LLM provider. No config files,
              no dependency injection, no boilerplate. Add policy hooks, budget
              guards, and tools only when you need them.
            </p>
            <Link
              className="button button--primary button--md"
              to="/docs/getting-started/quick-start">
              Quick Start Guide
            </Link>
          </div>
          <div className="col col--6">
            <pre className={styles.codeBlock}>
              <code>{`provider := anthropic.New(os.Getenv("ANTHROPIC_API_KEY"))

orch, err := orchestrator.New(provider)

result, err := orch.Invoke(ctx, praxis.InvocationRequest{
    Model: "claude-haiku-4-20250514",
    Messages: []llm.Message{{
        Role:  llm.RoleUser,
        Parts: []llm.MessagePart{llm.TextPart("Hello!")},
    }},
})`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Enterprise Agent Orchestration for Go"
      description="praxis is a production-grade Go library for orchestrating LLM agents with typed state machines, policy hooks, budget enforcement, and structured telemetry.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <QuickStartSnippet />
      </main>
    </Layout>
  );
}

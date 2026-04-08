import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Typed State Machine',
    description: (
      <>
        Every invocation flows through an explicit finite state machine with
        allow-listed transitions and property-based tests. No procedural loops,
        no hidden state.
      </>
    ),
  },
  {
    title: 'Provider Agnostic',
    description: (
      <>
        Swap LLM providers via a single <code>llm.Provider</code> interface.
        Ships with an Anthropic adapter; OpenAI planned for v0.3.0. Your
        orchestration logic stays the same.
      </>
    ),
  },
  {
    title: 'Policy Hooks',
    description: (
      <>
        Four-phase lifecycle hooks (<code>PreInvocation</code>,{' '}
        <code>PreLLMInput</code>, <code>PostToolOutput</code>,{' '}
        <code>PostInvocation</code>) with filter chains that can Pass, Redact,
        Log, or Block.
      </>
    ),
  },
  {
    title: 'Budget Enforcement',
    description: (
      <>
        Four-dimensional cost control: wall-clock duration, LLM tokens, tool
        call count, and estimated cost in micro-dollars. Any breach transitions
        to <code>BudgetExceeded</code>.
      </>
    ),
  },
  {
    title: 'Observable by Default',
    description: (
      <>
        Mandatory OpenTelemetry spans at every state transition, 10 bounded
        Prometheus metrics, and a neutral lifecycle event stream. Silent
        paths are a bug.
      </>
    ),
  },
  {
    title: 'Zero-Wiring Start',
    description: (
      <>
        Constructible with just an <code>llm.Provider</code>. Every optional
        component ships with a null default. Wire in policy, budget, tools,
        and identity only when your workload requires them.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className="col col--4">
      <div className={`${styles.featureCard} feature-card`}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

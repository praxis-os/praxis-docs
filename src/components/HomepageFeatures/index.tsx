import type {ReactNode} from 'react';
import styles from './styles.module.css';

type FeatureItem = {
  num: string;
  pkg: string;
  title: string;
  description: ReactNode;
  code: string;
};

const FeatureList: FeatureItem[] = [
  {
    num: '01',
    pkg: 'fsm',
    title: 'Typed state machine',
    description: (
      <>
        13 invocation states, allow-listed transitions, property-based tests.
        Every transition emits a span. Silent paths are a bug.
      </>
    ),
    code: 'praxis/fsm',
  },
  {
    num: '02',
    pkg: 'hooks',
    title: 'Filter chains',
    description: (
      <>
        Four phases: <code>PreInvocation</code>, <code>PreLLMInput</code>,{' '}
        <code>PostToolOutput</code>, <code>PostInvocation</code>. Filters
        return Pass · Redact · Log · Block.
      </>
    ),
    code: 'praxis/hooks',
  },
  {
    num: '03',
    pkg: 'budget',
    title: 'Four-dimensional guard',
    description: (
      <>
        Wall-clock · tokens · tool calls · cost in micro-dollars. Any breach
        transitions the invocation to <code>BudgetExceeded</code>.
      </>
    ),
    code: 'praxis/budget',
  },
  {
    num: '04',
    pkg: 'llm',
    title: 'Provider agnostic',
    description: (
      <>
        One <code>llm.Provider</code> interface. Anthropic and OpenAI adapters
        ship. Your orchestration logic stays the same across providers.
      </>
    ),
    code: 'praxis/llm',
  },
  {
    num: '05',
    pkg: 'otel',
    title: 'Observable by default',
    description: (
      <>
        Mandatory OpenTelemetry spans at every transition. 10 bounded Prometheus
        metrics. Neutral lifecycle event stream. Nothing silent.
      </>
    ),
    code: 'praxis/otel',
  },
  {
    num: '06',
    pkg: 'mcp',
    title: 'Signed MCP tools',
    description: (
      <>
        Ed25519-signed tool invocations with a trust-boundary classifier.
        Untrusted output routes through PostTool filters automatically.
      </>
    ),
    code: 'praxis/mcp',
  },
];

function Feature({num, pkg, title, description, code}: FeatureItem) {
  return (
    <div className={styles.feat}>
      <div className={styles.featNum}>{num} · {pkg}</div>
      <h3 className={styles.featTitle}>{title}</h3>
      <p className={styles.featDesc}>{description}</p>
      <code className={styles.featCode}>{code}</code>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <div className={styles.grid}>
      {FeatureList.map((props, idx) => (
        <Feature key={idx} {...props} />
      ))}
    </div>
  );
}

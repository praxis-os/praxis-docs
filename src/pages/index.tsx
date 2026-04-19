import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        {/* Left column */}
        <div className={styles.heroLeft}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Production-grade · Go
          </div>
          <h1 className={styles.display}>
            ship agents<br />you can oper<span className={styles.accentX}>a</span>te.
          </h1>
          <p className={styles.heroSub}>
            Praxis OS is the runtime, orchestrator, and governance plane for
            agentic systems — built in Go, with typed state machines, filter
            chains, four-dimensional budgets, and OpenTelemetry baked in.
          </p>
          <div className={styles.heroCta}>
            <Link
              className={styles.btnPrimary}
              to="/docs/getting-started/introduction">
              Read the kernel docs →
            </Link>
            <Link
              className={styles.btn}
              href="https://github.com/praxis-os/praxis">
              go get praxis-os/praxis
            </Link>
          </div>
          <div className={styles.heroMeta}>
            <span><b>praxis</b> v0.9.0</span>
            <span><b>praxis-forge</b> v0.7.0</span>
            <span><b>Apache-2.0</b></span>
            <span><b>Go 1.22+</b></span>
          </div>
        </div>

        {/* Right column — terminal panel */}
        <div className={styles.term}>
          <div className={styles.termBar}>
            <span className={styles.termDot} />
            <span className={styles.termDot} />
            <span className={styles.termDot} />
            <span className={styles.termFn}>main.go</span>
          </div>
          <pre className={styles.termPre}>
            <code dangerouslySetInnerHTML={{__html: `<span class="c-kw">package</span> main

<span class="c-kw">import</span> (
    <span class="c-str">"context"</span>
    <span class="c-str">"github.com/praxis-os/praxis/llm/anthropic"</span>
    <span class="c-str">"github.com/praxis-os/praxis/orchestrator"</span>
)

<span class="c-kw">func</span> <span class="c-fn">main</span>() {
    <span class="c-id">provider</span> := <span class="c-pk">anthropic</span>.<span class="c-fn">New</span>(<span class="c-pk">os</span>.<span class="c-fn">Getenv</span>(<span class="c-str">"ANTHROPIC_API_KEY"</span>))

    <span class="c-id">orch</span>, _ := <span class="c-pk">orchestrator</span>.<span class="c-fn">New</span>(<span class="c-id">provider</span>)

    <span class="c-id">result</span>, _ := <span class="c-id">orch</span>.<span class="c-fn">Invoke</span>(<span class="c-pk">ctx</span>, <span class="c-tp">praxis</span>.<span class="c-tp">InvocationRequest</span>{
        <span class="c-id">Model</span>:   <span class="c-str">"claude-sonnet-4-6"</span>,
        <span class="c-id">Budget</span>:  <span class="c-tp">budget</span>.<span class="c-fn">FourD</span>(<span class="c-num">10</span>*<span class="c-pk">time</span>.<span class="c-id">Second</span>, <span class="c-num">8000</span>, <span class="c-num">5</span>, <span class="c-num">10_000</span>),
        <span class="c-id">Hooks</span>:   <span class="c-tp">hooks</span>.<span class="c-fn">Chain</span>(<span class="c-id">pii</span>, <span class="c-id">denyWrites</span>),
    })
    <span class="c-cm">// result.TerminalState == Completed</span>
}`}} />
          </pre>
        </div>
      </div>
    </section>
  );
}

function PrimitivesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          Primitives
        </div>
        <h2 className={styles.anchor}>what the kernel gives you</h2>
        <p className={styles.lede}>
          Every invocation flows through an explicit state machine. No
          procedural loops. No hidden state. Silent paths are a bug.
        </p>
        <HomepageFeatures />
      </div>
    </section>
  );
}

function MetricsSection() {
  const metrics = [
    {label: 'p99 transition', value: '1.8', unit: 'ms', sub: 'kernel overhead per state change'},
    {label: 'FSM states', value: '13', unit: '', sub: 'allow-listed · property-tested'},
    {label: 'filter phases', value: '4', unit: '', sub: 'pre · pre-llm · post-tool · post'},
    {label: 'budget axes', value: '4D', unit: '', sub: 'time · tokens · tools · cost'},
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          Operate
        </div>
        <h2 className={styles.anchor}>the numbers you can prove</h2>
        <p className={styles.lede}>
          Every invocation surfaces 10 bounded Prometheus metrics. No cardinality
          bombs. Nothing silent.
        </p>
        <div className={styles.metricsRow}>
          {metrics.map((m) => (
            <div key={m.label} className={styles.metric}>
              <div className={styles.metricLabel}>{m.label}</div>
              <div className={styles.metricValue}>
                {m.value}
                {m.unit && <span className={styles.metricUnit}>{m.unit}</span>}
              </div>
              <div className={styles.metricSub}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          Quick start
        </div>
        <h2 className={styles.anchor}>zero-wiring start</h2>
        <p className={styles.lede}>
          Constructible with just an <code>llm.Provider</code>. Every optional
          component ships with a null default. Wire in policy, budget, tools,
          and identity only when your workload requires them.
        </p>
        <div className={styles.quickGrid}>
          <div>
            <p className={styles.quickBody}>
              Create an orchestrator with just an LLM provider. No config files,
              no dependency injection, no boilerplate. Add policy hooks, budget
              guards, and tools only when you need them.
            </p>
            <Link
              className={styles.btnPrimary}
              to="/docs/getting-started/quick-start">
              Quick start guide →
            </Link>
          </div>
          <div className={styles.term}>
            <div className={styles.termBar}>
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termFn}>main.go</span>
            </div>
            <pre className={styles.termPre}>
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

function CtaSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.ctaBlock}>
          <div>
            <h2 className={styles.ctaTitle}>
              your runtime. your policies.<br />your audit trail.
            </h2>
            <p className={styles.ctaBody}>
              Praxis OS is Apache-2.0, written in Go, and designed to be hosted
              inside your VPC. Nothing phones home. Every tool call is signed;
              every state transition is logged.
            </p>
            <div className={styles.heroCta}>
              <Link
                className={styles.btnPrimary}
                to="/docs/getting-started/introduction">
                Start with the kernel →
              </Link>
              <Link
                className={styles.btn}
                href="https://github.com/praxis-os/praxis">
                GitHub ↗
              </Link>
            </div>
          </div>
          <div className={styles.term}>
            <div className={styles.termBar}>
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termFn}>install.sh</span>
            </div>
            <pre className={styles.termPre}>
              <code dangerouslySetInnerHTML={{__html: `<span class="c-cm"># kernel</span>
$ go get github.com/praxis-os/praxis

<span class="c-cm"># forge (tools + signing)</span>
$ go get github.com/praxis-os/praxis-forge

<span class="c-cm"># verify</span>
$ praxis doctor
<span class="c-str">✓</span> go 1.22.4
<span class="c-str">✓</span> otel collector reachable
<span class="c-str">✓</span> provider anthropic`}} />
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
      <Hero />
      <main>
        <PrimitivesSection />
        <MetricsSection />
        <QuickStartSection />
        <CtaSection />
      </main>
    </Layout>
  );
}

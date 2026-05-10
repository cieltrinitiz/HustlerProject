import Link from "next/link";

const features = [
  ["Create lessons", "Draft clean module content and quiz items before anything touches the blockchain."],
  ["Verify humans", "GoodDollar Identity keeps rewards focused on real learners instead of duplicate accounts."],
  ["Commit answers", "Answer commitments stay private until the reveal window, so quizzes remain fair."],
  ["Earn G$", "Learners claim rewards per correct answer from a transparent reward pool."],
];

const stats = [
  ["30s", "default timer"],
  ["G$", "reward token"],
  ["Celo", "network ready"],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero hero-split">
        <div className="hero-copy">
          <span className="eyebrow">GoodDollar Learn & Earn</span>
          <h1>Turn lessons into reward quests.</h1>
          <p>
            GoodLearn Quest gives creators a polished flow for publishing modules, running timed quizzes, and rewarding verified learners with G$.
          </p>
          <div className="actions">
            <Link className="button" href="/create">Create exam draft</Link>
            <a className="button secondary" href="/docs/architecture.md">Read architecture</a>
          </div>
        </div>

        <div className="hero-panel" aria-label="Product highlights">
          <div className="quest-card">
            <span className="badge">Live flow</span>
            <h2>Publish in three steps</h2>
            <ol className="step-list">
              <li>Build module and quiz</li>
              <li>Connect wallet on Celo</li>
              <li>Fund and publish rewards</li>
            </ol>
          </div>
          <div className="stat-row">
            {stats.map(([value, label]) => (
              <div className="stat" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid feature-grid">
        {features.map(([title, body]) => (
          <article className="card feature-card" key={title}>
            <span className="badge">Flow</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

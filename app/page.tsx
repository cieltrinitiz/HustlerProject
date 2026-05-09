import Link from "next/link";

const features = [
  ["Module-first", "Creators publish learning content off-chain before opening a reward quiz."],
  ["Timed questions", "Each quiz question uses a default 30-second timer and supports dynamic question counts."],
  ["Commit/reveal", "Answer commitments are published first; correction is only revealed after the configured delay."],
  ["G$ rewards", "Learners claim rewards based on correct answers, not a pass/fail threshold."],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <span className="eyebrow">GoodDollar Learn & Earn</span>
        <h1>GoodLearn Quest</h1>
        <p>
          GoodDollar Learn & Earn flow with Supabase module content, timed quizzes, on-chain answer commitments, delayed correction, and G$ reward pools.
        </p>
        <div className="actions">
          <Link className="button" href="/create">Create exam draft</Link>
          <a className="button secondary" href="/docs/architecture.md">Read architecture</a>
        </div>
      </section>

      <section className="grid">
        {features.map(([title, body]) => (
          <article className="card" key={title}>
            <span className="badge">Flow</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

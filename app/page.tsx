import { CreateExamAction } from "@/components/CreateExamAction";

const rewardSteps = [
  ["Learn the module", "Read the short lesson and understand the goal before opening the quiz."],
  ["Answer the quiz", "Submit answers during the timer so the system can score your attempt fairly."],
  ["Verify one human", "GoodDollar Identity helps keep rewards for real learners, not duplicate accounts."],
  ["Claim G$ rewards", "Connected learners can claim GoodDollar rewards for correct answers when the pool is funded."],
];

const creatorSteps = [
  ["Draft off-chain", "Creators prepare lessons and questions first without sending every edit to the blockchain."],
  ["Connect wallet", "The creator form appears after a wallet is connected, keeping first visit focused on instructions."],
  ["Publish rewards", "When the quiz is ready, publish the final question hash and reward settings on Celo."],
];

const stats = [
  ["1", "wallet per learner"],
  ["G$", "reward token"],
  ["Celo", "network ready"],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero hero-split">
        <div className="hero-copy">
          <span className="eyebrow">GoodDollar Learn & Earn</span>
          <h1>Learn lessons. Pass quizzes. Earn rewards.</h1>
          <p>
            GoodLearn Quest is a Learn & Earn flow where verified learners study short modules, answer timed quizzes, and claim G$ rewards for correct answers.
          </p>
          <div className="actions">
            <CreateExamAction />
            <a className="button secondary" href="/docs/architecture.md">Read architecture</a>
          </div>
        </div>

        <div className="hero-panel" aria-label="Product highlights">
          <div className="quest-card">
            <span className="badge">How it works</span>
            <h2>Rewards in four steps</h2>
            <ol className="step-list">
              <li>Open a lesson</li>
              <li>Complete the quiz</li>
              <li>Verify with GoodDollar</li>
              <li>Claim earned G$</li>
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

      <section className="info-section">
        <span className="eyebrow">Learner guide</span>
        <h2>What is Learn & Earn?</h2>
        <p>
          Learn & Earn rewards people for completing educational activities. In this app, a creator publishes a lesson and quiz, then verified learners can earn from the funded reward pool when they answer correctly.
        </p>
      </section>

      <section className="grid feature-grid">
        {rewardSteps.map(([title, body]) => (
          <article className="card feature-card" key={title}>
            <span className="badge">Reward guide</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="grid feature-grid">
        {creatorSteps.map(([title, body]) => (
          <article className="card feature-card" key={title}>
            <span className="badge">Creator guide</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

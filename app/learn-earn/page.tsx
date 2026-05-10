import { CreateAccessGate } from "@/components/CreateAccessGate";
import { QuestionBuilder } from "@/components/QuestionBuilder";

const contractCards = [
  ["GoodLearnExam", "Publishes the question-set hash, timer, and passing rules for every reward lesson."],
  ["Reward Pool", "Tracks funded G$ rewards so learners can claim after a valid quiz result."],
  ["Creator Proof", "Keep lesson drafts off-chain first, then submit only the final hash on Celo."],
];

export default function LearnEarnPage() {
  return (
    <CreateAccessGate>
      <main className="learn-earn-page">
        <section className="hero learn-earn-hero">
          <span className="eyebrow">Learn & Earn Studio</span>
          <h1>Create reward lessons powered by contracts.</h1>
          <p>
            Build a module, add quiz questions, preview the exact question-set hash, and publish when your GoodLearn contracts and reward pool are ready.
          </p>
          <div className="contract-card-row">
            {contractCards.map(([title, body]) => (
              <article className="contract-card" key={title}>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="studio-section">
          <div className="section-heading compact">
            <span className="eyebrow">Creator tools</span>
            <h2>Exam builder</h2>
            <p>
              This is the working Learn & Earn area. Other GoodMarket actions are marked Coming Soon until their flows are connected.
            </p>
          </div>
          <QuestionBuilder />
        </section>
      </main>
    </CreateAccessGate>
  );
}

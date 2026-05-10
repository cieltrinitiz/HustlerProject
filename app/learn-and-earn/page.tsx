import { CreateAccessGate } from "@/components/CreateAccessGate";
import { QuestionBuilder } from "@/components/QuestionBuilder";

export default function LearnAndEarnPage() {
  return (
    <CreateAccessGate>
      <main className="learn-earn-main">
        <section className="hero learn-earn-hero">
          <div className="learn-earn-hero-copy">
            <span className="eyebrow pill-eyebrow">Learn & Earn</span>
            <h1>Create reward-ready exams without guessing contract fields.</h1>
            <p>
              Configure rewards, participant limits, learner timing, and answer commitments in a cleaner creator flow. The app keeps friendly inputs visible while preparing contract-ready values for GoodLearnExam and GoodLearnRewardPool.
            </p>
            <div className="learn-earn-hero-actions" aria-label="Creator setup highlights">
              <span>Editable before funding</span>
              <span>Minutes, hours, days</span>
              <span>G$ pool preview</span>
            </div>
          </div>
          <div className="learn-earn-hero-panel" aria-hidden="true">
            <div>
              <span>Max participants</span>
              <strong>100</strong>
            </div>
            <div>
              <span>Timer</span>
              <strong>1 min</strong>
            </div>
            <div>
              <span>Funding lock</span>
              <strong>On-chain</strong>
            </div>
          </div>
        </section>
        <QuestionBuilder />
      </main>
    </CreateAccessGate>
  );
}

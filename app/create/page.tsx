import { CreateAccessGate } from "@/components/CreateAccessGate";
import { QuestionBuilder } from "@/components/QuestionBuilder";

export default function CreatePage() {
  return (
    <CreateAccessGate>
      <main className="create-main">
        <section className="hero create-hero">
          <div className="create-hero-copy">
            <span className="eyebrow pill-eyebrow">Creator studio</span>
            <h1>Create a polished Learn & Earn exam.</h1>
            <p>
              Set rewards, add questions, and preview the contract-ready values in one focused workspace before publishing on-chain.
            </p>
            <div className="create-hero-metrics" aria-label="Creator workflow highlights">
              <span><strong>01</strong> Draft</span>
              <span><strong>02</strong> Hash</span>
              <span><strong>03</strong> Publish</span>
            </div>
          </div>
          <div className="create-hero-card" aria-hidden="true">
            <span>Reward pool</span>
            <strong>G$ ready</strong>
            <small>Questions, timing, and commitments stay synced.</small>
          </div>
        </section>
        <QuestionBuilder />
      </main>
    </CreateAccessGate>
  );
}

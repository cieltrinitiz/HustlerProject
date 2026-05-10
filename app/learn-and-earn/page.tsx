import { CreateAccessGate } from "@/components/CreateAccessGate";
import { QuestionBuilder } from "@/components/QuestionBuilder";

export default function LearnAndEarnPage() {
  return (
    <CreateAccessGate>
      <main>
        <section className="hero learn-earn-hero">
          <span className="eyebrow">Learn & Earn</span>
          <h1>Create an exam for GoodDollar rewards.</h1>
          <p>
            Build an exam using the same fields required by the GoodLearnExam and GoodLearnRewardPool contracts: module ID, question hash, answer commitment, timing, rewards, and participant cap.
          </p>
        </section>
        <QuestionBuilder />
      </main>
    </CreateAccessGate>
  );
}

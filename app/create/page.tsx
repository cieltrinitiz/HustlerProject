import { QuestionBuilder } from "@/components/QuestionBuilder";

export default function CreatePage() {
  return (
    <main>
      <section className="hero">
        <span className="eyebrow">Creator flow</span>
        <h1>Create a Learn & Earn exam</h1>
        <p>
          Draft module content and questions off-chain first. Publish to the contract only after Submit/Publish and wallet confirmation.
        </p>
      </section>
      <QuestionBuilder />
    </main>
  );
}

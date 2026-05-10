import Link from "next/link";
import { getOnChainExamListings, type OnChainExamListing } from "@/lib/goodlearnExam";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  let exams: OnChainExamListing[] = [];
  let errorMessage = "";

  try {
    const onChainExams = await getOnChainExamListings();
    exams = onChainExams.filter(exam => exam.status === "active" || exam.status === "upcoming");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load on-chain exams.";
  }

  return (
    <main className="exams-main">
      <section className="hero exams-hero">
        <div>
          <span className="eyebrow pill-eyebrow">On-chain exam list</span>
          <h1>Find active Learn & Earn exams.</h1>
          <p>
            GoodLearnExam is the source of truth for active exams. This page reads the on-chain ExamCreated events and current contract settings from Celo; Supabase is not used for exam creation or exam listing transactions.
          </p>
          <div className="actions">
            <Link className="button" href="/learn-and-earn">Create another exam</Link>
            <Link className="button secondary" href="/">Back home</Link>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="card exams-empty-state" role="status">
          <span className="badge">On-chain setup needed</span>
          <h2>Exam list is not connected to Celo yet</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage && exams.length === 0 ? (
        <section className="card exams-empty-state" role="status">
          <span className="badge">No active exams</span>
          <h2>No active or upcoming on-chain exams found</h2>
          <p>Publish a creator exam successfully through the GoodLearnExam contract and it will appear here while it is upcoming or active.</p>
          <Link className="button" href="/learn-and-earn">Open creator studio</Link>
        </section>
      ) : null}

      {exams.length > 0 ? (
        <section className="exam-list" aria-label="Active on-chain exams">
          {exams.map(exam => (
            <article className="card exam-list-card" key={exam.examId.toString()}>
              <div className="exam-list-card-heading">
                <div>
                  <span className="badge">{exam.status}</span>
                  <h2>Exam #{exam.examId.toString()}</h2>
                </div>
                <time dateTime={new Date(Number(exam.startTime) * 1000).toISOString()}>{formatWindow(exam.startTime, exam.endTime)}</time>
              </div>
              <div className="exam-list-stats">
                <p><strong>{exam.questionCount.toString()}</strong><span>questions</span></p>
                <p><strong>{exam.rewardPerCorrect.toString()} G$</strong><span>per correct</span></p>
                <p><strong>{exam.maxParticipants.toString()}</strong><span>max learners</span></p>
                <p><strong>{exam.timerSeconds.toString()} sec</strong><span>timer</span></p>
              </div>
              <div className="exam-list-hashes">
                <p><span>Creator</span><code>{shortHash(exam.creator)}</code></p>
                <p><span>On-chain moduleId</span><code>{exam.moduleId}</code></p>
                <p><span>On-chain question hash</span><code>{exam.questionSetHash}</code></p>
                <p><span>On-chain exam ID</span><code>{exam.examId.toString()}</code></p>
                <p><span>Contract tx</span><code>{formatTransactionHash(exam.transactionHash)}</code></p>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function shortHash(value: string) {
  return value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function formatTransactionHash(value?: string | null) {
  if (!value) {
    return "Unavailable from RPC event lookup";
  }

  return shortHash(value);
}

function formatWindow(startTime: bigint, endTime: bigint) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(new Date(Number(startTime) * 1000))} - ${formatter.format(new Date(Number(endTime) * 1000))}`;
}

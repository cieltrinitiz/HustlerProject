import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublishedExam = {
  id: string;
  module_id: string | null;
  creator_wallet: string | null;
  contract_exam_id: string | null;
  question_set_hash: string | null;
  question_count: number | null;
  reward_per_correct: string | number | null;
  max_participants: number | null;
  timer_seconds: number | null;
  status: string | null;
  created_at: string | null;
};

async function getPublishedExams() {
  const supabase = createSupabaseAdmin();
  return supabase
    .from("exams")
    .select("id,module_id,creator_wallet,contract_exam_id,question_set_hash,question_count,reward_per_correct,max_participants,timer_seconds,status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
}

export default async function ExamsPage() {
  let exams: PublishedExam[] = [];
  let errorMessage = "";

  try {
    const { data, error } = await getPublishedExams();
    if (error) {
      errorMessage = error.message;
    } else {
      exams = (data ?? []) as PublishedExam[];
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load published exams.";
  }

  return (
    <main className="exams-main">
      <section className="hero exams-hero">
        <div>
          <span className="eyebrow pill-eyebrow">Exam list</span>
          <h1>Find published Learn & Earn exams.</h1>
          <p>
            The contract is the source of truth for the exam ID, settings, and question hash. Supabase is only the off-chain content index for readable question text and discovery.
          </p>
          <div className="actions">
            <Link className="button" href="/learn-and-earn">Create another exam</Link>
            <Link className="button secondary" href="/">Back home</Link>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="card exams-empty-state" role="status">
          <span className="badge">Setup needed</span>
          <h2>Exam list is not connected yet</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage && exams.length === 0 ? (
        <section className="card exams-empty-state" role="status">
          <span className="badge">No exams yet</span>
          <h2>No published exams found</h2>
          <p>Publish a creator exam successfully and it will appear in this list.</p>
          <Link className="button" href="/learn-and-earn">Open creator studio</Link>
        </section>
      ) : null}

      {exams.length > 0 ? (
        <section className="exam-list" aria-label="Published exams">
          {exams.map(exam => (
            <article className="card exam-list-card" key={exam.id}>
              <div className="exam-list-card-heading">
                <div>
                  <span className="badge">{exam.status ?? "published"}</span>
                  <h2>Exam {exam.contract_exam_id ? `#${exam.contract_exam_id}` : shortHash(exam.id)}</h2>
                </div>
                <time dateTime={exam.created_at ?? undefined}>{formatDate(exam.created_at)}</time>
              </div>
              <div className="exam-list-stats">
                <p><strong>{exam.question_count ?? "—"}</strong><span>questions</span></p>
                <p><strong>{exam.reward_per_correct ?? "—"} G$</strong><span>per correct</span></p>
                <p><strong>{exam.max_participants ?? "—"}</strong><span>max learners</span></p>
                <p><strong>{exam.timer_seconds ?? "—"} sec</strong><span>timer</span></p>
              </div>
              <div className="exam-list-hashes">
                <p><span>Creator</span><code>{shortHash(exam.creator_wallet)}</code></p>
                <p><span>Supabase record</span><code>{exam.id}</code></p>
                <p><span>Linked module record</span><code>{exam.module_id ?? "Off-chain module not linked"}</code></p>
                <p><span>On-chain question hash</span><code>{exam.question_set_hash}</code></p>
                <p><span>On-chain exam ID</span><code>{exam.contract_exam_id ?? "Waiting for ExamCreated event"}</code></p>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function shortHash(value?: string | null) {
  if (!value) {
    return "pending";
  }

  return value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

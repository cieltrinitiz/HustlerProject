import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getOnChainExamListings, type OnChainExamListing } from "@/lib/goodlearnExam";

export const dynamic = "force-dynamic";

type SupabaseExamMirror = {
  id: string;
  module_id: string | null;
  question_set_hash: string | null;
};

type ExamListItem = OnChainExamListing & {
  supabaseRecordId?: string;
  supabaseModuleId?: string | null;
};

async function getSupabaseMirrors(questionSetHashes: string[]) {
  if (questionSetHashes.length === 0) {
    return new Map<string, SupabaseExamMirror>();
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("exams")
      .select("id,module_id,question_set_hash")
      .in("question_set_hash", questionSetHashes);

    return new Map((data ?? []).map(row => [row.question_set_hash, row as SupabaseExamMirror]));
  } catch {
    return new Map<string, SupabaseExamMirror>();
  }
}

export default async function ExamsPage() {
  let exams: ExamListItem[] = [];
  let errorMessage = "";

  try {
    const onChainExams = await getOnChainExamListings();
    const activeOnChainExams = onChainExams.filter(exam => exam.status === "active" || exam.status === "upcoming");
    const supabaseMirrors = await getSupabaseMirrors(activeOnChainExams.map(exam => exam.questionSetHash));
    exams = activeOnChainExams.map(exam => {
      const mirror = supabaseMirrors.get(exam.questionSetHash);
      return {
        ...exam,
        supabaseRecordId: mirror?.id,
        supabaseModuleId: mirror?.module_id,
      };
    });
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
            GoodLearnExam is the source of truth for active exams: the page reads ExamCreated events and current contract settings from Celo. Supabase is only used as an optional mirror for readable question content and discovery metadata.
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
                <p><span>Contract tx</span><code>{shortHash(exam.transactionHash)}</code></p>
                <p><span>Supabase content mirror</span><code>{exam.supabaseRecordId ?? "Not mirrored yet"}</code></p>
                <p><span>Supabase module mirror</span><code>{exam.supabaseModuleId ?? "Not mirrored / not required"}</code></p>
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

function formatWindow(startTime: bigint, endTime: bigint) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(new Date(Number(startTime) * 1000))} - ${formatter.format(new Date(Number(endTime) * 1000))}`;
}

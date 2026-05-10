import Link from "next/link";
import { ExamTakeAction, type LearnerQuestion } from "@/components/ExamTakeAction";
import { getOnChainExamListings, type OnChainExamListing } from "@/lib/goodlearnExam";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type StoredExamContent = {
  contract_exam_id: string | null;
  question_set_hash: string;
  questions: Array<{
    question_index: number;
    prompt: string;
    choice_a: string;
    choice_b: string;
    choice_c: string;
    choice_d: string;
  }> | null;
};

export default async function ExamsPage() {
  let exams: OnChainExamListing[] = [];
  let errorMessage = "";
  const contentByExamId = await getStoredExamContent();

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
            GoodLearnExam is the source of truth for exam timing, rewards, hashes, and submissions. The list now loads directly by on-chain exam ID first, so learners do not wait for a slow full RPC event scan before seeing exams.
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
          {exams.map(exam => {
            const questions = contentByExamId.get(exam.examId.toString()) ?? contentByExamId.get(exam.questionSetHash.toLowerCase()) ?? [];

            return (
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
                <ExamTakeAction
                  examId={exam.examId.toString()}
                  initialQuestions={questions}
                  questionSetHash={exam.questionSetHash}
                  status={exam.status}
                  timerSeconds={Number(exam.timerSeconds)}
                />
                <div className="exam-list-hashes">
                  <p><span>Creator</span><code>{shortHash(exam.creator)}</code></p>
                  <p><span>On-chain moduleId</span><code>{exam.moduleId}</code></p>
                  <p><span>On-chain question hash</span><code>{exam.questionSetHash}</code></p>
                  <p><span>On-chain exam ID</span><code>{exam.examId.toString()}</code></p>
                  <p><span>Contract tx</span><code>{formatTransactionHash(exam.transactionHash)}</code></p>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

async function getStoredExamContent() {
  const contentByKey = new Map<string, LearnerQuestion[]>();

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("exams")
      .select("contract_exam_id,question_set_hash,questions(question_index,prompt,choice_a,choice_b,choice_c,choice_d)")
      .in("status", ["published", "active", "corrected"]);

    if (error) {
      return contentByKey;
    }

    for (const exam of (data ?? []) as StoredExamContent[]) {
      const questions = (exam.questions ?? [])
        .sort((left, right) => left.question_index - right.question_index)
        .map(question => ({
          questionIndex: question.question_index,
          prompt: question.prompt,
          choiceA: question.choice_a,
          choiceB: question.choice_b,
          choiceC: question.choice_c,
          choiceD: question.choice_d,
        }));

      if (exam.contract_exam_id) {
        contentByKey.set(exam.contract_exam_id, questions);
      }

      contentByKey.set(exam.question_set_hash.toLowerCase(), questions);
    }
  } catch {
    return contentByKey;
  }

  return contentByKey;
}

function shortHash(value: string) {
  return value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function formatTransactionHash(value?: string | null) {
  if (!value) {
    return "Exam data loaded on-chain; tx hash not indexed by this RPC";
  }

  return shortHash(value);
}

function formatWindow(startTime: bigint, endTime: bigint) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(new Date(Number(startTime) * 1000))} - ${formatter.format(new Date(Number(endTime) * 1000))}`;
}

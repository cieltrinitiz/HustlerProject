import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { DraftQuestion } from "@/lib/questions";

type PublishExamPayload = {
  creatorWallet?: string;
  contractExamId?: string;
  questionSetHash?: string;
  questionCount?: number;
  rewardPerCorrect?: number;
  maxParticipants?: number;
  timerSeconds?: number;
  correctionDelaySeconds?: number;
  questions?: DraftQuestion[];
};

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("exams")
      .select("id,contract_exam_id,question_set_hash,timer_seconds,questions(question_index,prompt,choice_a,choice_b,choice_c,choice_d)")
      .in("status", ["published", "active", "corrected"])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exams: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load exam content.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PublishExamPayload;
    const questions = body.questions?.filter(isCompleteQuestion) ?? [];

    if (!body.creatorWallet || !body.questionSetHash || !body.questionCount || questions.length !== body.questionCount) {
      return NextResponse.json({ error: "creatorWallet, questionSetHash, questionCount, and matching questions are required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: existingExam } = await supabase
      .from("exams")
      .select("id")
      .eq("question_set_hash", body.questionSetHash)
      .maybeSingle();

    let examId = existingExam?.id as string | undefined;

    if (!examId) {
      const { data: insertedExam, error: examError } = await supabase
        .from("exams")
        .insert({
          creator_wallet: body.creatorWallet.toLowerCase(),
          contract_exam_id: body.contractExamId,
          question_set_hash: body.questionSetHash,
          question_count: body.questionCount,
          reward_per_correct: body.rewardPerCorrect ?? 0,
          max_participants: body.maxParticipants ?? 1,
          timer_seconds: body.timerSeconds ?? 5,
          correction_delay_seconds: body.correctionDelaySeconds ?? 86400,
          status: "published",
        })
        .select("id")
        .single();

      if (examError) {
        return NextResponse.json({ error: examError.message }, { status: 500 });
      }

      examId = insertedExam.id as string;
    } else {
      const { error: updateError } = await supabase
        .from("exams")
        .update({ contract_exam_id: body.contractExamId, status: "published" })
        .eq("id", examId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const { error: questionError } = await supabase
      .from("questions")
      .upsert(questions.map((question, index) => ({
        exam_id: examId,
        question_index: index + 1,
        prompt: question.prompt,
        choice_a: question.choiceA,
        choice_b: question.choiceB,
        choice_c: question.choiceC,
        choice_d: question.choiceD,
        correct_answer: question.correctAnswer,
      })), { onConflict: "exam_id,question_index" });

    if (questionError) {
      return NextResponse.json({ error: questionError.message }, { status: 500 });
    }

    return NextResponse.json({ exam: { id: examId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save exam content.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isCompleteQuestion(question: DraftQuestion) {
  return Boolean(question.prompt && question.choiceA && question.choiceB && question.choiceC && question.choiceD && question.correctAnswer);
}

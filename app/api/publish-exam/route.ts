import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_MAX_REWARD_PER_LEARNER = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublishedQuestion = {
  id?: number;
  prompt?: string;
  choiceA?: string;
  choiceB?: string;
  choiceC?: string;
  choiceD?: string;
  correctAnswer?: "A" | "B" | "C" | "D";
};

export async function POST(request: Request) {
  const body = await request.json() as {
    moduleId?: string;
    creatorWallet?: string;
    contractExamId?: string;
    questionSetHash?: string;
    questionCount?: number;
    rewardPerCorrect?: string;
    maxParticipants?: number;
    timerSeconds?: number;
    questions?: PublishedQuestion[];
  };

  if (!body.moduleId || !body.creatorWallet || !body.questionSetHash || !body.questionCount) {
    return NextResponse.json({ error: "moduleId, creatorWallet, questionSetHash, and questionCount are required" }, { status: 400 });
  }

  if (body.questions && body.questions.length !== body.questionCount) {
    return NextResponse.json({ error: "questions length must match questionCount" }, { status: 400 });
  }

  const invalidQuestion = body.questions?.find(question =>
    !question.prompt ||
    !question.choiceA ||
    !question.choiceB ||
    !question.choiceC ||
    !question.choiceD ||
    !question.correctAnswer,
  );

  if (invalidQuestion) {
    return NextResponse.json({ error: "Each question must include prompt, four choices, and a correct answer" }, { status: 400 });
  }

  const rewardPerCorrect = body.rewardPerCorrect ?? String(Math.floor(DEFAULT_MAX_REWARD_PER_LEARNER / body.questionCount));
  const examInsert = {
    creator_wallet: body.creatorWallet.toLowerCase(),
    contract_exam_id: body.contractExamId,
    question_set_hash: body.questionSetHash,
    question_count: body.questionCount,
    reward_per_correct: rewardPerCorrect,
    max_participants: body.maxParticipants ?? 100,
    timer_seconds: body.timerSeconds ?? 30,
    status: "published",
    ...(UUID_PATTERN.test(body.moduleId) ? { module_id: body.moduleId } : {}),
  };

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("exams")
    .insert(examInsert)
    .select("id,contract_exam_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.questions?.length) {
    const { error: questionError } = await supabase
      .from("questions")
      .insert(body.questions.map((question, index) => ({
        exam_id: data.id,
        question_index: question.id ?? index + 1,
        prompt: question.prompt,
        choice_a: question.choiceA,
        choice_b: question.choiceB,
        choice_c: question.choiceC,
        choice_d: question.choiceD,
        correct_answer: question.correctAnswer,
      })));

    if (questionError) {
      return NextResponse.json({ error: questionError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ exam: data });
}

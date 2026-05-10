import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_MAX_REWARD_PER_LEARNER = 1000;

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
  };

  if (!body.moduleId || !body.creatorWallet || !body.questionSetHash || !body.questionCount) {
    return NextResponse.json({ error: "moduleId, creatorWallet, questionSetHash, and questionCount are required" }, { status: 400 });
  }

  const rewardPerCorrect = body.rewardPerCorrect ?? String(Math.floor(DEFAULT_MAX_REWARD_PER_LEARNER / body.questionCount));

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("exams")
    .insert({
      module_id: body.moduleId,
      creator_wallet: body.creatorWallet.toLowerCase(),
      contract_exam_id: body.contractExamId,
      question_set_hash: body.questionSetHash,
      question_count: body.questionCount,
      reward_per_correct: rewardPerCorrect,
      max_participants: body.maxParticipants ?? 100,
      timer_seconds: body.timerSeconds ?? 30,
      status: "published",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exam: data });
}

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json() as {
    examId?: string;
    walletAddress?: string;
    answerCommitment?: string;
  };

  if (!body.examId || !body.walletAddress || !body.answerCommitment) {
    return NextResponse.json({ error: "examId, walletAddress, and answerCommitment are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      exam_id: body.examId,
      wallet_address: body.walletAddress.toLowerCase(),
      answer_commitment: body.answerCommitment,
      status: "committed",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submission: data });
}

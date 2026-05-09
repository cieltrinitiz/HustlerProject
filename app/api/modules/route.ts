import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("modules")
    .select("id,title,description,category,creator_wallet,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ modules: data });
}

import { NextResponse } from "next/server";
import { normalizeWalletAddress } from "@/lib/gooddollar/identity";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json() as {
    walletAddress?: string;
    isWhitelisted?: boolean;
    root?: string;
    checkedAt?: string;
  };

  if (!body.walletAddress || typeof body.isWhitelisted !== "boolean") {
    return NextResponse.json({ error: "walletAddress and isWhitelisted are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const walletAddress = normalizeWalletAddress(body.walletAddress);
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      wallet_address: walletAddress,
      gooddollar_verified: body.isWhitelisted,
      gooddollar_root: body.root ? normalizeWalletAddress(body.root) : null,
      gooddollar_checked_at: body.checkedAt ?? new Date().toISOString(),
    }, { onConflict: "wallet_address" })
    .select("wallet_address,gooddollar_verified,gooddollar_root,gooddollar_checked_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ identity: data });
}

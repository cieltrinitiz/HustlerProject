"use client";

import Link from "next/link";
import { useWalletConnection } from "@/components/WalletConnectionProvider";

export function CreateExamAction() {
  const { wallet } = useWalletConnection();

  if (!wallet) {
    return (
      <p className="wallet-required-note" role="status">
        Connect your wallet first to unlock the exam creator.
      </p>
    );
  }

  return (
    <Link className="button" href="/create">
      Create exam draft
    </Link>
  );
}

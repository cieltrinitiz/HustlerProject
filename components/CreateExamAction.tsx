"use client";

import Link from "next/link";
import { useWalletConnection } from "@/components/WalletConnectionProvider";

export function CreateExamAction() {
  const { wallet } = useWalletConnection();

  if (!wallet) {
    return (
      <p className="wallet-required-note" role="status">
        Connect wallet to launch the Learn & Earn creator.
      </p>
    );
  }

  return (
    <Link className="button" href="/learn-and-earn">
      Open Learn & Earn
    </Link>
  );
}

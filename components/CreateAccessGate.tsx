"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useWalletConnection } from "@/components/WalletConnectionProvider";

export function CreateAccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const { wallet } = useWalletConnection();

  if (!wallet) {
    return (
      <main>
        <section className="hero access-gate">
          <span className="eyebrow">Wallet required</span>
          <h1>Connect your wallet first.</h1>
          <p>
            The exam creator is hidden on first visit so learners only see Learn & Earn instructions. Use the Connect wallet button above, then return here to draft and publish exams.
          </p>
          <div className="actions">
            <Link className="button secondary" href="/">
              Back to instructions
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

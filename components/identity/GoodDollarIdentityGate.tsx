"use client";

import { useState, type ReactNode } from "react";
import { useIdentitySDK } from "@goodsdks/citizen-sdk";
import { getGoodDollarIdentityEnvironment, normalizeWalletAddress, type GoodDollarIdentityStatus } from "@/lib/gooddollar/identity";

type GoodDollarIdentityGateProps = {
  walletAddress?: string;
  callbackUrl?: string;
  children?: ReactNode;
};

export function GoodDollarIdentityGate({ walletAddress, callbackUrl, children }: GoodDollarIdentityGateProps) {
  const environment = getGoodDollarIdentityEnvironment();
  const identitySDK = useIdentitySDK(environment);
  const [status, setStatus] = useState<GoodDollarIdentityStatus | null>(null);
  const [faceVerificationLink, setFaceVerificationLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("Connect a wallet to check GoodDollar Identity status.");
  const [isLoading, setIsLoading] = useState(false);

  async function checkIdentity() {
    if (!walletAddress) {
      setMessage("Wallet address is required before checking GoodDollar Identity.");
      return;
    }

    setIsLoading(true);
    setMessage("Checking GoodDollar Identity status...");

    try {
      const normalizedWallet = normalizeWalletAddress(walletAddress);
      const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(normalizedWallet);
      const nextStatus = {
        walletAddress: normalizedWallet,
        isWhitelisted,
        root,
        checkedAt: new Date().toISOString(),
      };
      setStatus(nextStatus);
      setMessage(isWhitelisted ? "GoodDollar Identity verified." : "Wallet is not GoodDollar verified yet.");

      await fetch("/api/identity/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextStatus),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to check GoodDollar Identity.";
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function startFaceVerification() {
    setIsLoading(true);
    setMessage("Generating Face Verification link...");

    try {
      const link = await identitySDK.generateFVLink(false, callbackUrl ?? window.location.href);
      setFaceVerificationLink(link);
      setMessage("Face Verification link is ready.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to generate Face Verification link.";
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  const isVerified = Boolean(status?.isWhitelisted);

  return (
    <section className="card">
      <span className="badge">GoodDollar Identity</span>
      <h2>Verified-human reward gate</h2>
      <p>{message}</p>
      {status?.root ? <p><strong>Root:</strong> {status.root}</p> : null}
      <div className="actions">
        <button className="button secondary" disabled={isLoading || !walletAddress} onClick={checkIdentity} type="button">
          Check identity
        </button>
        {!isVerified ? (
          <button className="button" disabled={isLoading} onClick={startFaceVerification} type="button">
            Start face verification
          </button>
        ) : null}
      </div>
      {faceVerificationLink ? (
        <p>
          <a href={faceVerificationLink} rel="noreferrer" target="_blank">Open Face Verification</a>
        </p>
      ) : null}
      {isVerified ? children : null}
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { IdentitySDK, type IdentitySDKOptions } from "@goodsdks/citizen-sdk";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import {
  getGoodDollarIdentityEnvironment,
  normalizeWalletAddress,
  type GoodDollarIdentityStatus,
} from "@/lib/gooddollar/identity";

const CELO_RPC_URL = "https://forno.celo.org";
const PROVIDER_DISCOVERY_TIMEOUT_MS = 300;

const WALLET_PROVIDER_PRIORITIES = [
  "MiniPay",
  "Trust Wallet",
  "MetaMask",
  "Injected wallet",
] as const;

type WalletProviderName = (typeof WALLET_PROVIDER_PRIORITIES)[number];
type EthereumProvider = Parameters<typeof custom>[0] & {
  isMetaMask?: boolean;
  isMiniPay?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthereumProvider[];
  request?: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>;
};
type Eip6963ProviderDetail = {
  info?: {
    name?: string;
    rdns?: string;
  };
  provider?: EthereumProvider;
};
type BrowserWindow = typeof window & {
  ethereum?: EthereumProvider;
  trustwallet?: EthereumProvider | { ethereum?: EthereumProvider };
};

type GoodDollarIdentityGateProps = {
  walletAddress?: string;
  callbackUrl?: string;
  children?: ReactNode;
};

export function GoodDollarIdentityGate({
  walletAddress,
  callbackUrl,
  children,
}: GoodDollarIdentityGateProps) {
  const environment = getGoodDollarIdentityEnvironment();
  const [status, setStatus] = useState<GoodDollarIdentityStatus | null>(null);
  const [faceVerificationLink, setFaceVerificationLink] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState<string>(
    "Connect a wallet to check GoodDollar Identity status.",
  );
  const [isLoading, setIsLoading] = useState(false);

  async function checkIdentity() {
    if (!walletAddress) {
      setMessage(
        "Wallet address is required before checking GoodDollar Identity.",
      );
      return;
    }

    setIsLoading(true);
    setMessage("Checking GoodDollar Identity status...");

    try {
      const normalizedWallet = normalizeWalletAddress(walletAddress);
      const identitySDK = await createIdentitySDK(
        normalizedWallet as Address,
        environment,
      );
      const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(
        normalizedWallet as Address,
      );
      const nextStatus = {
        walletAddress: normalizedWallet,
        isWhitelisted,
        root,
        checkedAt: new Date().toISOString(),
      };
      setStatus(nextStatus);
      setMessage(
        isWhitelisted
          ? "GoodDollar Identity verified."
          : "Wallet is not GoodDollar verified yet.",
      );

      await fetch("/api/identity/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextStatus),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to check GoodDollar Identity.";
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function startFaceVerification() {
    setIsLoading(true);
    setMessage("Generating Face Verification link...");

    try {
      if (!walletAddress) {
        setMessage(
          "Wallet address is required before starting GoodDollar Face Verification.",
        );
        return;
      }

      const identitySDK = await createIdentitySDK(
        normalizeWalletAddress(walletAddress) as Address,
        environment,
      );
      const link = await identitySDK.generateFVLink(
        false,
        callbackUrl ?? window.location.href,
      );
      setFaceVerificationLink(link);
      setMessage("Face Verification link is ready.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to generate Face Verification link.";
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
      {status?.root ? (
        <p>
          <strong>Root:</strong> {status.root}
        </p>
      ) : null}
      <div className="actions">
        <button
          className="button secondary"
          disabled={isLoading || !walletAddress}
          onClick={checkIdentity}
          type="button"
        >
          Check identity
        </button>
        {!isVerified ? (
          <button
            className="button"
            disabled={isLoading}
            onClick={startFaceVerification}
            type="button"
          >
            Start face verification
          </button>
        ) : null}
      </div>
      {faceVerificationLink ? (
        <p>
          <a href={faceVerificationLink} rel="noreferrer" target="_blank">
            Open Face Verification
          </a>
        </p>
      ) : null}
      {isVerified ? children : null}
    </section>
  );
}

async function createIdentitySDK(
  walletAddress: Address,
  environment: ReturnType<typeof getGoodDollarIdentityEnvironment>,
) {
  const provider = await getBrowserEthereumProvider(walletAddress);

  if (!provider) {
    throw new Error(
      "No injected wallet provider found. Please open this page in MiniPay, Trust Wallet, or a MetaMask-enabled browser.",
    );
  }

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC_URL),
  });
  const walletClient = createWalletClient({
    account: walletAddress,
    chain: celo,
    transport: custom(provider),
  });

  return IdentitySDK.init({
    publicClient: publicClient as unknown as IdentitySDKOptions["publicClient"],
    walletClient: walletClient as unknown as IdentitySDKOptions["walletClient"],
    env: environment,
  });
}

async function getBrowserEthereumProvider(walletAddress: Address) {
  const providerOptions = await discoverInjectedProviders();
  const matchingProvider = await findProviderForWallet(
    providerOptions,
    walletAddress,
  );

  if (matchingProvider) {
    return matchingProvider;
  }

  const preferredProvider = providerOptions[0]?.provider;

  if (!preferredProvider) {
    return undefined;
  }

  await preferredProvider.request?.({ method: "eth_requestAccounts" });
  return preferredProvider;
}

async function discoverInjectedProviders() {
  const providers = new Map<EthereumProvider, WalletProviderName>();

  function addProvider(
    provider: EthereumProvider | undefined,
    announcedName?: string,
  ) {
    if (!provider) {
      return;
    }

    if (Array.isArray(provider.providers)) {
      provider.providers.forEach((nestedProvider) =>
        addProvider(nestedProvider, announcedName),
      );
    }

    providers.set(provider, getWalletProviderName(provider, announcedName));
  }

  const browserWindow = window as BrowserWindow;
  const trustWallet = browserWindow.trustwallet;

  addProvider(browserWindow.ethereum);

  addProvider(getTrustWalletProvider(trustWallet));

  await collectEip6963Providers(addProvider);

  return Array.from(providers, ([provider, name]) => ({ provider, name })).sort(
    (a, b) =>
      WALLET_PROVIDER_PRIORITIES.indexOf(a.name) -
      WALLET_PROVIDER_PRIORITIES.indexOf(b.name),
  );
}

function getTrustWalletProvider(trustWallet: BrowserWindow["trustwallet"]) {
  if (!trustWallet) {
    return undefined;
  }

  return "ethereum" in trustWallet
    ? trustWallet.ethereum
    : (trustWallet as EthereumProvider);
}

async function collectEip6963Providers(
  addProvider: (
    provider: EthereumProvider | undefined,
    announcedName?: string,
  ) => void,
) {
  function handleProviderAnnouncement(event: Event) {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    addProvider(detail?.provider, detail?.info?.name ?? detail?.info?.rdns);
  }

  window.addEventListener(
    "eip6963:announceProvider",
    handleProviderAnnouncement,
  );
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  await new Promise((resolve) =>
    setTimeout(resolve, PROVIDER_DISCOVERY_TIMEOUT_MS),
  );
  window.removeEventListener(
    "eip6963:announceProvider",
    handleProviderAnnouncement,
  );
}

async function findProviderForWallet(
  providerOptions: Array<{
    provider: EthereumProvider;
    name: WalletProviderName;
  }>,
  walletAddress: Address,
) {
  for (const { provider } of providerOptions) {
    const accounts = await requestProviderAccounts(provider, "eth_accounts");

    if (accounts.includes(walletAddress.toLowerCase())) {
      return provider;
    }
  }

  for (const { provider } of providerOptions) {
    const accounts = await requestProviderAccounts(
      provider,
      "eth_requestAccounts",
    );

    if (accounts.includes(walletAddress.toLowerCase())) {
      return provider;
    }
  }

  return undefined;
}

async function requestProviderAccounts(
  provider: EthereumProvider,
  method: "eth_accounts" | "eth_requestAccounts",
) {
  try {
    const accounts = await provider.request?.({ method });

    if (!Array.isArray(accounts)) {
      return [];
    }

    return accounts
      .filter((account): account is string => typeof account === "string")
      .map(normalizeWalletAddress);
  } catch {
    return [];
  }
}

function getWalletProviderName(
  provider: EthereumProvider,
  announcedName = "",
): WalletProviderName {
  const normalizedName = announcedName.toLowerCase();

  if (provider.isMiniPay || normalizedName.includes("minipay")) {
    return "MiniPay";
  }

  if (
    provider.isTrust ||
    provider.isTrustWallet ||
    normalizedName.includes("trust")
  ) {
    return "Trust Wallet";
  }

  if (provider.isMetaMask || normalizedName.includes("metamask")) {
    return "MetaMask";
  }

  return "Injected wallet";
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type EthereumProvider = {
  isMetaMask?: boolean;
  isMiniPay?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isGoodWallet?: boolean;
  isGoodDollar?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthereumProvider[];
  request?: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  disconnect?: () => Promise<void>;
};

type BrowserWindow = typeof window & {
  ethereum?: EthereumProvider;
  goodwallet?: EthereumProvider | { ethereum?: EthereumProvider };
  trustwallet?: EthereumProvider | { ethereum?: EthereumProvider };
};

export type WalletState = {
  address: string;
  label: string;
};

export type WalletVisual = {
  accent: string;
  bg: string;
  emoji: string;
  label: string;
  shortLabel: string;
};

type WalletConnectionContextValue = {
  wallet: WalletState | null;
  setWallet: (wallet: WalletState | null) => void;
  detectedWalletLabel: string;
  hasInjectedWallet: boolean;
  isMobileBrowser: boolean;
  walletVisual: WalletVisual;
};

const WalletConnectionContext = createContext<WalletConnectionContextValue | undefined>(undefined);

export function WalletConnectionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [detectedWalletLabel, setDetectedWalletLabel] = useState("Checking wallet browser...");
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);

  useEffect(() => {
    setIsMobileBrowser(isMobileUserAgent());

    const provider = getInjectedProvider();
    setHasInjectedWallet(Boolean(provider));
    setDetectedWalletLabel(provider ? getProviderLabel(provider) : "No injected wallet detected");

    provider
      ?.request?.({ method: "eth_accounts" })
      .then((accounts) => {
        const firstAccount = parseFirstAccount(accounts);
        if (firstAccount) {
          setWallet({ address: firstAccount, label: getProviderLabel(provider) });
        }
      })
      .catch(() => undefined);
  }, []);

  const walletVisual = useMemo(
    () => getWalletVisual(wallet?.label ?? (hasInjectedWallet ? detectedWalletLabel : "Injected wallet")),
    [detectedWalletLabel, hasInjectedWallet, wallet?.label],
  );

  const value = useMemo(
    () => ({ wallet, setWallet, detectedWalletLabel, hasInjectedWallet, isMobileBrowser, walletVisual }),
    [detectedWalletLabel, hasInjectedWallet, isMobileBrowser, wallet, walletVisual],
  );

  return <WalletConnectionContext.Provider value={value}>{children}</WalletConnectionContext.Provider>;
}

export function useWalletConnection() {
  const context = useContext(WalletConnectionContext);

  if (!context) {
    throw new Error("useWalletConnection must be used inside WalletConnectionProvider");
  }

  return context;
}

export function getInjectedProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const browserWindow = window as BrowserWindow;
  const injected = browserWindow.ethereum;
  const goodWallet = browserWindow.goodwallet;
  const trustWallet = browserWindow.trustwallet;

  if (injected?.providers?.length) {
    return (
      injected.providers.find((provider) => provider.isGoodWallet || provider.isGoodDollar) ??
      injected.providers.find((provider) => provider.isMiniPay) ??
      injected.providers.find((provider) => provider.isTrust || provider.isTrustWallet) ??
      injected.providers.find((provider) => provider.isMetaMask) ??
      injected.providers.find((provider) => provider.isCoinbaseWallet) ??
      injected.providers[0]
    );
  }

  if (injected) {
    return injected;
  }

  const externalWallet = normalizeExternalProvider(goodWallet) ?? normalizeExternalProvider(trustWallet);
  return externalWallet;
}

export function parseFirstAccount(accounts: unknown) {
  if (!Array.isArray(accounts)) {
    return undefined;
  }

  const account = accounts.find((item): item is string => typeof item === "string");
  return account?.toLowerCase();
}

export function getProviderLabel(provider: EthereumProvider) {
  if (provider.isGoodWallet || provider.isGoodDollar) {
    return "GoodWallet";
  }

  if (provider.isMiniPay) {
    return "MiniPay";
  }

  if (provider.isTrust || provider.isTrustWallet) {
    return "Trust Wallet";
  }

  if (provider.isMetaMask) {
    return "MetaMask";
  }

  if (provider.isCoinbaseWallet) {
    return "Coinbase Wallet";
  }

  return "Injected wallet";
}

export function getWalletVisual(label: string): WalletVisual {
  const normalized = label.toLowerCase();

  if (normalized.includes("good")) {
    return { accent: "#facc15", bg: "#1d4ed8", emoji: "G$", label: "GoodWallet", shortLabel: "GW" };
  }

  if (normalized.includes("metamask")) {
    return { accent: "#ff8f4c", bg: "#fff4ec", emoji: "🦊", label: "MetaMask", shortLabel: "MM" };
  }

  if (normalized.includes("trust")) {
    return { accent: "#3375bb", bg: "#eef6ff", emoji: "🛡️", label: "Trust Wallet", shortLabel: "TW" };
  }

  if (normalized.includes("minipay")) {
    return { accent: "#35d07f", bg: "#ecfff5", emoji: "💚", label: "MiniPay", shortLabel: "MP" };
  }

  if (normalized.includes("coinbase")) {
    return { accent: "#0052ff", bg: "#edf3ff", emoji: "🔵", label: "Coinbase Wallet", shortLabel: "CB" };
  }

  if (normalized.includes("walletconnect")) {
    return { accent: "#2563eb", bg: "#eaf2ff", emoji: "📱", label: "WalletConnect", shortLabel: "WC" };
  }

  return { accent: "#7c3aed", bg: "#f4efff", emoji: "🔐", label: "Injected wallet", shortLabel: "IW" };
}

function normalizeExternalProvider(provider?: EthereumProvider | { ethereum?: EthereumProvider }) {
  if (!provider) {
    return undefined;
  }

  if ("ethereum" in provider) {
    return provider.ethereum;
  }

  return provider as EthereumProvider;
}

function isMobileUserAgent() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

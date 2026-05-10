"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type EthereumProvider = {
  isMetaMask?: boolean;
  isMiniPay?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthereumProvider[];
  request?: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

type BrowserWindow = typeof window & {
  ethereum?: EthereumProvider;
  trustwallet?: EthereumProvider | { ethereum?: EthereumProvider };
};

export type WalletState = {
  address: string;
  label: string;
};

type WalletConnectionContextValue = {
  wallet: WalletState | null;
  setWallet: (wallet: WalletState | null) => void;
  detectedWalletLabel: string;
  hasInjectedWallet: boolean;
  isMobileBrowser: boolean;
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

  const value = useMemo(
    () => ({ wallet, setWallet, detectedWalletLabel, hasInjectedWallet, isMobileBrowser }),
    [detectedWalletLabel, hasInjectedWallet, isMobileBrowser, wallet],
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
  const trustWallet = browserWindow.trustwallet;

  if (injected?.providers?.length) {
    return (
      injected.providers.find((provider) => provider.isMiniPay) ??
      injected.providers.find((provider) => provider.isTrust || provider.isTrustWallet) ??
      injected.providers.find((provider) => provider.isMetaMask) ??
      injected.providers[0]
    );
  }

  if (injected) {
    return injected;
  }

  if (!trustWallet) {
    return undefined;
  }

  if ("ethereum" in trustWallet) {
    return trustWallet.ethereum;
  }

  return trustWallet as EthereumProvider;
}

export function parseFirstAccount(accounts: unknown) {
  if (!Array.isArray(accounts)) {
    return undefined;
  }

  const account = accounts.find((item): item is string => typeof item === "string");
  return account?.toLowerCase();
}

export function getProviderLabel(provider: EthereumProvider) {
  if (provider.isMiniPay) {
    return "MiniPay";
  }

  if (provider.isTrust || provider.isTrustWallet) {
    return "Trust Wallet";
  }

  if (provider.isMetaMask) {
    return "MetaMask";
  }

  return "Injected wallet";
}

function isMobileUserAgent() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

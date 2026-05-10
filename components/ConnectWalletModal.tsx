"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type EthereumProvider = {
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

type Eip6963ProviderDetail = {
  info?: {
    name?: string;
    rdns?: string;
  };
  provider?: EthereumProvider;
};

type WalletOption = {
  provider: EthereumProvider;
  label: string;
};

type WalletState = {
  address: string;
  label: string;
};

const CELO_CHAIN_ID = "0xa4ec";
const PROVIDER_DISCOVERY_TIMEOUT_MS = 350;
const WALLET_APPROVAL_TIMEOUT_MS = 20_000;

export function ConnectWalletModal() {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [detectedWallet, setDetectedWallet] = useState<WalletOption | null>(null);
  const [message, setMessage] = useState("Choose a wallet to continue.");
  const [isConnecting, setIsConnecting] = useState(false);

  const shortAddress = useMemo(() => {
    if (!wallet?.address) {
      return "Connect wallet";
    }

    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet?.address]);

  useEffect(() => {
    setIsMounted(true);

    discoverWalletProvider()
      .then(async (option) => {
        setDetectedWallet(option ?? null);

        if (!option) {
          setMessage("No dApp wallet detected in this browser yet.");
          return;
        }

        setMessage(`${option.label} detected. Tap connect to approve.`);
        const accounts = await requestProviderAccounts(option.provider, "eth_accounts");
        const firstAccount = accounts[0];

        if (firstAccount) {
          setWallet({ address: firstAccount, label: option.label });
          setMessage(`${option.label} connected and ready.`);
        }
      })
      .catch(() => setMessage("Unable to detect a wallet in this browser."));
  }, []);

  async function connectWallet() {
    const option = detectedWallet ?? await discoverWalletProvider();

    if (!option) {
      setDetectedWallet(null);
      setMessage("No dApp wallet detected. Open this site inside MiniPay, Trust Wallet, MetaMask mobile browser, or install a desktop wallet extension.");
      setIsOpen(true);
      return;
    }

    setDetectedWallet(option);
    setIsConnecting(true);
    setMessage(`Opening ${option.label} approval...`);

    try {
      const accounts = await requestProviderAccounts(option.provider, "eth_requestAccounts", WALLET_APPROVAL_TIMEOUT_MS);
      const firstAccount = accounts[0];

      if (!firstAccount) {
        setMessage(`${option.label} did not return an account. Please unlock the wallet and try again.`);
        return;
      }

      await switchToCelo(option.provider);
      setWallet({ address: firstAccount, label: option.label });
      setMessage(`${option.label} connected successfully on Celo.`);
      setIsOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection was cancelled.");
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectWallet() {
    setWallet(null);
    setMessage("Wallet disconnected in this app. You can reconnect anytime.");
  }

  const modal = isOpen ? (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
      <section
        aria-labelledby="wallet-modal-title"
        aria-modal="true"
        className="wallet-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close wallet modal" className="modal-close" onClick={() => setIsOpen(false)} type="button">
          ×
        </button>
        <span className="eyebrow">Wallet access</span>
        <h2 id="wallet-modal-title">Connect your wallet</h2>
        <p>
          Connect with MiniPay, Trust Wallet, MetaMask, or any injected wallet to publish exams and claim rewards on Celo.
        </p>

        <div className={detectedWallet ? "wallet-detection detected" : "wallet-detection missing"}>
          <strong>{detectedWallet ? `${detectedWallet.label} detected` : "No mobile dApp wallet detected"}</strong>
          <span>
            {detectedWallet
              ? "This browser exposed a wallet provider for the app."
              : "If you are on mobile, open this exact URL inside the wallet app's built-in browser."}
          </span>
        </div>

        <div className="wallet-options">
          <button className="wallet-option" disabled={isConnecting} onClick={connectWallet} type="button">
            <span>
              <strong>{wallet?.label ?? detectedWallet?.label ?? "Browser wallet"}</strong>
              <small>{wallet ? wallet.address : detectedWallet ? "Ready for wallet approval" : "Waiting for a dApp browser or extension"}</small>
            </span>
            <span>{isConnecting ? "Connecting..." : "Connect"}</span>
          </button>
        </div>

        <p className="wallet-message">{message}</p>

        {wallet ? (
          <button className="button secondary" onClick={disconnectWallet} type="button">
            Disconnect in app
          </button>
        ) : null}
      </section>
    </div>
  ) : null;

  return (
    <div className="wallet-shell">
      <button className="wallet-button" onClick={() => setIsOpen(true)} type="button">
        <span className={wallet ? "wallet-status-dot connected" : "wallet-status-dot"} aria-hidden="true" />
        {shortAddress}
      </button>
      {isMounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}

async function discoverWalletProvider(): Promise<WalletOption | undefined> {
  const options = await discoverInjectedProviders();
  return options[0];
}

async function discoverInjectedProviders() {
  const providers = new Map<EthereumProvider, string>();

  function addProvider(provider: EthereumProvider | undefined, announcedName?: string) {
    if (!provider) {
      return;
    }

    if (Array.isArray(provider.providers)) {
      provider.providers.forEach((nestedProvider) => addProvider(nestedProvider, announcedName));
    }

    providers.set(provider, getProviderLabel(provider, announcedName));
  }

  const browserWindow = window as BrowserWindow;
  const trustWallet = browserWindow.trustwallet;

  addProvider(browserWindow.ethereum);
  addProvider(getTrustWalletProvider(trustWallet));
  await collectEip6963Providers(addProvider);

  return Array.from(providers, ([provider, label]) => ({ provider, label })).sort(
    (a, b) => getProviderPriority(a.label) - getProviderPriority(b.label),
  );
}

function getTrustWalletProvider(trustWallet: BrowserWindow["trustwallet"]) {
  if (!trustWallet) {
    return undefined;
  }

  if ("ethereum" in trustWallet) {
    return trustWallet.ethereum;
  }

  return trustWallet as EthereumProvider;
}

async function collectEip6963Providers(addProvider: (provider: EthereumProvider | undefined, announcedName?: string) => void) {
  function handleProviderAnnouncement(event: Event) {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    addProvider(detail?.provider, detail?.info?.name ?? detail?.info?.rdns);
  }

  window.addEventListener("eip6963:announceProvider", handleProviderAnnouncement);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  await new Promise((resolve) => setTimeout(resolve, PROVIDER_DISCOVERY_TIMEOUT_MS));
  window.removeEventListener("eip6963:announceProvider", handleProviderAnnouncement);
}

async function requestProviderAccounts(
  provider: EthereumProvider,
  method: "eth_accounts" | "eth_requestAccounts",
  timeoutMs?: number,
) {
  if (!provider.request) {
    throw new Error("Detected wallet does not support account requests.");
  }

  const accounts = await withOptionalTimeout(provider.request({ method }), timeoutMs);

  if (!Array.isArray(accounts)) {
    return [];
  }

  return accounts
    .filter((account): account is string => typeof account === "string")
    .map((account) => account.toLowerCase());
}

async function withOptionalTimeout<T>(promise: Promise<T>, timeoutMs?: number) {
  if (!timeoutMs) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Wallet approval timed out. Please check the wallet popup, unlock your wallet, then try again.")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function switchToCelo(provider: EthereumProvider) {
  if (!provider.request) {
    throw new Error("Detected wallet cannot switch networks automatically.");
  }

  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CELO_CHAIN_ID }] });
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CELO_CHAIN_ID,
          chainName: "Celo",
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: ["https://forno.celo.org"],
          blockExplorerUrls: ["https://celoscan.io"],
        },
      ],
    });
  }
}

function getProviderLabel(provider: EthereumProvider, announcedName = "") {
  const normalizedName = announcedName.toLowerCase();

  if (provider.isMiniPay || normalizedName.includes("minipay")) {
    return "MiniPay";
  }

  if (provider.isTrust || provider.isTrustWallet || normalizedName.includes("trust")) {
    return "Trust Wallet";
  }

  if (provider.isMetaMask || normalizedName.includes("metamask")) {
    return "MetaMask";
  }

  return announcedName || "Injected wallet";
}

function getProviderPriority(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("minipay")) {
    return 0;
  }

  if (normalizedLabel.includes("trust")) {
    return 1;
  }

  if (normalizedLabel.includes("metamask")) {
    return 2;
  }

  return 3;
}

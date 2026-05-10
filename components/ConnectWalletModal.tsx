"use client";

import { useEffect, useMemo, useState } from "react";

type EthereumProvider = {
  isMetaMask?: boolean;
  isMiniPay?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  request?: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

type BrowserWindow = typeof window & {
  ethereum?: EthereumProvider;
  trustwallet?: EthereumProvider | { ethereum?: EthereumProvider };
};

type WalletState = {
  address: string;
  label: string;
};

const CELO_CHAIN_ID = "0xa4ec";

export function ConnectWalletModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [message, setMessage] = useState("Choose a wallet to continue.");
  const [isConnecting, setIsConnecting] = useState(false);

  const shortAddress = useMemo(() => {
    if (!wallet?.address) {
      return "Connect wallet";
    }

    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet?.address]);

  useEffect(() => {
    const provider = getInjectedProvider();

    provider
      ?.request?.({ method: "eth_accounts" })
      .then((accounts) => {
        const firstAccount = parseFirstAccount(accounts);
        if (firstAccount) {
          setWallet({ address: firstAccount, label: getProviderLabel(provider) });
          setMessage("Wallet connected and ready.");
        }
      })
      .catch(() => undefined);
  }, []);

  async function connectWallet() {
    const provider = getInjectedProvider();

    if (!provider) {
      setMessage("No wallet found. Install MetaMask, Trust Wallet, or open in MiniPay.");
      setIsOpen(true);
      return;
    }

    setIsConnecting(true);
    setMessage("Opening wallet approval...");

    try {
      const accounts = await provider.request?.({ method: "eth_requestAccounts" });
      const firstAccount = parseFirstAccount(accounts);

      if (!firstAccount) {
        setMessage("Wallet did not return an account. Please try again.");
        return;
      }

      await switchToCelo(provider);
      setWallet({ address: firstAccount, label: getProviderLabel(provider) });
      setMessage("Wallet connected successfully.");
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

  return (
    <div className="wallet-shell">
      <button className="wallet-button" onClick={() => setIsOpen(true)} type="button">
        <span className="wallet-status-dot" aria-hidden="true" />
        {shortAddress}
      </button>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            aria-modal="true"
            className="wallet-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button aria-label="Close wallet modal" className="modal-close" onClick={() => setIsOpen(false)} type="button">
              ×
            </button>
            <span className="eyebrow">Wallet access</span>
            <h2>Connect your wallet</h2>
            <p>
              Connect with MiniPay, Trust Wallet, MetaMask, or any injected wallet to publish exams and claim rewards on Celo.
            </p>

            <div className="wallet-options">
              <button className="wallet-option" disabled={isConnecting} onClick={connectWallet} type="button">
                <span>
                  <strong>{wallet?.label ?? "Browser wallet"}</strong>
                  <small>{wallet ? wallet.address : "Recommended for GoodDollar rewards"}</small>
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
      ) : null}
    </div>
  );
}

function getInjectedProvider(): EthereumProvider | undefined {
  const browserWindow = window as BrowserWindow;
  const trustWallet = browserWindow.trustwallet;

  if (browserWindow.ethereum) {
    return browserWindow.ethereum;
  }

  if (!trustWallet) {
    return undefined;
  }

  if ("ethereum" in trustWallet) {
    return trustWallet.ethereum;
  }

  return trustWallet as EthereumProvider;
}

function parseFirstAccount(accounts: unknown) {
  if (!Array.isArray(accounts)) {
    return undefined;
  }

  const account = accounts.find((item): item is string => typeof item === "string");
  return account?.toLowerCase();
}

async function switchToCelo(provider: EthereumProvider) {
  try {
    await provider.request?.({ method: "wallet_switchEthereumChain", params: [{ chainId: CELO_CHAIN_ID }] });
  } catch {
    await provider.request?.({
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

function getProviderLabel(provider: EthereumProvider) {
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

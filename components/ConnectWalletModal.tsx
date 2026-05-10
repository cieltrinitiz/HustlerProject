"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  getInjectedProvider,
  getProviderLabel,
  parseFirstAccount,
  useWalletConnection,
  type EthereumProvider,
} from "@/components/WalletConnectionProvider";

const CELO_CHAIN_ID = "0xa4ec";

export function ConnectWalletModal() {
  const { detectedWalletLabel, hasInjectedWallet, isMobileBrowser, setWallet, wallet } = useWalletConnection();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("Choose a wallet to continue.");
  const [isConnecting, setIsConnecting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const shortAddress = useMemo(() => {
    if (!wallet?.address) {
      return "Connect wallet";
    }

    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet?.address]);

  const walletHint = useMemo(() => {
    if (wallet) {
      return `${wallet.label} connected`;
    }

    if (hasInjectedWallet) {
      return `${detectedWalletLabel} detected`;
    }

    if (isMobileBrowser) {
      return "No mobile dApp wallet detected. Open this site inside MiniPay, Trust Wallet, or MetaMask mobile browser.";
    }

    return "No browser wallet detected. Install/unlock MetaMask or use a wallet dApp browser.";
  }, [detectedWalletLabel, hasInjectedWallet, isMobileBrowser, wallet]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function connectWallet() {
    const provider = getInjectedProvider();

    if (!provider) {
      setMessage(
        isMobileBrowser
          ? "No mobile wallet was detected in this browser. Please open the site inside MiniPay, Trust Wallet, or MetaMask mobile."
          : "No injected wallet found. Install or unlock MetaMask/Trust Wallet, then refresh and try again.",
      );
      setIsOpen(true);
      return;
    }

    setIsConnecting(true);
    setMessage("Approve the connection in your wallet. If nothing opens, unlock your wallet app/extension and try again.");

    try {
      const accounts = await provider.request?.({ method: "eth_requestAccounts" });
      const firstAccount = parseFirstAccount(accounts);

      if (!firstAccount) {
        setMessage("Wallet did not return an account. Please try again or switch wallet browser.");
        return;
      }

      await switchToCelo(provider);
      setWallet({ address: firstAccount, label: getProviderLabel(provider) });
      setMessage("Wallet connected successfully. You can now create an exam draft.");
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

        <div className={`wallet-detection ${hasInjectedWallet ? "detected" : "missing"}`}>
          <strong>{hasInjectedWallet ? "Wallet detected" : "Wallet not detected"}</strong>
          <span>{walletHint}</span>
        </div>

        <div className="wallet-options">
          <button className="wallet-option" disabled={isConnecting} onClick={connectWallet} type="button">
            <span>
              <strong>{wallet?.label ?? (hasInjectedWallet ? detectedWalletLabel : "Browser wallet")}</strong>
              <small>{wallet ? wallet.address : "Use the wallet browser/extension detected above"}</small>
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
        <span className="wallet-status-dot" aria-hidden="true" />
        {shortAddress}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
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

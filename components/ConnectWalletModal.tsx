"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import EthereumProvider from "@walletconnect/ethereum-provider";
import {
  getInjectedProvider,
  getProviderLabel,
  getWalletVisual,
  parseFirstAccount,
  useWalletConnection,
  type EthereumProvider as InjectedEthereumProvider,
} from "@/components/WalletConnectionProvider";

const CELO_CHAIN_ID = "0xa4ec";
const CELO_CHAIN_ID_DECIMAL = 42220;
const WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;

type WalletConnectProvider = InjectedEthereumProvider & {
  enable?: () => Promise<string[]>;
};

export function ConnectWalletModal() {
  const { detectedWalletLabel, hasInjectedWallet, isMobileBrowser, setWallet, wallet, walletVisual } = useWalletConnection();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("Choose how you want to join.");
  const [isConnecting, setIsConnecting] = useState<"injected" | "walletconnect" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const shortAddress = useMemo(() => {
    if (!wallet?.address) {
      return "Get Started";
    }

    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  }, [wallet?.address]);

  const walletHint = useMemo(() => {
    if (wallet) {
      return `${wallet.label} connected — continue with Learn & Earn modules.`;
    }

    if (hasInjectedWallet) {
      return `${detectedWalletLabel} detected — connect wallet, then approve the login signature.`;
    }

    if (isMobileBrowser) {
      return "Open this site inside GoodWallet, MiniPay, Trust Wallet, or MetaMask mobile browser.";
    }

    return "Install/unlock a browser wallet or use WalletConnect when a project ID is configured.";
  }, [detectedWalletLabel, hasInjectedWallet, isMobileBrowser, wallet]);

  const injectedVisual = getWalletVisual(hasInjectedWallet ? detectedWalletLabel : "Injected wallet");
  const canUseWalletConnect = Boolean(WALLET_CONNECT_PROJECT_ID);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function connectInjectedWallet() {
    const provider = getInjectedProvider();

    if (!provider) {
      setMessage(
        isMobileBrowser
          ? "No mobile wallet was detected. Open this site inside GoodWallet, MiniPay, Trust Wallet, or MetaMask mobile."
          : "No injected wallet found. Install or unlock MetaMask, GoodWallet, or Trust Wallet; or configure WalletConnect.",
      );
      setIsOpen(true);
      return;
    }

    await completeWalletLogin(provider, getProviderLabel(provider), "injected");
  }

  async function connectWalletConnect() {
    if (!WALLET_CONNECT_PROJECT_ID) {
      setMessage("WalletConnect is ready, but NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is empty. Add it to your env vars to enable QR/deeplink login.");
      return;
    }

    setIsConnecting("walletconnect");
    setMessage("Opening WalletConnect. Scan the QR code or approve the deeplink in your wallet.");

    try {
      const provider = (await EthereumProvider.init({
        chains: [CELO_CHAIN_ID_DECIMAL],
        methods: ["eth_sendTransaction", "personal_sign"],
        optionalChains: [CELO_CHAIN_ID_DECIMAL],
        projectId: WALLET_CONNECT_PROJECT_ID,
        rpcMap: { [CELO_CHAIN_ID_DECIMAL]: "https://forno.celo.org" },
        showQrModal: true,
      })) as WalletConnectProvider;

      const enabledAccounts = await provider.enable?.();
      const firstAccount = parseFirstAccount(enabledAccounts) ?? parseFirstAccount(await provider.request?.({ method: "eth_accounts" }));

      if (!firstAccount) {
        setMessage("WalletConnect did not return an account. Please try again or choose another wallet.");
        return;
      }

      await switchToCelo(provider);
      await requestLoginSignature(provider, firstAccount);
      setWallet({ address: firstAccount, label: "WalletConnect" });
      setMessage("Wallet connected. Your Learn & Earn page is ready.");
      setIsOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "WalletConnect login was cancelled.");
    } finally {
      setIsConnecting(null);
    }
  }

  async function completeWalletLogin(provider: InjectedEthereumProvider, label: string, mode: "injected" | "walletconnect") {
    setIsConnecting(mode);
    setMessage("Approve wallet access, then sign the GoodMarket login message. This does not spend funds.");

    try {
      const accounts = await provider.request?.({ method: "eth_requestAccounts" });
      const firstAccount = parseFirstAccount(accounts);

      if (!firstAccount) {
        setMessage("Wallet did not return an account. Please try again or switch wallet browser.");
        return;
      }

      await switchToCelo(provider);
      await requestLoginSignature(provider, firstAccount);
      setWallet({ address: firstAccount, label });
      setMessage("Wallet connected. Your Learn & Earn page is ready.");
      setIsOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection or login signature was cancelled.");
    } finally {
      setIsConnecting(null);
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
        <div className="wallet-modal-heading">
          <span className="wallet-brand-logo" aria-hidden="true">G$</span>
          <div>
            <h2>Get Started with GoodMarket</h2>
            <p>Choose how you want to join</p>
          </div>
        </div>

        <button className="back-login" onClick={() => setMessage("Choose how you want to join.")} type="button">
          ← Back to login options
        </button>

        <label className="referral-field">
          Referral Code <span>(Optional)</span>
          <input
            maxLength={8}
            onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
            placeholder="Enter referral code if you have one"
            value={referralCode}
          />
        </label>
        <p className="referral-help">Paste the 8-character code from the friend who invited you. Applies to injected wallet and WalletConnect login below.</p>

        <div className={`wallet-detection ${hasInjectedWallet ? "detected" : "missing"}`}>
          <strong>{wallet ? "Wallet connected" : hasInjectedWallet ? "Wallet detected" : "Wallet not detected"}</strong>
          <span>{walletHint}</span>
        </div>

        <div className="wallet-options">
          <button
            className="wallet-option injected-option"
            disabled={Boolean(isConnecting)}
            onClick={connectInjectedWallet}
            style={{ "--wallet-accent": injectedVisual.accent, "--wallet-bg": injectedVisual.bg } as CSSProperties}
            type="button"
          >
            <span className="wallet-logo" aria-hidden="true">{injectedVisual.emoji}</span>
            <span className="wallet-copy">
              <strong>{wallet?.label ?? (hasInjectedWallet ? detectedWalletLabel : "Injected Wallet")}</strong>
              <small>{wallet ? wallet.address : hasInjectedWallet ? "Detected wallet — connect, then approve signature" : "GoodWallet, MetaMask, MiniPay, Trust Wallet, and more"}</small>
            </span>
            <span className="wallet-arrow">{isConnecting === "injected" ? "Connecting..." : "→"}</span>
          </button>

          <button
            className="wallet-option walletconnect-option"
            disabled={Boolean(isConnecting)}
            onClick={connectWalletConnect}
            type="button"
          >
            <span className="wallet-logo" aria-hidden="true">📱</span>
            <span className="wallet-copy">
              <strong>WalletConnect</strong>
              <small>{canUseWalletConnect ? "Scan QR / deeplink to connect external wallet" : "Add project ID in env vars to enable QR login"}</small>
            </span>
            <span className="wallet-arrow">{isConnecting === "walletconnect" ? "Opening..." : "→"}</span>
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
        <span className="wallet-button-logo" style={{ background: walletVisual.accent }} aria-hidden="true">
          {wallet ? walletVisual.shortLabel : "🚀"}
        </span>
        {shortAddress}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}

async function requestLoginSignature(provider: InjectedEthereumProvider, address: string) {
  const message = [`Login to GoodMarket`, `Wallet:`, address, `Time: ${new Date().toISOString()}`].join("\n");

  await provider.request?.({ method: "personal_sign", params: [message, address] });
}

async function switchToCelo(provider: InjectedEthereumProvider) {
  try {
    await provider.request?.({ method: "wallet_switchEthereumChain", params: [{ chainId: CELO_CHAIN_ID }] });
  } catch {
    await provider.request?.({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CELO_CHAIN_ID,
          chainName: "Celo Mainnet",
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: ["https://forno.celo.org"],
          blockExplorerUrls: ["https://celoscan.io"],
        },
      ],
    });
  }
}

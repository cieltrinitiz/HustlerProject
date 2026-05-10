import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";
import "./styles.css";

export const metadata: Metadata = {
  title: "GoodMarket Learn & Earn",
  description: "GoodDollar Learn & Earn community hub",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletConnectionProvider>
          <header className="site-header">
            <a className="brand" href="/" aria-label="GoodMarket home">
              <span className="brand-mark">G$</span>
              <span>GoodMarket</span>
            </a>
            <nav className="site-nav" aria-label="Primary navigation">
              <a href="/exams">Exams</a>
              <a href="/learn-and-earn">Create</a>
            </nav>
            <ConnectWalletModal />
          </header>
          {children}
        </WalletConnectionProvider>
      </body>
    </html>
  );
}

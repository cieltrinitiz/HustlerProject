import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import "./styles.css";

export const metadata: Metadata = {
  title: "GoodLearn Quest",
  description: "GoodDollar Learn & Earn",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/" aria-label="GoodLearn Quest home">
            <span className="brand-mark">GQ</span>
            <span>GoodLearn Quest</span>
          </a>
          <ConnectWalletModal />
        </header>
        {children}
      </body>
    </html>
  );
}

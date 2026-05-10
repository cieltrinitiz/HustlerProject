"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateExamAction } from "@/components/CreateExamAction";
import { useWalletConnection } from "@/components/WalletConnectionProvider";

const rewardSteps = [
  ["Pick a quest", "Choose a short lesson that matches your current Web3 level."],
  ["Study the cards", "Learn one bite-size idea at a time before opening the quiz."],
  ["Pass the check", "Answer quick questions so rewards go to people who actually learned."],
  ["Claim G$", "Use your connected wallet to claim eligible GoodDollar rewards."],
];

const creatorSteps = [
  ["Build a lesson", "Create community-friendly learning modules with a clear reward path."],
  ["Fund rewards", "Publish a quiz and point it to a funded pool on the Celo network."],
  ["Grow learners", "Share modules with new GoodDollar users and track completion momentum."],
];

const stats = [
  ["4", "micro lessons"],
  ["G$", "reward-ready"],
  ["Celo", "gas-friendly"],
];

const modules = [
  ["G$ Basics", "Understand the mission behind GoodDollar and why community rewards matter.", "12 min", "Beginner"],
  ["Wallet Safety", "Learn practical signing, recovery, and dApp connection habits.", "9 min", "Core"],
  ["Celo Rewards", "See how Celo transactions support low-cost Learn & Earn claims.", "15 min", "Network"],
];

const tokenRows = [
  ["G$", "GoodDollar", "26,789.249 G$", "≈ $3.08"],
  ["CELO", "Celo gas", "0.3442 CELO", "For network fees"],
  ["cUSD", "Celo Dollar", "1.35 cUSD", "$1.35"],
];

const dashboardActions = [
  { icon: "⇄", label: "GoodSwap" },
  { icon: "📚", label: "Learn & Earn", href: "/learn-and-earn" },
  { icon: "📊", label: "More Ways to Earn G$" },
  { icon: "↑", label: "Send" },
  { icon: "G$", label: "Claim" },
  { icon: "🗓️", label: "Check-in" },
  { icon: "🌉", label: "Bridge" },
  { icon: "🏦", label: "Savings" },
  { icon: "🤝", label: "P2P Trade" },
];

export function HomeExperience() {
  const { wallet } = useWalletConnection();
  const [comingSoonMessage, setComingSoonMessage] = useState("");

  const shortAddress = useMemo(() => {
    if (!wallet?.address) {
      return "FF00 •••• 1A50";
    }

    return `${wallet.address.slice(2, 6).toUpperCase()} •••• ${wallet.address.slice(-4).toUpperCase()}`;
  }, [wallet?.address]);

  function showComingSoon(feature: string) {
    setComingSoonMessage(`${feature} is coming soon. Learn & Earn is available now.`);
  }

  if (wallet) {
    return (
      <main className="app-dashboard">
        {comingSoonMessage ? (
          <div className="coming-soon-toast" role="status" aria-live="polite">
            {comingSoonMessage}
          </div>
        ) : null}

        <section className="dashboard-hero">
          <div className="dashboard-topbar">
            <button className="icon-button" type="button" aria-label="Settings" onClick={() => showComingSoon("Settings")}>⚙️</button>
            <div>
              <strong>GoodMarket</strong>
              <span>Learn & Earn hub</span>
            </div>
            <div className="dashboard-icons" aria-label="Dashboard shortcuts">
              <button type="button" aria-label="Analytics" onClick={() => showComingSoon("Analytics")}>📊</button>
              <button type="button" aria-label="Home shortcut" onClick={() => showComingSoon("Home shortcut")}>🏠</button>
            </div>
          </div>

          <div className="dashboard-grid">
            <aside className="portfolio-panel">
              <div className="good-card">
                <span className="card-brand">GoodMarket</span>
                <span className="card-subtitle">GoodDollar portfolio</span>
                <span className="card-chip" aria-hidden="true" />
                <strong>{shortAddress}</strong>
                <div>
                  <span>Cardholder</span>
                  <b>{wallet.label}</b>
                </div>
                <div>
                  <span>Focus</span>
                  <b>Learn & Earn</b>
                </div>
              </div>

              <nav className="earn-menu" aria-label="Learn and earn actions">
                {dashboardActions.map(action => (
                  action.href ? (
                    <Link className="active" href={action.href} key={action.label}>
                      <span>{action.icon}</span>
                      {action.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => showComingSoon(action.label)} key={action.label}>
                      <span>{action.icon}</span>
                      {action.label}
                    </button>
                  )
                ))}
              </nav>
            </aside>

            <section className="learn-panel" id="learn-focus">
              <div className="section-heading">
                <span className="eyebrow">Connected learner</span>
                <h1>Focus on Learn & Earn.</h1>
                <p>
                  Your wallet is ready. Open the Learn & Earn page to draft an exam that follows the GoodLearnExam and reward pool contract settings.
                </p>
              </div>

              <div className="learn-tabs" role="tablist" aria-label="Dashboard tabs">
                <button className="active" type="button" onClick={() => showComingSoon("Crypto tab")}>Crypto</button>
                <button type="button" onClick={() => showComingSoon("Transactions")}>Transactions</button>
              </div>

              <div className="token-list" aria-label="Supported tokens">
                {tokenRows.map(([symbol, name, amount, helper]) => (
                  <article className="token-row" key={symbol}>
                    <span className="token-logo">{symbol.slice(0, 2)}</span>
                    <div>
                      <strong>{symbol}</strong>
                      <small>{name}</small>
                    </div>
                    <div>
                      <strong>{amount}</strong>
                      <small>{helper}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="module-section" id="learn-modules">
          <div className="section-heading compact">
            <span className="eyebrow">Modules</span>
            <h2>Choose your next reward lesson</h2>
          </div>
          <div className="grid module-grid">
            {modules.map(([title, body, time, level]) => (
              <article className="card module-card" key={title}>
                <span className="badge">{level}</span>
                <h2>{title}</h2>
                <p>{body}</p>
                <div>
                  <span>{time}</span>
                  <button className="button" type="button" onClick={() => showComingSoon(`${title} lesson`)}>Start lesson</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="hero hero-split landing-hero">
        <div className="hero-copy">
          <span className="eyebrow pill-eyebrow">Community-powered · Live on Celo</span>
          <h1><span>Earn G$.</span> Learn Web3. No experience needed.</h1>
          <p>
            A GoodDollar learning hub where curious people complete short quests, build safer wallet habits, and unlock real G$ reward opportunities.
          </p>
          <div className="actions">
            <CreateExamAction />
            <a className="button secondary dark-secondary" href="#learn-how">Explore quests</a>
          </div>
          <div className="hero-checks" aria-label="Platform highlights">
            <span>✓ Gas-friendly claims</span>
            <span>✓ Non-custodial</span>
            <span>✓ Community lessons</span>
          </div>
        </div>

        <div className="hero-panel landing-visual" aria-label="Product highlights">
          <div className="coin-orb" aria-hidden="true">G$</div>
          <div className="float-card top-card">
            <small>Total G$ prepared</small>
            <strong>2.23M G$</strong>
            <span>Learn & Earn reward pools</span>
          </div>
          <div className="float-card mid-card">
            <small>Active learners</small>
            <strong>875</strong>
            <span>Across community quests</span>
          </div>
          <div className="float-card bottom-card">
            <small>Tasks completed</small>
            <strong>102</strong>
            <span>This month</span>
          </div>
        </div>
      </section>

      <section className="info-section dark-info" id="learn-how">
        <span className="eyebrow">Learner guide</span>
        <h2>What happens before you earn?</h2>
        <p>
          Learn & Earn should feel simple: study a module, prove you understood the idea, verify you are one real learner, and claim when rewards are available.
        </p>
      </section>

      <section className="grid feature-grid">
        {rewardSteps.map(([title, body]) => (
          <article className="card feature-card dark-card" key={title}>
            <span className="badge">Reward path</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="grid feature-grid">
        {creatorSteps.map(([title, body]) => (
          <article className="card feature-card dark-card" key={title}>
            <span className="badge">Creator path</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

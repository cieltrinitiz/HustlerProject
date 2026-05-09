export const GOODDOLLAR_IDENTITY_ENVIRONMENTS = ["production", "staging", "development"] as const;

export type GoodDollarIdentityEnvironment = (typeof GOODDOLLAR_IDENTITY_ENVIRONMENTS)[number];

export type GoodDollarIdentityStatus = {
  walletAddress: string;
  isWhitelisted: boolean;
  root?: string;
  checkedAt: string;
};

export function getGoodDollarIdentityEnvironment(): GoodDollarIdentityEnvironment {
  const configured = process.env.NEXT_PUBLIC_GOODDOLLAR_IDENTITY_ENV;
  if (configured === "production" || configured === "staging" || configured === "development") {
    return configured;
  }

  return "production";
}

export function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

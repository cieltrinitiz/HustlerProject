# GoodLearn Quest

GoodDollar Learn & Earn app with Supabase content, timed quiz commitments, delayed correction, and G$ rewards.

## Flow

- Creators draft learning modules off-chain.
- Creators add questions in the UI without paying gas while editing.
- `maxParticipants` defaults to `100` and can be changed by the creator.
- Each question defaults to `30` seconds.
- Publish writes compact commitments on-chain after Submit/Publish.
- Creator pays a one-time CELO publish fee, network gas, and funds the G$ reward pool.
- Creator reveals correct answers after the correction delay, defaulting to `24` hours.
- Learners check GoodDollar Identity before reward claim.
- Learners claim `score × rewardPerCorrect`.

## Project structure

```txt
app/                         Next.js app routes and API routes
components/                  UI components
lib/supabase/                Supabase clients
lib/questions.ts             Question parsing and payload helpers
supabase/migrations/         Database schema
contracts/                   Solidity contracts
docs/architecture.md         Architecture notes
```

## Environment

```bash
cp .env.example .env.local
```

## Commands

```bash
npm run validate
npm run dev
npm run build
```

## GoodDollar Identity

`GoodDollarIdentityGate` uses `@goodsdks/citizen-sdk` to call `getWhitelistedRoot` and `generateFVLink`. `/api/identity/status` mirrors the latest check in Supabase `profiles`. Local-only identity overrides can be kept in `lib/gooddollar/identity.local.ts`, which is ignored by Git.

## Smart contracts

- `GoodLearnExam.sol` handles exam publication, question commitments, timed submissions, correction reveal, and scoring.
- `GoodLearnRewardPool.sol` handles G$ funding, claims, CELO publish fees, and unused reward refunds.

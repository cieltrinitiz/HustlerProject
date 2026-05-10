# GoodLearn Quest

GoodLearn Quest is a GoodDollar-powered Learn & Earn scaffold where creators publish learning modules, create timed quizzes, fund G$ reward pools, and let verified learners claim rewards based on correct answers.

The app uses a hybrid architecture:

- **Supabase** stores editable content, quiz metadata, identity mirrors, and submission mirrors.
- **Solidity contracts** store exam commitments, delayed correction, scores, pool funding, claims, and refunds.
- **GoodDollar Identity** gates reward-claim UX so claims are intended for verified humans.
- **Remix-friendly contracts** make Celo deployment easier when import resolution is a problem.

## Flow

### Creator

1. Draft learning module content off-chain.
2. Add questions dynamically in the UI. Question 2 appears after Question 1 is complete, and so on.
3. Set the max reward per participant, max participants, timer per question, schedule, and correction delay. The UI auto-divides the per-participant max across completed questions for the contract `rewardPerCorrect` value.
4. Click Submit/Publish.
5. Generate a question set hash and correct-answer commitment.
6. Publish the exam on-chain and pay the one-time CELO publish fee.
7. Fund the required G$ reward pool.
8. Reveal correct answers after the correction delay.

### Learner

1. Read the module.
2. Answer timed quiz questions.
3. Submit an answer commitment before the exam closes.
4. Wait for creator correction.
5. Check GoodDollar Identity status.
6. Reveal answers and claim G$ rewards based on score.

```txt
rewardPerCorrect = floor(maxRewardPerParticipant ÷ questionCount)
reward = correctAnswerCount × rewardPerCorrect
actualMaxRewardPerParticipant = questionCount × rewardPerCorrect
requiredPool = actualMaxRewardPerParticipant × maxParticipants
```

## Project structure

```txt
app/                         Next.js app routes and API routes
components/                  UI components and GoodDollar Identity gate
lib/supabase/                Supabase clients
lib/gooddollar/              GoodDollar Identity helpers
lib/questions.ts             Question parsing and canonical payload helpers
supabase/migrations/         Database schema
contracts/                   Solidity contracts
contracts/remix/             Remix-friendly deployment contracts
docs/architecture.md         Architecture notes
docs/local-identity.md       Local identity setup
docs/remix-deploy.md         Remix deployment guide
```

## Environment

```bash
cp .env.example .env.local
```

For Celo mainnet, the production G$ token address is:

```txt
0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
```

## Commands

```bash
npm run validate
npm run dev
npm run build
```

## GoodDollar Identity

`GoodDollarIdentityGate` uses `@goodsdks/citizen-sdk` to call `getWhitelistedRoot` and `generateFVLink`. `/api/identity/status` mirrors the latest check in Supabase `profiles`. GoodDollar Identity remains the verification source; Supabase is only a UX mirror.

Local-only identity overrides can be kept in `lib/gooddollar/identity.local.ts`, which is ignored by Git.

## Smart contracts

- `GoodLearnExam.sol` handles exam publication, question commitments, timed submissions, correction reveal, and scoring.
- `GoodLearnRewardPool.sol` handles G$ funding, optional-return-safe token transfers, claims, double-claim prevention, and unused reward refunds.
- `contracts/remix/GoodLearnRewardPoolRemix.sol` includes inline interfaces for Remix deployments without import errors.

## Remix deployment

See [`docs/remix-deploy.md`](docs/remix-deploy.md). Short version:

1. Deploy `GoodLearnExam.sol`.
2. Deploy `GoodLearnRewardPoolRemix.sol`.
3. Use Celo G$ token `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`.

## Current limitations

- Full wallet connection and contract-write UI are not implemented yet.
- Deployed contract addresses are not committed by default.
- Foundry unit tests still need to be added.
- Production Supabase RLS policies should be expanded before launch.

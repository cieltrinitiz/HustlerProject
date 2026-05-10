# Architecture

## Storage

| Layer | Data |
| --- | --- |
| Supabase | profiles, identity status mirrors, modules, drafts, questions, UI metadata, submission mirrors |
| GoodLearnExam.sol | exam schedule, question set hash, answer commitments, correction delay, user scores |
| GoodLearnRewardPool.sol | G$ deposits, claim accounting, unused reward refunds |

## Creator flow

1. Create module content in Supabase.
2. Fill Question 1; Question 2 appears after Question 1 is complete.
3. Keep questions as drafts while editing.
4. Set max participants, max reward per participant, timer, start/end time, and correction delay. The UI auto-divides the per-participant max across completed questions for the contract `rewardPerCorrect` value.
5. Submit/Publish.
6. Hash the question set and answer commitment.
7. Pay the publish fee and fund the G$ pool.
8. Store exam configuration and commitments on-chain.

## Learner flow

1. Study the module.
2. Answer timed questions.
3. Submit an answer commitment before the exam closes.
4. Wait for creator correction.
5. Check GoodDollar Identity status before claim.
6. Reveal answers and claim rewards.

## Reward formula

```txt
rewardPerCorrect = floor(maxRewardPerParticipant ÷ questionCount)
reward = correctAnswerCount × rewardPerCorrect
actualMaxRewardPerParticipant = questionCount × rewardPerCorrect
requiredPool = actualMaxRewardPerParticipant × maxParticipants
```

## Fee model

The publish fee is a one-time CELO platform fee. Network gas and G$ reward funding are separate.

## Identity gate

`GoodDollarIdentityGate` checks `getWhitelistedRoot` and starts Face Verification with `generateFVLink`. Supabase `profiles` stores the latest status for dashboards. `lib/gooddollar/identity.local.ts` is ignored by Git for local-only overrides.


## Remix deployment

For Remix, deploy `GoodLearnExam.sol` first and then `contracts/remix/GoodLearnRewardPoolRemix.sol`. The Remix contract keeps the ERC-20 and exam interfaces inline to avoid import-resolution errors for `contracts/interfaces/IERC20.sol` and `contracts/interfaces/IGoodLearnExam.sol`.

Use the Celo G$ token address `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` for production deployments.

# Remix deployment

Use this path when you want to deploy from Remix without configuring Foundry import paths.

## Network

- Network: Celo mainnet
- Chain ID: `42220`
- RPC: `https://forno.celo.org`
- Explorer: `https://celoscan.io`
- G$ token: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`

## Deploy `GoodLearnExam.sol`

Compile `contracts/GoodLearnExam.sol` with Solidity `0.8.24` or newer.

Constructor values:

```txt
initialTreasury = your wallet address
initialPublishFee = 1000000000000000
```

Save the deployed exam address.

## Deploy `GoodLearnRewardPoolRemix.sol`

Compile `contracts/remix/GoodLearnRewardPoolRemix.sol`. This file includes inline ERC-20 and exam interfaces so Remix does not need to resolve `contracts/interfaces/IERC20.sol` or `contracts/interfaces/IGoodLearnExam.sol` imports. In Remix, make sure the selected deploy contract is `GoodLearnRewardPoolRemix` (not either interface).

Constructor values:

```txt
goodDollarToken = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
goodLearnExam = deployed GoodLearnExam address
```

## Link the reward pool to the exam

After deploying `GoodLearnRewardPoolRemix.sol`, call `updateRewardPool` on `GoodLearnExam.sol` with the deployed reward pool address. This allows `fundExam` to lock editable exam settings at the same time the G$ pool is funded.

## Save frontend variables

```env
NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS=
NEXT_PUBLIC_GOODLEARN_REWARD_POOL_ADDRESS=
NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS=0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
```

## Creator publish flow

1. Submit the module and questions from the app.
2. Call `createExam` on `GoodLearnExam` with the generated question set hash and correct-answer commitment.
3. Optional: call `updateExamSettings` before learner submissions and before funding if you need to change `rewardPerCorrect`, `maxParticipants`, timer, schedule, or correction delay.
4. Approve the reward pool contract to spend the exact required G$ amount.
5. Call `fundExam` on `GoodLearnRewardPoolRemix`. The pool locks the exam settings, uses low-level optional-return ERC-20 calls, and verifies the contract received the full expected amount before marking the pool funded.
6. After the correction delay, call `revealCorrectAnswers` on `GoodLearnExam`.

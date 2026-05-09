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

## Deploy the reward pool

Compile `contracts/GoodLearnRewardPool.sol`. Its minimal ERC-20 and exam interfaces are inline, so Remix does not need to resolve `contracts/interfaces/IERC20.sol` or `contracts/interfaces/IGoodLearnExam.sol` imports.

If you prefer a clearly separated Remix-only copy, compile `contracts/remix/GoodLearnRewardPoolRemix.sol` instead; it has the same deployment constructor shape.

Constructor values:

```txt
goodDollarToken = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
goodLearnExam = deployed GoodLearnExam address
```

## Save frontend variables

```env
NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS=
NEXT_PUBLIC_GOODLEARN_REWARD_POOL_ADDRESS=
NEXT_PUBLIC_GOODDOLLAR_TOKEN_ADDRESS=0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
```

## Creator publish flow

1. Submit the module and questions from the app.
2. Call `createExam` on `GoodLearnExam` with the generated question set hash and correct-answer commitment.
3. Approve the reward pool contract to spend the required G$ amount.
4. Call `fundExam` on the deployed reward pool.
5. After the correction delay, call `revealCorrectAnswers` on `GoodLearnExam`.

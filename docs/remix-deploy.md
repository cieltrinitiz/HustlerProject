# Remix deploy

Use these files in Remix:

```txt
contracts/GoodLearnExam.sol
contracts/remix/GoodLearnRewardPoolRemix.sol
```

`GoodLearnRewardPoolRemix.sol` has the interfaces inside the same file, so Remix will not fetch `contracts/interfaces/*` from npm.

If Remix shows a `Fetch failed 404` import error for `contracts/interfaces/IERC20.sol`, compile `GoodLearnRewardPoolRemix.sol` instead of `GoodLearnRewardPool.sol`.

Deploy order:

1. Compile and deploy `GoodLearnExam`.
2. Copy the deployed `GoodLearnExam` address.
3. Compile and deploy `GoodLearnRewardPoolRemix`.
4. Constructor values:

```txt
goodDollarToken = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
goodLearnExam = deployed GoodLearnExam address
```

For `GoodLearnExam` constructor:

```txt
initialTreasury = your wallet address
initialPublishFee = 1000000000000000
```

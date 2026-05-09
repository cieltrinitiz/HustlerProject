// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IGoodLearnExam} from "./interfaces/IGoodLearnExam.sol";

contract GoodLearnRewardPool {
    struct Pool {
        address creator;
        uint256 requiredAmount;
        uint256 fundedAmount;
        uint256 claimedAmount;
        bool funded;
    }

    IERC20 public immutable goodDollar;
    IGoodLearnExam public immutable examContract;
    address public owner;

    mapping(uint256 examId => Pool) public pools;
    mapping(uint256 examId => mapping(address learner => bool claimed)) public claimed;

    event PoolFunded(uint256 indexed examId, address indexed creator, uint256 amount, uint256 requiredAmount);
    event RewardClaimed(uint256 indexed examId, address indexed learner, uint256 score, uint256 amount);
    event UnusedRewardsRefunded(uint256 indexed examId, address indexed creator, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address goodDollarToken, address goodLearnExam) {
        require(goodDollarToken != address(0), "G$ required");
        require(goodLearnExam != address(0), "Exam required");
        goodDollar = IERC20(goodDollarToken);
        examContract = IGoodLearnExam(goodLearnExam);
        owner = msg.sender;
    }

    function fundExam(uint256 examId) external {
        (
            address creator,
            uint256 questionCount,
            uint256 rewardPerCorrect,
            uint256 maxParticipants,
            uint256 examEndTime,
            bool corrected
        ) = examContract.getExamRewardConfig(examId);
        examEndTime;
        corrected;
        require(creator == msg.sender, "Not exam creator");
        require(!pools[examId].funded, "Already funded");

        uint256 requiredAmount = questionCount * rewardPerCorrect * maxParticipants;
        require(requiredAmount > 0, "Invalid pool");

        pools[examId] = Pool({
            creator: msg.sender,
            requiredAmount: requiredAmount,
            fundedAmount: requiredAmount,
            claimedAmount: 0,
            funded: true
        });

        require(goodDollar.transferFrom(msg.sender, address(this), requiredAmount), "G$ transfer failed");
        emit PoolFunded(examId, msg.sender, requiredAmount, requiredAmount);
    }

    function claimReward(uint256 examId) external {
        Pool storage pool = pools[examId];
        require(pool.funded, "Pool not funded");
        require(!claimed[examId][msg.sender], "Already claimed");

        (, , uint256 rewardPerCorrect, , , bool corrected) = examContract.getExamRewardConfig(examId);
        require(corrected, "Exam not corrected");

        (uint256 score, bool revealed) = examContract.getUserScore(examId, msg.sender);
        require(revealed, "Score not revealed");
        require(score > 0, "No reward");

        uint256 amount = score * rewardPerCorrect;
        require(pool.claimedAmount + amount <= pool.fundedAmount, "Pool exhausted");

        claimed[examId][msg.sender] = true;
        pool.claimedAmount += amount;

        require(goodDollar.transfer(msg.sender, amount), "Reward transfer failed");
        emit RewardClaimed(examId, msg.sender, score, amount);
    }

    function refundUnused(uint256 examId) external {
        Pool storage pool = pools[examId];
        require(pool.funded, "Pool not funded");
        require(pool.creator == msg.sender, "Not pool creator");

        (, , , , uint256 endTime, bool corrected) = examContract.getExamRewardConfig(examId);
        require(corrected || block.timestamp > endTime + 30 days, "Refund locked");

        uint256 unused = pool.fundedAmount - pool.claimedAmount;
        require(unused > 0, "No unused funds");

        pool.fundedAmount = pool.claimedAmount;
        require(goodDollar.transfer(msg.sender, unused), "Refund transfer failed");
        emit UnusedRewardsRefunded(examId, msg.sender, unused);
    }

    function recoverUnexpectedToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(goodDollar), "Cannot recover G$ rewards");
        require(to != address(0), "Recipient required");
        require(IERC20(token).transfer(to, amount), "Recover failed");
    }
}

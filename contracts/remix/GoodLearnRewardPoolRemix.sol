// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Inline ERC-20 interface for Remix deployments where relative imports can fail.
interface IERC20Remix {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Inline GoodLearnExam interface for Remix deployments where relative imports can fail.
interface IGoodLearnExamRemix {
    function getExamRewardConfig(uint256 examId)
        external
        view
        returns (
            address creator,
            uint256 questionCount,
            uint256 rewardPerCorrect,
            uint256 maxParticipants,
            uint256 endTime,
            bool corrected
        );

    function getUserScore(uint256 examId, address learner) external view returns (uint256 score, bool revealed);
}

/// @notice Remix-friendly reward pool. Deploy with the Celo G$ token and GoodLearnExam addresses.
contract GoodLearnRewardPoolRemix {
    function _safeTransfer(IERC20Remix token, address to, uint256 amount) private {
        _callOptionalReturn(token, abi.encodeWithSelector(IERC20Remix.transfer.selector, to, amount));
    }

    function _safeTransferFrom(IERC20Remix token, address from, address to, uint256 amount) private {
        _callOptionalReturn(token, abi.encodeWithSelector(IERC20Remix.transferFrom.selector, from, to, amount));
    }

    function _callOptionalReturn(IERC20Remix token, bytes memory data) private {
        require(address(token).code.length > 0, "Token has no code");

        (bool success, bytes memory returnData) = address(token).call(data);
        require(success, "Token call failed");

        if (returnData.length > 0) {
            require(abi.decode(returnData, (bool)), "Token operation failed");
        }
    }

    struct Pool {
        address creator;
        uint256 requiredAmount;
        uint256 fundedAmount;
        uint256 claimedAmount;
        bool funded;
    }

    IERC20Remix public immutable goodDollar;
    IGoodLearnExamRemix public immutable examContract;
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
        goodDollar = IERC20Remix(goodDollarToken);
        examContract = IGoodLearnExamRemix(goodLearnExam);
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

        uint256 balanceBefore = goodDollar.balanceOf(address(this));
        _safeTransferFrom(goodDollar, msg.sender, address(this), requiredAmount);
        uint256 receivedAmount = goodDollar.balanceOf(address(this)) - balanceBefore;
        require(receivedAmount == requiredAmount, "Incorrect G$ received");

        pools[examId] = Pool({
            creator: msg.sender,
            requiredAmount: requiredAmount,
            fundedAmount: receivedAmount,
            claimedAmount: 0,
            funded: true
        });
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

        _safeTransfer(goodDollar, msg.sender, amount);
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
        _safeTransfer(goodDollar, msg.sender, unused);
        emit UnusedRewardsRefunded(examId, msg.sender, unused);
    }

    function recoverUnexpectedToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(goodDollar), "Cannot recover G$ rewards");
        require(token != address(0), "Token required");
        require(to != address(0), "Recipient required");
        _safeTransfer(IERC20Remix(token), to, amount);
    }
}

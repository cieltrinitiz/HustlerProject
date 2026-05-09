// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGoodLearnExam {
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

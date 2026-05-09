// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GoodLearnExam {
    struct Exam {
        address creator;
        bytes32 moduleId;
        bytes32 questionSetHash;
        uint256 questionCount;
        uint256 rewardPerCorrect;
        uint256 maxParticipants;
        uint256 participantCount;
        uint256 timerSeconds;
        uint256 startTime;
        uint256 endTime;
        uint256 correctionUnlockTime;
        bytes32 correctAnswerCommitment;
        string revealedAnswers;
        bool corrected;
    }

    struct Submission {
        bytes32 answerCommitment;
        bool submitted;
        bool revealed;
        uint256 score;
    }

    address public owner;
    address payable public treasury;
    uint256 public publishFee;
    uint256 public nextExamId = 1;

    mapping(uint256 examId => Exam) private exams;
    mapping(uint256 examId => mapping(address learner => Submission)) private submissions;

    event ExamCreated(
        uint256 indexed examId,
        address indexed creator,
        bytes32 indexed moduleId,
        bytes32 questionSetHash,
        uint256 questionCount,
        uint256 rewardPerCorrect,
        uint256 maxParticipants,
        uint256 timerSeconds,
        uint256 startTime,
        uint256 endTime,
        uint256 correctionUnlockTime
    );
    event AnswersSubmitted(uint256 indexed examId, address indexed learner, bytes32 answerCommitment);
    event CorrectAnswersRevealed(uint256 indexed examId, string answers);
    event UserAnswersRevealed(uint256 indexed examId, address indexed learner, uint256 score);
    event PublishFeeUpdated(uint256 publishFee);
    event TreasuryUpdated(address treasury);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyExamCreator(uint256 examId) {
        require(msg.sender == exams[examId].creator, "Not exam creator");
        _;
    }

    constructor(address payable initialTreasury, uint256 initialPublishFee) {
        require(initialTreasury != address(0), "Treasury required");
        owner = msg.sender;
        treasury = initialTreasury;
        publishFee = initialPublishFee;
    }

    function createExam(
        bytes32 moduleId,
        bytes32 questionSetHash,
        uint256 questionCount,
        uint256 rewardPerCorrect,
        uint256 maxParticipants,
        uint256 timerSeconds,
        uint256 startTime,
        uint256 endTime,
        uint256 correctionDelaySeconds,
        bytes32 correctAnswerCommitment
    ) external payable returns (uint256 examId) {
        require(msg.value >= publishFee, "Insufficient publish fee");
        require(questionSetHash != bytes32(0), "Question hash required");
        require(questionCount > 0, "No questions");
        require(rewardPerCorrect > 0, "No reward");
        require(maxParticipants > 0, "No participants");
        require(timerSeconds >= 5, "Timer too short");
        require(startTime >= block.timestamp, "Invalid start");
        require(endTime > startTime, "Invalid end");
        require(correctionDelaySeconds >= 1 days, "Delay too short");
        require(correctAnswerCommitment != bytes32(0), "Answer commitment required");

        examId = nextExamId++;
        uint256 correctionUnlockTime = endTime + correctionDelaySeconds;

        exams[examId] = Exam({
            creator: msg.sender,
            moduleId: moduleId,
            questionSetHash: questionSetHash,
            questionCount: questionCount,
            rewardPerCorrect: rewardPerCorrect,
            maxParticipants: maxParticipants,
            participantCount: 0,
            timerSeconds: timerSeconds,
            startTime: startTime,
            endTime: endTime,
            correctionUnlockTime: correctionUnlockTime,
            correctAnswerCommitment: correctAnswerCommitment,
            revealedAnswers: "",
            corrected: false
        });

        emit ExamCreated(
            examId,
            msg.sender,
            moduleId,
            questionSetHash,
            questionCount,
            rewardPerCorrect,
            maxParticipants,
            timerSeconds,
            startTime,
            endTime,
            correctionUnlockTime
        );
    }

    function submitAnswers(uint256 examId, bytes32 answerCommitment) external {
        Exam storage exam = exams[examId];
        require(exam.creator != address(0), "Exam not found");
        require(block.timestamp >= exam.startTime, "Exam not started");
        require(block.timestamp <= exam.endTime, "Exam ended");
        require(exam.participantCount < exam.maxParticipants, "Exam is full");
        require(answerCommitment != bytes32(0), "Answer commitment required");
        require(!submissions[examId][msg.sender].submitted, "Already submitted");

        submissions[examId][msg.sender] = Submission({
            answerCommitment: answerCommitment,
            submitted: true,
            revealed: false,
            score: 0
        });
        exam.participantCount += 1;

        emit AnswersSubmitted(examId, msg.sender, answerCommitment);
    }

    function revealCorrectAnswers(uint256 examId, string calldata answers, bytes32 secret)
        external
        onlyExamCreator(examId)
    {
        Exam storage exam = exams[examId];
        require(block.timestamp >= exam.correctionUnlockTime, "Correction locked");
        require(!exam.corrected, "Already corrected");
        require(bytes(answers).length == exam.questionCount, "Answer count mismatch");
        require(keccak256(abi.encodePacked(answers, secret)) == exam.correctAnswerCommitment, "Invalid answer reveal");

        exam.revealedAnswers = answers;
        exam.corrected = true;

        emit CorrectAnswersRevealed(examId, answers);
    }

    function revealUserAnswers(uint256 examId, string calldata answers, bytes32 secret) external returns (uint256 score) {
        Exam storage exam = exams[examId];
        Submission storage submission = submissions[examId][msg.sender];
        require(exam.corrected, "Exam not corrected");
        require(submission.submitted, "No submission");
        require(!submission.revealed, "Already revealed");
        require(bytes(answers).length == exam.questionCount, "Answer count mismatch");
        require(keccak256(abi.encodePacked(answers, secret)) == submission.answerCommitment, "Invalid user reveal");

        bytes memory learnerAnswers = bytes(answers);
        bytes memory correctAnswers = bytes(exam.revealedAnswers);

        for (uint256 index = 0; index < exam.questionCount; index++) {
            if (learnerAnswers[index] == correctAnswers[index]) {
                score += 1;
            }
        }

        submission.score = score;
        submission.revealed = true;

        emit UserAnswersRevealed(examId, msg.sender, score);
    }

    function getExam(uint256 examId) external view returns (Exam memory) {
        require(exams[examId].creator != address(0), "Exam not found");
        return exams[examId];
    }

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
        )
    {
        Exam storage exam = exams[examId];
        require(exam.creator != address(0), "Exam not found");
        return (
            exam.creator,
            exam.questionCount,
            exam.rewardPerCorrect,
            exam.maxParticipants,
            exam.endTime,
            exam.corrected
        );
    }

    function getUserScore(uint256 examId, address learner) external view returns (uint256 score, bool revealed) {
        Submission storage submission = submissions[examId][learner];
        return (submission.score, submission.revealed);
    }

    function updatePublishFee(uint256 newPublishFee) external onlyOwner {
        publishFee = newPublishFee;
        emit PublishFeeUpdated(newPublishFee);
    }

    function updateTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury required");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function withdrawPublishFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees");
        (bool success,) = treasury.call{value: balance}("");
        require(success, "Fee withdrawal failed");
    }
}

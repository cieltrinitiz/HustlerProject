"use client";

import { useEffect, useMemo, useState } from "react";
import { encodePacked, keccak256, toBytes, toHex, type Hex } from "viem";
import { getInjectedProvider, parseFirstAccount, useWalletConnection } from "@/components/WalletConnectionProvider";
import { CELO_CHAIN_ID, GOODLEARN_EXAM_ADDRESS, getSubmitAnswersData } from "@/lib/goodlearnExam";

export type LearnerQuestion = {
  questionIndex: number;
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
};

type ExamTakeActionProps = {
  examId: string;
  questionSetHash: string;
  status: "upcoming" | "active" | "ended" | "corrected";
  timerSeconds: number;
  initialQuestions: LearnerQuestion[];
};

const CHOICES = ["A", "B", "C", "D"] as const;

export function ExamTakeAction({ examId, questionSetHash, status, timerSeconds, initialQuestions }: ExamTakeActionProps) {
  const { wallet } = useWalletConnection();
  const [questions, setQuestions] = useState<LearnerQuestion[]>(initialQuestions);
  const [isStarted, setIsStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(timerSeconds * Math.max(1, initialQuestions.length));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialQuestions.length > 0 || typeof window === "undefined") {
      return;
    }

    const cached = window.localStorage.getItem(`goodlearn.exam.${questionSetHash}`) || window.localStorage.getItem(`goodlearn.exam.${window.localStorage.getItem(`goodlearn.examId.${examId}`)}`);
    if (!cached) {
      return;
    }

    try {
      const parsed = JSON.parse(cached) as { questions?: Array<{ id?: number; prompt: string; choiceA: string; choiceB: string; choiceC: string; choiceD: string }> };
      setQuestions((parsed.questions ?? []).map((question, index) => ({
        questionIndex: question.id ?? index + 1,
        prompt: question.prompt,
        choiceA: question.choiceA,
        choiceB: question.choiceB,
        choiceC: question.choiceC,
        choiceD: question.choiceD,
      })));
    } catch {
      setMessage("Saved learner questions could not be opened from this browser cache.");
    }
  }, [examId, initialQuestions.length, questionSetHash]);

  useEffect(() => {
    if (!isStarted || isSubmitting || secondsLeft <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => setSecondsLeft(current => current - 1), 1_000);
    return () => window.clearTimeout(timeout);
  }, [isStarted, isSubmitting, secondsLeft]);

  const answerString = useMemo(
    () => questions.map(question => answers[question.questionIndex] || "").join(""),
    [answers, questions],
  );
  const isComplete = questions.length > 0 && answerString.length === questions.length;

  function startQuiz() {
    if (status !== "active") {
      setMessage(status === "upcoming" ? "This exam is not open yet. Come back during the active window." : "This exam is already closed.");
      return;
    }

    setSecondsLeft(timerSeconds * Math.max(1, questions.length));
    setIsStarted(true);
    setMessage("Quiz started. Choose one answer per question, then submit on-chain before the timer reaches zero.");
  }

  async function submitAnswers() {
    if (!wallet) {
      setMessage("Connect your wallet first so your answer commitment can be submitted on-chain.");
      return;
    }

    if (!GOODLEARN_EXAM_ADDRESS) {
      setMessage("NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS is missing, so submissions cannot be sent yet.");
      return;
    }

    if (!isComplete) {
      setMessage("Answer every question before submitting.");
      return;
    }

    const provider = getInjectedProvider();
    if (!provider?.request) {
      setMessage("No injected wallet provider was found. Open this page in your wallet browser or MetaMask.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Opening wallet for the on-chain answer commitment...");

    try {
      await switchToCelo(provider);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const signerAddress = parseFirstAccount(accounts) ?? wallet.address;
      const learnerSecret = keccak256(toBytes(`${signerAddress}:${examId}:${questionSetHash}:${Date.now()}`));
      const answerCommitment = keccak256(encodePacked(["string", "bytes32"], [answerString, learnerSecret]));
      const data = getSubmitAnswersData([BigInt(examId), answerCommitment]);
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: signerAddress, to: GOODLEARN_EXAM_ADDRESS, data, gas: toHex(180_000n) }],
      });

      window.localStorage.setItem(`goodlearn.submission.${examId}.${signerAddress.toLowerCase()}`, JSON.stringify({
        examId,
        questionSetHash,
        answers: answerString,
        learnerSecret,
        answerCommitment,
        txHash,
      }));
      setMessage(`Submitted on-chain. Save this browser/session for reveal later. Transaction: ${String(txHash)}`);
      setIsStarted(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet rejected or failed to submit answers.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="exam-take-panel unavailable" role="status">
        <strong>Quiz content unavailable</strong>
        <span>The on-chain hash exists, but learner questions were not saved in Supabase or this browser cache yet.</span>
      </div>
    );
  }

  return (
    <div className="exam-take-panel">
      {!isStarted ? (
        <button className="button start-quiz-button" disabled={status !== "active"} onClick={startQuiz} type="button">
          {status === "active" ? "Start quiz" : status === "upcoming" ? "Quiz opens soon" : "Quiz closed"}
        </button>
      ) : (
        <div className="quiz-runner">
          <div className="quiz-runner-heading">
            <strong>{secondsLeft}s left</strong>
            <span>{questions.length} questions</span>
          </div>
          {questions.map(question => (
            <fieldset className="learner-question" key={question.questionIndex} disabled={isSubmitting || secondsLeft <= 0}>
              <legend>Question {question.questionIndex}</legend>
              <p>{question.prompt}</p>
              {CHOICES.map(choice => (
                <label className="choice-row" key={choice}>
                  <input
                    checked={answers[question.questionIndex] === choice}
                    name={`exam-${examId}-question-${question.questionIndex}`}
                    onChange={() => setAnswers(current => ({ ...current, [question.questionIndex]: choice }))}
                    type="radio"
                  />
                  <span>{choice}. {question[`choice${choice}` as keyof LearnerQuestion]}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <button className="button start-quiz-button" disabled={!isComplete || isSubmitting || secondsLeft <= 0} onClick={submitAnswers} type="button">
            {isSubmitting ? "Submitting..." : "Submit answers on-chain"}
          </button>
        </div>
      )}
      {message ? <p className="wallet-message publish-status" role="status">{message}</p> : null}
    </div>
  );
}

async function switchToCelo(provider: NonNullable<ReturnType<typeof getInjectedProvider>>) {
  try {
    await provider.request?.({ method: "wallet_switchEthereumChain", params: [{ chainId: CELO_CHAIN_ID }] });
  } catch {
    await provider.request?.({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CELO_CHAIN_ID,
        chainName: "Celo",
        nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
        rpcUrls: ["https://forno.celo.org"],
        blockExplorerUrls: ["https://celoscan.io"],
      }],
    });
  }
}

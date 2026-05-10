"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, keccak256, toBytes, toHex, type Hex } from "viem";
import { getInjectedProvider, parseFirstAccount, useWalletConnection, type EthereumProvider } from "@/components/WalletConnectionProvider";
import { buildQuestionSetHashInput, type DraftQuestion } from "@/lib/questions";

const emptyQuestion = (id: number): DraftQuestion => ({
  id,
  prompt: "",
  choiceA: "",
  choiceB: "",
  choiceC: "",
  choiceD: "",
  correctAnswer: "A",
});

const DEFAULT_MAX_REWARD_PER_LEARNER = 1000;
const CELO_CHAIN_ID = "0xa4ec";
const GOODLEARN_EXAM_ADDRESS = process.env.NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS as Hex | undefined;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

const isComplete = (question: DraftQuestion) =>
  question.prompt.trim() !== "" &&
  question.choiceA.trim() !== "" &&
  question.choiceB.trim() !== "" &&
  question.choiceC.trim() !== "" &&
  question.choiceD.trim() !== "";

const formatUnit = (value: number, unit: string) => `${value.toLocaleString()} ${unit}${value === 1 ? "" : "s"}`;

const goodLearnExamAbi = [
  {
    type: "function",
    name: "publishFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "createExam",
    stateMutability: "payable",
    inputs: [
      { name: "moduleId", type: "bytes32" },
      { name: "questionSetHash", type: "bytes32" },
      { name: "questionCount", type: "uint256" },
      { name: "rewardPerCorrect", type: "uint256" },
      { name: "maxParticipants", type: "uint256" },
      { name: "timerSeconds", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "correctionDelaySeconds", type: "uint256" },
      { name: "correctAnswerCommitment", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function QuestionBuilder() {
  const { wallet } = useWalletConnection();
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion(1)]);
  const [moduleKey, setModuleKey] = useState("goodmarket-gs-basics");
  const [maxRewardPerLearner, setMaxRewardPerLearner] = useState(DEFAULT_MAX_REWARD_PER_LEARNER);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [timerSecondsInput, setTimerSecondsInput] = useState(60);
  const [startDelayHours, setStartDelayHours] = useState(1);
  const [durationDays, setDurationDays] = useState(7);
  const [correctionDelayDays, setCorrectionDelayDays] = useState(1);
  const [answerSecret, setAnswerSecret] = useState("goodmarket-secret");
  const [publishStatus, setPublishStatus] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const completedQuestions = questions.filter(isComplete);
  const correctAnswers = completedQuestions.map(question => question.correctAnswer).join("");
  const rewardPerCorrect = completedQuestions.length > 0 ? Math.floor(maxRewardPerLearner / completedQuestions.length) : 0;
  const perLearnerMaxReward = completedQuestions.length * rewardPerCorrect;
  const unusedRewardRemainder = maxRewardPerLearner - perLearnerMaxReward;
  const requiredPool = perLearnerMaxReward * maxParticipants;
  const activeQuestionIndex = questions.findIndex(question => !isComplete(question));
  const activeQuestion = activeQuestionIndex >= 0 ? questions[activeQuestionIndex] : questions[questions.length - 1];

  const safeTimerSeconds = Math.max(1, timerSecondsInput || 1);
  const safeStartDelayHours = Math.max(0, startDelayHours || 0);
  const safeDurationDays = Math.max(1, durationDays || 1);
  const safeCorrectionDelayDays = Math.max(1, correctionDelayDays || 1);
  const timerSeconds = safeTimerSeconds;
  const startDelaySeconds = safeStartDelayHours * SECONDS_PER_HOUR;
  const examDurationSeconds = safeDurationDays * SECONDS_PER_DAY;
  const correctionDelaySeconds = safeCorrectionDelayDays * SECONDS_PER_DAY;

  const previewPayload = useMemo(
    () => buildQuestionSetHashInput(completedQuestions, timerSeconds),
    [completedQuestions, timerSeconds],
  );
  const moduleId = useMemo(
    () => keccak256(toBytes(moduleKey.trim() || "goodmarket-module")),
    [moduleKey],
  );
  const questionSetHash = useMemo(
    () => (completedQuestions.length > 0 ? keccak256(toBytes(previewPayload)) : "Waiting for completed questions"),
    [completedQuestions.length, previewPayload],
  );
  const correctAnswerCommitment = useMemo(
    () => (correctAnswers && answerSecret.trim() ? keccak256(toBytes(`${correctAnswers}:${answerSecret.trim()}`)) : "Waiting for answers and secret"),
    [answerSecret, correctAnswers],
  );

  async function handlePublish() {
    if (!wallet) {
      setPublishStatus("Connect your wallet first so the contract transaction can be signed.");
      return;
    }

    if (!GOODLEARN_EXAM_ADDRESS) {
      setPublishStatus("NEXT_PUBLIC_GOODLEARN_EXAM_ADDRESS is missing. Add the deployed GoodLearnExam address before publishing.");
      return;
    }

    if (completedQuestions.length === 0 || rewardPerCorrect <= 0 || !answerSecret.trim()) {
      setPublishStatus("Complete at least one question, keep rewards above zero, and keep the answer secret before publishing.");
      return;
    }

    const provider = getInjectedProvider();
    if (!provider?.request) {
      setPublishStatus("No injected wallet provider was found. Open this page in GoodWallet, MetaMask, MiniPay, Trust Wallet, or another injected wallet browser.");
      return;
    }

    setIsPublishing(true);
    setPublishStatus("Opening wallet. Please approve the GoodLearnExam createExam transaction.");

    try {
      await switchToCelo(provider);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const signerAddress = parseFirstAccount(accounts) ?? wallet.address;

      const now = Math.floor(Date.now() / 1000);
      const startTime = BigInt(now + startDelaySeconds);
      const endTime = BigInt(now + startDelaySeconds + examDurationSeconds);
      const publishFee = await readPublishFee(provider, GOODLEARN_EXAM_ADDRESS);
      const data = encodeFunctionData({
        abi: goodLearnExamAbi,
        functionName: "createExam",
        args: [
          moduleId,
          questionSetHash as Hex,
          BigInt(completedQuestions.length),
          BigInt(rewardPerCorrect),
          BigInt(maxParticipants),
          BigInt(timerSeconds),
          startTime,
          endTime,
          BigInt(correctionDelaySeconds),
          correctAnswerCommitment as Hex,
        ],
      });

      const transactionHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: signerAddress,
          to: GOODLEARN_EXAM_ADDRESS,
          data,
          value: toHex(publishFee),
        }],
      });

      void fetch("/api/publish-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          creatorWallet: signerAddress,
          contractExamId: typeof transactionHash === "string" ? transactionHash : undefined,
          questionSetHash,
          questionCount: completedQuestions.length,
          rewardPerCorrect: String(rewardPerCorrect),
          maxParticipants,
          timerSeconds,
        }),
      }).catch(() => undefined);

      setPublishStatus(`Publish transaction submitted: ${String(transactionHash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet rejected or failed to send the publish transaction.";
      setPublishStatus(message);
    } finally {
      setIsPublishing(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions(current => {
      const next = current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      );
      const last = next[next.length - 1];
      if (isComplete(last)) {
        next.push(emptyQuestion(next.length + 1));
      }
      return next;
    });
  }

  return (
    <div className="builder-layout creator-workspace">
      <section className="form builder-form creator-form">
        <div className="builder-section-heading">
          <span className="badge">Creator controls</span>
          <div>
            <h2>Set up the exam details</h2>
            <p>Set the learner timer directly in seconds so every question uses the exact contract-ready countdown.</p>
          </div>
        </div>

        <fieldset className="settings-card elevated-card">
          <legend>Exam settings</legend>
          <div className="settings-grid">
            <label className="wide-field">
              <span>Module key / slug</span>
              <input placeholder="goodmarket-gs-basics" value={moduleKey} onChange={event => setModuleKey(event.target.value)} />
            </label>
            <label>
              <span>Max reward per participant</span>
              <div className="input-with-suffix">
                <input min={1} type="number" value={maxRewardPerLearner} onChange={event => setMaxRewardPerLearner(Number(event.target.value))} />
                <small>G$</small>
              </div>
            </label>
            <label>
              <span>Max participants</span>
              <input min={1} type="number" value={maxParticipants} onChange={event => setMaxParticipants(Number(event.target.value))} />
            </label>
            <label>
              <span>Timer per question</span>
              <div className="input-with-suffix">
                <input min={1} type="number" value={timerSecondsInput} onChange={event => setTimerSecondsInput(Number(event.target.value))} />
                <small>sec</small>
              </div>
            </label>
            <label>
              <span>Start delay</span>
              <div className="input-with-suffix">
                <input min={0} type="number" value={startDelayHours} onChange={event => setStartDelayHours(Number(event.target.value))} />
                <small>hr</small>
              </div>
            </label>
            <label>
              <span>Exam duration</span>
              <div className="input-with-suffix">
                <input min={1} type="number" value={durationDays} onChange={event => setDurationDays(Number(event.target.value))} />
                <small>day</small>
              </div>
            </label>
            <label>
              <span>Correction delay</span>
              <div className="input-with-suffix">
                <input min={1} type="number" value={correctionDelayDays} onChange={event => setCorrectionDelayDays(Number(event.target.value))} />
                <small>day</small>
              </div>
            </label>
            <label className="wide-field">
              <span>Answer reveal secret</span>
              <input placeholder="Keep this private until reveal" value={answerSecret} onChange={event => setAnswerSecret(event.target.value)} />
            </label>
          </div>
        </fieldset>

        <div className="builder-section-heading compact-heading">
          <span className="badge">Question set</span>
          <div>
            <h2>Build learner questions</h2>
            <p>Only the active question stays visible. After it is complete, it disappears and the next question appears automatically.</p>
          </div>
        </div>

        {activeQuestion ? (
          <fieldset className="question-card elevated-card" key={activeQuestion.id}>
            <legend>Question {activeQuestion.id}</legend>
            <div className="question-card-heading">
              <span>Active question</span>
              <strong>{activeQuestion.correctAnswer}</strong>
            </div>
            <label>
              <span>Prompt</span>
              <textarea placeholder="Ask one clear question..." value={activeQuestion.prompt} onChange={event => updateQuestion(activeQuestionIndex, { prompt: event.target.value })} />
            </label>
            <div className="grid compact-grid answer-grid">
              <label><span>Choice A</span><input placeholder="First answer" value={activeQuestion.choiceA} onChange={event => updateQuestion(activeQuestionIndex, { choiceA: event.target.value })} /></label>
              <label><span>Choice B</span><input placeholder="Second answer" value={activeQuestion.choiceB} onChange={event => updateQuestion(activeQuestionIndex, { choiceB: event.target.value })} /></label>
              <label><span>Choice C</span><input placeholder="Third answer" value={activeQuestion.choiceC} onChange={event => updateQuestion(activeQuestionIndex, { choiceC: event.target.value })} /></label>
              <label><span>Choice D</span><input placeholder="Fourth answer" value={activeQuestion.choiceD} onChange={event => updateQuestion(activeQuestionIndex, { choiceD: event.target.value })} /></label>
            </div>
            <label className="correct-answer-field">
              <span>Correct answer</span>
              <select value={activeQuestion.correctAnswer} onChange={event => updateQuestion(activeQuestionIndex, { correctAnswer: event.target.value as DraftQuestion["correctAnswer"] })}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
          </fieldset>
        ) : null}
      </section>

      <aside className="card summary publish-panel creator-summary-panel">
        <div className="publish-panel-heading">
          <span className="badge">Ready to publish</span>
          <h2>Exam summary</h2>
          <p>Human-friendly settings with contract values prepared for the on-chain call.</p>
        </div>
        <div className="summary-metrics">
          <div>
            <span>Questions</span>
            <strong>{completedQuestions.length}</strong>
          </div>
          <div>
            <span>Pool needed</span>
            <strong>{requiredPool.toLocaleString()} G$</strong>
          </div>
        </div>
        <div className="summary-list polished-summary-list">
          <p><strong>{maxRewardPerLearner.toLocaleString()} G$</strong><span>target reward per participant</span></p>
          <p><strong>{rewardPerCorrect.toLocaleString()} G$</strong><span>reward per correct answer</span></p>
          <p><strong>{maxParticipants.toLocaleString()}</strong><span>max participants</span></p>
          <p><strong>{perLearnerMaxReward.toLocaleString()} G$</strong><span>actual max payout per learner</span></p>
          {unusedRewardRemainder > 0 && <p><strong>{unusedRewardRemainder.toLocaleString()} G$</strong><span>undistributed remainder</span></p>}
          <p><strong>{formatUnit(safeTimerSeconds, "second")}</strong><span>timer per question</span></p>
          <p><strong>{formatUnit(safeStartDelayHours, "hour")}</strong><span>start delay</span></p>
          <p><strong>{formatUnit(safeDurationDays, "day")}</strong><span>exam duration</span></p>
          <p><strong>{formatUnit(safeCorrectionDelayDays, "day")}</strong><span>correction delay</span></p>
        </div>
        <div className="contract-values">
          <span>Contract-ready timing</span>
          <code>timerSeconds={timerSeconds.toLocaleString()} · startDelay={startDelaySeconds.toLocaleString()} · duration={examDurationSeconds.toLocaleString()} · correctionDelay={correctionDelaySeconds.toLocaleString()}</code>
        </div>
        <div className="hash-preview">
          <span>moduleId</span>
          <code>{moduleId}</code>
        </div>
        <div className="hash-preview">
          <span>questionSetHash</span>
          <code>{questionSetHash}</code>
        </div>
        <div className="hash-preview">
          <span>correctAnswerCommitment</span>
          <code>{correctAnswerCommitment}</code>
        </div>
        <p className="muted">Set the target max reward per participant and the app auto-divides it across completed questions for the contract rewardPerCorrect input. Funding locks the final settings on-chain.</p>
        {publishStatus ? <p className="wallet-message publish-status" role="status">{publishStatus}</p> : null}
        <button className="button publish-button" disabled={completedQuestions.length === 0 || isPublishing} onClick={handlePublish} type="button">
          {isPublishing ? "Publishing..." : "Submit and publish"}
        </button>
      </aside>
    </div>
  );
}

async function readPublishFee(provider: EthereumProvider, contractAddress: Hex) {
  const data = encodeFunctionData({ abi: goodLearnExamAbi, functionName: "publishFee" });
  const result = await provider.request?.({
    method: "eth_call",
    params: [{ to: contractAddress, data }, "latest"],
  });

  return typeof result === "string" && result !== "0x" ? BigInt(result) : 0n;
}

async function switchToCelo(provider: EthereumProvider) {
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

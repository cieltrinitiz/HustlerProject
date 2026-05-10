"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { keccak256, toBytes, toHex, type Hex } from "viem";
import { getInjectedProvider, parseFirstAccount, useWalletConnection, type EthereumProvider } from "@/components/WalletConnectionProvider";
import { buildQuestionSetHashInput, type DraftQuestion } from "@/lib/questions";
import { CELO_CHAIN_ID, GOODLEARN_EXAM_ADDRESS, decodeExamCreatedLog, getCreateExamData, getPublishFeeData } from "@/lib/goodlearnExam";

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
const MIN_CONTRACT_TIMER_SECONDS = 5;
const GAS_LIMIT_BUFFER_PERCENT = 20n;
const MIN_START_DELAY_SECONDS = 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

const isComplete = (question: DraftQuestion) =>
  question.prompt.trim() !== "" &&
  question.choiceA.trim() !== "" &&
  question.choiceB.trim() !== "" &&
  question.choiceC.trim() !== "" &&
  question.choiceD.trim() !== "";

const formatUnit = (value: number, unit: string) => `${value.toLocaleString()} ${unit}${value === 1 ? "" : "s"}`;
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
  const [publishedExam, setPublishedExam] = useState<{ transactionHash: string; onChainExamId?: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const completedQuestions = questions.filter(isComplete);
  const correctAnswers = completedQuestions.map(question => question.correctAnswer).join("");
  const rewardPerCorrect = completedQuestions.length > 0 ? Math.floor(maxRewardPerLearner / completedQuestions.length) : 0;
  const perLearnerMaxReward = completedQuestions.length * rewardPerCorrect;
  const unusedRewardRemainder = maxRewardPerLearner - perLearnerMaxReward;
  const requiredPool = perLearnerMaxReward * maxParticipants;
  const safeTimerSeconds = Math.max(MIN_CONTRACT_TIMER_SECONDS, timerSecondsInput || MIN_CONTRACT_TIMER_SECONDS);
  const safeStartDelayHours = Math.max(0, startDelayHours || 0);
  const safeDurationDays = Math.max(1, durationDays || 1);
  const safeCorrectionDelayDays = Math.max(1, correctionDelayDays || 1);
  const timerSeconds = safeTimerSeconds;
  const startDelaySeconds = Math.max(MIN_START_DELAY_SECONDS, safeStartDelayHours * SECONDS_PER_HOUR);
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
    if (publishedExam) {
      setPublishStatus("This exam is already published in this session. Open the exams page instead of submitting another wallet transaction.");
      return;
    }

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
    setPublishStatus("Opening wallet. MetaMask will show the contract publish fee plus a separate Celo gas/network fee. Add more CELO if the wallet says the network fee is unavailable.");

    try {
      await switchToCelo(provider);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const signerAddress = parseFirstAccount(accounts) ?? wallet.address;

      const now = Math.floor(Date.now() / 1000);
      const startTime = BigInt(now + startDelaySeconds);
      const endTime = BigInt(now + startDelaySeconds + examDurationSeconds);
      const publishFee = await readPublishFee(provider, GOODLEARN_EXAM_ADDRESS);
      setPublishStatus(`Confirm in MetaMask: ${formatCeloAmount(publishFee)} publish fee plus a separate Celo gas/network fee. The gas fee can vary, so your wallet may require more CELO than the publish fee alone.`);
      const data = getCreateExamData([
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
      ]);
      const transactionRequest = {
        from: signerAddress,
        to: GOODLEARN_EXAM_ADDRESS,
        data,
        value: toHex(publishFee),
      };
      setPublishStatus(`Checking Celo gas before opening MetaMask: ${formatCeloAmount(publishFee)} publish fee plus network gas.`);
      const gasLimit = await estimatePublishGas(provider, transactionRequest);
      const gasPrice = await readGasPrice(provider);
      await assertEnoughCeloForPublish(provider, signerAddress, publishFee, gasLimit, gasPrice);
      setPublishStatus(`Confirm in MetaMask: ${formatCeloAmount(publishFee)} publish fee plus about ${formatCeloAmount(gasLimit * gasPrice)} reserved for Celo network gas.`);
      const transactionHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ ...transactionRequest, gas: toHex(gasLimit) }],
      });
      const transactionHashText = String(transactionHash);
      setPublishedExam({ transactionHash: transactionHashText });
      setPublishStatus(`Exam publish transaction submitted. Waiting for the on-chain ExamCreated event: ${transactionHashText}`);
      const onChainExamId = await waitForCreatedExamId(provider, transactionHashText as Hex, GOODLEARN_EXAM_ADDRESS);
      setPublishedExam({ transactionHash: transactionHashText, onChainExamId });
      setPublishStatus(onChainExamId ? `Exam #${onChainExamId} published on-chain and is ready in the on-chain exam list.` : `Exam publish transaction is on-chain. Open the on-chain exam list after the RPC indexes the ExamCreated event. Transaction: ${transactionHashText}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet rejected or failed to send the publish transaction.";
      setPublishStatus(message);
    } finally {
      setIsPublishing(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions(current =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  function addQuestion() {
    setQuestions(current => [...current, emptyQuestion(current.length + 1)]);
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
                <input min={MIN_CONTRACT_TIMER_SECONDS} type="number" value={timerSecondsInput} onChange={event => setTimerSecondsInput(Number(event.target.value))} />
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
            <p>Creator mode keeps every question visible while you type. Use Add another question when you are ready for the next item.</p>
          </div>
        </div>

        <div className="question-list">
          {questions.map((question, questionIndex) => {
            const questionComplete = isComplete(question);

            return (
              <fieldset className={`question-card elevated-card${questionComplete ? " complete" : ""}`} key={question.id}>
                <legend>Question {question.id}</legend>
                <div className="question-card-heading">
                  <span>{questionComplete ? "Complete question" : "Draft question"}</span>
                  <strong>{question.correctAnswer}</strong>
                </div>
                <label>
                  <span>Prompt</span>
                  <textarea placeholder="Ask one clear question..." value={question.prompt} onChange={event => updateQuestion(questionIndex, { prompt: event.target.value })} />
                </label>
                <div className="grid compact-grid answer-grid">
                  <label><span>Choice A</span><input placeholder="First answer" value={question.choiceA} onChange={event => updateQuestion(questionIndex, { choiceA: event.target.value })} /></label>
                  <label><span>Choice B</span><input placeholder="Second answer" value={question.choiceB} onChange={event => updateQuestion(questionIndex, { choiceB: event.target.value })} /></label>
                  <label><span>Choice C</span><input placeholder="Third answer" value={question.choiceC} onChange={event => updateQuestion(questionIndex, { choiceC: event.target.value })} /></label>
                  <label><span>Choice D</span><input placeholder="Fourth answer" value={question.choiceD} onChange={event => updateQuestion(questionIndex, { choiceD: event.target.value })} /></label>
                </div>
                <label className="correct-answer-field">
                  <span>Correct answer</span>
                  <select value={question.correctAnswer} onChange={event => updateQuestion(questionIndex, { correctAnswer: event.target.value as DraftQuestion["correctAnswer"] })}>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>
              </fieldset>
            );
          })}
        </div>

        <button className="button secondary add-question-button" onClick={addQuestion} type="button">
          Add another question
        </button>
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
        <p className="muted">Publishing opens MetaMask for the on-chain createExam call. Keep enough CELO for the contract publish fee plus the separate Celo gas/network fee shown by your wallet; this extra wallet fee can vary and may be roughly $0.10 worth of CELO depending on current network conditions.</p>
        {publishStatus ? <p className="wallet-message publish-status" role="status">{publishStatus}</p> : null}
        {publishedExam ? (
          <div className="published-exam-card" role="status">
            <span className="badge">Published</span>
            <h3>Exam is already on-chain</h3>
            <p>The publish button is hidden now so you do not accidentally sign again and pay another gas fee. The contract is the source of truth for the exam settings, question hash, answer commitment, and exam ID.</p>
            {publishedExam.onChainExamId ? <code>On-chain exam #{publishedExam.onChainExamId}</code> : null}
            <code>{publishedExam.transactionHash}</code>
            <div className="published-exam-actions">
              <Link className="button" href="/exams">Open exam list</Link>
            </div>
          </div>
        ) : (
          <button className="button publish-button" disabled={completedQuestions.length === 0 || isPublishing} onClick={handlePublish} type="button">
            {isPublishing ? "Publishing..." : "Submit and publish"}
          </button>
        )}
      </aside>
    </div>
  );
}

type TransactionReceiptLog = {
  address?: string;
  data?: Hex;
  topics?: Hex[];
};

type TransactionReceipt = {
  logs?: TransactionReceiptLog[];
};

async function waitForCreatedExamId(provider: EthereumProvider, transactionHash: Hex, contractAddress: Hex) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const receipt = await provider.request?.({ method: "eth_getTransactionReceipt", params: [transactionHash] }) as TransactionReceipt | null | undefined;

    for (const log of receipt?.logs ?? []) {
      if (log.address?.toLowerCase() !== contractAddress.toLowerCase() || !log.data || !log.topics) {
        continue;
      }

      try {
        const event = decodeExamCreatedLog(log.data, log.topics as [Hex, ...Hex[]]);
        if (event.eventName === "ExamCreated") {
          return event.args.examId.toString();
        }
      } catch {
        // Ignore non-GoodLearnExam logs in the receipt.
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2_000));
  }

  return undefined;
}

function formatCeloAmount(value: bigint) {
  const celoDecimals = 18n;
  const base = 10n ** celoDecimals;
  const whole = value / base;
  const fraction = value % base;

  if (fraction === 0n) {
    return `${whole.toString()} CELO`;
  }

  const trimmedFraction = fraction.toString().padStart(Number(celoDecimals), "0").replace(/0+$/, "");
  return `${whole.toString()}.${trimmedFraction} CELO`;
}

async function estimatePublishGas(provider: EthereumProvider, transactionRequest: { from: string; to: Hex; data: Hex; value: Hex }) {
  try {
    const estimatedGas = await provider.request?.({ method: "eth_estimateGas", params: [transactionRequest] });
    const gas = typeof estimatedGas === "string" ? BigInt(estimatedGas) : 0n;

    if (gas <= 0n) {
      throw new Error("Wallet could not estimate the Celo network fee for this publish transaction.");
    }

    return gas + ((gas * GAS_LIMIT_BUFFER_PERCENT) / 100n);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown gas estimation error";
    throw new Error(`Celo network fee is unavailable because the createExam transaction cannot be estimated. Check that the exam contract address is correct, your timer is at least ${MIN_CONTRACT_TIMER_SECONDS} seconds, start time is not in the past, and your wallet has enough CELO. Details: ${details}`);
  }
}

async function readGasPrice(provider: EthereumProvider) {
  const gasPrice = await provider.request?.({ method: "eth_gasPrice" });
  return typeof gasPrice === "string" ? BigInt(gasPrice) : 0n;
}

async function assertEnoughCeloForPublish(provider: EthereumProvider, signerAddress: string, publishFee: bigint, gasLimit: bigint, gasPrice: bigint) {
  const balanceResult = await provider.request?.({ method: "eth_getBalance", params: [signerAddress, "latest"] });
  const balance = typeof balanceResult === "string" ? BigInt(balanceResult) : 0n;
  const required = publishFee + (gasLimit * gasPrice);

  if (balance < required) {
    throw new Error(`Your wallet needs about ${formatCeloAmount(required)} total (${formatCeloAmount(publishFee)} publish fee + ${formatCeloAmount(gasLimit * gasPrice)} estimated Celo network fee), but only has ${formatCeloAmount(balance)}. Add CELO and publish again.`);
  }
}

async function readPublishFee(provider: EthereumProvider, contractAddress: Hex) {
  const data = getPublishFeeData();
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

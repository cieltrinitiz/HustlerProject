"use client";

import { useMemo, useState } from "react";
import { keccak256, toBytes } from "viem";
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
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

const isComplete = (question: DraftQuestion) =>
  question.prompt.trim() !== "" &&
  question.choiceA.trim() !== "" &&
  question.choiceB.trim() !== "" &&
  question.choiceC.trim() !== "" &&
  question.choiceD.trim() !== "";

const formatUnit = (value: number, unit: string) => `${value.toLocaleString()} ${unit}${value === 1 ? "" : "s"}`;

export function QuestionBuilder() {
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion(1)]);
  const [moduleKey, setModuleKey] = useState("goodmarket-gs-basics");
  const [maxRewardPerLearner, setMaxRewardPerLearner] = useState(DEFAULT_MAX_REWARD_PER_LEARNER);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [startDelayHours, setStartDelayHours] = useState(1);
  const [durationDays, setDurationDays] = useState(7);
  const [correctionDelayDays, setCorrectionDelayDays] = useState(1);
  const [answerSecret, setAnswerSecret] = useState("goodmarket-secret");

  const completedQuestions = questions.filter(isComplete);
  const correctAnswers = completedQuestions.map(question => question.correctAnswer).join("");
  const rewardPerCorrect = completedQuestions.length > 0 ? Math.floor(maxRewardPerLearner / completedQuestions.length) : 0;
  const perLearnerMaxReward = completedQuestions.length * rewardPerCorrect;
  const unusedRewardRemainder = maxRewardPerLearner - perLearnerMaxReward;
  const requiredPool = perLearnerMaxReward * maxParticipants;

  const safeTimerMinutes = Math.max(1, timerMinutes || 1);
  const safeStartDelayHours = Math.max(0, startDelayHours || 0);
  const safeDurationDays = Math.max(1, durationDays || 1);
  const safeCorrectionDelayDays = Math.max(1, correctionDelayDays || 1);
  const timerSeconds = safeTimerMinutes * SECONDS_PER_MINUTE;
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
            <p>Use friendly time units here; the app still prepares the contract-ready seconds behind the scenes.</p>
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
                <input min={1} type="number" value={timerMinutes} onChange={event => setTimerMinutes(Number(event.target.value))} />
                <small>min</small>
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
            <p>A new question appears automatically after the current card is complete.</p>
          </div>
        </div>

        {questions.map((question, index) => {
          const complete = isComplete(question);

          return (
            <fieldset className={`question-card elevated-card ${complete ? "complete" : ""}`} key={question.id}>
              <legend>Question {question.id}</legend>
              <div className="question-card-heading">
                <span>{complete ? "Complete" : "Draft"}</span>
                <strong>{question.correctAnswer}</strong>
              </div>
              <label>
                <span>Prompt</span>
                <textarea placeholder="Ask one clear question..." value={question.prompt} onChange={event => updateQuestion(index, { prompt: event.target.value })} />
              </label>
              <div className="grid compact-grid answer-grid">
                <label><span>Choice A</span><input placeholder="First answer" value={question.choiceA} onChange={event => updateQuestion(index, { choiceA: event.target.value })} /></label>
                <label><span>Choice B</span><input placeholder="Second answer" value={question.choiceB} onChange={event => updateQuestion(index, { choiceB: event.target.value })} /></label>
                <label><span>Choice C</span><input placeholder="Third answer" value={question.choiceC} onChange={event => updateQuestion(index, { choiceC: event.target.value })} /></label>
                <label><span>Choice D</span><input placeholder="Fourth answer" value={question.choiceD} onChange={event => updateQuestion(index, { choiceD: event.target.value })} /></label>
              </div>
              <label className="correct-answer-field">
                <span>Correct answer</span>
                <select value={question.correctAnswer} onChange={event => updateQuestion(index, { correctAnswer: event.target.value as DraftQuestion["correctAnswer"] })}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>
            </fieldset>
          );
        })}
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
          <p><strong>{formatUnit(safeTimerMinutes, "minute")}</strong><span>timer per question</span></p>
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
        <button className="button publish-button" disabled={completedQuestions.length === 0} type="button">
          Submit and publish
        </button>
      </aside>
    </div>
  );
}

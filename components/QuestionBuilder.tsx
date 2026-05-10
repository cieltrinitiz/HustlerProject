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

const isComplete = (question: DraftQuestion) =>
  question.prompt.trim() !== "" &&
  question.choiceA.trim() !== "" &&
  question.choiceB.trim() !== "" &&
  question.choiceC.trim() !== "" &&
  question.choiceD.trim() !== "";

export function QuestionBuilder() {
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion(1)]);
  const [moduleKey, setModuleKey] = useState("goodmarket-gs-basics");
  const [rewardPerCorrect, setRewardPerCorrect] = useState(100);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [startDelayHours, setStartDelayHours] = useState(1);
  const [durationDays, setDurationDays] = useState(7);
  const [correctionDelayDays, setCorrectionDelayDays] = useState(1);
  const [answerSecret, setAnswerSecret] = useState("goodmarket-secret");

  const completedQuestions = questions.filter(isComplete);
  const correctAnswers = completedQuestions.map(question => question.correctAnswer).join("");
  const requiredPool = completedQuestions.length * rewardPerCorrect * maxParticipants;

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
  const startDelaySeconds = Math.max(0, startDelayHours) * 60 * 60;
  const examDurationSeconds = Math.max(1, durationDays) * 24 * 60 * 60;
  const correctionDelaySeconds = Math.max(1, correctionDelayDays) * 24 * 60 * 60;

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
    <div className="builder-layout">
      <section className="form builder-form">
        <fieldset>
          <legend>Exam settings</legend>
          <div className="grid compact-grid">
            <label>
              Module key / slug
              <input placeholder="goodmarket-gs-basics" value={moduleKey} onChange={event => setModuleKey(event.target.value)} />
            </label>
            <label>
              Reward per correct answer (G$)
              <input min={1} type="number" value={rewardPerCorrect} onChange={event => setRewardPerCorrect(Number(event.target.value))} />
            </label>
            <label>
              Max participants
              <input min={1} type="number" value={maxParticipants} onChange={event => setMaxParticipants(Number(event.target.value))} />
            </label>
            <label>
              Timer per question (seconds)
              <input min={5} type="number" value={timerSeconds} onChange={event => setTimerSeconds(Number(event.target.value))} />
            </label>
            <label>
              Start delay (hours)
              <input min={0} type="number" value={startDelayHours} onChange={event => setStartDelayHours(Number(event.target.value))} />
            </label>
            <label>
              Exam duration (days)
              <input min={1} type="number" value={durationDays} onChange={event => setDurationDays(Number(event.target.value))} />
            </label>
            <label>
              Correction delay (days)
              <input min={1} type="number" value={correctionDelayDays} onChange={event => setCorrectionDelayDays(Number(event.target.value))} />
            </label>
            <label>
              Answer reveal secret
              <input placeholder="Keep this private until reveal" value={answerSecret} onChange={event => setAnswerSecret(event.target.value)} />
            </label>
          </div>
        </fieldset>

        {questions.map((question, index) => (
          <fieldset className="question-card" key={question.id}>
            <legend>Question {question.id}</legend>
            <label>
              Prompt
              <textarea placeholder="Ask one clear question..." value={question.prompt} onChange={event => updateQuestion(index, { prompt: event.target.value })} />
            </label>
            <div className="grid compact-grid">
              <label>A<input placeholder="First answer" value={question.choiceA} onChange={event => updateQuestion(index, { choiceA: event.target.value })} /></label>
              <label>B<input placeholder="Second answer" value={question.choiceB} onChange={event => updateQuestion(index, { choiceB: event.target.value })} /></label>
              <label>C<input placeholder="Third answer" value={question.choiceC} onChange={event => updateQuestion(index, { choiceC: event.target.value })} /></label>
              <label>D<input placeholder="Fourth answer" value={question.choiceD} onChange={event => updateQuestion(index, { choiceD: event.target.value })} /></label>
            </div>
            <label>
              Correct answer
              <select value={question.correctAnswer} onChange={event => updateQuestion(index, { correctAnswer: event.target.value as DraftQuestion["correctAnswer"] })}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
          </fieldset>
        ))}
      </section>

      <aside className="card summary publish-panel">
        <span className="badge">Ready to publish</span>
        <h2>Exam summary</h2>
        <div className="summary-list">
          <p><strong>{completedQuestions.length}</strong><span>questionCount</span></p>
          <p><strong>{requiredPool.toLocaleString()} G$</strong><span>GoodLearnRewardPool requiredAmount</span></p>
          <p><strong>{timerSeconds}s</strong><span>timerSeconds</span></p>
          <p><strong>{startDelaySeconds.toLocaleString()}s</strong><span>startTime offset</span></p>
          <p><strong>{examDurationSeconds.toLocaleString()}s</strong><span>endTime window</span></p>
          <p><strong>{correctionDelaySeconds.toLocaleString()}s</strong><span>correctionDelaySeconds</span></p>
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
        <p className="muted">These values mirror the createExam contract inputs. Fund the matching pool with questionCount × rewardPerCorrect × maxParticipants after publishing.</p>
        <button className="button" disabled={completedQuestions.length === 0} type="button">
          Submit and publish
        </button>
      </aside>
    </div>
  );
}

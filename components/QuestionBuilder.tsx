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
  const [rewardPerCorrect, setRewardPerCorrect] = useState(100);
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [timerSeconds, setTimerSeconds] = useState(30);

  const completedQuestions = questions.filter(isComplete);
  const requiredPool = completedQuestions.length * rewardPerCorrect * maxParticipants;

  const previewPayload = useMemo(
    () => buildQuestionSetHashInput(completedQuestions, timerSeconds),
    [completedQuestions, timerSeconds],
  );
  const questionSetHash = useMemo(
    () => (completedQuestions.length > 0 ? keccak256(toBytes(previewPayload)) : "Waiting for completed questions"),
    [completedQuestions.length, previewPayload],
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
    <div className="builder-layout">
      <section className="form builder-form">
        <fieldset>
          <legend>Exam settings</legend>
          <div className="grid compact-grid">
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
          <p><strong>{completedQuestions.length}</strong><span>Completed questions</span></p>
          <p><strong>{requiredPool.toLocaleString()} G$</strong><span>Required reward pool</span></p>
          <p><strong>{timerSeconds}s</strong><span>Timer per question</span></p>
        </div>
        <div className="hash-preview">
          <span>Question set hash</span>
          <code>{questionSetHash}</code>
        </div>
        <p className="muted">The raw canonical payload is kept behind the scenes, so creators see a clean summary instead of JSON.</p>
        <button className="button" disabled={completedQuestions.length === 0} type="button">
          Submit and publish
        </button>
      </aside>
    </div>
  );
}

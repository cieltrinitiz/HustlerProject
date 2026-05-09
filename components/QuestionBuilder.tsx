"use client";

import { useMemo, useState } from "react";
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
    <div className="grid" style={{ alignItems: "start" }}>
      <section className="form">
        <fieldset>
          <legend>Exam settings</legend>
          <div className="grid">
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
          <fieldset key={question.id}>
            <legend>Question {question.id}</legend>
            <label>
              Prompt
              <textarea value={question.prompt} onChange={event => updateQuestion(index, { prompt: event.target.value })} />
            </label>
            <div className="grid">
              <label>A<input value={question.choiceA} onChange={event => updateQuestion(index, { choiceA: event.target.value })} /></label>
              <label>B<input value={question.choiceB} onChange={event => updateQuestion(index, { choiceB: event.target.value })} /></label>
              <label>C<input value={question.choiceC} onChange={event => updateQuestion(index, { choiceC: event.target.value })} /></label>
              <label>D<input value={question.choiceD} onChange={event => updateQuestion(index, { choiceD: event.target.value })} /></label>
            </div>
            <label>
              Correct answer commitment source
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

      <aside className="card summary">
        <h2>Publish summary</h2>
        <p><strong>Completed questions:</strong> {completedQuestions.length}</p>
        <p><strong>Required reward pool:</strong> {requiredPool.toLocaleString()} G$</p>
        <p><strong>Publish fee:</strong> one-time fee set in the exam contract</p>
        <p className="muted">No gas is paid while filling fields. Contract publishing happens only after the final submit transaction.</p>
        <textarea readOnly value={previewPayload} aria-label="Canonical question payload preview" />
      </aside>
    </div>
  );
}

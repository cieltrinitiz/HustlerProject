export type AnswerChoice = "A" | "B" | "C" | "D";

export type DraftQuestion = {
  id: number;
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctAnswer: AnswerChoice;
};

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

export function buildQuestionSetHashInput(questions: DraftQuestion[], timerSeconds: number) {
  return JSON.stringify({
    timerSeconds,
    questions: questions.map(question => ({
      id: question.id,
      prompt: normalize(question.prompt),
      choices: [
        normalize(question.choiceA),
        normalize(question.choiceB),
        normalize(question.choiceC),
        normalize(question.choiceD),
      ],
    })),
  });
}

export function buildAnswerString(questions: DraftQuestion[]) {
  return questions.map(question => question.correctAnswer).join("");
}

export function parsePipeDelimitedQuestions(input: string): DraftQuestion[] {
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== "" && !line.startsWith("#"))
    .map((line, index) => {
      const [id, prompt, choiceA, choiceB, choiceC, choiceD, correctAnswer] = line.split("|").map(part => part.trim());
      if (!id || !prompt || !choiceA || !choiceB || !choiceC || !choiceD || !["A", "B", "C", "D"].includes(correctAnswer)) {
        throw new Error(`Invalid question format on line ${index + 1}`);
      }
      return {
        id: Number(id),
        prompt,
        choiceA,
        choiceB,
        choiceC,
        choiceD,
        correctAnswer: correctAnswer as AnswerChoice,
      };
    });
}

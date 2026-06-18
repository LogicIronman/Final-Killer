import type { QuestionType } from "../types.js";

export function normalizeChoice(value: string): string {
  return Array.from(new Set(value.toUpperCase().replace(/\s/g, "").split("")))
    .filter(Boolean)
    .sort()
    .join("");
}

export function normalizeJudgeAnswer(
  answer: string,
  options: Record<string, string>
): string {
  const trimmed = answer.trim();
  const upper = trimmed.toUpperCase();
  if (upper in options) {
    return upper;
  }

  const match = Object.entries(options).find(([, label]) => label.trim() === trimmed);
  return match?.[0] ?? upper;
}

export function gradeAnswer(params: {
  type: QuestionType;
  answer: string;
  correctAnswer: string;
  options: Record<string, string>;
}): { isCorrect: boolean; normalizedAnswer: string; normalizedCorrect: string } {
  const { type, answer, correctAnswer, options } = params;

  if (type === "multiple") {
    const normalizedAnswer = normalizeChoice(answer);
    const normalizedCorrect = normalizeChoice(correctAnswer);
    return {
      normalizedAnswer,
      normalizedCorrect,
      isCorrect: normalizedAnswer === normalizedCorrect
    };
  }

  if (type === "judge") {
    const normalizedAnswer = normalizeJudgeAnswer(answer, options);
    const normalizedCorrect = normalizeJudgeAnswer(correctAnswer, options);
    return {
      normalizedAnswer,
      normalizedCorrect,
      isCorrect: normalizedAnswer === normalizedCorrect
    };
  }

  const normalizedAnswer = answer.trim().toUpperCase();
  const normalizedCorrect = correctAnswer.trim().toUpperCase();
  return {
    normalizedAnswer,
    normalizedCorrect,
    isCorrect: normalizedAnswer === normalizedCorrect
  };
}

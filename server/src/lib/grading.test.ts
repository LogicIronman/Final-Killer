import assert from "node:assert/strict";
import test from "node:test";
import { gradeAnswer } from "./grading.js";

test("grades single choice answers", () => {
  const result = gradeAnswer({
    type: "single",
    answer: "b",
    correctAnswer: "B",
    options: { A: "A", B: "B" }
  });

  assert.equal(result.isCorrect, true);
});

test("grades multiple choice answers without order sensitivity", () => {
  const result = gradeAnswer({
    type: "multiple",
    answer: "BAA",
    correctAnswer: "AB",
    options: { A: "A", B: "B", C: "C" }
  });

  assert.equal(result.isCorrect, true);
  assert.equal(result.normalizedAnswer, "AB");
});

test("grades judge answers by label or key", () => {
  const labelResult = gradeAnswer({
    type: "judge",
    answer: "错",
    correctAnswer: "B",
    options: { A: "对", B: "错" }
  });

  const keyResult = gradeAnswer({
    type: "judge",
    answer: "B",
    correctAnswer: "错",
    options: { A: "对", B: "错" }
  });

  assert.equal(labelResult.isCorrect, true);
  assert.equal(keyResult.isCorrect, true);
});

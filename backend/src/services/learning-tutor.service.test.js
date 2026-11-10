import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

process.env.OCR_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.OPENAI_API_KEY = "tutor-test-key";
const [
  { nextDifficulty, requestStructuredOutput, serializeLearningSession, startTutorSession, answerTutorQuestion },
  { encryptJson },
  { default: LearningSession },
  { default: Note },
  { default: NoteOcrResult },
] = await Promise.all([
  import("./learning-tutor.service.js"),
  import("./encrypted-json.service.js"),
  import("../models/LearningSession.js"),
  import("../models/Note.js"),
  import("../models/NoteOcrResult.js"),
]);

test("the AI tutor distinguishes exhausted API quota from temporary rate limiting", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const request = {
    instructions: "Return structured data.",
    input: {},
    name: "test_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  };

  globalThis.fetch = async () => Response.json({
    error: { code: "insufficient_quota", type: "insufficient_quota" },
  }, { status: 429 });
  await assert.rejects(
    requestStructuredOutput(request),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.expose, true);
      assert.match(error.message, /no remaining quota/i);
      assert.match(error.message, /restore API billing/i);
      return true;
    },
  );

  globalThis.fetch = async () => Response.json({
    error: { code: "rate_limit_exceeded", type: "requests" },
  }, { status: 429 });
  await assert.rejects(
    requestStructuredOutput(request),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.expose, true);
      assert.match(error.message, /wait a moment/i);
      return true;
    },
  );
});

test("correct short answers raise the tutor difficulty one level at a time", () => {
  assert.equal(
    nextDifficulty({
      difficulty: "easy",
      isCorrect: true,
      questionType: "short_answer",
      mcqCorrectStreak: 0,
    }).difficulty,
    "medium",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "medium",
      isCorrect: true,
      questionType: "conceptual",
      mcqCorrectStreak: 0,
    }).difficulty,
    "hard",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "hard",
      isCorrect: true,
      questionType: "scenario",
      mcqCorrectStreak: 0,
    }).difficulty,
    "advanced",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "advanced",
      isCorrect: true,
      questionType: "scenario",
      mcqCorrectStreak: 0,
    }).difficulty,
    "advanced",
  );
});

test("one correct multiple-choice answer does not raise difficulty after a lucky guess", () => {
  assert.equal(
    nextDifficulty({
      difficulty: "easy",
      isCorrect: true,
      questionType: "mcq",
      mcqCorrectStreak: 1,
    }).difficulty,
    "easy",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "easy",
      isCorrect: true,
      questionType: "mcq",
      mcqCorrectStreak: 2,
    }).difficulty,
    "medium",
  );
});

test("incorrect answers reduce difficulty and preserve the easiest level for reinforcement", () => {
  assert.equal(
    nextDifficulty({
      difficulty: "advanced",
      isCorrect: false,
      questionType: "scenario",
      mcqCorrectStreak: 0,
    }).difficulty,
    "medium",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "hard",
      isCorrect: false,
      questionType: "short_answer",
      mcqCorrectStreak: 0,
    }).difficulty,
    "medium",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "medium",
      isCorrect: false,
      questionType: "conceptual",
      mcqCorrectStreak: 0,
    }).difficulty,
    "easy",
  );
  assert.equal(
    nextDifficulty({
      difficulty: "easy",
      isCorrect: false,
      questionType: "conceptual",
      mcqCorrectStreak: 0,
    }).difficulty,
    "easy",
  );
});

test("serialized learning sessions never expose answer keys or rubric points", () => {
  const session = {
    _id: "session-1",
    resource: "note-1",
    resourceTitle: "Python loops",
    subject: "Programming",
    topic: "Loops",
    status: "active",
    currentDifficulty: "easy",
    currentConcept: "for loops",
    correctCount: 0,
    incorrectCount: 0,
    correctStreak: 0,
    incorrectStreak: 0,
    strongConcepts: [],
    weakConcepts: [],
    conceptMastery: [],
    difficultyChanges: [],
    questions: [{
      _id: "question-1",
      question: "What does a for loop do?",
      concept: "for loops",
      difficulty: "easy",
      type: "short_answer",
      choices: [],
      answerKey: "Repeats statements over a sequence.",
      keyPoints: ["sequence", "repetition"],
      studentAnswer: "",
      isCorrect: null,
      feedback: "",
      explanation: "",
      workedExample: "",
      hintText: "",
      explainAgain: "",
      answeredAt: null,
      skipped: false,
    }],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: null,
  };
  const serialized = serializeLearningSession(session);
  assert.equal(serialized.questions[0].question, "What does a for loop do?");
  assert.equal("answerKey" in serialized.questions[0], false);
  assert.equal("keyPoints" in serialized.questions[0], false);
});

test("a note-grounded tutor session adapts after correct, incorrect, then correct answers", async () => {
  const studentId = "507f1f77bcf86cd799439011";
  const noteId = "507f1f77bcf86cd799439012";
  const note = {
    _id: noteId,
    title: "Python for loops",
    subject: "Programming",
    topic: "Loops",
    unit: "Control flow",
    description: "An introduction to Python loops.",
    publicationStatus: "published",
    visibility: "public",
    ocrStatus: "completed",
    uploadedBy: { equals: () => false },
  };
  const ocr = {
    pages: [{
      extractedText:
        "Python for loops repeat a block of statements once for each item in a sequence. " +
        "The loop variable takes the value of the current item on each iteration. " +
        "For example, for fruit in fruits: print(fruit) prints each value. The loop body is indented.",
    }],
  };
  const questions = [
    {
      question: "What does a Python for loop do?",
      concept: "Python for loops",
      type: "short_answer",
      choices: [],
      answerKey: "It repeats a block once for every item in a sequence.",
      keyPoints: ["repeats a block", "each item in a sequence"],
    },
    {
      question: "How can a for loop process each item in a list?",
      concept: "Python for loops",
      type: "scenario",
      choices: [],
      answerKey: "It visits each item in order and runs the loop body with that item.",
      keyPoints: ["each item", "loop body"],
    },
    {
      question: "What value does the loop variable hold on each iteration?",
      concept: "Python for loops",
      type: "conceptual",
      choices: [],
      answerKey: "The current item in the sequence.",
      keyPoints: ["current item", "sequence"],
    },
    {
      question: "What can you infer about the printed values in the note's fruit example?",
      concept: "Python for loops",
      type: "scenario",
      choices: [],
      answerKey: "The body prints each fruit value as the loop visits the sequence.",
      keyPoints: ["each fruit", "loop visits the sequence"],
    },
  ];
  const evaluations = [
    {
      isCorrect: true,
      feedback: "Exactly — it repeats the body for each item.",
      explanation: "The sequence provides the values for each iteration.",
      hint: "Think about what happens once for every sequence item.",
      workedExample: "",
    },
    {
      isCorrect: false,
      feedback: "Not quite. You missed how the loop reaches every item.",
      explanation: "The loop variable takes the current item on each iteration.",
      hint: "Follow the loop variable as it visits the sequence.",
      workedExample: "For each fruit in fruits, print(fruit) prints that current fruit.",
    },
    {
      isCorrect: true,
      feedback: "That's it — it holds the current item.",
      explanation: "The variable changes to the next sequence item on each iteration.",
      hint: "The loop variable represents one item at a time.",
      workedExample: "",
    },
  ];
  const outputs = [
    { name: "adaptive_tutor_question", value: questions[0] },
    { name: "adaptive_tutor_evaluation", value: evaluations[0] },
    { name: "adaptive_tutor_question", value: questions[1] },
    { name: "adaptive_tutor_evaluation", value: evaluations[1] },
    { name: "adaptive_tutor_question", value: questions[2] },
    { name: "adaptive_tutor_evaluation", value: evaluations[2] },
    { name: "adaptive_tutor_question", value: questions[3] },
  ];
  let activeSession = null;
  const originals = {
    noteFindById: Note.findById,
    ocrFindOne: NoteOcrResult.findOne,
    sessionFindOne: LearningSession.findOne,
    sessionCreate: LearningSession.create,
    fetch: globalThis.fetch,
  };
  Note.findById = async () => note;
  NoteOcrResult.findOne = () => ({
    select() { return this; },
    lean: async () => ({ encryptedResult: encryptJson(ocr) }),
  });
  LearningSession.findOne = async () => activeSession;
  LearningSession.create = async (data) => {
    activeSession = new LearningSession(data);
    activeSession.save = async () => activeSession;
    return activeSession;
  };
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const expected = outputs.shift();
    assert.equal(request.text.format.name, expected.name);
    assert.equal(request.store, false);
    return Response.json({
      output: [{
        content: [{ type: "output_text", text: JSON.stringify(expected.value) }],
      }],
    });
  };

  try {
    const student = { _id: studentId, role: "user" };
    const started = await startTutorSession({ noteId, user: student });
    assert.equal(started.session.questions[0].difficulty, "easy");
    assert.equal(started.session.questions[0].question, questions[0].question);

    const first = await answerTutorQuestion({
      sessionId: started.session.id,
      user: student,
      answer: "It repeats statements for each item.",
    });
    assert.equal(first.session.currentDifficulty, "medium");
    assert.equal(first.session.questions.at(-1).difficulty, "medium");
    assert.equal(first.session.correctCount, 1);

    const second = await answerTutorQuestion({
      sessionId: started.session.id,
      user: student,
      answer: "It just repeats one thing once.",
    });
    assert.equal(second.session.currentDifficulty, "easy");
    assert.equal(second.session.questions.at(-1).difficulty, "easy");
    assert.equal(second.session.questions.at(-2).workedExample, evaluations[1].workedExample);
    assert.deepEqual(second.session.weakConcepts, ["Python for loops"]);

    const third = await answerTutorQuestion({
      sessionId: started.session.id,
      user: student,
      answer: "It holds the current item as the loop moves through the sequence.",
    });
    assert.equal(third.session.currentDifficulty, "medium");
    assert.equal(third.session.questions.at(-1).difficulty, "medium");
    assert.equal(third.session.correctCount, 2);
    assert.equal(third.session.incorrectCount, 1);
    assert.deepEqual(outputs, []);
  } finally {
    Note.findById = originals.noteFindById;
    NoteOcrResult.findOne = originals.ocrFindOne;
    LearningSession.findOne = originals.sessionFindOne;
    LearningSession.create = originals.sessionCreate;
    globalThis.fetch = originals.fetch;
  }
});

test("the tutor refuses to invent questions when note OCR is unavailable", async () => {
  const originalFindById = Note.findById;
  const originalOcrFindOne = NoteOcrResult.findOne;
  const originalSessionFindOne = LearningSession.findOne;
  const originalFetch = globalThis.fetch;
  Note.findById = async () => ({
    _id: "507f1f77bcf86cd799439012",
    title: "Python for loops",
    subject: "Programming",
    topic: "Loops",
    description: "An introduction to Python loops.",
    publicationStatus: "published",
    visibility: "public",
    ocrStatus: "failed",
    ocrError: "Text extraction stopped because the OpenAI API account has no remaining quota. Restore API billing, then requeue this note's OCR.",
    uploadedBy: { equals: () => false },
  });
  NoteOcrResult.findOne = () => ({
    select() { return this; },
    lean: async () => null,
  });
  LearningSession.findOne = async () => null;
  globalThis.fetch = async () => {
    throw new Error("The AI provider must not be called without source text.");
  };

  try {
    const result = await startTutorSession({
      noteId: "507f1f77bcf86cd799439012",
      user: { _id: "507f1f77bcf86cd799439011", role: "user" },
    });
    assert.equal(result.available, false);
    assert.match(result.message, /OpenAI API account has no remaining quota/i);
    assert.equal("session" in result, false);
  } finally {
    Note.findById = originalFindById;
    NoteOcrResult.findOne = originalOcrFindOne;
    LearningSession.findOne = originalSessionFindOne;
    globalThis.fetch = originalFetch;
  }
});

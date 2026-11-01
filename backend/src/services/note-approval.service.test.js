import assert from "node:assert/strict";
import test from "node:test";
import { decideNoteApproval } from "./note-approval.service.js";

function report(totalVerifiableStatements, classifications, overrides = {}) {
  return {
    totalVerifiableStatements,
    issues: classifications.map((classification, index) => ({
      classification,
      confidence: index === 0 ? 0.01 : 0.99,
    })),
    pages: [{ pageNumber: 1 }],
    analysisReliable: true,
    unreadablePageCount: 0,
    ...overrides,
  };
}

test("uses confirmed errors only and approves at exactly five percent", () => {
  const decision = decideNoteApproval(
    report(20, [
      "CONFIRMED_ERROR",
      "UNCERTAIN",
      "UNCERTAIN",
      "NO_ISSUE_DETECTED",
    ]),
    5,
  );

  assert.equal(decision.decision, "APPROVED");
  assert.equal(decision.confirmedErrorCount, 1);
  assert.equal(decision.verifiableStatementCount, 20);
  assert.equal(decision.mistakePercentage, 5);
});

test("approves with warning at ten percent and rejects only above ten percent", () => {
  assert.equal(
    decideNoteApproval(
      report(20, ["CONFIRMED_ERROR", "CONFIRMED_ERROR"]),
      5,
    ).decision,
    "APPROVED_WITH_WARNING",
  );
  assert.equal(
    decideNoteApproval(
      report(100, Array.from({ length: 11 }, () => "CONFIRMED_ERROR")),
      5,
    ).decision,
    "REJECTED",
  );
  assert.equal(
    decideNoteApproval(
      report(100, Array.from({ length: 10 }, () => "CONFIRMED_ERROR")),
      5,
    ).mistakePercentage,
    10,
  );
});

test("requires human review for too few statements or unreliable analysis", () => {
  const tooFew = decideNoteApproval(
    report(4, ["CONFIRMED_ERROR"], { analysisLimitations: ["Short note"] }),
    5,
  );
  assert.equal(tooFew.decision, "NEEDS_HUMAN_REVIEW");
  assert.equal(tooFew.mistakePercentage, null);

  const unreadable = decideNoteApproval(
    report(0, [], {
      analysisReliable: false,
      unreadablePageCount: 1,
      pages: [{ pageNumber: 1 }],
    }),
    5,
  );
  assert.equal(unreadable.decision, "NEEDS_HUMAN_REVIEW");
  assert.equal(unreadable.confirmedErrorCount, 0);
  assert.equal(unreadable.mistakePercentage, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { requireRole } from "./auth.middleware.js";

test("permits only the roles explicitly authorized by a route", () => {
  let nextError;
  requireRole("student")(
    { user: { role: "student" } },
    {},
    (error) => {
      nextError = error;
    },
  );
  assert.equal(nextError, undefined);

  requireRole("admin")(
    { user: { role: "student" } },
    {},
    (error) => {
      nextError = error;
    },
  );
  assert.equal(nextError.statusCode, 403);

  requireRole("admin")({}, {}, (error) => {
    nextError = error;
  });
  assert.equal(nextError.statusCode, 403);
});

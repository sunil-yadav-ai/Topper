import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCorsOrigin } from "./env.js";

test("allows configured browser origins and their localhost loopback alias", () => {
  const allowedOrigins = ["http://localhost:5173"];
  assert.equal(isAllowedCorsOrigin("http://localhost:5173", allowedOrigins), true);
  assert.equal(isAllowedCorsOrigin("http://127.0.0.1:5173", allowedOrigins), true);
  assert.equal(isAllowedCorsOrigin("http://localhost:5174", allowedOrigins), false);
  assert.equal(isAllowedCorsOrigin("https://example.com", allowedOrigins), false);
});

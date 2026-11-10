import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCorsOrigin } from "./env.js";

test("allows configured browser origins and Vite's fallback localhost ports", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const allowedOrigins = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];
  try {
    process.env.NODE_ENV = "production";
    assert.equal(isAllowedCorsOrigin("http://localhost:5173", allowedOrigins), true);
    assert.equal(isAllowedCorsOrigin("http://127.0.0.1:5173", allowedOrigins), true);
    assert.equal(isAllowedCorsOrigin("http://localhost:5174", allowedOrigins), true);
    assert.equal(isAllowedCorsOrigin("http://127.0.0.1:5174", allowedOrigins), true);
    assert.equal(isAllowedCorsOrigin("http://localhost:5176", allowedOrigins), false);
    assert.equal(isAllowedCorsOrigin("https://example.com", allowedOrigins), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("allows Vite fallback ports in development but not production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.equal(isAllowedCorsOrigin("http://localhost:5182", ["http://localhost:5173"]), true);
    assert.equal(isAllowedCorsOrigin("http://127.0.0.1:5182", ["http://localhost:5173"]), true);
    process.env.NODE_ENV = "production";
    assert.equal(isAllowedCorsOrigin("http://localhost:5182", ["http://localhost:5173"]), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

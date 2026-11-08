import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";

process.env.JWT_SECRET = "a".repeat(64);
const [{ default: authRouter }, { errorHandler }] = await Promise.all([
  import("./auth.routes.js"),
  import("../middleware/errorHandler.js"),
]);

test("login attempts are limited independently from logout and session refresh", async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  const address = await new Promise((resolve) =>
    server.once("listening", () => resolve(server.address())),
  );
  const baseUrl = `http://127.0.0.1:${address.port}/api/auth`;

  try {
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const response = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 400);
    }

    const limitedLogin = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(limitedLogin.status, 429);

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const logout = await fetch(`${baseUrl}/logout`, { method: "POST" });
      assert.equal(logout.status, 200);

      const session = await fetch(`${baseUrl}/me`);
      assert.equal(session.status, 401);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

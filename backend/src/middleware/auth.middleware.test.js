import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET = "a".repeat(64);
const [{ requireAuth, optionalAuth, requireRole, isAdmin }, User, authService] =
  await Promise.all([
    import("./auth.middleware.js"),
    import("../models/User.js").then(({ default: model }) => model),
    import("../services/auth.service.js"),
  ]);

test("permits only the roles explicitly authorized by a route", () => {
  let nextError;
  requireRole("user")(
    { user: { role: "user" } },
    {},
    (error) => {
      nextError = error;
    },
  );
  assert.equal(nextError, undefined);

  requireRole("admin")(
    { user: { role: "user" } },
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

test("allows a JWT-authenticated user to continue without email verification", async () => {
  const user = {
    id: "student-123",
    _id: "student-123",
    authVersion: 0,
    emailVerified: false,
    isSuspended: false,
  };
  const originalFindById = User.findById;
  User.findById = () => ({ select: async () => user });

  try {
    const token = authService.signAuthToken(user);
    const request = { cookies: { [authService.authCookieName]: token } };
    let nextError;

    await requireAuth(request, {}, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(request.user, user);
  } finally {
    User.findById = originalFindById;
  }
});

test("optional authentication recognizes users without verified email", async () => {
  const user = {
    id: "student-123",
    _id: "student-123",
    authVersion: 0,
    emailVerified: false,
    isSuspended: false,
  };
  const originalFindById = User.findById;
  User.findById = () => ({ select: async () => user });

  try {
    const token = authService.signAuthToken(user);
    const request = { cookies: { [authService.authCookieName]: token } };
    let nextError;

    await optionalAuth(request, {}, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.equal(request.user, user);
  } finally {
    User.findById = originalFindById;
  }
});

test("admin authorization uses the current database role, not the token role", async () => {
  const user = {
    id: "user-123",
    _id: "user-123",
    role: "user",
    authVersion: 0,
    isSuspended: false,
  };
  const originalFindById = User.findById;
  User.findById = () => ({ select: async () => user });
  const token = authService.signAuthToken(user);

  try {
    user.role = "admin";
    const promotedRequest = {
      cookies: { [authService.authCookieName]: token },
    };
    let promotedError;
    await isAdmin(promotedRequest, {}, (error) => {
      promotedError = error;
    });
    assert.equal(promotedError, undefined);
    assert.equal(promotedRequest.user.role, "admin");

    user.role = "user";
    let demotedError;
    await isAdmin(
      { cookies: { [authService.authCookieName]: token } },
      {},
      (error) => {
        demotedError = error;
      },
    );
    assert.equal(demotedError.statusCode, 403);
  } finally {
    User.findById = originalFindById;
  }
});

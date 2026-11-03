import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET = "a".repeat(64);
const [authController, User, authService] = await Promise.all([
  import("./auth.controller.js"),
  import("../models/User.js").then(({ default: model }) => model),
  import("../services/auth.service.js"),
]);

test("registers a default user and ignores a submitted admin role", async () => {
  const originalCreate = User.create;
  const originalExists = User.exists;
  let createdUser;
  User.create = async (attributes) => {
    createdUser = attributes;
    return attributes;
  };
  User.exists = async () => false;

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
    },
  };

  try {
    await authController.registerStudent(
      {
        body: {
          fullName: "Ada Student",
          email: " ADA@EXAMPLE.COM ",
          password: "secure-password",
          college: "Example College",
          university: "Example University",
          department: "Computer Science",
          batch: "2024",
          semester: 1,
          role: "admin",
        },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(createdUser.email, "ada@example.com");
    assert.equal(createdUser.role, "user");
    assert.equal("emailVerificationTokenHash" in createdUser, false);
    assert.match(response.payload.message, /sign in now/);
  } finally {
    User.create = originalCreate;
    User.exists = originalExists;
  }
});

test("the User schema only permits user/admin and defaults to user", async () => {
  const user = new User();
  assert.equal(user.role, "user");
  assert.deepEqual(User.schema.path("role").enumValues, ["user", "admin"]);
});

test("logs in a student whose email has not been verified", async () => {
  const user = {
    id: "student-123",
    role: "user",
    authVersion: 0,
    emailVerified: false,
    isSuspended: false,
    comparePassword: async () => true,
    toSafeObject: () => ({
      id: "student-123",
      email: "student@example.com",
      role: "user",
    }),
  };
  const originalFindOne = User.findOne;
  User.findOne = () => ({ select: async () => user });

  const response = {
    clearedCookies: [],
    cookieName: null,
    cookieValue: null,
    cookieOptions: null,
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
    },
    cookie(name, value, options) {
      this.cookieName = name;
      this.cookieValue = value;
      this.cookieOptions = options;
    },
    json(payload) {
      this.payload = payload;
    },
  };

  try {
    await authController.loginStudent(
      { body: { email: "student@example.com", password: "secure-password" } },
      response,
    );

    assert.equal(response.cookieName, authService.authCookieName);
    assert.equal(response.cookieOptions.path, "/api");
    assert.equal(
      response.clearedCookies[0].options.path,
      authService.legacyAuthCookiePath,
    );
    assert.ok(authService.verifyAuthToken(response.cookieValue));
    assert.equal(response.payload.user.email, "student@example.com");
    assert.equal(response.payload.user.role, "user");
  } finally {
    User.findOne = originalFindOne;
  }
});

test("refreshing the current user migrates the legacy auth cookie scope", async () => {
  const user = {
    id: "student-123",
    authVersion: 0,
    toSafeObject: () => ({ id: "student-123", role: "user" }),
  };
  const response = {
    clearedCookies: [],
    cookies: [],
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
    },
    json(payload) {
      this.payload = payload;
    },
  };

  authController.getCurrentUser({ user }, response);
  assert.equal(response.clearedCookies[0].options.path, "/api/auth");
  assert.equal(response.cookies[0].options.path, "/api");
  assert.equal(response.payload.user.role, "user");
});

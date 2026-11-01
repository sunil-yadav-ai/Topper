import assert from "node:assert/strict";
import test from "node:test";
import { parseResourceSearchQuery } from "./resource-search.service.js";

test("parses supported academic filters, sort, and pagination", () => {
  assert.deepEqual(
    parseResourceSearchQuery({
      q: "linear algebra",
      department: "Mathematics",
      university: "Example University",
      college: "Main Campus",
      batch: "2025",
      semester: "4",
      subject: "Algebra",
      unit: "Matrices",
      topic: "Eigenvalues",
      resourceType: "note",
      sort: "helpful",
      page: "2",
      limit: "20",
    }),
    {
      q: "linear algebra",
      resourceType: "note",
      sort: "helpful",
      page: 2,
      limit: 20,
      semester: 4,
      department: "Mathematics",
      university: "Example University",
      college: "Main Campus",
      batch: "2025",
      subject: "Algebra",
      unit: "Matrices",
      topic: "Eigenvalues",
    },
  );
});

test("applies safe defaults and rejects invalid search controls", () => {
  assert.deepEqual(parseResourceSearchQuery({}), {
    q: "",
    resourceType: "",
    sort: "recent",
    page: 1,
    limit: 12,
    semester: undefined,
    department: "",
    university: "",
    college: "",
    batch: "",
    subject: "",
    unit: "",
    topic: "",
  });
  assert.throws(() => parseResourceSearchQuery({ resourceType: "other" }), {
    statusCode: 400,
  });
  assert.throws(() => parseResourceSearchQuery({ sort: "oldest" }), {
    statusCode: 400,
  });
  assert.throws(() => parseResourceSearchQuery({ semester: "0" }), {
    statusCode: 400,
  });
  assert.throws(() => parseResourceSearchQuery({ q: "a".repeat(101) }), {
    statusCode: 400,
  });
});

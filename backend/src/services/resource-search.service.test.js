import assert from "node:assert/strict";
import test from "node:test";
import Note from "../models/Note.js";
import Pyq from "../models/Pyq.js";
import User from "../models/User.js";
import {
  getResourceSearchOptions,
  parseResourceSearchQuery,
  searchResources,
} from "./resource-search.service.js";

test("parses supported academic filters, sort, and pagination", () => {
  assert.deepEqual(
    parseResourceSearchQuery({
      q: "linear algebra",
      department: "Mathematics",
      university: "Example University",
      college: "Main Campus",
      batch: "2025",
      examinationYear: "2024",
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
      examinationYear: 2024,
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
    examinationYear: undefined,
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
  assert.throws(() => parseResourceSearchQuery({ examinationYear: "1899" }), {
    statusCode: 400,
  });
  assert.throws(() => parseResourceSearchQuery({ q: "a".repeat(101) }), {
    statusCode: 400,
  });
});

test("builds case-insensitive dynamic filter options from searchable resources", async () => {
  const originalNoteDistinct = Note.distinct;
  const originalNoteCountDocuments = Note.countDocuments;
  const originalPyqDistinct = Pyq.distinct;
  const originalPyqCountDocuments = Pyq.countDocuments;
  const originalUserDistinct = User.distinct;
  const noteFilter = {
    publicationStatus: "published",
    visibility: { $in: ["public", null] },
    approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
  };
  const pyqFilter = { approvalStatus: "approved" };

  Note.distinct = async (field, filter) => {
    if (field === "subject") {
      assert.deepEqual(filter, noteFilter);
      return ["Computer Graphics", "computer graphics", " Physics "];
    }
    if (field === "topic") {
      assert.deepEqual(filter, noteFilter);
      return ["Rendering", "rendering"];
    }
    if (field === "uploadedBy") {
      assert.deepEqual(filter, {
        ...noteFilter,
        $or: [{ university: { $exists: false } }, { university: "" }],
      });
      return ["legacy-uploader"];
    }
    assert.equal(field, "university");
    assert.deepEqual(filter, noteFilter);
    return ["PTU", "ptu", " LPU "];
  };
  Note.countDocuments = async (filter) => {
    assert.deepEqual(filter, noteFilter);
    return 3;
  };
  User.distinct = async (field, filter) => {
    assert.equal(field, "university");
    assert.deepEqual(filter, { _id: { $in: ["legacy-uploader"] } });
    return ["GNDU", "gndu"];
  };
  Pyq.distinct = async (field, filter) => {
    assert.deepEqual(filter, pyqFilter);
    if (field === "subject") return ["Mathematics", "mathematics"];
    if (field === "university") return ["PTU", "GNDU", "ptu"];
    assert.equal(field, "examinationYear");
    return [2025, 2024];
  };
  Pyq.countDocuments = async (filter) => {
    assert.deepEqual(filter, pyqFilter);
    return 2;
  };

  try {
    assert.deepEqual(await getResourceSearchOptions("note"), {
      subjects: ["Computer Graphics", "Physics"],
      topics: ["Rendering"],
      universities: ["GNDU", "LPU", "PTU"],
      years: [],
    });
    assert.deepEqual(await getResourceSearchOptions("pyq"), {
      subjects: ["Mathematics"],
      topics: [],
      universities: ["GNDU", "PTU"],
      years: [2025, 2024],
    });
  } finally {
    Note.distinct = originalNoteDistinct;
    Note.countDocuments = originalNoteCountDocuments;
    Pyq.distinct = originalPyqDistinct;
    Pyq.countDocuments = originalPyqCountDocuments;
    User.distinct = originalUserDistinct;
  }
});

test("note schema uses publicationStatus rather than isPublished for search eligibility", () => {
  assert.ok(Note.schema.path("publicationStatus"));
  assert.ok(Note.schema.path("visibility"));
  assert.equal(Note.schema.path("isPublished"), undefined);
});

test("combines subject, topic, and university filters and returns the matching count", async () => {
  const originalNoteFind = Note.find;
  const originalNoteCountDocuments = Note.countDocuments;
  const originalUserDistinct = User.distinct;
  const filter = {
    publicationStatus: "published",
    visibility: { $in: ["public", null] },
    approvalDecision: { $in: ["APPROVED", "APPROVED_WITH_WARNING"] },
    subject: /^Computer Graphics$/i,
    university: /^PTU$/i,
    topic: /^Render/i,
  };
  User.distinct = async (field, query) => {
    assert.equal(field, "_id");
    assert.deepEqual(query, { university: /^PTU$/i });
    return [];
  };
  const matchingNote = {
    _id: { toString: () => "note-123" },
    title: "Rendering basics",
    description: "Computer graphics notes",
    department: "Computer Science",
    subject: "Computer Graphics",
    university: "PTU",
    visibility: "public",
    topic: "Rendering",
    unit: "Unit 1",
    semester: 4,
    storage: { format: "pdf" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const noteQuery = {
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    async lean() { return [matchingNote]; },
  };
  Note.find = (actualFilter) => {
    assert.deepEqual(actualFilter, filter);
    return noteQuery;
  };
  Note.countDocuments = async (actualFilter) => {
    assert.deepEqual(actualFilter, filter);
    return 1;
  };

  try {
    const result = await searchResources({
      resourceType: "note",
      subject: "Computer Graphics",
      university: "PTU",
      topic: "Render",
    });
    assert.equal(result.resources.length, 1);
    assert.equal(result.resources[0].id, "note-123");
    assert.equal(result.resources[0].subject, "Computer Graphics");
    assert.equal(result.pagination.total, 1);
  } finally {
    Note.find = originalNoteFind;
    Note.countDocuments = originalNoteCountDocuments;
    User.distinct = originalUserDistinct;
  }
});

test("logs why notes are excluded when no searchable notes match", async () => {
  const originalNoteFind = Note.find;
  const originalNoteCountDocuments = Note.countDocuments;
  const originalNoteAggregate = Note.aggregate;
  const originalConsoleInfo = console.info;
  const diagnostics = [];
  Note.find = () => ({
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    async lean() { return []; },
  });
  Note.countDocuments = async () => 0;
  Note.aggregate = async () => [
    {
      _id: {
        publicationStatus: "private",
        approvalDecision: "NEEDS_HUMAN_REVIEW",
        ocrStatus: "failed",
        verificationStatus: "completed",
      },
      count: 2,
    },
  ];
  console.info = (message) => diagnostics.push(JSON.parse(message.slice(18)));

  try {
    const result = await searchResources({ resourceType: "note" });
    assert.equal(result.pagination.total, 0);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].endpoint, "GET /api/search");
    assert.equal(diagnostics[0].collections[0].name, Note.collection.name);
    assert.equal(
      diagnostics[0].excludedReason,
      "No documents satisfy the published/approved status filters.",
    );
    assert.equal(
      diagnostics[0].collections[0].statusBreakdown[0]._id.ocrStatus,
      "failed",
    );
  } finally {
    Note.find = originalNoteFind;
    Note.countDocuments = originalNoteCountDocuments;
    Note.aggregate = originalNoteAggregate;
    console.info = originalConsoleInfo;
  }
});

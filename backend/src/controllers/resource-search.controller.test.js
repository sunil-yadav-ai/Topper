import assert from "node:assert/strict";
import test from "node:test";

process.env.CLOUDINARY_CLOUD_NAME = "preview-test";
process.env.CLOUDINARY_API_KEY = "preview-test-key";
process.env.CLOUDINARY_API_SECRET = "preview-test-secret";

const [{ viewNotePreview }, { default: Note }] = await Promise.all([
  import("./resource-search.controller.js"),
  import("../models/Note.js"),
]);

test("serves only the private thumbnail asset for a public PDF note", async () => {
  const originalFindById = Note.findById;
  Note.findById = async () => ({
    _id: "507f1f77bcf86cd799439011",
    publicationStatus: "published",
    visibility: "public",
    storage: {
      format: "pdf",
      resourceType: "raw",
      publicId: "student-notes/private-original",
    },
    previewStorage: {
      format: "png",
      resourceType: "image",
      publicId: "student-notes/previews/first-page",
    },
  });
  const response = {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    redirect(status, url) {
      this.status = status;
      this.url = url;
    },
  };

  try {
    await viewNotePreview(
      { params: { resourceId: "507f1f77bcf86cd799439011" } },
      response,
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers["Cross-Origin-Resource-Policy"], "cross-origin");
    const previewUrl = new URL(response.url);
    assert.equal(
      previewUrl.searchParams.get("public_id"),
      "student-notes/previews/first-page",
    );
    assert.notEqual(
      previewUrl.searchParams.get("public_id"),
      "student-notes/private-original",
    );
  } finally {
    Note.findById = originalFindById;
  }
});

test("does not serve previews of private notes to unauthenticated visitors", async () => {
  const originalFindById = Note.findById;
  Note.findById = async () => ({
    _id: "507f1f77bcf86cd799439011",
    publicationStatus: "published",
    visibility: "private",
    storage: { format: "png", resourceType: "image" },
    uploadedBy: { equals: () => false },
  });

  try {
    await assert.rejects(
      viewNotePreview(
        { params: { resourceId: "507f1f77bcf86cd799439011" } },
        {},
      ),
      { statusCode: 404 },
    );
  } finally {
    Note.findById = originalFindById;
  }
});

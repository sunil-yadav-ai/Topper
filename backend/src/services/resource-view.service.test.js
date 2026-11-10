import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { streamResourceView } from "./resource-view.service.js";

test("streams a requested PDF byte range inline without exposing a storage URL", async () => {
  const originalFetch = globalThis.fetch;
  const body = Buffer.from("%PDF-1.7 sample");
  let fetchedUrl;
  let forwardedRange;
  globalThis.fetch = async (url, options) => {
    fetchedUrl = url;
    forwardedRange = options.headers.Range;
    return new Response(body, {
      status: 206,
      headers: {
        "content-range": `bytes 0-${body.length - 1}/${body.length}`,
        "content-length": String(body.length),
      },
    });
  };
  const response = new PassThrough();
  response.headers = {};
  response.set = function set(field, value) {
    if (typeof field === "string") this.headers[field] = value;
    else Object.assign(this.headers, field);
    return this;
  };
  response.status = function status(value) {
    this.statusCode = value;
    return this;
  };
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));

  try {
    await streamResourceView(
      { get: (name) => name === "range" ? "bytes=0-14" : undefined },
      response,
      {
        url: "https://secure-storage.example/signed-file",
        format: "pdf",
        fileName: "lecture notes.pdf",
        uploaderName: "Aarav Sharma",
      },
    );
    assert.equal(fetchedUrl, "https://secure-storage.example/signed-file");
    assert.equal(forwardedRange, "bytes=0-14");
    assert.equal(response.statusCode, 206);
    assert.equal(response.headers["Content-Type"], "application/pdf");
    assert.equal(response.headers["X-Resource-Uploader"], "Aarav%20Sharma");
    assert.match(response.headers["Content-Disposition"], /^inline;/);
    assert.equal(response.headers["Cache-Control"], "private, no-store");
    assert.equal(response.headers["Accept-Ranges"], "bytes");
    assert.equal(response.headers["content-range"], `bytes 0-${body.length - 1}/${body.length}`);
    assert.deepEqual(Buffer.concat(chunks), body);
    assert.equal(JSON.stringify(response.headers).includes("secure-storage.example"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects multiple byte ranges before contacting storage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Storage should not be contacted for an invalid range.");
  };
  try {
    await assert.rejects(
      streamResourceView(
        { get: () => "bytes=0-1,4-5" },
        {},
        { url: "https://secure-storage.example/file", format: "pdf", fileName: "file.pdf" },
      ),
      { statusCode: 400 },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

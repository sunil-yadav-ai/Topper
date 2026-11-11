import assert from "node:assert/strict";
import test from "node:test";
import app from "../app.js";

test("the API exposes robots.txt and a sitemap for public SEO crawlers", async () => {
  const server = app.listen(0, "127.0.0.1");
  const address = await new Promise((resolve) =>
    server.once("listening", () => resolve(server.address())),
  );
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsResponse.status, 200);
    const robotsText = await robotsResponse.text();
    assert.match(robotsText, /Sitemap:/i);
    assert.match(robotsText, /Allow:/i);
    assert.match(robotsText, /Disallow: \/search/i);
    assert.match(robotsText, /Disallow: \/library/i);

    const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapResponse.status, 200);
    const sitemapText = await sitemapResponse.text();
    assert.match(sitemapText, /<urlset/i);
    assert.match(sitemapText, /<loc>/i);
    assert.match(sitemapText, /\/pyqs<\/loc>/i);
    assert.doesNotMatch(sitemapText, /\/login|\/admin|\/library|\/search/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("SEO resource routes return a real 404 for invalid resource IDs", async () => {
  const server = app.listen(0, "127.0.0.1");
  const address = await new Promise((resolve) =>
    server.once("listening", () => resolve(server.address())),
  );
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const apiResponse = await fetch(`${baseUrl}/api/seo/resources/note/not-an-object-id`);
    assert.equal(apiResponse.status, 404);
    assert.match(apiResponse.headers.get("content-type"), /application\/json/i);

    const pageResponse = await fetch(`${baseUrl}/notes/not-an-object-id/computer-graphics-notes`);
    assert.equal(pageResponse.status, 404);
    assert.match(pageResponse.headers.get("content-type"), /text\/html/i);
    assert.match(pageResponse.headers.get("x-robots-tag"), /noindex/i);

    const unknownPageResponse = await fetch(`${baseUrl}/unknown-page`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(unknownPageResponse.status, 404);
    assert.match(unknownPageResponse.headers.get("x-robots-tag"), /noindex/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

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

    const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapResponse.status, 200);
    const sitemapText = await sitemapResponse.text();
    assert.match(sitemapText, /<urlset/i);
    assert.match(sitemapText, /<loc>/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

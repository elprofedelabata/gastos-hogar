import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds a GitHub Pages-compatible app shell", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<title>Mi casa · Gastos del hogar<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /assets\/[^"']+\.js/i);
  assert.doesNotMatch(html, /(?:src|href)="\/assets\//i, "assets must use a repository-relative URL");
});

test("ships the installable PWA files", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
  );
  const serviceWorker = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");

  assert.equal(manifest.short_name, "Mi casa");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
});

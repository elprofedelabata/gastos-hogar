import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the household dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mi casa · Gastos del hogar<\/title>/i);
  assert.match(html, /Gastos del mes/);
  assert.match(html, /Movimientos recientes/);
  assert.match(html, /Añadir gasto/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/i);
});

test("exposes the PWA manifest", async () => {
  const response = await render("/manifest.webmanifest");
  assert.equal(response.status, 200);
  const manifest = await response.json();
  assert.equal(manifest.short_name, "Mi casa");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
});

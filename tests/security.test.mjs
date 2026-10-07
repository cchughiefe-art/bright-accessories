import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout uses the authoritative order API", async () => {
  const app = await read("src/App.jsx");
  assert.match(app, /fetch\("\/api\/create-order"/);
  assert.doesNotMatch(app, /addDoc\(collection\(db, "orders"/);
});

test("order and public tracking writes are server-only", async () => {
  const rules = await read("firestore.rules");
  assert.match(rules, /match \/orders\/\{orderId\}[\s\S]*allow create, update, delete: if false/);
  assert.match(rules, /match \/publicOrders\/\{orderRef\}[\s\S]*allow read, write: if false/);
});

test("web and Android release versions agree", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const release = JSON.parse(await read("public/app-version.json"));
  assert.equal(pkg.version, release.latestVersion);
});

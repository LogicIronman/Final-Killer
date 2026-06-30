import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import { DEFAULT_TOP_GAME_LINK, getPublicAppSettings, updateTopGameLink } from "./appSettings.js";

async function setupDb() {
  const db = await openDb(path.join(os.tmpdir(), `final-killer-settings-${Date.now()}-${Math.random()}.db`));
  await migrate(db);
  return db;
}

test("public app settings expose the default top game link", async () => {
  const db = await setupDb();

  const settings = await getPublicAppSettings(db);

  assert.equal(settings.topGameLink, DEFAULT_TOP_GAME_LINK);
  await db.close();
});

test("top game link can be updated and blank restores the default", async () => {
  const db = await setupDb();

  await updateTopGameLink(db, "https://example.com/play");
  assert.equal((await getPublicAppSettings(db)).topGameLink, "https://example.com/play");

  await updateTopGameLink(db, " ");
  assert.equal((await getPublicAppSettings(db)).topGameLink, DEFAULT_TOP_GAME_LINK);
  await db.close();
});

test("top game link rejects non-http urls", async () => {
  const db = await setupDb();

  await assert.rejects(() => updateTopGameLink(db, "javascript:alert(1)"), /http/);
  await db.close();
});

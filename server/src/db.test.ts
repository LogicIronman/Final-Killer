import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "./db.js";

test("migration adds base_updated_at to an existing preview table", async () => {
  const db = await openDb(
    path.join(os.tmpdir(), `final-killer-legacy-preview-${Date.now()}-${Math.random()}.db`)
  );
  const now = new Date().toISOString();

  await db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE quiz_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      question_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE question_bank_previews (
      id TEXT PRIMARY KEY,
      quiz_bank_id INTEGER NOT NULL,
      bank_name TEXT NOT NULL,
      source_file_name TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      added_count INTEGER NOT NULL,
      updated_count INTEGER NOT NULL,
      removed_count INTEGER NOT NULL,
      unchanged_count INTEGER NOT NULL,
      added_ids_json TEXT NOT NULL,
      updated_ids_json TEXT NOT NULL,
      removed_ids_json TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (quiz_bank_id) REFERENCES quiz_banks(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.run(
    "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (1, 'admin', 'hash', 'admin', ?)",
    now
  );
  await db.run(
    `INSERT INTO quiz_banks (id, name, question_count, created_at, updated_at)
     VALUES (1, 'Legacy bank', 0, ?, ?)`,
    now,
    now
  );
  await db.run(
    `INSERT INTO question_bank_previews
     (id, quiz_bank_id, bank_name, source_file_name, questions_json,
      added_count, updated_count, removed_count, unchanged_count,
      added_ids_json, updated_ids_json, removed_ids_json,
      created_by, created_at, expires_at)
     VALUES ('legacy-preview', 1, 'Legacy bank', 'questions.json', '[]',
             0, 0, 0, 0, '[]', '[]', '[]', 1, ?, ?)`,
    now,
    new Date(Date.now() + 60_000).toISOString()
  );

  await migrate(db);
  await migrate(db);

  const columns = await db.all<Array<{ name: string }>>(
    "PRAGMA table_info(question_bank_previews)"
  );
  assert.ok(columns.some((column) => column.name === "base_updated_at"));
  assert.equal(
    (await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM question_bank_previews"))?.count,
    0
  );
  await db.close();
});

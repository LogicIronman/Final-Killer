import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import { getLeaderboard } from "./leaderboard.js";

test("leaderboard ranks all users by attempts, correct answers, then user id", async () => {
  const db = await openDb(path.join(os.tmpdir(), `final-killer-rank-${Date.now()}-${Math.random()}.db`));
  await migrate(db);
  const now = new Date().toISOString();

  await db.run("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'alice', 'hash', ?)", now);
  await db.run("INSERT INTO users (id, username, password_hash, created_at) VALUES (2, 'bob', 'hash', ?)", now);
  await db.run("INSERT INTO users (id, username, password_hash, created_at) VALUES (3, 'carol', 'hash', ?)", now);
  await db.run(
    `INSERT INTO quiz_banks (id, name, question_count, created_at, updated_at)
     VALUES (1, 'Test bank', 2, ?, ?)`,
    now,
    now
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, type)
     VALUES ('q1', 1, 'Question 1', '{"A":"One","B":"Two"}', 'A', 'single')`
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, type)
     VALUES ('q2', 1, 'Question 2', '{"A":"One","B":"Two"}', 'A', 'single')`
  );
  await db.run(
    `INSERT INTO user_progress
       (user_id, quiz_bank_id, question_id, status, total_attempts, correct_count, wrong_count)
     VALUES (1, 1, 'q1', 'done', 5, 4, 1)`
  );
  await db.run(
    `INSERT INTO user_progress
       (user_id, quiz_bank_id, question_id, status, total_attempts, correct_count, wrong_count)
     VALUES (2, 1, 'q2', 'reviewing', 5, 3, 2)`
  );

  const entries = await getLeaderboard(db, 2);

  assert.deepEqual(
    entries.map(({ username, practiceCount, rank }) => ({ username, practiceCount, rank })),
    [
      { username: "alice", practiceCount: 5, rank: 1 },
      { username: "bob", practiceCount: 5, rank: 2 },
      { username: "carol", practiceCount: 0, rank: 3 }
    ]
  );
  assert.equal(entries[1].isCurrentUser, true);
  assert.equal(entries[0].accuracy, 80);
  assert.equal(entries[2].accuracy, 0);
  await db.close();
});


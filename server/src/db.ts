import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

type SqlValue = string | number | null;

export interface RunResult {
  lastID?: number;
  changes: number;
}

export interface PreparedStatement {
  run(...params: SqlValue[]): Promise<RunResult>;
  finalize(): Promise<void>;
}

export interface AppDb {
  exec(sql: string): Promise<void>;
  run(sql: string, ...params: SqlValue[]): Promise<RunResult>;
  get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: SqlValue[]): Promise<T>;
  prepare(sql: string): Promise<PreparedStatement>;
  close(): Promise<void>;
}

class NodeSqliteDb implements AppDb {
  private db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
  }

  async exec(sql: string) {
    this.db.exec(sql);
  }

  async run(sql: string, ...params: SqlValue[]) {
    const result = this.db.prepare(sql).run(...params);
    return {
      lastID:
        typeof result.lastInsertRowid === "bigint"
          ? Number(result.lastInsertRowid)
          : Number(result.lastInsertRowid ?? 0),
      changes: Number(result.changes)
    };
  }

  async get<T>(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  async all<T>(sql: string, ...params: SqlValue[]) {
    return this.db.prepare(sql).all(...params) as T;
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    const statement = this.db.prepare(sql);
    return {
      async run(...params: SqlValue[]) {
        const result = statement.run(...params);
        return {
          lastID:
            typeof result.lastInsertRowid === "bigint"
              ? Number(result.lastInsertRowid)
              : Number(result.lastInsertRowid ?? 0),
          changes: Number(result.changes)
        };
      },
      async finalize() {
        return undefined;
      }
    };
  }

  async close() {
    this.db.close();
  }
}

let dbPromise: Promise<AppDb> | null = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = openDb(config.databasePath);
  }
  return dbPromise;
}

export async function openDb(filename: string): Promise<AppDb> {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new NodeSqliteDb(filename);
  await db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

export async function migrate(db: AppDb) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS quiz_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      question_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_bank_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      chapter TEXT,
      type TEXT NOT NULL,
      explanation TEXT,
      FOREIGN KEY (quiz_bank_id) REFERENCES quiz_banks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quiz_bank_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unseen',
      total_attempts INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      consecutive_correct INTEGER NOT NULL DEFAULT 0,
      first_wrong_at TEXT,
      last_wrong_at TEXT,
      last_answered_at TEXT,
      is_marked INTEGER NOT NULL DEFAULT 0,
      wrong_history_json TEXT,
      UNIQUE(user_id, quiz_bank_id, question_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (quiz_bank_id) REFERENCES quiz_banks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quiz_bank_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      new_questions_count INTEGER NOT NULL DEFAULT 0,
      review_questions_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      total_time_minutes INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, quiz_bank_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (quiz_bank_id) REFERENCES quiz_banks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exam_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_name TEXT NOT NULL,
      exam_at TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_bank_previews (
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
      base_updated_at TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (quiz_bank_id) REFERENCES quiz_banks(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS question_bank_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_bank_id INTEGER NOT NULL,
      bank_name TEXT NOT NULL,
      bank_description TEXT,
      source_file_name TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      progress_json TEXT NOT NULL,
      daily_logs_json TEXT NOT NULL,
      question_count INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_questions_bank ON questions(quiz_bank_id);
    CREATE INDEX IF NOT EXISTS idx_questions_chapter_type ON questions(chapter, type);
    CREATE INDEX IF NOT EXISTS idx_progress_user_bank_status
      ON user_progress(user_id, quiz_bank_id, status);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_user_bank_date
      ON daily_logs(user_id, quiz_bank_id, date);
    CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam_at ON exam_schedules(exam_at);
    CREATE INDEX IF NOT EXISTS idx_question_bank_previews_expires
      ON question_bank_previews(expires_at);
    CREATE INDEX IF NOT EXISTS idx_question_bank_versions_created
      ON question_bank_versions(created_at DESC);
  `);

  const userColumns = await db.all<Array<{ name: string }>>("PRAGMA table_info(users)");
  if (!userColumns.some((column) => column.name === "role")) {
    await db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';");
  }

  const progressColumns = await db.all<Array<{ name: string }>>("PRAGMA table_info(user_progress)");
  if (!progressColumns.some((column) => column.name === "last_wrong_at")) {
    await db.exec("ALTER TABLE user_progress ADD COLUMN last_wrong_at TEXT;");
  }

  const previewColumns = await db.all<Array<{ name: string }>>(
    "PRAGMA table_info(question_bank_previews)"
  );
  if (!previewColumns.some((column) => column.name === "base_updated_at")) {
    await db.exec("BEGIN TRANSACTION");
    try {
      await db.exec(
        "ALTER TABLE question_bank_previews ADD COLUMN base_updated_at TEXT NOT NULL DEFAULT '';"
      );
      await db.run("DELETE FROM question_bank_previews");
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  } else {
    await db.run(
      "DELETE FROM question_bank_previews WHERE base_updated_at IS NULL OR base_updated_at = ''"
    );
  }

  const defaultExamSeeded = await db.get<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'default_exam_seeded'"
  );
  if (!defaultExamSeeded) {
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO exam_schedules (course_name, exam_at, created_by, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?)`,
      "马克思主义基本原理",
      "2026-07-02T00:00:00+08:00",
      now,
      now
    );
    await db.run(
      "INSERT INTO app_settings (key, value) VALUES ('default_exam_seeded', '1')"
    );
  }
}

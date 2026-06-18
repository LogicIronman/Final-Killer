import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AppDb } from "../db.js";
import { config } from "../config.js";
import type { AuthUser } from "../types.js";

export async function registerUser(db: AppDb, username: string, password: string) {
  const normalized = username.trim();
  const existing = await db.get("SELECT id FROM users WHERE username = ?", normalized);
  if (existing) {
    throw new Error("用户名已存在");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO users (username, password_hash, role, created_at, last_login_at)
     VALUES (?, ?, 'user', ?, ?)`,
    normalized,
    passwordHash,
    now,
    now
  );

  const user = { id: result.lastID!, username: normalized, role: "user" as const };
  return { user, token: signToken(user) };
}

export async function loginUser(db: AppDb, username: string, password: string) {
  const user = await db.get<{
    id: number;
    username: string;
    password_hash: string;
    role: "user" | "admin";
  }>("SELECT id, username, password_hash, role FROM users WHERE username = ?", username.trim());

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new Error("用户名或密码错误");
  }

  await db.run("UPDATE users SET last_login_at = ? WHERE id = ?", new Date().toISOString(), user.id);
  const publicUser = { id: user.id, username: user.username, role: user.role };
  return { user: publicUser, token: signToken(publicUser) };
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, config.jwtSecret) as AuthUser;
}

export async function ensureAdminUser(db: AppDb) {
  if (!config.adminUsername || !config.adminPassword) return null;

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  const existing = await db.get<{ id: number }>(
    "SELECT id FROM users WHERE username = ?",
    config.adminUsername
  );
  const now = new Date().toISOString();

  if (existing) {
    await db.run(
      "UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?",
      passwordHash,
      existing.id
    );
    return { id: existing.id, username: config.adminUsername, role: "admin" as const };
  }

  const result = await db.run(
    `INSERT INTO users (username, password_hash, role, created_at, last_login_at)
     VALUES (?, ?, 'admin', ?, NULL)`,
    config.adminUsername,
    passwordHash,
    now
  );
  return { id: result.lastID!, username: config.adminUsername, role: "admin" as const };
}

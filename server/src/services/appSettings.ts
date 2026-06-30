import type { AppDb } from "../db.js";

export const DEFAULT_TOP_GAME_LINK = "https://generals.io/games/5rsr";
const TOP_GAME_LINK_KEY = "top_game_link";

export async function getPublicAppSettings(db: AppDb) {
  return {
    topGameLink: await getTopGameLink(db)
  };
}

export async function getTopGameLink(db: AppDb) {
  const row = await db.get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", TOP_GAME_LINK_KEY);
  return row?.value || DEFAULT_TOP_GAME_LINK;
}

export async function updateTopGameLink(db: AppDb, value: string) {
  const nextValue = normalizeLink(value);
  await db.run(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    TOP_GAME_LINK_KEY,
    nextValue
  );
  return { topGameLink: nextValue };
}

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_TOP_GAME_LINK;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("请输入正确的链接");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("链接必须以 http:// 或 https:// 开头");
  }
  return url.toString();
}

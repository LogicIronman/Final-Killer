import type { AppDb } from "../db.js";

type LeaderboardRow = {
  id: number;
  username: string;
  practice_count: number;
  correct_count: number;
};

export async function getLeaderboard(db: AppDb, currentUserId: number) {
  const rows = await db.all<LeaderboardRow[]>(
    `SELECT
       u.id,
       u.username,
       COALESCE(SUM(p.total_attempts), 0) AS practice_count,
       COALESCE(SUM(p.correct_count), 0) AS correct_count
     FROM users u
     LEFT JOIN user_progress p ON p.user_id = u.id
     GROUP BY u.id, u.username
     ORDER BY practice_count DESC, correct_count DESC, u.id ASC`
  );

  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    practiceCount: Number(row.practice_count),
    correctCount: Number(row.correct_count),
    accuracy:
      Number(row.practice_count) > 0
        ? Math.round((Number(row.correct_count) / Number(row.practice_count)) * 1000) / 10
        : 0,
    isCurrentUser: row.id === currentUserId
  }));
}


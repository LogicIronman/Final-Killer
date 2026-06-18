import type { NextFunction, Request, Response } from "express";
import { sendError } from "../lib/api.js";
import { verifyToken } from "../services/auth.js";
import type { AuthUser } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return sendError(res, "UNAUTHORIZED", "请先登录", 401);
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return sendError(res, "UNAUTHORIZED", "登录状态已过期，请重新登录", 401);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return sendError(res, "FORBIDDEN", "需要管理员权限", 403);
    }
    return next();
  });
}

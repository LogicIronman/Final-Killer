import type { Response } from "express";

export function sendOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data, error: null });
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 400
) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: { code, message }
  });
}

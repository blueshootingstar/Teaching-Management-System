import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '../utils/response';
import type { AuthenticatedRequest, AuthUser } from '../types/auth';

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return fail(res, '未登录或 token 缺失', 401);
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as AuthUser;
    return next();
  } catch {
    return fail(res, '登录状态已失效', 401);
  }
}

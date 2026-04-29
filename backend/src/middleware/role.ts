import type { NextFunction, Response } from 'express';
import { fail } from '../utils/response';
import type { AuthenticatedRequest, UserRole } from '../types/auth';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, '没有访问权限', 403);
    }
    return next();
  };
}

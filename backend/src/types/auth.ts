import type { Request } from 'express';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface AuthUser {
  userId: number;
  username: string;
  role: UserRole;
  displayName: string;
  studentId?: string | null;
  staffId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

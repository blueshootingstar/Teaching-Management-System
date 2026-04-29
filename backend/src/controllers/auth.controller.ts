import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { execute, query } from '../db/mysql';
import { fail, success } from '../utils/response';
import type { AuthenticatedRequest, UserRole } from '../types/auth';

interface UserRow extends RowDataPacket {
  user_id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string;
  student_id: string | null;
  staff_id: string | null;
  status: 'active' | 'disabled';
}

function toPayload(user: UserRow) {
  return {
    userId: user.user_id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
    studentId: user.student_id,
    staffId: user.staff_id
  };
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return fail(res, '请输入账号和密码');
  }

  const users = await query<UserRow[]>(
    `SELECT user_id, username, password_hash, role, display_name, student_id, staff_id, status
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [username]
  );
  const user = users[0];

  if (!user || user.status !== 'active') {
    return fail(res, '账号不存在或已禁用', 401);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return fail(res, '账号或密码错误', 401);
  }

  const payload = toPayload(user);
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });
  await execute('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

  return success(res, { token, user: payload });
}

export async function me(req: AuthenticatedRequest, res: Response) {
  return success(res, req.user || null);
}

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
    `SELECT
       account_rows.user_id,
       account_rows.username,
       account_rows.password_hash,
       account_rows.role,
       account_rows.display_name,
       account_rows.student_id,
       account_rows.staff_id,
       account_rows.status
     FROM (
       SELECT
         u.user_id,
         aa.username,
         u.password_hash,
         'admin' AS role,
         aa.display_name,
         NULL AS student_id,
         NULL AS staff_id,
         u.status
       FROM admin_accounts AS aa
       JOIN users AS u ON u.user_id = aa.user_id
       WHERE aa.username = ?
       UNION ALL
       SELECT
         u.user_id,
         sa.student_id AS username,
         u.password_hash,
         'student' AS role,
         s.name AS display_name,
         sa.student_id,
         NULL AS staff_id,
         u.status
       FROM student_accounts AS sa
       JOIN users AS u ON u.user_id = sa.user_id
       JOIN student AS s ON s.student_id = sa.student_id
       WHERE sa.student_id = ?
       UNION ALL
       SELECT
         u.user_id,
         ta.staff_id AS username,
         u.password_hash,
         'teacher' AS role,
         t.name AS display_name,
         NULL AS student_id,
         ta.staff_id,
         u.status
       FROM teacher_accounts AS ta
       JOIN users AS u ON u.user_id = ta.user_id
       JOIN teacher AS t ON t.staff_id = ta.staff_id
       WHERE ta.staff_id = ?
     ) AS account_rows
     LIMIT 1`,
    [username, username, username]
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

  return success(res, { token, user: payload });
}

export async function me(req: AuthenticatedRequest, res: Response) {
  return success(res, req.user || null);
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return fail(res, '未登录', 401);

  const oldPassword = String(req.body?.old_password || req.body?.oldPassword || '');
  const newPassword = String(req.body?.new_password || req.body?.newPassword || '');
  const fieldErrors: Record<string, string> = {};
  if (!oldPassword) fieldErrors.old_password = '请输入旧密码';
  if (!newPassword) fieldErrors.new_password = '请输入新密码';
  else if (newPassword.length < 6) fieldErrors.new_password = '新密码至少 6 位';
  if (Object.keys(fieldErrors).length > 0) {
    return fail(res, '表单校验失败', 400, { fieldErrors });
  }

  const users = await query<RowDataPacket[]>(
    'SELECT password_hash FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  );
  const user = users[0];
  if (!user) return fail(res, '账号不存在', 404);

  const ok = await bcrypt.compare(oldPassword, String(user.password_hash));
  if (!ok) {
    return fail(res, '表单校验失败', 400, {
      fieldErrors: { old_password: '旧密码错误' }
    });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
  return success(res);
}

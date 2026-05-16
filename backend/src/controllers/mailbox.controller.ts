import type { Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/mysql';
import type { AuthenticatedRequest } from '../types/auth';
import { fail, success } from '../utils/response';

export async function listMailbox(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return fail(res, '未登录', 401);

  const rows = await query<RowDataPacket[]>(
    `SELECT
       mr.recipient_id,
       mr.read_at,
       mi.mail_item_id,
       mi.created_at,
       sender.sender_name,
       CASE
         WHEN nm.mail_item_id IS NOT NULL THEN 'notification'
         ELSE 'substitution'
       END AS item_type,
       nm.title,
       nm.content,
       sr.week_no,
       sr.status AS substitution_status,
       sr.reason AS substitution_reason,
       c.offering_id,
       c.semester_id AS semester,
       co.course_id,
       co.course_name,
       c.class_time,
       CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom,
       requester.staff_id AS requester_staff_id,
       requester.name AS requester_teacher_name,
       substitute.staff_id AS substitute_staff_id,
       substitute.name AS substitute_teacher_name
     FROM mail_recipients AS mr
     JOIN mail_items AS mi ON mi.mail_item_id = mr.mail_item_id
     LEFT JOIN (
       SELECT aa.user_id, aa.display_name AS sender_name
       FROM admin_accounts AS aa
       UNION ALL
       SELECT sa.user_id, s.name AS sender_name
       FROM student_accounts AS sa
       JOIN student AS s ON s.student_id = sa.student_id
       UNION ALL
       SELECT ta.user_id, t.name AS sender_name
       FROM teacher_accounts AS ta
       JOIN teacher AS t ON t.staff_id = ta.staff_id
     ) AS sender ON sender.user_id = mi.sender_user_id
     LEFT JOIN notification_messages AS nm ON nm.mail_item_id = mi.mail_item_id
     LEFT JOIN substitution_requests AS sr ON sr.mail_item_id = mi.mail_item_id
     LEFT JOIN course_offerings AS c ON c.offering_id = sr.offering_id
     LEFT JOIN course AS co ON co.course_id = c.course_id
     LEFT JOIN teacher AS requester ON requester.staff_id = c.staff_id
     LEFT JOIN teacher AS substitute ON substitute.staff_id = sr.substitute_staff_id
     WHERE mr.recipient_user_id = ?
     ORDER BY mi.created_at DESC, mi.mail_item_id DESC`,
    [userId]
  );

  return success(res, rows);
}

export async function unreadCount(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return fail(res, '未登录', 401);

  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unread_count
     FROM mail_recipients
     WHERE recipient_user_id = ? AND read_at IS NULL`,
    [userId]
  );

  return success(res, { unread_count: Number(rows[0]?.unread_count || 0) });
}

export async function markRead(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return fail(res, '未登录', 401);

  const result = await execute(
    `UPDATE mail_recipients
     SET read_at = COALESCE(read_at, NOW())
     WHERE recipient_id = ? AND recipient_user_id = ?`,
    [req.params.recipientId, userId]
  );

  if (result.affectedRows === 0) {
    return fail(res, '信件不存在或无权操作', 404);
  }

  return success(res);
}

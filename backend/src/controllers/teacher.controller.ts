import type { Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/mysql';
import type { AuthenticatedRequest } from '../types/auth';
import { fail, success } from '../utils/response';

function requireStaffId(req: AuthenticatedRequest, res: Response) {
  const staffId = req.user?.staffId;
  if (!staffId) {
    fail(res, '当前账号未绑定教师信息', 403);
    return null;
  }
  return staffId;
}

export async function myCourses(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;
  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id, c.semester, co.course_id, co.course_name, co.credit,
       c.class_time, c.classroom, c.capacity, c.status,
       COUNT(cs.selection_id) AS selected_count
     FROM class AS c
     JOIN course AS co ON co.course_id = c.course_id
     LEFT JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
      AND cs.selection_status = 'selected'
     WHERE c.staff_id = ?
     GROUP BY c.offering_id, c.semester, co.course_id, co.course_name, co.credit,
              c.class_time, c.classroom, c.capacity, c.status
     ORDER BY c.semester DESC, co.course_id`,
    [staffId]
  );
  return success(res, rows);
}

export async function courseStudents(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;
  const rows = await query<RowDataPacket[]>(
    `SELECT
       cs.selection_id, g.grade_id, s.student_id, s.name AS student_name,
       s.mobile_phone, g.regular_score, g.exam_score, g.score, g.grade_status
     FROM class AS c
     JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
     JOIN student AS s ON s.student_id = cs.student_id
     LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
     WHERE c.offering_id = ?
       AND c.staff_id = ?
       AND cs.selection_status = 'selected'
     ORDER BY s.student_id`,
    [req.params.courseOfferingId, staffId]
  );
  return success(res, rows);
}

export async function updateGrade(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;
  const regularScore = Number(req.body.regular_score);
  const examScore = Number(req.body.exam_score);
  if (!isValidScore(regularScore) || !isValidScore(examScore)) {
    return fail(res, '平时成绩和考试成绩都必须在 0 到 100 之间');
  }
  const score = Number((regularScore * 0.4 + examScore * 0.6).toFixed(2));

  const rows = await query<RowDataPacket[]>(
    `SELECT g.grade_id, cs.selection_id
     FROM grades AS g
     JOIN course_selection AS cs ON cs.selection_id = g.selection_id
     JOIN class AS c ON c.semester = cs.semester AND c.course_id = cs.course_id AND c.staff_id = cs.staff_id
     WHERE g.grade_id = ? AND c.staff_id = ?
     LIMIT 1`,
    [req.params.gradeId, staffId]
  );

  const grade = rows[0];
  if (!grade) {
    return fail(res, '成绩记录不存在或无权修改', 404);
  }

  await execute(
    `UPDATE grades
     SET regular_score = ?, exam_score = ?, score = ?, grade_status = 'submitted', graded_at = NOW()
     WHERE grade_id = ?`,
    [regularScore, examScore, score, req.params.gradeId]
  );
  await execute('UPDATE course_selection SET score = ? WHERE selection_id = ?', [score, grade.selection_id]);

  return success(res);
}

export async function courseStatistics(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;

  const ownerRows = await query<RowDataPacket[]>(
    'SELECT offering_id FROM class WHERE offering_id = ? AND staff_id = ? LIMIT 1',
    [req.params.courseOfferingId, staffId]
  );
  if (ownerRows.length === 0) {
    return fail(res, '课程不存在或无权查看', 404);
  }

  const rows = await query<RowDataPacket[][]>('CALL sp_course_grade_statistics(?)', [req.params.courseOfferingId]);
  return success(res, rows[0] || []);
}

function isValidScore(score: number) {
  return Number.isFinite(score) && score >= 0 && score <= 100;
}

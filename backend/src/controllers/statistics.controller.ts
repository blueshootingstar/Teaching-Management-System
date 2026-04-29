import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/mysql';
import { success } from '../utils/response';

export async function courseStatistics(req: Request, res: Response) {
  const rows = await query<RowDataPacket[][]>('CALL sp_course_grade_statistics(?)', [req.params.courseOfferingId]);
  return success(res, rows[0] || []);
}

export async function studentStatistics(req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       s.student_id,
       s.name,
       COUNT(g.grade_id) AS graded_course_count,
       ROUND(AVG(g.score), 2) AS average_score,
       SUM(co.credit) AS total_credit
     FROM student AS s
     LEFT JOIN course_selection AS cs ON cs.student_id = s.student_id AND cs.selection_status = 'selected'
     LEFT JOIN grades AS g ON g.selection_id = cs.selection_id AND g.score IS NOT NULL
     LEFT JOIN class AS c ON c.semester = cs.semester AND c.course_id = cs.course_id AND c.staff_id = cs.staff_id
     LEFT JOIN course AS co ON co.course_id = c.course_id
     WHERE s.student_id = ?
     GROUP BY s.student_id, s.name`,
    [req.params.studentId]
  );
  return success(res, rows[0] || null);
}

export async function teacherStatistics(req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       t.staff_id,
       t.name AS teacher_name,
       COUNT(DISTINCT c.offering_id) AS offering_count,
       COUNT(cs.selection_id) AS student_count
     FROM teacher AS t
     LEFT JOIN class AS c ON c.staff_id = t.staff_id
     LEFT JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
      AND cs.selection_status = 'selected'
     WHERE t.staff_id = ?
     GROUP BY t.staff_id, t.name`,
    [req.params.teacherId]
  );
  return success(res, rows[0] || null);
}

export async function semesterStatistics(req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id,
       c.semester,
       co.course_id,
       co.course_name,
       t.name AS teacher_name,
       COUNT(cs.selection_id) AS selected_count
     FROM class AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
      AND cs.selection_status = 'selected'
     WHERE c.semester = ?
     GROUP BY c.offering_id, c.semester, co.course_id, co.course_name, t.name
     ORDER BY selected_count DESC, co.course_id`,
    [req.params.semesterId]
  );
  return success(res, rows);
}

export async function courseRanking(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       co.course_id,
       co.course_name,
       ROUND(AVG(g.score), 2) AS average_score
     FROM course AS co
     JOIN class AS c ON c.course_id = co.course_id
     JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
      AND cs.selection_status = 'selected'
     JOIN grades AS g ON g.selection_id = cs.selection_id
     WHERE g.score IS NOT NULL
     GROUP BY co.course_id, co.course_name
     ORDER BY average_score DESC`
  );
  return success(res, rows);
}

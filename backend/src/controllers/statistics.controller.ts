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
     LEFT JOIN course_selection AS cs ON cs.student_id = s.student_id
     LEFT JOIN v_grades AS g ON g.selection_id = cs.selection_id AND g.score IS NOT NULL
     LEFT JOIN course_offerings AS c ON c.offering_id = cs.offering_id
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
     LEFT JOIN course_offerings AS c ON c.staff_id = t.staff_id
     LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
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
       c.semester_id AS semester,
       c.staff_id,
       co.course_id,
       co.course_name,
       co.dept_id,
       d.dept_name,
       t.name AS teacher_name,
       c.capacity,
       c.status,
       COUNT(cs.selection_id) AS selected_count,
       SUM(CASE WHEN g.score IS NOT NULL THEN 1 ELSE 0 END) AS graded_count,
       (COUNT(cs.selection_id) - SUM(CASE WHEN g.score IS NOT NULL THEN 1 ELSE 0 END)) AS pending_grade_count,
       (c.capacity - COUNT(cs.selection_id)) AS remaining_capacity,
       ROUND(COUNT(cs.selection_id) * 100 / NULLIF(c.capacity, 0), 2) AS utilization_rate,
       ROUND(SUM(CASE WHEN g.score IS NOT NULL THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(cs.selection_id), 0), 2) AS grade_completion_rate
     FROM course_offerings AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN department AS d ON d.dept_id = co.dept_id
     JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
     LEFT JOIN v_grades AS g ON g.selection_id = cs.selection_id
     WHERE c.semester_id = ?
     GROUP BY c.offering_id, c.semester_id, c.staff_id, co.course_id, co.course_name, co.dept_id, d.dept_name, t.name, c.capacity, c.status
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
     JOIN course_offerings AS c ON c.course_id = co.course_id
     JOIN course_selection AS cs ON cs.offering_id = c.offering_id
     JOIN v_grades AS g ON g.selection_id = cs.selection_id
     WHERE g.score IS NOT NULL
     GROUP BY co.course_id, co.course_name
     ORDER BY average_score DESC`
  );
  return success(res, rows);
}

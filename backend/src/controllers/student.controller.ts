import type { Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { getConnection, query } from '../db/mysql';
import type { AuthenticatedRequest } from '../types/auth';
import { fail, success } from '../utils/response';

async function getCurrentSemester() {
  const rows = await query<RowDataPacket[]>(
    `SELECT semester_id
     FROM semesters
     ORDER BY is_current DESC, semester_id DESC
     LIMIT 1`
  );
  return rows[0]?.semester_id as string | undefined;
}

function requireStudentId(req: AuthenticatedRequest, res: Response) {
  const studentId = req.user?.studentId;
  if (!studentId) {
    fail(res, '当前账号未绑定学生信息', 403);
    return null;
  }
  return studentId;
}

export async function semesters(req: AuthenticatedRequest, res: Response) {
  const studentId = requireStudentId(req, res);
  if (!studentId) return null;

  const rows = await query<RowDataPacket[]>(
    `SELECT
       semester_id,
       semester_name,
       DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
       is_current
     FROM semesters
     ORDER BY semester_id DESC`
  );
  return success(res, rows);
}

export async function availableCourses(req: AuthenticatedRequest, res: Response) {
  const studentId = requireStudentId(req, res);
  if (!studentId) return null;

  const semester = String(req.query.semester || '').trim() || (await getCurrentSemester());
  if (!semester) return success(res, []);
  const keyword = String(req.query.keyword || '').trim();
  const hasCapacity = req.query.hasCapacity === 'true' || req.query.hasCapacity === '1';
  const onlyUnselected = req.query.onlyUnselected === 'true' || req.query.onlyUnselected === '1';

  const whereParts = ['c.semester = ?'];
  const whereParams: Array<string | number> = [semester];
  if (keyword) {
    whereParts.push('(co.course_id LIKE ? OR co.course_name LIKE ? OR c.staff_id LIKE ? OR t.name LIKE ?)');
    const likeKeyword = `%${keyword}%`;
    whereParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
  }
  const havingParts = [];
  if (hasCapacity) {
    havingParts.push('(c.capacity - COUNT(DISTINCT cs.selection_id)) > 0');
  }
  if (onlyUnselected) {
    havingParts.push('MAX(mine.selection_id) IS NULL');
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id, c.semester, co.course_id, co.course_name, co.credit, co.credit_hours,
       c.staff_id, t.name AS teacher_name, c.class_time, c.classroom, c.capacity, c.status,
       COUNT(DISTINCT cs.selection_id) AS selected_count,
       (c.capacity - COUNT(DISTINCT cs.selection_id)) AS remaining_capacity,
       MAX(mine.selection_id) AS selection_id,
       IF(MAX(mine.selection_id) IS NULL, 0, 1) AS is_selected,
       MAX(g.score) AS score,
       IF(MAX(same_course.selection_id) IS NOT NULL, 1, 0) AS same_course_selected,
       IF(MAX(time_class.offering_id) IS NOT NULL, 1, 0) AS time_conflicted,
       MAX(same_teacher.name) AS same_course_teacher_name,
       MAX(time_course.course_name) AS conflict_course_name,
       MAX(time_teacher.name) AS conflict_teacher_name,
       CASE
         WHEN MAX(same_course.selection_id) IS NOT NULL
           THEN CONCAT('你已选过该课程，不能重复选择不同教师的同一课程')
         WHEN MAX(time_class.offering_id) IS NOT NULL
           THEN CONCAT('课程时间冲突：已选 ', MAX(time_course.course_name), '（', MAX(time_teacher.name), '，', c.class_time, '）')
         ELSE NULL
       END AS conflict_reason
      FROM class AS c
      JOIN course AS co ON co.course_id = c.course_id
      JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
      AND cs.selection_status = 'selected'
     LEFT JOIN course_selection AS mine
      ON mine.semester = c.semester AND mine.course_id = c.course_id AND mine.staff_id = c.staff_id
      AND mine.student_id = ?
      AND mine.selection_status = 'selected'
      LEFT JOIN grades AS g ON g.selection_id = mine.selection_id
      LEFT JOIN course_selection AS same_course
       ON same_course.semester = c.semester
      AND same_course.course_id = c.course_id
      AND same_course.staff_id <> c.staff_id
      AND same_course.student_id = ?
      AND same_course.selection_status = 'selected'
      LEFT JOIN class AS same_class
       ON same_class.semester = same_course.semester
      AND same_class.course_id = same_course.course_id
      AND same_class.staff_id = same_course.staff_id
      LEFT JOIN teacher AS same_teacher ON same_teacher.staff_id = same_class.staff_id
      LEFT JOIN course_selection AS time_selection
       ON time_selection.student_id = ?
      AND time_selection.selection_status = 'selected'
      LEFT JOIN class AS time_class
       ON time_class.semester = time_selection.semester
      AND time_class.course_id = time_selection.course_id
      AND time_class.staff_id = time_selection.staff_id
      AND time_class.semester = c.semester
      AND time_class.class_time = c.class_time
      AND NOT (time_class.course_id = c.course_id AND time_class.staff_id = c.staff_id)
      LEFT JOIN course AS time_course ON time_course.course_id = time_class.course_id
      LEFT JOIN teacher AS time_teacher ON time_teacher.staff_id = time_class.staff_id
      ${whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''}
      GROUP BY c.offering_id, c.semester, co.course_id, co.course_name, co.credit, co.credit_hours,
               c.staff_id, t.name, c.class_time, c.classroom, c.capacity, c.status
      ${havingParts.length > 0 ? `HAVING ${havingParts.join(' AND ')}` : ''}
      ORDER BY c.semester DESC, co.course_id, t.name`,
    [studentId, studentId, studentId, ...whereParams]
  );

  return success(res, rows);
}

export async function selectCourse(req: AuthenticatedRequest, res: Response) {
  const studentId = requireStudentId(req, res);
  if (!studentId) return null;

  const offeringId = Number(req.body.offeringId || req.body.course_offering_id);
  if (!offeringId) return fail(res, '缺少开课 ID');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [offerings] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM class WHERE offering_id = ? FOR UPDATE',
      [offeringId]
    );
    const offering = offerings[0];
    if (!offering) {
      await conn.rollback();
      return fail(res, '开课记录不存在', 404);
    }
    if (offering.status !== 'open') {
      await conn.rollback();
      return fail(res, '该课程当前不可选');
    }

    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT cs.selection_id, cs.staff_id, t.name AS teacher_name
       FROM course_selection
         AS cs
       JOIN teacher AS t ON t.staff_id = cs.staff_id
       WHERE cs.student_id = ? AND cs.semester = ? AND cs.course_id = ? AND cs.selection_status = 'selected'
       LIMIT 1`,
      [studentId, offering.semester, offering.course_id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      if (String(existing[0].staff_id) === String(offering.staff_id)) {
        return fail(res, '已经选过该课程');
      }
      return fail(res, '你已选过该课程，不能重复选择不同教师的同一课程');
    }

    const [capacityRows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS selected_count
       FROM course_selection
       WHERE semester = ? AND course_id = ? AND staff_id = ? AND selection_status = 'selected'`,
      [offering.semester, offering.course_id, offering.staff_id]
    );
    if (Number(capacityRows[0].selected_count) >= Number(offering.capacity)) {
      await conn.rollback();
      return fail(res, '课程容量已满');
    }

    const [conflicts] = await conn.query<RowDataPacket[]>(
      `SELECT cs.selection_id, co.course_name, t.name AS teacher_name, c.class_time
       FROM course_selection AS cs
       JOIN class AS c
         ON c.semester = cs.semester AND c.course_id = cs.course_id AND c.staff_id = cs.staff_id
       JOIN course AS co ON co.course_id = c.course_id
       JOIN teacher AS t ON t.staff_id = c.staff_id
       WHERE cs.student_id = ?
         AND cs.selection_status = 'selected'
         AND c.semester = ?
         AND c.class_time = ?
       LIMIT 1`,
      [studentId, offering.semester, offering.class_time]
    );
    if (conflicts.length > 0) {
      await conn.rollback();
      const conflict = conflicts[0];
      return fail(res, `课程时间冲突：已选 ${conflict.course_name}（${conflict.teacher_name}，${conflict.class_time}）`);
    }

    await conn.execute(
      `INSERT INTO course_selection (student_id, semester, course_id, staff_id, score, selection_status)
       VALUES (?, ?, ?, ?, NULL, 'selected')`,
      [studentId, offering.semester, offering.course_id, offering.staff_id]
    );
    await conn.commit();
    return success(res, null, 'selected', 201);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function dropCourse(req: AuthenticatedRequest, res: Response) {
  const studentId = requireStudentId(req, res);
  if (!studentId) return null;

  const selectionId = Number(req.params.selectionId);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT cs.selection_id, g.score
       FROM course_selection AS cs
       LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
       WHERE cs.selection_id = ? AND cs.student_id = ?
       FOR UPDATE`,
      [selectionId, studentId]
    );
    const selection = rows[0];
    if (!selection) {
      await conn.rollback();
      return fail(res, '选课记录不存在', 404);
    }
    if (selection.score !== null) {
      await conn.rollback();
      return fail(res, '成绩已录入，不能退课');
    }
    await conn.execute('DELETE FROM course_selection WHERE selection_id = ?', [selectionId]);
    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function myCourses(req: AuthenticatedRequest, res: Response) {
  const studentId = requireStudentId(req, res);
  if (!studentId) return null;
  const semester = String(req.query.semester || '').trim() || (await getCurrentSemester());
  if (!semester) return success(res, []);
  const rows = await query<RowDataPacket[]>(
    `SELECT
       cs.selection_id, c.offering_id, c.semester, co.course_id, co.course_name,
       co.credit, c.staff_id, t.name AS teacher_name, c.class_time, c.classroom,
       cs.selection_status, g.score
     FROM course_selection AS cs
     JOIN class AS c ON c.semester = cs.semester AND c.course_id = cs.course_id AND c.staff_id = cs.staff_id
     JOIN course AS co ON co.course_id = c.course_id
     JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
     WHERE cs.student_id = ? AND cs.selection_status = 'selected' AND c.semester = ?
     ORDER BY c.semester DESC, c.class_time`,
    [studentId, semester]
  );
  return success(res, rows);
}

export async function timetable(req: AuthenticatedRequest, res: Response) {
  return myCourses(req, res);
}

export async function myGrades(req: AuthenticatedRequest, res: Response) {
  const studentId = requireStudentId(req, res);
  if (!studentId) return null;
  const rows = await query<RowDataPacket[]>(
    `SELECT
       cs.selection_id, c.semester, co.course_id, co.course_name, co.credit,
       t.name AS teacher_name, g.regular_score, g.exam_score, g.score, g.grade_status, g.graded_at
     FROM course_selection AS cs
     JOIN class AS c ON c.semester = cs.semester AND c.course_id = cs.course_id AND c.staff_id = cs.staff_id
     JOIN course AS co ON co.course_id = c.course_id
     JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
     WHERE cs.student_id = ? AND cs.selection_status = 'selected'
     ORDER BY c.semester DESC, co.course_id`,
    [studentId]
  );
  return success(res, rows);
}

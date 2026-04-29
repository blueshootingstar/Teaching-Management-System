import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { execute, getConnection, query } from '../db/mysql';
import { fail, success } from '../utils/response';

const DEFAULT_PASSWORD = '123456';
const OFFERING_STATUS_VALUES = new Set(['open', 'closed']);

function toCount(value: unknown) {
  return Number(value || 0);
}

function studentDeleteReason(row: RowDataPacket) {
  const selectionCount = toCount(row.selection_count);
  const gradeCount = toCount(row.grade_count);
  if (selectionCount === 0 && gradeCount === 0) return null;
  const parts = [];
  if (selectionCount > 0) parts.push(`${selectionCount}条选课记录`);
  if (gradeCount > 0) parts.push(`${gradeCount}条成绩记录`);
  return `已有${parts.join('、')}，不能删除`;
}

function teacherDeleteReason(row: RowDataPacket) {
  const offeringCount = toCount(row.offering_count);
  return offeringCount > 0 ? `已有${offeringCount}条开课记录，不能删除` : null;
}

function courseDeleteReason(row: RowDataPacket) {
  const offeringCount = toCount(row.offering_count);
  const selectionCount = toCount(row.selection_count);
  if (offeringCount === 0 && selectionCount === 0) return null;
  const parts = [];
  if (offeringCount > 0) parts.push(`${offeringCount}条开课记录`);
  if (selectionCount > 0) parts.push(`${selectionCount}条选课记录`);
  return `已有${parts.join('、')}，不能删除`;
}

function offeringDeleteReason(row: RowDataPacket) {
  const selectionCount = toCount(row.selection_count);
  return selectionCount > 0 ? `已有${selectionCount}条选课记录，不能删除` : null;
}

function addDeleteState(row: RowDataPacket, reason: string | null) {
  return {
    ...row,
    can_delete: reason ? 0 : 1,
    delete_reason: reason
  };
}

function buildNextSemester(maxSemesterId: string) {
  if (!/^\d{4}(01|02)$/.test(maxSemesterId)) {
    throw new Error('现有最大学期号不符合 YYYY01/YYYY02 规则，无法自动生成下一学期');
  }

  const year = Number(maxSemesterId.slice(0, 4));
  const term = maxSemesterId.slice(4);
  const nextYear = term === '01' ? year : year + 1;
  const nextTerm = term === '01' ? '02' : '01';
  const semesterId = `${nextYear}${nextTerm}`;

  if (nextTerm === '01') {
    return {
      semester_id: semesterId,
      semester_name: `${nextYear}学年第一学期`,
      start_date: `${nextYear}-09-01`,
      end_date: `${nextYear + 1}-01-20`
    };
  }

  return {
    semester_id: semesterId,
    semester_name: `${nextYear}学年第二学期`,
    start_date: `${nextYear + 1}-03-01`,
    end_date: `${nextYear + 1}-07-10`
  };
}

async function upsertUser(
  conn: PoolConnection,
  username: string,
  role: 'student' | 'teacher',
  displayName: string,
  password: string | undefined,
  bindId: string
) {
  const passwordHash = await bcrypt.hash(password || DEFAULT_PASSWORD, 10);
  const studentId = role === 'student' ? bindId : null;
  const staffId = role === 'teacher' ? bindId : null;
  await conn.execute(
    `INSERT INTO users (username, password_hash, role, display_name, student_id, staff_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       student_id = VALUES(student_id),
       staff_id = VALUES(staff_id),
       role = VALUES(role),
       status = 'active'`,
    [username, passwordHash, role, displayName, studentId, staffId]
  );
}

export async function listDepartments(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>('SELECT * FROM department ORDER BY dept_id');
  return success(res, rows);
}

export async function listClassrooms(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT classroom_id, building, floor_no, room_no, capacity, status
     FROM classrooms
     WHERE status = 'available'
     ORDER BY building, floor_no, room_no`
  );
  return success(res, rows);
}

export async function listStudents(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       s.*, d.dept_name,
       COALESCE(selection_counts.selection_count, 0) AS selection_count,
       COALESCE(grade_counts.grade_count, 0) AS grade_count
     FROM student AS s
     JOIN department AS d ON d.dept_id = s.dept_id
     LEFT JOIN (
       SELECT student_id, COUNT(*) AS selection_count
       FROM course_selection
       GROUP BY student_id
     ) AS selection_counts ON selection_counts.student_id = s.student_id
     LEFT JOIN (
       SELECT cs.student_id, COUNT(g.grade_id) AS grade_count
       FROM course_selection AS cs
       JOIN grades AS g ON g.selection_id = cs.selection_id
       GROUP BY cs.student_id
     ) AS grade_counts ON grade_counts.student_id = s.student_id
     ORDER BY s.student_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, studentDeleteReason(row))));
}

export async function createStudent(req: Request, res: Response) {
  const body = req.body;
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO student (student_id, name, sex, date_of_birth, native_place, mobile_phone, dept_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.student_id,
        body.name,
        body.sex,
        body.date_of_birth,
        body.native_place,
        body.mobile_phone,
        body.dept_id,
        body.status || '正常'
      ]
    );
    await upsertUser(conn, body.student_id, 'student', body.name, body.password, body.student_id);
    await conn.commit();
    return success(res, null, 'created', 201);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateStudent(req: Request, res: Response) {
  const body = req.body;
  await execute(
    `UPDATE student
     SET name = ?, sex = ?, date_of_birth = ?, native_place = ?, mobile_phone = ?, dept_id = ?, status = ?
     WHERE student_id = ?`,
    [
      body.name,
      body.sex,
      body.date_of_birth,
      body.native_place,
      body.mobile_phone,
      body.dept_id,
      body.status || '正常',
      req.params.id
    ]
  );
  await execute('UPDATE users SET display_name = ? WHERE student_id = ?', [body.name, req.params.id]);
  return success(res);
}

export async function deleteStudent(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM course_selection WHERE student_id = ?) AS selection_count,
       (SELECT COUNT(g.grade_id)
        FROM course_selection AS cs
        JOIN grades AS g ON g.selection_id = cs.selection_id
        WHERE cs.student_id = ?) AS grade_count`,
    [req.params.id, req.params.id]
  );
  const reason = studentDeleteReason(dependencyRows[0]);
  if (reason) return fail(res, reason);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM users WHERE student_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM student WHERE student_id = ?', [req.params.id]);
    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function listTeachers(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       t.*, d.dept_name,
       COALESCE(offering_counts.offering_count, 0) AS offering_count
     FROM teacher AS t
     JOIN department AS d ON d.dept_id = t.dept_id
     LEFT JOIN (
       SELECT staff_id, COUNT(*) AS offering_count
       FROM class
       GROUP BY staff_id
     ) AS offering_counts ON offering_counts.staff_id = t.staff_id
     ORDER BY t.staff_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, teacherDeleteReason(row))));
}

export async function createTeacher(req: Request, res: Response) {
  const body = req.body;
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO teacher (staff_id, name, sex, date_of_birth, professional_ranks, salary, dept_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [body.staff_id, body.name, body.sex, body.date_of_birth, body.professional_ranks, body.salary, body.dept_id]
    );
    await upsertUser(conn, body.staff_id, 'teacher', body.name, body.password, body.staff_id);
    await conn.commit();
    return success(res, null, 'created', 201);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateTeacher(req: Request, res: Response) {
  const body = req.body;
  await execute(
    `UPDATE teacher
     SET name = ?, sex = ?, date_of_birth = ?, professional_ranks = ?, salary = ?, dept_id = ?
     WHERE staff_id = ?`,
    [body.name, body.sex, body.date_of_birth, body.professional_ranks, body.salary, body.dept_id, req.params.id]
  );
  await execute('UPDATE users SET display_name = ? WHERE staff_id = ?', [body.name, req.params.id]);
  return success(res);
}

export async function deleteTeacher(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    'SELECT COUNT(*) AS offering_count FROM class WHERE staff_id = ?',
    [req.params.id]
  );
  const reason = teacherDeleteReason(dependencyRows[0]);
  if (reason) return fail(res, reason);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM users WHERE staff_id = ?', [req.params.id]);
    await conn.execute('DELETE FROM teacher WHERE staff_id = ?', [req.params.id]);
    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function listCourses(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.*, d.dept_name,
       COALESCE(offering_counts.offering_count, 0) AS offering_count,
       COALESCE(selection_counts.selection_count, 0) AS selection_count
     FROM course AS c
     JOIN department AS d ON d.dept_id = c.dept_id
     LEFT JOIN (
       SELECT course_id, COUNT(*) AS offering_count
       FROM class
       GROUP BY course_id
     ) AS offering_counts ON offering_counts.course_id = c.course_id
     LEFT JOIN (
       SELECT course_id, COUNT(*) AS selection_count
       FROM course_selection
       GROUP BY course_id
     ) AS selection_counts ON selection_counts.course_id = c.course_id
     ORDER BY c.course_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, courseDeleteReason(row))));
}

export async function createCourse(req: Request, res: Response) {
  const body = req.body;
  await execute(
    `INSERT INTO course (course_id, course_name, credit, credit_hours, dept_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.course_id, body.course_name, body.credit, body.credit_hours, body.dept_id]
  );
  return success(res, null, 'created', 201);
}

export async function updateCourse(req: Request, res: Response) {
  const body = req.body;
  await execute(
    `UPDATE course
     SET course_name = ?, credit = ?, credit_hours = ?, dept_id = ?
     WHERE course_id = ?`,
    [body.course_name, body.credit, body.credit_hours, body.dept_id, req.params.id]
  );
  return success(res);
}

export async function deleteCourse(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM class WHERE course_id = ?) AS offering_count,
       (SELECT COUNT(*) FROM course_selection WHERE course_id = ?) AS selection_count`,
    [req.params.id, req.params.id]
  );
  const reason = courseDeleteReason(dependencyRows[0]);
  if (reason) return fail(res, reason);

  await execute('DELETE FROM course WHERE course_id = ?', [req.params.id]);
  return success(res);
}

export async function listSemesters(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       semester_id,
       semester_name,
       DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
       is_current,
       created_at,
       updated_at
     FROM semesters
     ORDER BY semester_id DESC`
  );
  return success(res, rows);
}

export async function createSemester(req: Request, res: Response) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT semester_id FROM semesters ORDER BY semester_id DESC LIMIT 1 FOR UPDATE'
    );
    const maxSemesterId = rows[0]?.semester_id as string | undefined;
    if (!maxSemesterId) {
      await conn.rollback();
      return fail(res, '暂无已有学期，无法自动生成下一学期');
    }

    const nextSemester = buildNextSemester(maxSemesterId);
    await conn.execute(
      `INSERT INTO semesters (semester_id, semester_name, start_date, end_date, is_current)
       VALUES (?, ?, ?, ?, 0)`,
      [
        nextSemester.semester_id,
        nextSemester.semester_name,
        nextSemester.start_date,
        nextSemester.end_date
      ]
    );
    await conn.commit();
    return success(res, nextSemester, 'created', 201);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateSemester(_req: Request, res: Response) {
  return fail(res, '学期号、学期名和日期由系统规则生成，不允许手动编辑');
}

export async function setCurrentSemester(req: Request, res: Response) {
  const semesterId = req.params.id;
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT semester_id FROM semesters WHERE semester_id = ? FOR UPDATE',
      [semesterId]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return fail(res, '学期不存在', 404);
    }
    await conn.execute('UPDATE semesters SET is_current = 0');
    await conn.execute('UPDATE semesters SET is_current = 1 WHERE semester_id = ?', [semesterId]);
    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteSemester(_req: Request, res: Response) {
  return fail(res, '学期作为历史核心维度不允许删除');
}

export async function listCourseOfferings(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id, c.semester, s.semester_name, c.course_id, co.course_name,
       c.staff_id, t.name AS teacher_name, c.class_time, c.classroom,
       c.capacity, c.status,
       COALESCE(selected_counts.selected_count, 0) AS selected_count,
       COALESCE(selection_counts.selection_count, 0) AS selection_count
     FROM class AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN semesters AS s ON s.semester_id = c.semester
     LEFT JOIN (
       SELECT semester, course_id, staff_id, COUNT(*) AS selected_count
       FROM course_selection
       WHERE selection_status = 'selected'
       GROUP BY semester, course_id, staff_id
     ) AS selected_counts
       ON selected_counts.semester = c.semester
      AND selected_counts.course_id = c.course_id
      AND selected_counts.staff_id = c.staff_id
     LEFT JOIN (
       SELECT semester, course_id, staff_id, COUNT(*) AS selection_count
       FROM course_selection
       GROUP BY semester, course_id, staff_id
     ) AS selection_counts
       ON selection_counts.semester = c.semester
      AND selection_counts.course_id = c.course_id
      AND selection_counts.staff_id = c.staff_id
     ORDER BY c.semester DESC, c.course_id, c.staff_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, offeringDeleteReason(row))));
}

export async function createCourseOffering(req: Request, res: Response) {
  const body = req.body;
  const payload = await validateCourseOfferingPayload(body, res);
  if (!payload) return null;
  await execute(
    `INSERT INTO class (semester, course_id, staff_id, class_time, capacity, status, classroom)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      body.semester,
      body.course_id,
      body.staff_id,
      body.class_time,
      payload.capacity,
      payload.status,
      payload.classroom
    ]
  );
  return success(res, null, 'created', 201);
}

export async function updateCourseOffering(req: Request, res: Response) {
  const body = req.body;
  const payload = await validateCourseOfferingPayload(body, res, Number(req.params.id));
  if (!payload) return null;
  await execute(
    `UPDATE class
     SET semester = ?, course_id = ?, staff_id = ?, class_time = ?, capacity = ?, status = ?, classroom = ?
     WHERE offering_id = ?`,
    [
      body.semester,
      body.course_id,
      body.staff_id,
      body.class_time,
      payload.capacity,
      payload.status,
      payload.classroom,
      req.params.id
    ]
  );
  return success(res);
}

export async function deleteCourseOffering(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id,
       COUNT(cs.selection_id) AS selection_count
     FROM class AS c
     LEFT JOIN course_selection AS cs
       ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
     WHERE c.offering_id = ?
     GROUP BY c.offering_id`,
    [req.params.id]
  );
  if (dependencyRows.length === 0) return fail(res, '开课记录不存在', 404);
  const reason = offeringDeleteReason(dependencyRows[0]);
  if (reason) return fail(res, reason);

  await execute('DELETE FROM class WHERE offering_id = ?', [req.params.id]);
  return success(res);
}

async function validateCourseOfferingPayload(body: any, res: Response, offeringId?: number) {
  const capacity = Number(body.capacity);
  const status = body.status || 'open';
  const classroom = body.classroom;

  if (!classroom) {
    fail(res, '请选择教室');
    return null;
  }
  if (!Number.isFinite(capacity) || capacity <= 0) {
    fail(res, '课程容量必须大于 0');
    return null;
  }
  if (!OFFERING_STATUS_VALUES.has(status)) {
    fail(res, '课程状态只能是 open 或 closed');
    return null;
  }

  const classroomRows = await query<RowDataPacket[]>(
    `SELECT classroom_id, capacity
     FROM classrooms
     WHERE classroom_id = ? AND status = 'available'
     LIMIT 1`,
    [classroom]
  );
  const classroomRow = classroomRows[0];
  if (!classroomRow) {
    fail(res, '教室不存在或不可用', 404);
    return null;
  }
  if (capacity > Number(classroomRow.capacity)) {
    fail(res, `课程容量不能超过教室容量 ${classroomRow.capacity}`);
    return null;
  }

  if (offeringId) {
    const selectedRows = await query<RowDataPacket[]>(
      `SELECT COUNT(cs.selection_id) AS selected_count
       FROM class AS c
       LEFT JOIN course_selection AS cs
         ON cs.semester = c.semester AND cs.course_id = c.course_id AND cs.staff_id = c.staff_id
        AND cs.selection_status = 'selected'
       WHERE c.offering_id = ?`,
      [offeringId]
    );
    const selectedCount = Number(selectedRows[0]?.selected_count || 0);
    if (capacity < selectedCount) {
      fail(res, `课程容量不能小于当前已选人数 ${selectedCount}`);
      return null;
    }
  }

  return { capacity, status, classroom };
}

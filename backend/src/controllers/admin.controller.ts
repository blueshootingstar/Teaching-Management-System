import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { execute, getConnection, query } from '../db/mysql';
import { courseSelectionWindowPayload, getCourseSelectionOpen, setCourseSelectionOpen } from '../services/systemSettings';
import type { AuthenticatedRequest } from '../types/auth';
import { fail, success } from '../utils/response';

const DEFAULT_PASSWORD = '123456';
const OFFERING_STATUS_VALUES = new Set(['open', 'closed']);
const SEX_VALUES = new Set(['男', '女']);
const STUDENT_ID_PATTERN = /^1\d{3}$/;
const TEACHER_ID_PATTERN = /^0\d{3}$/;

type FieldErrors = Record<string, string>;

function toCount(value: unknown) {
  return Number(value || 0);
}

function failFieldErrors(res: Response, fieldErrors: FieldErrors) {
  return fail(res, '表单校验失败', 400, { fieldErrors });
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function cleanOptionalPassword(value: unknown) {
  const password = cleanText(value);
  return password ? password : undefined;
}

function validDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() <= todayUtc;
}

async function existsInTable(table: string, column: string, value: unknown) {
  const rows = await query<RowDataPacket[]>(
    `SELECT 1 AS ok FROM ${table} WHERE ${column} = ? LIMIT 1`,
    [value]
  );
  return rows.length > 0;
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
  const substitutionCount = toCount(row.substitution_count);
  if (offeringCount === 0 && substitutionCount === 0) return null;
  const parts = [];
  if (offeringCount > 0) parts.push(`${offeringCount}条开课记录`);
  if (substitutionCount > 0) parts.push(`${substitutionCount}条代课申请`);
  return `已有${parts.join('、')}，不能删除`;
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
  const substitutionCount = toCount(row.substitution_count);
  if (selectionCount === 0 && substitutionCount === 0) return null;
  const parts = [];
  if (selectionCount > 0) parts.push(`${selectionCount}条选课记录`);
  if (substitutionCount > 0) parts.push(`${substitutionCount}条代课申请`);
  return `已有${parts.join('、')}，不能删除`;
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

function parseClassroom(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  const match = text.match(/^([A-Z])(.+)$/);
  if (!match) return null;
  return {
    classroom: `${match[1]}${match[2]}`,
    buildingNo: match[1],
    roomNo: match[2]
  };
}

function courseOfferingDuplicateFieldErrors(error: unknown): FieldErrors | null {
  const maybeMysqlError = error as { code?: string; message?: string };
  if (maybeMysqlError?.code !== 'ER_DUP_ENTRY') return null;

  const message = String(maybeMysqlError.message || '');
  if (message.includes('uk_course_offerings_classroom_time')) {
    return {
      class_time: '该时间段教室已被占用',
      classroom: '该教室在该时间已有课程'
    };
  }
  if (message.includes('uk_course_offerings_business')) {
    return {
      course_id: '该学期该教师已开设这门课程',
      staff_id: '该教师本学期已开设这门课程'
    };
  }

  return null;
}

function identityFormatFieldErrors(error: unknown): FieldErrors | null {
  const maybeMysqlError = error as { code?: string; message?: string };
  const message = String(maybeMysqlError?.message || '');

  if (maybeMysqlError?.code !== 'ER_CHECK_CONSTRAINT_VIOLATED' && !message.includes('chk_')) {
    return null;
  }
  if (message.includes('chk_student_id_format')) {
    return { student_id: '学号需为 1 开头的 4 位数字' };
  }
  if (message.includes('chk_teacher_id_format')) {
    return { staff_id: '教工号需为 0 开头的 4 位数字' };
  }

  return null;
}

async function upsertUser(
  conn: PoolConnection,
  role: 'student' | 'teacher',
  password: string | undefined,
  bindId: string
) {
  const passwordHash = await bcrypt.hash(password || DEFAULT_PASSWORD, 10);
  const accountTable = role === 'student' ? 'student_accounts' : 'teacher_accounts';
  const bindColumn = role === 'student' ? 'student_id' : 'staff_id';
  const [existingRows] = await conn.query<RowDataPacket[]>(
    `SELECT u.user_id
     FROM ${accountTable} AS account
     JOIN users AS u ON u.user_id = account.user_id
     WHERE account.${bindColumn} = ?
     LIMIT 1`,
    [bindId]
  );
  const existingUserId = existingRows[0]?.user_id;
  if (existingUserId) {
    await conn.execute('UPDATE users SET status = ? WHERE user_id = ?', ['active', existingUserId]);
    if (password) {
      await conn.execute(
        'UPDATE users SET password_hash = ? WHERE user_id = ?',
        [passwordHash, existingUserId]
      );
    }
    return;
  }

  const [userResult] = await conn.execute<ResultSetHeader>(
    `INSERT INTO users (password_hash, status)
     VALUES (?, 'active')`,
    [passwordHash]
  );
  await conn.execute(
    `INSERT INTO ${accountTable} (user_id, ${bindColumn})
     VALUES (?, ?)`,
    [userResult.insertId, bindId]
  );
}

async function updateBoundUserPassword(
  conn: PoolConnection,
  role: 'student' | 'teacher',
  bindId: string,
  password: string | undefined
) {
  if (!password) return;
  const accountTable = role === 'student' ? 'student_accounts' : 'teacher_accounts';
  const bindColumn = role === 'student' ? 'student_id' : 'staff_id';
  const passwordHash = await bcrypt.hash(password, 10);
  await conn.execute(
    `UPDATE users AS u
     JOIN ${accountTable} AS account ON account.user_id = u.user_id
     SET u.password_hash = ?
     WHERE account.${bindColumn} = ?`,
    [passwordHash, bindId]
  );
}

async function validateStudentPayload(body: any, mode: 'create' | 'update', currentStudentId?: string) {
  const payload = {
    student_id: cleanText(body.student_id || currentStudentId),
    name: cleanText(body.name),
    sex: cleanText(body.sex),
    date_of_birth: cleanText(body.date_of_birth),
    native_place: cleanText(body.native_place),
    mobile_phone: cleanText(body.mobile_phone),
    dept_id: cleanText(body.dept_id),
    status_code: cleanText(body.status_code || body.status || 'normal'),
    password: cleanOptionalPassword(body.password)
  };
  const fieldErrors: FieldErrors = {};

  if (!payload.student_id) fieldErrors.student_id = '请输入学号';
  else if (!STUDENT_ID_PATTERN.test(payload.student_id)) fieldErrors.student_id = '学号需为 1 开头的 4 位数字';
  else if (mode === 'create' && await existsInTable('student', 'student_id', payload.student_id)) {
    fieldErrors.student_id = '学号已存在';
  }

  if (!payload.name) fieldErrors.name = '请输入姓名';
  if (!SEX_VALUES.has(payload.sex)) fieldErrors.sex = '请选择性别';
  if (!payload.date_of_birth) fieldErrors.date_of_birth = '请选择出生日期';
  else if (!validDateString(payload.date_of_birth)) fieldErrors.date_of_birth = '出生日期格式不正确';
  else if (payload.date_of_birth > new Date().toISOString().slice(0, 10)) {
    fieldErrors.date_of_birth = '出生日期不能晚于今天';
  }
  if (!payload.native_place) fieldErrors.native_place = '请输入籍贯';
  if (!payload.mobile_phone) fieldErrors.mobile_phone = '请输入电话';
  else if (!/^\d{5,20}$/.test(payload.mobile_phone)) {
    fieldErrors.mobile_phone = '电话需为 5-20 位数字';
  }
  if (!payload.dept_id) fieldErrors.dept_id = '请选择院系';
  else if (!await existsInTable('department', 'dept_id', payload.dept_id)) {
    fieldErrors.dept_id = '院系不存在';
  }
  if (!payload.status_code) fieldErrors.status_code = '请选择状态';
  else if (!await existsInTable('student_statuses', 'status_code', payload.status_code)) {
    fieldErrors.status_code = '学生状态不存在';
  }
  if (payload.password && payload.password.length < 6) {
    fieldErrors.password = '密码至少 6 位';
  }

  return { payload, fieldErrors };
}

async function validateTeacherPayload(body: any, mode: 'create' | 'update', currentStaffId?: string) {
  const professionalRankId = Number(body.professional_rank_id || body.professionalRankId);
  const salary = Number(body.salary);
  const payload = {
    staff_id: cleanText(body.staff_id || currentStaffId),
    name: cleanText(body.name),
    sex: cleanText(body.sex),
    date_of_birth: cleanText(body.date_of_birth),
    professional_rank_id: professionalRankId,
    salary,
    dept_id: cleanText(body.dept_id),
    password: cleanOptionalPassword(body.password)
  };
  const fieldErrors: FieldErrors = {};

  if (!payload.staff_id) fieldErrors.staff_id = '请输入教工号';
  else if (!TEACHER_ID_PATTERN.test(payload.staff_id)) fieldErrors.staff_id = '教工号需为 0 开头的 4 位数字';
  else if (mode === 'create' && await existsInTable('teacher', 'staff_id', payload.staff_id)) {
    fieldErrors.staff_id = '教工号已存在';
  }

  if (!payload.name) fieldErrors.name = '请输入姓名';
  if (!SEX_VALUES.has(payload.sex)) fieldErrors.sex = '请选择性别';
  if (!payload.date_of_birth) fieldErrors.date_of_birth = '请选择出生日期';
  else if (!validDateString(payload.date_of_birth)) fieldErrors.date_of_birth = '出生日期格式不正确';
  else if (payload.date_of_birth > new Date().toISOString().slice(0, 10)) {
    fieldErrors.date_of_birth = '出生日期不能晚于今天';
  }
  if (!Number.isInteger(payload.professional_rank_id) || payload.professional_rank_id <= 0) {
    fieldErrors.professional_rank_id = '请选择职称';
  } else if (!await existsInTable('professional_ranks', 'rank_id', payload.professional_rank_id)) {
    fieldErrors.professional_rank_id = '职称不存在';
  }
  if (!Number.isFinite(payload.salary) || payload.salary < 0) fieldErrors.salary = '薪资不能小于 0';
  if (!payload.dept_id) fieldErrors.dept_id = '请选择院系';
  else if (!await existsInTable('department', 'dept_id', payload.dept_id)) {
    fieldErrors.dept_id = '院系不存在';
  }
  if (payload.password && payload.password.length < 6) {
    fieldErrors.password = '密码至少 6 位';
  }

  return { payload, fieldErrors };
}

async function validateCoursePayload(body: any, mode: 'create' | 'update', currentCourseId?: string) {
  const credit = Number(body.credit);
  const creditHours = Number(body.credit_hours);
  const payload = {
    course_id: cleanText(body.course_id || currentCourseId),
    course_name: cleanText(body.course_name),
    credit,
    credit_hours: creditHours,
    dept_id: cleanText(body.dept_id)
  };
  const fieldErrors: FieldErrors = {};

  if (!payload.course_id) fieldErrors.course_id = '请输入课程号';
  else if (!/^\d{8}$/.test(payload.course_id)) fieldErrors.course_id = '课程号需为 8 位数字';
  else if (mode === 'create' && await existsInTable('course', 'course_id', payload.course_id)) {
    fieldErrors.course_id = '课程号已存在';
  }
  if (!payload.course_name) fieldErrors.course_name = '请输入课程名';
  if (!Number.isFinite(payload.credit) || payload.credit <= 0) fieldErrors.credit = '学分必须大于 0';
  if (!Number.isInteger(payload.credit_hours) || payload.credit_hours <= 0) {
    fieldErrors.credit_hours = '请选择学时';
  } else if (!await existsInTable('course_hour_options', 'credit_hours', payload.credit_hours)) {
    fieldErrors.credit_hours = '学时必须从固定选项中选择';
  }
  if (!payload.dept_id) fieldErrors.dept_id = '请选择院系';
  else if (!await existsInTable('department', 'dept_id', payload.dept_id)) {
    fieldErrors.dept_id = '院系不存在';
  }

  return { payload, fieldErrors };
}

export async function listDepartments(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>('SELECT * FROM department ORDER BY dept_id');
  return success(res, rows);
}

export async function listStudentStatuses(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT status_code, status_name, can_select_course
     FROM student_statuses
     ORDER BY FIELD(status_code, 'normal', 'suspended', 'graduated'), status_code`
  );
  return success(res, rows);
}

export async function listProfessionalRanks(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT rank_id, rank_name
     FROM professional_ranks
     ORDER BY rank_id`
  );
  return success(res, rows);
}

export async function listCourseHourOptions(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT credit_hours, required_weeks
     FROM course_hour_options
     ORDER BY credit_hours`
  );
  return success(res, rows);
}

export async function listClassrooms(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT CONCAT(building_no, room_no) AS classroom, building_no, room_no, capacity, status
     FROM classrooms
     WHERE status = 'available'
     ORDER BY building_no, CAST(room_no AS UNSIGNED), room_no`
  );
  return success(res, rows);
}

export async function getCourseSelectionWindow(_req: Request, res: Response) {
  const isOpen = await getCourseSelectionOpen();
  return success(res, courseSelectionWindowPayload(isOpen));
}

export async function updateCourseSelectionWindow(req: Request, res: Response) {
  const isOpen = req.body?.is_open === true || req.body?.is_open === 1 || req.body?.is_open === '1';
  await setCourseSelectionOpen(isOpen);
  return success(res, courseSelectionWindowPayload(isOpen));
}

export async function sendNotification(req: AuthenticatedRequest, res: Response) {
  const title = String(req.body?.title || '').trim();
  const content = String(req.body?.content || '').trim();
  const scope = String(req.body?.scope || 'all').trim();
  const senderUserId = req.user?.userId;

  if (!senderUserId) return fail(res, '未登录', 401);
  if (!title) return fail(res, '请输入通知标题');
  if (!content) return fail(res, '请输入通知内容');
  if (!['all', 'students', 'teachers'].includes(scope)) {
    return fail(res, '通知范围只能是 all、students 或 teachers');
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [mailResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO mail_items (sender_user_id)
       VALUES (?)`,
      [senderUserId]
    );
    await conn.execute(
      `INSERT INTO notification_messages (mail_item_id, title, content)
       VALUES (?, ?, ?)`,
      [mailResult.insertId, title, content]
    );

    if (scope === 'all' || scope === 'students') {
      await conn.execute(
        `INSERT INTO mail_recipients (mail_item_id, recipient_user_id)
         SELECT ?, user_id
         FROM student_accounts`,
        [mailResult.insertId]
      );
    }
    if (scope === 'all' || scope === 'teachers') {
      await conn.execute(
        `INSERT INTO mail_recipients (mail_item_id, recipient_user_id)
         SELECT ?, user_id
         FROM teacher_accounts`,
        [mailResult.insertId]
      );
    }

    await conn.commit();
    return success(res, { mail_item_id: mailResult.insertId }, 'created', 201);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function listNotifications(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.userId) return fail(res, '未登录', 401);

  const rows = await query<RowDataPacket[]>(
    `SELECT
       mi.mail_item_id,
       nm.title,
       nm.content,
       mi.created_at,
       COALESCE(aa.display_name, aa.username, '系统管理员') AS sender_name,
       COUNT(mr.recipient_id) AS recipient_count,
       SUM(CASE WHEN mr.read_at IS NULL THEN 0 ELSE 1 END) AS read_count
     FROM mail_items AS mi
     JOIN notification_messages AS nm ON nm.mail_item_id = mi.mail_item_id
     LEFT JOIN admin_accounts AS aa ON aa.user_id = mi.sender_user_id
     LEFT JOIN mail_recipients AS mr ON mr.mail_item_id = mi.mail_item_id
     GROUP BY mi.mail_item_id, nm.title, nm.content, mi.created_at, aa.display_name, aa.username
     ORDER BY mi.created_at DESC, mi.mail_item_id DESC`
  );

  return success(res, rows);
}

export async function deleteNotification(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.userId) return fail(res, '未登录', 401);

  const result = await execute(
    `DELETE mi
     FROM mail_items AS mi
     JOIN notification_messages AS nm ON nm.mail_item_id = mi.mail_item_id
     WHERE mi.mail_item_id = ?`,
    [req.params.mailItemId]
  );
  if (result.affectedRows === 0) {
    return fail(res, '通知不存在', 404);
  }

  return success(res);
}

export async function listStudents(_req: Request, res: Response) {
  const rows = await query<RowDataPacket[]>(
    `SELECT
       s.*, ss.status_name, ss.can_select_course, d.dept_name,
       COALESCE(selection_counts.selection_count, 0) AS selection_count,
       COALESCE(grade_counts.grade_count, 0) AS grade_count
     FROM student AS s
     JOIN student_statuses AS ss ON ss.status_code = s.status_code
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
  const { payload, fieldErrors } = await validateStudentPayload(body, 'create');
  if (Object.keys(fieldErrors).length > 0) return failFieldErrors(res, fieldErrors);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO student (student_id, name, sex, date_of_birth, native_place, mobile_phone, dept_id, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.student_id,
        payload.name,
        payload.sex,
        payload.date_of_birth,
        payload.native_place,
        payload.mobile_phone,
        payload.dept_id,
        payload.status_code
      ]
    );
    await upsertUser(conn, 'student', payload.password, payload.student_id);
    await conn.commit();
    return success(res, null, 'created', 201);
  } catch (error) {
    await conn.rollback();
    const fieldErrors = identityFormatFieldErrors(error);
    if (fieldErrors) return failFieldErrors(res, fieldErrors);
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateStudent(req: Request, res: Response) {
  const body = req.body;
  const studentId = String(req.params.id);
  if (!await existsInTable('student', 'student_id', studentId)) {
    return fail(res, '学生不存在', 404);
  }
  const { payload, fieldErrors } = await validateStudentPayload(body, 'update', studentId);
  if (Object.keys(fieldErrors).length > 0) return failFieldErrors(res, fieldErrors);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE student
       SET name = ?, sex = ?, date_of_birth = ?, native_place = ?, mobile_phone = ?, dept_id = ?, status_code = ?
       WHERE student_id = ?`,
      [
        payload.name,
        payload.sex,
        payload.date_of_birth,
        payload.native_place,
        payload.mobile_phone,
        payload.dept_id,
        payload.status_code,
        studentId
      ]
    );
    await updateBoundUserPassword(conn, 'student', studentId, payload.password);
    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    const fieldErrors = identityFormatFieldErrors(error);
    if (fieldErrors) return failFieldErrors(res, fieldErrors);
    throw error;
  } finally {
    conn.release();
  }
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
    await conn.execute(
      `DELETE u
       FROM users AS u
       JOIN student_accounts AS sa ON sa.user_id = u.user_id
       WHERE sa.student_id = ?`,
      [req.params.id]
    );
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
       t.*, pr.rank_name AS professional_rank_name, pr.rank_name AS professional_ranks, d.dept_name,
       COALESCE(offering_counts.offering_count, 0) AS offering_count,
       COALESCE(substitution_counts.substitution_count, 0) AS substitution_count
     FROM teacher AS t
     JOIN professional_ranks AS pr ON pr.rank_id = t.professional_rank_id
     JOIN department AS d ON d.dept_id = t.dept_id
     LEFT JOIN (
       SELECT staff_id, COUNT(*) AS offering_count
       FROM course_offerings
       GROUP BY staff_id
     ) AS offering_counts ON offering_counts.staff_id = t.staff_id
     LEFT JOIN (
       SELECT staff_id, SUM(substitution_count) AS substitution_count
       FROM (
         SELECT c.staff_id, COUNT(*) AS substitution_count
         FROM substitution_requests AS sr
         JOIN course_offerings AS c ON c.offering_id = sr.offering_id
         GROUP BY c.staff_id
         UNION ALL
         SELECT substitute_staff_id AS staff_id, COUNT(*) AS substitution_count
         FROM substitution_requests
         GROUP BY substitute_staff_id
       ) AS teacher_substitutions
       GROUP BY staff_id
     ) AS substitution_counts ON substitution_counts.staff_id = t.staff_id
     ORDER BY t.staff_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, teacherDeleteReason(row))));
}

export async function createTeacher(req: Request, res: Response) {
  const body = req.body;
  const { payload, fieldErrors } = await validateTeacherPayload(body, 'create');
  if (Object.keys(fieldErrors).length > 0) return failFieldErrors(res, fieldErrors);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO teacher (staff_id, name, sex, date_of_birth, professional_rank_id, salary, dept_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.staff_id,
        payload.name,
        payload.sex,
        payload.date_of_birth,
        payload.professional_rank_id,
        payload.salary,
        payload.dept_id
      ]
    );
    await upsertUser(conn, 'teacher', payload.password, payload.staff_id);
    await conn.commit();
    return success(res, null, 'created', 201);
  } catch (error) {
    await conn.rollback();
    const fieldErrors = identityFormatFieldErrors(error);
    if (fieldErrors) return failFieldErrors(res, fieldErrors);
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateTeacher(req: Request, res: Response) {
  const body = req.body;
  const staffId = String(req.params.id);
  if (!await existsInTable('teacher', 'staff_id', staffId)) {
    return fail(res, '教师不存在', 404);
  }
  const { payload, fieldErrors } = await validateTeacherPayload(body, 'update', staffId);
  if (Object.keys(fieldErrors).length > 0) return failFieldErrors(res, fieldErrors);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE teacher
       SET name = ?, sex = ?, date_of_birth = ?, professional_rank_id = ?, salary = ?, dept_id = ?
       WHERE staff_id = ?`,
      [
        payload.name,
        payload.sex,
        payload.date_of_birth,
        payload.professional_rank_id,
        payload.salary,
        payload.dept_id,
        staffId
      ]
    );
    await updateBoundUserPassword(conn, 'teacher', staffId, payload.password);
    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    const fieldErrors = identityFormatFieldErrors(error);
    if (fieldErrors) return failFieldErrors(res, fieldErrors);
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteTeacher(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM course_offerings WHERE staff_id = ?) AS offering_count,
       (SELECT COUNT(*)
        FROM substitution_requests AS sr
        JOIN course_offerings AS c ON c.offering_id = sr.offering_id
        WHERE c.staff_id = ? OR sr.substitute_staff_id = ?) AS substitution_count`,
    [req.params.id, req.params.id, req.params.id]
  );
  const reason = teacherDeleteReason(dependencyRows[0]);
  if (reason) return fail(res, reason);

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `DELETE u
       FROM users AS u
       JOIN teacher_accounts AS ta ON ta.user_id = u.user_id
       WHERE ta.staff_id = ?`,
      [req.params.id]
    );
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
       c.*, cho.required_weeks, d.dept_name,
       COALESCE(offering_counts.offering_count, 0) AS offering_count,
       COALESCE(selection_counts.selection_count, 0) AS selection_count
     FROM course AS c
     JOIN course_hour_options AS cho ON cho.credit_hours = c.credit_hours
     JOIN department AS d ON d.dept_id = c.dept_id
     LEFT JOIN (
       SELECT course_id, COUNT(*) AS offering_count
       FROM course_offerings
       GROUP BY course_id
     ) AS offering_counts ON offering_counts.course_id = c.course_id
     LEFT JOIN (
       SELECT co.course_id, COUNT(*) AS selection_count
       FROM course_selection AS cs
       JOIN course_offerings AS co ON co.offering_id = cs.offering_id
       GROUP BY co.course_id
     ) AS selection_counts ON selection_counts.course_id = c.course_id
     ORDER BY c.course_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, courseDeleteReason(row))));
}

export async function createCourse(req: Request, res: Response) {
  const body = req.body;
  const { payload, fieldErrors } = await validateCoursePayload(body, 'create');
  if (Object.keys(fieldErrors).length > 0) return failFieldErrors(res, fieldErrors);

  await execute(
    `INSERT INTO course (course_id, course_name, credit, credit_hours, dept_id)
     VALUES (?, ?, ?, ?, ?)`,
    [payload.course_id, payload.course_name, payload.credit, payload.credit_hours, payload.dept_id]
  );
  return success(res, null, 'created', 201);
}

export async function updateCourse(req: Request, res: Response) {
  const body = req.body;
  const courseId = String(req.params.id);
  if (!await existsInTable('course', 'course_id', courseId)) {
    return fail(res, '课程不存在', 404);
  }
  const { payload, fieldErrors } = await validateCoursePayload(body, 'update', courseId);
  if (Object.keys(fieldErrors).length > 0) return failFieldErrors(res, fieldErrors);

  await execute(
    `UPDATE course
     SET course_name = ?, credit = ?, credit_hours = ?, dept_id = ?
     WHERE course_id = ?`,
    [payload.course_name, payload.credit, payload.credit_hours, payload.dept_id, courseId]
  );
  return success(res);
}

export async function deleteCourse(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM course_offerings WHERE course_id = ?) AS offering_count,
       (SELECT COUNT(*)
        FROM course_selection AS cs
        JOIN course_offerings AS co ON co.offering_id = cs.offering_id
        WHERE co.course_id = ?) AS selection_count`,
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
       is_current
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
       c.offering_id, c.semester_id AS semester, s.semester_name, c.course_id, co.course_name,
       c.staff_id, t.name AS teacher_name, c.class_time,
       CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom,
       c.capacity, c.status,
       COALESCE(selection_counts.selection_count, 0) AS selected_count,
       COALESCE(selection_counts.selection_count, 0) AS selection_count
     FROM course_offerings AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN teacher AS t ON t.staff_id = c.staff_id
     LEFT JOIN semesters AS s ON s.semester_id = c.semester_id
     LEFT JOIN (
       SELECT offering_id, COUNT(*) AS selection_count
       FROM course_selection
       GROUP BY offering_id
     ) AS selection_counts
       ON selection_counts.offering_id = c.offering_id
     ORDER BY c.semester_id DESC, c.course_id, c.staff_id`
  );
  return success(res, rows.map((row) => addDeleteState(row, offeringDeleteReason(row))));
}

export async function createCourseOffering(req: Request, res: Response) {
  const body = req.body;
  const payload = await validateCourseOfferingPayload(body, res);
  if (!payload) return null;
  try {
    await execute(
      `INSERT INTO course_offerings (semester_id, course_id, staff_id, class_time, capacity, status, classroom_building_no, classroom_room_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.semester,
        body.course_id,
        body.staff_id,
        body.class_time,
        payload.capacity,
        payload.status,
        payload.classroomBuildingNo,
        payload.classroomRoomNo
      ]
    );
    return success(res, null, 'created', 201);
  } catch (error) {
    const fieldErrors = courseOfferingDuplicateFieldErrors(error);
    if (fieldErrors) return failFieldErrors(res, fieldErrors);
    throw error;
  }
}

export async function updateCourseOffering(req: Request, res: Response) {
  const body = req.body;
  const payload = await validateCourseOfferingPayload(body, res, Number(req.params.id));
  if (!payload) return null;
  try {
    await execute(
      `UPDATE course_offerings
       SET semester_id = ?, course_id = ?, staff_id = ?, class_time = ?, capacity = ?, status = ?,
           classroom_building_no = ?, classroom_room_no = ?
       WHERE offering_id = ?`,
      [
        body.semester,
        body.course_id,
        body.staff_id,
        body.class_time,
        payload.capacity,
        payload.status,
        payload.classroomBuildingNo,
        payload.classroomRoomNo,
        req.params.id
      ]
    );
    return success(res);
  } catch (error) {
    const fieldErrors = courseOfferingDuplicateFieldErrors(error);
    if (fieldErrors) return failFieldErrors(res, fieldErrors);
    throw error;
  }
}

export async function deleteCourseOffering(req: Request, res: Response) {
  const dependencyRows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id,
       COUNT(DISTINCT cs.selection_id) AS selection_count,
       COUNT(DISTINCT sr.mail_item_id) AS substitution_count
     FROM course_offerings AS c
     LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
     LEFT JOIN substitution_requests AS sr ON sr.offering_id = c.offering_id
     WHERE c.offering_id = ?
     GROUP BY c.offering_id`,
    [req.params.id]
  );
  if (dependencyRows.length === 0) return fail(res, '开课记录不存在', 404);
  const reason = offeringDeleteReason(dependencyRows[0]);
  if (reason) return fail(res, reason);

  await execute('DELETE FROM course_offerings WHERE offering_id = ?', [req.params.id]);
  return success(res);
}

async function validateCourseOfferingPayload(body: any, res: Response, offeringId?: number) {
  const capacity = Number(body.capacity);
  const status = body.status || 'open';
  const classroom = parseClassroom(body.classroom);
  const semester = cleanText(body.semester);
  const courseId = cleanText(body.course_id);
  const staffId = cleanText(body.staff_id);
  const classTime = cleanText(body.class_time);
  const fieldErrors: FieldErrors = {};

  if (!semester) fieldErrors.semester = '请选择学期';
  else if (!await existsInTable('semesters', 'semester_id', semester)) fieldErrors.semester = '学期不存在';
  if (!courseId) fieldErrors.course_id = '请选择课程';
  else if (!await existsInTable('course', 'course_id', courseId)) fieldErrors.course_id = '课程不存在';
  if (!staffId) fieldErrors.staff_id = '请选择教师';
  else if (!await existsInTable('teacher', 'staff_id', staffId)) fieldErrors.staff_id = '教师不存在';
  if (!classTime) fieldErrors.class_time = '请选择上课时间';
  if (Object.keys(fieldErrors).length > 0) {
    failFieldErrors(res, fieldErrors);
    return null;
  }

  if (!classroom) {
    failFieldErrors(res, { classroom: '请选择教室' });
    return null;
  }
  if (!Number.isFinite(capacity) || capacity <= 0) {
    failFieldErrors(res, { capacity: '课程容量必须大于 0' });
    return null;
  }
  if (!OFFERING_STATUS_VALUES.has(status)) {
    failFieldErrors(res, { status: '课程状态只能是 open 或 closed' });
    return null;
  }

  const classroomRows = await query<RowDataPacket[]>(
    `SELECT capacity
     FROM classrooms
     WHERE building_no = ? AND room_no = ? AND status = 'available'
     LIMIT 1`,
    [classroom.buildingNo, classroom.roomNo]
  );
  const classroomRow = classroomRows[0];
  if (!classroomRow) {
    failFieldErrors(res, { classroom: '教室不存在或不可用' });
    return null;
  }
  if (capacity > Number(classroomRow.capacity)) {
    failFieldErrors(res, { capacity: `课程容量不能超过教室容量 ${classroomRow.capacity}` });
    return null;
  }

  const conflictErrors: FieldErrors = {};
  const offeringExcludeSql = offeringId ? ' AND offering_id <> ?' : '';
  const offeringExcludeParams = offeringId ? [offeringId] : [];
  const businessConflictRows = await query<RowDataPacket[]>(
    `SELECT offering_id
     FROM course_offerings
     WHERE semester_id = ? AND course_id = ? AND staff_id = ?${offeringExcludeSql}
     LIMIT 1`,
    [semester, courseId, staffId, ...offeringExcludeParams]
  );
  if (businessConflictRows.length > 0) {
    conflictErrors.course_id = '该学期该教师已开设这门课程';
    conflictErrors.staff_id = '该教师本学期已开设这门课程';
  }

  const classroomConflictRows = await query<RowDataPacket[]>(
    `SELECT offering_id
     FROM course_offerings
     WHERE semester_id = ?
       AND class_time = ?
       AND classroom_building_no = ?
       AND classroom_room_no = ?${offeringExcludeSql}
     LIMIT 1`,
    [semester, classTime, classroom.buildingNo, classroom.roomNo, ...offeringExcludeParams]
  );
  if (classroomConflictRows.length > 0) {
    conflictErrors.class_time = '该时间段教室已被占用';
    conflictErrors.classroom = '该教室在该时间已有课程';
  }
  if (Object.keys(conflictErrors).length > 0) {
    failFieldErrors(res, conflictErrors);
    return null;
  }

  if (offeringId) {
    const selectedRows = await query<RowDataPacket[]>(
      `SELECT COUNT(cs.selection_id) AS selected_count
       FROM course_offerings AS c
       LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
       WHERE c.offering_id = ?`,
      [offeringId]
    );
    const selectedCount = Number(selectedRows[0]?.selected_count || 0);
    if (capacity < selectedCount) {
      failFieldErrors(res, { capacity: `课程容量不能小于当前已选人数 ${selectedCount}` });
      return null;
    }
  }

  return {
    capacity,
    status,
    classroom: classroom.classroom,
    classroomBuildingNo: classroom.buildingNo,
    classroomRoomNo: classroom.roomNo
  };
}

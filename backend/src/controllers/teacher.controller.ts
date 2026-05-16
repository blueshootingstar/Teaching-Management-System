import type { Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { execute, getConnection, query } from '../db/mysql';
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

async function getCurrentSemester() {
  const rows = await query<RowDataPacket[]>(
    `SELECT semester_id
     FROM semesters
     ORDER BY is_current DESC, semester_id DESC
     LIMIT 1`
  );
  return rows[0]?.semester_id as string | undefined;
}

function normalizeWeek(value: unknown) {
  const weekNo = Number(value);
  return Number.isInteger(weekNo) && weekNo >= 1 && weekNo <= 16 ? weekNo : null;
}

async function teacherIsAvailable(
  conn: PoolConnection,
  offeringId: number,
  weekNo: number,
  substituteStaffId: string
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT
       EXISTS (
         SELECT 1
         FROM course_offerings AS busy
         JOIN course AS busy_course ON busy_course.course_id = busy.course_id
         JOIN course_hour_options AS busy_hours ON busy_hours.credit_hours = busy_course.credit_hours
         WHERE busy.staff_id = ?
           AND busy.semester_id = target.semester_id
           AND busy.class_time = target.class_time
           AND ? <= busy_hours.required_weeks
           AND NOT EXISTS (
             SELECT 1
             FROM substitution_requests AS busy_sub
             WHERE busy_sub.offering_id = busy.offering_id
               AND busy_sub.week_no = ?
               AND busy_sub.status = 'accepted'
           )
       ) AS has_regular_conflict,
       EXISTS (
         SELECT 1
         FROM substitution_requests AS accepted_sub
         JOIN course_offerings AS accepted_class ON accepted_class.offering_id = accepted_sub.offering_id
         WHERE accepted_sub.substitute_staff_id = ?
           AND accepted_sub.week_no = ?
           AND accepted_sub.status = 'accepted'
           AND accepted_class.semester_id = target.semester_id
           AND accepted_class.class_time = target.class_time
       ) AS has_substitution_conflict
     FROM course_offerings AS target
     WHERE target.offering_id = ?
     LIMIT 1`,
    [substituteStaffId, weekNo, weekNo, substituteStaffId, weekNo, offeringId]
  );
  const availability = rows[0];
  return availability
    && Number(availability.has_regular_conflict) === 0
    && Number(availability.has_substitution_conflict) === 0;
}

async function getOfferingWeekInfo(
  conn: PoolConnection | null,
  offeringId: number,
  staffId: string
) {
  const sql = `SELECT
       c.offering_id,
       c.semester_id,
       c.class_time,
       c.staff_id,
       co.course_name,
       cho.required_weeks
     FROM course_offerings AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN course_hour_options AS cho ON cho.credit_hours = co.credit_hours
     WHERE c.offering_id = ? AND c.staff_id = ?
     LIMIT 1`;
  const params = [offeringId, staffId];
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(sql, params);
    return rows[0];
  }
  const rows = await query<RowDataPacket[]>(sql, params);
  return rows[0];
}

export async function semesters(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;

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

export async function myCourses(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;

  const semester = String(req.query.semester || '').trim() || (await getCurrentSemester());
  if (!semester) return success(res, []);

  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id, c.semester_id AS semester, co.course_id, co.course_name, co.credit,
       co.credit_hours, cho.required_weeks,
       c.class_time, CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom, c.capacity, c.status,
       COUNT(cs.selection_id) AS selected_count
     FROM course_offerings AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN course_hour_options AS cho ON cho.credit_hours = co.credit_hours
     LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
     WHERE c.staff_id = ? AND c.semester_id = ?
     GROUP BY c.offering_id, c.semester_id, co.course_id, co.course_name, co.credit,
              co.credit_hours, cho.required_weeks,
              c.class_time, c.classroom_building_no, c.classroom_room_no, c.capacity, c.status
     ORDER BY c.class_time, co.course_id`,
    [staffId, semester]
  );
  return success(res, rows);
}

export async function timetable(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;

  const semester = String(req.query.semester || '').trim() || (await getCurrentSemester());
  const weekNo = normalizeWeek(req.query.week || 1);
  if (!semester) return success(res, []);
  if (!weekNo) return fail(res, '教学周必须是 1 到 16 的整数');

  const rows = await query<RowDataPacket[]>(
    `SELECT
       c.offering_id,
       c.semester_id AS semester,
       co.course_id,
       co.course_name,
       co.credit_hours,
       cho.required_weeks,
       c.class_time,
       CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom,
       c.staff_id AS original_staff_id,
       owner.name AS original_teacher_name,
       accepted.substitute_staff_id,
       substitute.name AS substitute_teacher_name,
       CASE WHEN accepted.mail_item_id IS NULL THEN 0 ELSE 1 END AS is_substituted,
       CASE WHEN accepted.mail_item_id IS NULL THEN owner.name ELSE substitute.name END AS actual_teacher_name,
       'owner' AS timetable_role
     FROM course_offerings AS c
     JOIN course AS co ON co.course_id = c.course_id
     JOIN course_hour_options AS cho ON cho.credit_hours = co.credit_hours
     JOIN teacher AS owner ON owner.staff_id = c.staff_id
     LEFT JOIN substitution_requests AS accepted
       ON accepted.offering_id = c.offering_id
      AND accepted.week_no = ?
      AND accepted.status = 'accepted'
     LEFT JOIN teacher AS substitute ON substitute.staff_id = accepted.substitute_staff_id
     WHERE c.staff_id = ?
       AND c.semester_id = ?
       AND ? <= cho.required_weeks
     UNION ALL
     SELECT
       c.offering_id,
       c.semester_id AS semester,
       co.course_id,
       co.course_name,
       co.credit_hours,
       cho.required_weeks,
       c.class_time,
       CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom,
       c.staff_id AS original_staff_id,
       owner.name AS original_teacher_name,
       accepted.substitute_staff_id,
       substitute.name AS substitute_teacher_name,
       1 AS is_substituted,
       substitute.name AS actual_teacher_name,
       'substitute' AS timetable_role
     FROM substitution_requests AS accepted
     JOIN course_offerings AS c ON c.offering_id = accepted.offering_id
     JOIN course AS co ON co.course_id = c.course_id
     JOIN course_hour_options AS cho ON cho.credit_hours = co.credit_hours
     JOIN teacher AS owner ON owner.staff_id = c.staff_id
     JOIN teacher AS substitute ON substitute.staff_id = accepted.substitute_staff_id
     WHERE accepted.substitute_staff_id = ?
       AND accepted.week_no = ?
       AND accepted.status = 'accepted'
       AND c.semester_id = ?
       AND ? <= cho.required_weeks
     ORDER BY class_time, course_id`,
    [weekNo, staffId, semester, weekNo, staffId, weekNo, semester, weekNo]
  );

  return success(res, rows);
}

export async function substituteCandidates(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;

  const offeringId = Number(req.query.offeringId);
  const weekNo = normalizeWeek(req.query.week);
  if (!offeringId) return fail(res, '缺少开课 ID');
  if (!weekNo) return fail(res, '教学周必须是 1 到 16 的整数');

  const offering = await getOfferingWeekInfo(null, offeringId, staffId);
  if (!offering) {
    return fail(res, '课程不存在或无权申请代课', 404);
  }
  if (weekNo > Number(offering.required_weeks)) {
    return fail(res, `该课程只上 ${offering.required_weeks} 周，不能申请第 ${weekNo} 周代课`);
  }

  const activeRows = await query<RowDataPacket[]>(
    `SELECT
       sr.mail_item_id,
       sr.status,
       sr.substitute_staff_id,
       t.name AS substitute_teacher_name
     FROM substitution_requests AS sr
     JOIN teacher AS t ON t.staff_id = sr.substitute_staff_id
     WHERE sr.offering_id = ?
       AND sr.week_no = ?
       AND sr.status IN ('pending', 'accepted')
     LIMIT 1`,
    [offeringId, weekNo]
  );
  const activeRequest = activeRows[0] || null;
  const requestBlocked = Boolean(activeRequest);
  const requestBlockReason = activeRequest
    ? activeRequest.status === 'accepted'
      ? `该课程第 ${weekNo} 周已有已同意的代课安排，代课教师为 ${activeRequest.substitute_teacher_name}`
      : `该课程第 ${weekNo} 周已有待处理的代课申请，目标教师为 ${activeRequest.substitute_teacher_name}`
    : null;

  const rows = await query<RowDataPacket[]>(
    `SELECT
       t.staff_id,
       t.name,
       pr.rank_name AS professional_ranks,
       pr.rank_name AS professional_rank_name,
       d.dept_name,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM course_offerings AS busy
           JOIN course AS busy_course ON busy_course.course_id = busy.course_id
           JOIN course_hour_options AS busy_hours ON busy_hours.credit_hours = busy_course.credit_hours
           WHERE busy.staff_id = t.staff_id
             AND busy.semester_id = target.semester_id
             AND busy.class_time = target.class_time
             AND ? <= busy_hours.required_weeks
             AND NOT EXISTS (
               SELECT 1
               FROM substitution_requests AS busy_sub
               WHERE busy_sub.offering_id = busy.offering_id
                 AND busy_sub.week_no = ?
                 AND busy_sub.status = 'accepted'
             )
         ) THEN 0
         WHEN EXISTS (
           SELECT 1
           FROM substitution_requests AS accepted_sub
           JOIN course_offerings AS accepted_class ON accepted_class.offering_id = accepted_sub.offering_id
           WHERE accepted_sub.substitute_staff_id = t.staff_id
             AND accepted_sub.week_no = ?
             AND accepted_sub.status = 'accepted'
             AND accepted_class.semester_id = target.semester_id
             AND accepted_class.class_time = target.class_time
         ) THEN 0
         ELSE 1
       END AS available,
       CASE
         WHEN EXISTS (
           SELECT 1
           FROM course_offerings AS busy
           JOIN course AS busy_course ON busy_course.course_id = busy.course_id
           JOIN course_hour_options AS busy_hours ON busy_hours.credit_hours = busy_course.credit_hours
           WHERE busy.staff_id = t.staff_id
             AND busy.semester_id = target.semester_id
             AND busy.class_time = target.class_time
             AND ? <= busy_hours.required_weeks
             AND NOT EXISTS (
               SELECT 1
               FROM substitution_requests AS busy_sub
               WHERE busy_sub.offering_id = busy.offering_id
                 AND busy_sub.week_no = ?
                 AND busy_sub.status = 'accepted'
             )
         ) THEN '该时间已有授课安排'
         WHEN EXISTS (
           SELECT 1
           FROM substitution_requests AS accepted_sub
           JOIN course_offerings AS accepted_class ON accepted_class.offering_id = accepted_sub.offering_id
           WHERE accepted_sub.substitute_staff_id = t.staff_id
             AND accepted_sub.week_no = ?
             AND accepted_sub.status = 'accepted'
             AND accepted_class.semester_id = target.semester_id
             AND accepted_class.class_time = target.class_time
         ) THEN '该时间已有已接受的代课安排'
         ELSE NULL
       END AS conflict_reason
     FROM course_offerings AS target
     JOIN teacher AS t ON t.staff_id <> target.staff_id
     JOIN professional_ranks AS pr ON pr.rank_id = t.professional_rank_id
     JOIN department AS d ON d.dept_id = t.dept_id
     WHERE target.offering_id = ?
     ORDER BY available DESC, t.staff_id`,
    [weekNo, weekNo, weekNo, weekNo, weekNo, weekNo, offeringId]
  );

  return success(res, {
    request_blocked: requestBlocked,
    request_block_reason: requestBlockReason,
    active_request: activeRequest,
    candidates: rows
  });
}

export async function createSubstitutionRequest(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  const senderUserId = req.user?.userId;
  if (!staffId || !senderUserId) return null;

  const offeringId = Number(req.body.offeringId || req.body.offering_id);
  const weekNo = normalizeWeek(req.body.weekNo || req.body.week_no);
  const substituteStaffId = String(req.body.substituteStaffId || req.body.substitute_staff_id || '').trim();
  const reason = String(req.body.reason || '').trim() || null;

  if (!offeringId) return fail(res, '缺少开课 ID');
  if (!weekNo) return fail(res, '教学周必须是 1 到 16 的整数');
  if (!substituteStaffId) return fail(res, '请选择代课教师');
  if (substituteStaffId === staffId) return fail(res, '不能申请自己为自己代课');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const offering = await getOfferingWeekInfo(conn, offeringId, staffId);
    if (!offering) {
      await conn.rollback();
      return fail(res, '课程不存在或无权申请代课', 404);
    }
    if (weekNo > Number(offering.required_weeks)) {
      await conn.rollback();
      return fail(res, `该课程只上 ${offering.required_weeks} 周，不能申请第 ${weekNo} 周代课`);
    }

    const [activeRows] = await conn.query<RowDataPacket[]>(
      `SELECT mail_item_id, status
       FROM substitution_requests
       WHERE offering_id = ? AND week_no = ? AND status IN ('pending', 'accepted')
       FOR UPDATE`,
      [offeringId, weekNo]
    );
    if (activeRows.length > 0) {
      await conn.rollback();
      return fail(res, '该周课程已有待处理或已同意的代课申请');
    }

    const [accountRows] = await conn.query<RowDataPacket[]>(
      `SELECT user_id
       FROM teacher_accounts
       WHERE staff_id = ?
       LIMIT 1`,
      [substituteStaffId]
    );
    const substituteUserId = accountRows[0]?.user_id;
    if (!substituteUserId) {
      await conn.rollback();
      return fail(res, '代课教师账号不存在', 404);
    }

    const available = await teacherIsAvailable(conn, offeringId, weekNo, substituteStaffId);
    if (!available) {
      await conn.rollback();
      return fail(res, '该教师在对应时间已有课程，不能发送代课申请');
    }

    const [mailResult] = await conn.execute<ResultSetHeader>(
      `INSERT INTO mail_items (sender_user_id)
       VALUES (?)`,
      [senderUserId]
    );
    await conn.execute(
      `INSERT INTO substitution_requests
       (mail_item_id, offering_id, week_no, substitute_staff_id, status, reason)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [mailResult.insertId, offeringId, weekNo, substituteStaffId, reason]
    );
    await conn.execute(
      `INSERT INTO mail_recipients (mail_item_id, recipient_user_id)
       VALUES (?, ?)`,
      [mailResult.insertId, substituteUserId]
    );

    await conn.commit();
    return success(res, { mail_item_id: mailResult.insertId }, 'created', 201);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function respondSubstitutionRequest(req: AuthenticatedRequest, res: Response, status: 'accepted' | 'rejected') {
  const staffId = requireStaffId(req, res);
  const userId = req.user?.userId;
  if (!staffId || !userId) return null;

  const mailItemId = Number(req.params.id);
  if (!mailItemId) return fail(res, '缺少代课申请 ID');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT sr.mail_item_id, sr.offering_id, sr.week_no, sr.substitute_staff_id
       FROM substitution_requests AS sr
       JOIN mail_recipients AS mr ON mr.mail_item_id = sr.mail_item_id
       WHERE sr.mail_item_id = ?
         AND sr.substitute_staff_id = ?
         AND mr.recipient_user_id = ?
         AND sr.status = 'pending'
       FOR UPDATE`,
      [mailItemId, staffId, userId]
    );
    const request = rows[0];
    if (!request) {
      await conn.rollback();
      return fail(res, '代课申请不存在、已处理或无权操作', 404);
    }

    if (status === 'accepted') {
      const available = await teacherIsAvailable(
        conn,
        Number(request.offering_id),
        Number(request.week_no),
        String(request.substitute_staff_id)
      );
      if (!available) {
        await conn.rollback();
        return fail(res, '当前时间已有冲突课程，不能同意该代课申请');
      }
    }

    await conn.execute(
      `UPDATE substitution_requests
       SET status = ?
       WHERE mail_item_id = ?`,
      [status, mailItemId]
    );
    await conn.execute(
      `UPDATE mail_recipients
       SET read_at = COALESCE(read_at, NOW())
       WHERE mail_item_id = ? AND recipient_user_id = ?`,
      [mailItemId, userId]
    );

    await conn.commit();
    return success(res);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function acceptSubstitutionRequest(req: AuthenticatedRequest, res: Response) {
  return respondSubstitutionRequest(req, res, 'accepted');
}

export async function rejectSubstitutionRequest(req: AuthenticatedRequest, res: Response) {
  return respondSubstitutionRequest(req, res, 'rejected');
}

export async function courseStudents(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;
  const rows = await query<RowDataPacket[]>(
     `SELECT
       cs.selection_id, g.grade_id, s.student_id, s.name AS student_name,
       s.mobile_phone, g.regular_score, g.exam_score, g.score, g.grade_status
     FROM course_offerings AS c
     JOIN course_selection AS cs ON cs.offering_id = c.offering_id
     JOIN student AS s ON s.student_id = cs.student_id
     LEFT JOIN v_grades AS g ON g.selection_id = cs.selection_id
     WHERE c.offering_id = ?
       AND c.staff_id = ?
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
  const rows = await query<RowDataPacket[]>(
    `SELECT g.grade_id, cs.selection_id
     FROM grades AS g
     JOIN course_selection AS cs ON cs.selection_id = g.selection_id
     JOIN course_offerings AS c ON c.offering_id = cs.offering_id
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
     SET regular_score = ?, exam_score = ?
     WHERE grade_id = ?`,
    [regularScore, examScore, req.params.gradeId]
  );

  return success(res);
}

export async function courseStatistics(req: AuthenticatedRequest, res: Response) {
  const staffId = requireStaffId(req, res);
  if (!staffId) return null;

  const ownerRows = await query<RowDataPacket[]>(
    'SELECT offering_id FROM course_offerings WHERE offering_id = ? AND staff_id = ? LIMIT 1',
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

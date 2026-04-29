SET NAMES utf8mb4;

CREATE OR REPLACE VIEW v_course_offering_detail AS
SELECT
  c.offering_id,
  c.semester,
  s.semester_name,
  c.course_id,
  co.course_name,
  co.credit,
  co.credit_hours,
  co.dept_id,
  d.dept_name,
  c.staff_id,
  t.name AS teacher_name,
  c.class_time,
  c.classroom,
  c.capacity,
  c.status,
  COUNT(cs.selection_id) AS selected_count,
  (c.capacity - COUNT(cs.selection_id)) AS remaining_capacity
FROM class AS c
JOIN course AS co ON co.course_id = c.course_id
JOIN department AS d ON d.dept_id = co.dept_id
JOIN teacher AS t ON t.staff_id = c.staff_id
LEFT JOIN semesters AS s ON s.semester_id = c.semester
LEFT JOIN course_selection AS cs
  ON cs.semester = c.semester
 AND cs.course_id = c.course_id
 AND cs.staff_id = c.staff_id
 AND cs.selection_status = 'selected'
GROUP BY
  c.offering_id, c.semester, s.semester_name, c.course_id, co.course_name,
  co.credit, co.credit_hours, co.dept_id, d.dept_name, c.staff_id, t.name,
  c.class_time, c.classroom, c.capacity, c.status;

CREATE OR REPLACE VIEW v_student_timetable AS
SELECT
  cs.selection_id,
  cs.student_id,
  st.name AS student_name,
  c.offering_id,
  c.semester,
  co.course_id,
  co.course_name,
  t.staff_id,
  t.name AS teacher_name,
  c.class_time,
  c.classroom,
  cs.selection_status
FROM course_selection AS cs
JOIN student AS st ON st.student_id = cs.student_id
JOIN class AS c
  ON c.semester = cs.semester
 AND c.course_id = cs.course_id
 AND c.staff_id = cs.staff_id
JOIN course AS co ON co.course_id = c.course_id
JOIN teacher AS t ON t.staff_id = c.staff_id;

CREATE OR REPLACE VIEW v_course_grade_summary AS
SELECT
  c.offering_id,
  c.semester,
  c.course_id,
  co.course_name,
  c.staff_id,
  t.name AS teacher_name,
  COUNT(cs.selection_id) AS selected_count,
  SUM(CASE WHEN g.score IS NOT NULL THEN 1 ELSE 0 END) AS graded_count,
  ROUND(AVG(g.score), 2) AS average_score,
  MAX(g.score) AS max_score,
  MIN(g.score) AS min_score
FROM class AS c
JOIN course AS co ON co.course_id = c.course_id
JOIN teacher AS t ON t.staff_id = c.staff_id
LEFT JOIN course_selection AS cs
  ON cs.semester = c.semester
 AND cs.course_id = c.course_id
 AND cs.staff_id = c.staff_id
 AND cs.selection_status = 'selected'
LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
GROUP BY c.offering_id, c.semester, c.course_id, co.course_name, c.staff_id, t.name;

CREATE OR REPLACE VIEW v_teacher_course_summary AS
SELECT
  t.staff_id,
  t.name AS teacher_name,
  COUNT(DISTINCT c.offering_id) AS offering_count,
  COUNT(cs.selection_id) AS student_count
FROM teacher AS t
LEFT JOIN class AS c ON c.staff_id = t.staff_id
LEFT JOIN course_selection AS cs
  ON cs.semester = c.semester
 AND cs.course_id = c.course_id
 AND cs.staff_id = c.staff_id
 AND cs.selection_status = 'selected'
GROUP BY t.staff_id, t.name;

-- Core SQL queries for experiment report and demonstration.

-- 1. Available courses for the current semester.
SELECT *
FROM v_course_offering_detail
WHERE status = 'open'
  AND semester = (SELECT semester_id FROM semesters WHERE is_current = 1 LIMIT 1)
ORDER BY course_id, teacher_name;

-- 2. A student's timetable.
SELECT *
FROM v_student_timetable
WHERE student_id = '1101'
  AND selection_status = 'selected'
ORDER BY semester, class_time;

-- 3. A teacher's course roster.
SELECT
  cs.selection_id,
  st.student_id,
  st.name AS student_name,
  st.mobile_phone,
  g.regular_score,
  g.exam_score,
  g.score,
  g.grade_status
FROM course_selection AS cs
JOIN student AS st ON st.student_id = cs.student_id
JOIN grades AS g ON g.selection_id = cs.selection_id
JOIN class AS c
  ON c.semester = cs.semester
 AND c.course_id = cs.course_id
 AND c.staff_id = cs.staff_id
WHERE c.offering_id = 1
  AND cs.selection_status = 'selected'
ORDER BY st.student_id;

-- 4. Course grade statistics through stored procedure.
CALL sp_course_grade_statistics(1);

-- 5. Student completed courses and average score.
SELECT
  st.student_id,
  st.name,
  COUNT(g.grade_id) AS graded_course_count,
  ROUND(AVG(g.score), 2) AS average_score
FROM student AS st
JOIN course_selection AS cs ON cs.student_id = st.student_id
JOIN grades AS g ON g.selection_id = cs.selection_id
WHERE st.student_id = '1101'
  AND g.score IS NOT NULL
GROUP BY st.student_id, st.name;

-- 6. Teacher offering count and selected student count.
SELECT *
FROM v_teacher_course_summary
ORDER BY offering_count DESC, student_count DESC;

-- 7. Semester course selection count.
SELECT
  semester,
  course_id,
  course_name,
  teacher_name,
  selected_count
FROM v_course_offering_detail
WHERE semester = '201302'
ORDER BY selected_count DESC;

-- 8. Course average score ranking.
SELECT
  course_id,
  course_name,
  ROUND(AVG(score), 2) AS average_score
FROM (
  SELECT c.course_id, co.course_name, g.score
  FROM class AS c
  JOIN course AS co ON co.course_id = c.course_id
  JOIN course_selection AS cs
    ON cs.semester = c.semester
   AND cs.course_id = c.course_id
   AND cs.staff_id = c.staff_id
  JOIN grades AS g ON g.selection_id = cs.selection_id
  WHERE g.score IS NOT NULL
) AS scored_courses
GROUP BY course_id, course_name
ORDER BY average_score DESC;

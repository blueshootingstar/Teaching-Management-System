SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS sp_course_grade_statistics;

DELIMITER $$

CREATE PROCEDURE sp_course_grade_statistics(IN p_offering_id BIGINT UNSIGNED)
BEGIN
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
    MIN(g.score) AS min_score,
    SUM(CASE WHEN g.score >= 60 THEN 1 ELSE 0 END) AS pass_count,
    SUM(CASE WHEN g.score IS NOT NULL AND g.score < 60 THEN 1 ELSE 0 END) AS fail_count,
    SUM(CASE WHEN g.score >= 90 THEN 1 ELSE 0 END) AS excellent_count
  FROM class AS c
  JOIN course AS co ON co.course_id = c.course_id
  JOIN teacher AS t ON t.staff_id = c.staff_id
  LEFT JOIN course_selection AS cs
    ON cs.semester = c.semester
   AND cs.course_id = c.course_id
   AND cs.staff_id = c.staff_id
   AND cs.selection_status = 'selected'
  LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
  WHERE c.offering_id = p_offering_id
  GROUP BY c.offering_id, c.semester, c.course_id, co.course_name, c.staff_id, t.name;
END $$

DELIMITER ;

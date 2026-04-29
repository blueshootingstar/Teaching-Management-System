SET NAMES utf8mb4;

DROP TRIGGER IF EXISTS trg_course_selection_after_insert;

DELIMITER $$

CREATE TRIGGER trg_course_selection_after_insert
AFTER INSERT ON course_selection
FOR EACH ROW
BEGIN
  INSERT INTO grades (selection_id, regular_score, exam_score, score, grade_status, graded_at)
  VALUES (
    NEW.selection_id,
    NEW.score,
    NEW.score,
    NEW.score,
    CASE WHEN NEW.score IS NULL THEN 'pending' ELSE 'submitted' END,
    CASE WHEN NEW.score IS NULL THEN NULL ELSE NOW() END
  )
  ON DUPLICATE KEY UPDATE
    selection_id = VALUES(selection_id);
END $$

DELIMITER ;

-- Schema extension for the teaching affairs management system.
-- Base tables reused from the original school database:
-- department, student, teacher, course, class, course_selection.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS semesters (
  semester_id CHAR(6) NOT NULL,
  semester_name VARCHAR(40) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (semester_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO semesters (semester_id, semester_name, is_current)
SELECT semester,
       CONCAT(SUBSTRING(semester, 1, 4), '学年',
              CASE RIGHT(semester, 2)
                WHEN '01' THEN '第一学期'
                WHEN '02' THEN '第二学期'
                ELSE CONCAT('第', RIGHT(semester, 2), '学期')
              END) AS semester_name,
       0 AS is_current
FROM (
  SELECT semester FROM class
  UNION
  SELECT semester FROM course_selection
) AS all_semesters;

UPDATE semesters
SET is_current = CASE
  WHEN semester_id = (SELECT max_semester FROM (SELECT MAX(semester_id) AS max_semester FROM semesters) AS t) THEN 1
  ELSE 0
END;

UPDATE semesters
SET semester_name = CONCAT(SUBSTRING(semester_id, 1, 4), '学年',
                    CASE RIGHT(semester_id, 2)
                      WHEN '01' THEN '第一学期'
                      WHEN '02' THEN '第二学期'
                    END),
    start_date = CASE RIGHT(semester_id, 2)
      WHEN '01' THEN CONCAT(SUBSTRING(semester_id, 1, 4), '-09-01')
      WHEN '02' THEN CONCAT(CAST(SUBSTRING(semester_id, 1, 4) AS UNSIGNED) + 1, '-03-01')
    END,
    end_date = CASE RIGHT(semester_id, 2)
      WHEN '01' THEN CONCAT(CAST(SUBSTRING(semester_id, 1, 4) AS UNSIGNED) + 1, '-01-20')
      WHEN '02' THEN CONCAT(CAST(SUBSTRING(semester_id, 1, 4) AS UNSIGNED) + 1, '-07-10')
    END
WHERE semester_id REGEXP '^[0-9]{4}(01|02)$';

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','teacher','student') NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  student_id CHAR(4) NULL,
  staff_id CHAR(4) NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_users_username (username),
  KEY idx_users_role (role),
  KEY idx_users_student (student_id),
  KEY idx_users_teacher (staff_id),
  CONSTRAINT fk_users_student FOREIGN KEY (student_id) REFERENCES student (student_id),
  CONSTRAINT fk_users_teacher FOREIGN KEY (staff_id) REFERENCES teacher (staff_id),
  CONSTRAINT chk_users_role_binding CHECK (
    (role = 'admin' AND student_id IS NULL AND staff_id IS NULL)
    OR (role = 'student' AND student_id IS NOT NULL AND staff_id IS NULL)
    OR (role = 'teacher' AND staff_id IS NOT NULL AND student_id IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS classrooms (
  classroom_id VARCHAR(10) NOT NULL,
  building CHAR(1) NOT NULL,
  floor_no INT NOT NULL,
  room_no VARCHAR(10) NOT NULL,
  capacity INT NOT NULL DEFAULT 60,
  status ENUM('available','disabled') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (classroom_id),
  KEY idx_classrooms_building_floor (building, floor_no),
  CONSTRAINT chk_classrooms_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @sql_text = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @sql_text = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_fk_if_missing $$
CREATE PROCEDURE add_fk_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_constraint_name VARCHAR(64),
  IN p_constraint_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND CONSTRAINT_NAME = p_constraint_name
  ) THEN
    SET @sql_text = CONCAT('ALTER TABLE `', p_table_name, '` ADD CONSTRAINT ', p_constraint_definition);
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_check_if_missing $$
CREATE PROCEDURE add_check_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_constraint_name VARCHAR(64),
  IN p_check_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND CONSTRAINT_NAME = p_constraint_name
  ) THEN
    SET @sql_text = CONCAT('ALTER TABLE `', p_table_name, '` ADD CONSTRAINT `', p_constraint_name, '` CHECK (', p_check_definition, ')');
    PREPARE stmt FROM @sql_text;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing('class', 'offering_id', '`offering_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD UNIQUE KEY `uk_class_offering_id` (`offering_id`)');
CALL add_column_if_missing('class', 'capacity', '`capacity` INT NOT NULL DEFAULT 60 AFTER `class_time`');
CALL add_column_if_missing('class', 'status', '`status` ENUM(''open'',''closed'') NOT NULL DEFAULT ''open'' AFTER `capacity`');
CALL add_column_if_missing('class', 'classroom', '`classroom` VARCHAR(50) NULL AFTER `status`');
CALL add_column_if_missing('class', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `classroom`');
CALL add_column_if_missing('class', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`');
CALL add_index_if_missing('class', 'idx_class_semester_status', 'KEY `idx_class_semester_status` (`semester`, `status`)');
CALL add_fk_if_missing('class', 'fk_class_semester', '`fk_class_semester` FOREIGN KEY (`semester`) REFERENCES `semesters` (`semester_id`)');

UPDATE class SET status = 'closed' WHERE status = 'cancelled';
ALTER TABLE class MODIFY COLUMN status ENUM('open','closed') NOT NULL DEFAULT 'open';

UPDATE class AS c
LEFT JOIN classrooms AS cr ON cr.classroom_id = c.classroom
SET c.classroom = NULL
WHERE c.classroom IS NOT NULL
  AND c.classroom <> ''
  AND cr.classroom_id IS NULL;

UPDATE class AS c
JOIN classrooms AS cr ON cr.classroom_id = c.classroom
SET c.capacity = cr.capacity
WHERE c.capacity > cr.capacity;

CALL add_fk_if_missing('class', 'fk_class_classroom', '`fk_class_classroom` FOREIGN KEY (`classroom`) REFERENCES `classrooms` (`classroom_id`)');

CALL add_column_if_missing('course_selection', 'selection_id', '`selection_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD UNIQUE KEY `uk_course_selection_id` (`selection_id`)');
CALL add_column_if_missing('course_selection', 'selection_status', '`selection_status` ENUM(''selected'',''dropped'') NOT NULL DEFAULT ''selected'' AFTER `score`');
CALL add_column_if_missing('course_selection', 'selected_at', '`selected_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `selection_status`');
CALL add_column_if_missing('course_selection', 'dropped_at', '`dropped_at` DATETIME NULL AFTER `selected_at`');
CALL add_column_if_missing('course_selection', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `dropped_at`');
CALL add_column_if_missing('course_selection', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`');
CALL add_index_if_missing('course_selection', 'idx_selection_student_status', 'KEY `idx_selection_student_status` (`student_id`, `selection_status`)');
CALL add_index_if_missing('course_selection', 'idx_selection_offering_lookup', 'KEY `idx_selection_offering_lookup` (`semester`, `course_id`, `staff_id`, `selection_status`)');

SET @has_old_score_check = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'course_selection_chk_1'
);
SET @sql_text = IF(
  @has_old_score_check > 0,
  'ALTER TABLE course_selection DROP CHECK course_selection_chk_1',
  'SELECT 1'
);
PREPARE stmt FROM @sql_text;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE course_selection
  ADD CONSTRAINT course_selection_chk_1 CHECK (score IS NULL OR (score >= 0 AND score <= 100));

CREATE TABLE IF NOT EXISTS grades (
  grade_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  selection_id BIGINT UNSIGNED NOT NULL,
  regular_score DECIMAL(5,2) NULL,
  exam_score DECIMAL(5,2) NULL,
  score DECIMAL(5,2) NULL,
  grade_status ENUM('pending','submitted') NOT NULL DEFAULT 'pending',
  graded_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grade_id),
  UNIQUE KEY uk_grades_selection (selection_id),
  KEY idx_grades_status (grade_status),
  CONSTRAINT fk_grades_selection FOREIGN KEY (selection_id) REFERENCES course_selection (selection_id) ON DELETE CASCADE,
  CONSTRAINT chk_grades_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL add_column_if_missing('grades', 'regular_score', '`regular_score` DECIMAL(5,2) NULL AFTER `selection_id`');
CALL add_column_if_missing('grades', 'exam_score', '`exam_score` DECIMAL(5,2) NULL AFTER `regular_score`');
CALL add_check_if_missing('grades', 'chk_grades_regular_score', '`regular_score` IS NULL OR (`regular_score` >= 0 AND `regular_score` <= 100)');
CALL add_check_if_missing('grades', 'chk_grades_exam_score', '`exam_score` IS NULL OR (`exam_score` >= 0 AND `exam_score` <= 100)');

UPDATE grades
SET regular_score = score,
    exam_score = score
WHERE score IS NOT NULL
  AND (regular_score IS NULL OR exam_score IS NULL);

DROP TABLE IF EXISTS teaching_logs;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DROP PROCEDURE IF EXISTS add_check_if_missing;

-- Rebuild the complete teaching affairs database from scratch.
-- WARNING: This script drops and recreates the `school` database.
-- Usage:
--   mysql -uroot -p < database/00_rebuild_school_from_scratch.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS school;
CREATE DATABASE school DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE school;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE department (
  dept_id CHAR(2) NOT NULL,
  dept_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE semesters (
  semester_id CHAR(6) NOT NULL,
  semester_name VARCHAR(40) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (semester_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE system_settings (
  setting_key VARCHAR(64) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE student_statuses (
  status_code VARCHAR(20) NOT NULL,
  status_name VARCHAR(20) NOT NULL,
  can_select_course TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (status_code),
  UNIQUE KEY uk_student_statuses_name (status_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE professional_ranks (
  rank_id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rank_name VARCHAR(20) NOT NULL,
  PRIMARY KEY (rank_id),
  UNIQUE KEY uk_professional_ranks_name (rank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE course_hour_options (
  credit_hours INT NOT NULL,
  required_weeks INT NOT NULL,
  PRIMARY KEY (credit_hours),
  CONSTRAINT chk_course_hour_options_hours CHECK (credit_hours > 0),
  CONSTRAINT chk_course_hour_options_weeks CHECK (required_weeks BETWEEN 1 AND 16)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE classrooms (
  building_no CHAR(1) NOT NULL,
  room_no VARCHAR(10) NOT NULL,
  capacity INT NOT NULL DEFAULT 60,
  status ENUM('available','disabled') NOT NULL DEFAULT 'available',
  PRIMARY KEY (building_no, room_no),
  CONSTRAINT chk_classrooms_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE student (
  student_id CHAR(4) NOT NULL,
  name VARCHAR(50) NOT NULL,
  sex ENUM('男','女') NOT NULL,
  date_of_birth DATE NOT NULL,
  native_place VARCHAR(50) NOT NULL,
  mobile_phone VARCHAR(20) NOT NULL,
  dept_id CHAR(2) NOT NULL,
  status_code VARCHAR(20) NOT NULL DEFAULT 'normal',
  PRIMARY KEY (student_id),
  KEY idx_student_dept_name (dept_id, name DESC),
  KEY idx_student_status (status_code),
  CONSTRAINT fk_student_department FOREIGN KEY (dept_id) REFERENCES department (dept_id),
  CONSTRAINT fk_student_status FOREIGN KEY (status_code) REFERENCES student_statuses (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE teacher (
  staff_id CHAR(4) NOT NULL,
  name VARCHAR(50) NOT NULL,
  sex ENUM('男','女') NOT NULL,
  date_of_birth DATE NOT NULL,
  professional_rank_id TINYINT UNSIGNED NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  dept_id CHAR(2) NOT NULL,
  PRIMARY KEY (staff_id),
  KEY idx_teacher_dept (dept_id),
  KEY idx_teacher_rank (professional_rank_id),
  CONSTRAINT fk_teacher_department FOREIGN KEY (dept_id) REFERENCES department (dept_id),
  CONSTRAINT fk_teacher_professional_rank FOREIGN KEY (professional_rank_id) REFERENCES professional_ranks (rank_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE course (
  course_id CHAR(8) NOT NULL,
  course_name VARCHAR(50) NOT NULL,
  credit DECIMAL(3,1) NOT NULL DEFAULT 4.0,
  credit_hours INT NOT NULL DEFAULT 40,
  dept_id CHAR(2) NOT NULL,
  PRIMARY KEY (course_id),
  KEY idx_course_dept (dept_id),
  KEY idx_course_name (course_name),
  KEY idx_course_credit_hours (credit_hours),
  CONSTRAINT fk_course_department FOREIGN KEY (dept_id) REFERENCES department (dept_id),
  CONSTRAINT fk_course_hour_option FOREIGN KEY (credit_hours) REFERENCES course_hour_options (credit_hours)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE course_offerings (
  offering_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  semester_id CHAR(6) NOT NULL,
  course_id CHAR(8) NOT NULL,
  staff_id CHAR(4) NOT NULL,
  class_time VARCHAR(50) NOT NULL,
  capacity INT NOT NULL DEFAULT 60,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  classroom_building_no CHAR(1) NOT NULL,
  classroom_room_no VARCHAR(10) NOT NULL,
  PRIMARY KEY (offering_id),
  UNIQUE KEY uk_course_offerings_business (semester_id, course_id, staff_id),
  UNIQUE KEY uk_course_offerings_classroom_time (semester_id, class_time, classroom_building_no, classroom_room_no),
  KEY idx_course_offerings_course (course_id),
  KEY idx_course_offerings_teacher (staff_id),
  KEY idx_course_offerings_semester_status (semester_id, status),
  KEY idx_course_offerings_classroom (classroom_building_no, classroom_room_no),
  CONSTRAINT fk_course_offerings_semester FOREIGN KEY (semester_id) REFERENCES semesters (semester_id),
  CONSTRAINT fk_course_offerings_course FOREIGN KEY (course_id) REFERENCES course (course_id),
  CONSTRAINT fk_course_offerings_teacher FOREIGN KEY (staff_id) REFERENCES teacher (staff_id),
  CONSTRAINT fk_course_offerings_classroom FOREIGN KEY (classroom_building_no, classroom_room_no) REFERENCES classrooms (building_no, room_no),
  CONSTRAINT chk_course_offerings_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE course_selection (
  selection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id CHAR(4) NOT NULL,
  offering_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (selection_id),
  UNIQUE KEY uk_course_selection_student_offering (student_id, offering_id),
  KEY idx_selection_offering_lookup (offering_id),
  CONSTRAINT fk_selection_student FOREIGN KEY (student_id) REFERENCES student (student_id),
  CONSTRAINT fk_selection_offering FOREIGN KEY (offering_id) REFERENCES course_offerings (offering_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE admin_accounts (
  user_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_admin_accounts_username (username),
  CONSTRAINT fk_admin_accounts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE student_accounts (
  user_id BIGINT UNSIGNED NOT NULL,
  student_id CHAR(4) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_student_accounts_student (student_id),
  CONSTRAINT fk_student_accounts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_accounts_student FOREIGN KEY (student_id) REFERENCES student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE teacher_accounts (
  user_id BIGINT UNSIGNED NOT NULL,
  staff_id CHAR(4) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uk_teacher_accounts_teacher (staff_id),
  CONSTRAINT fk_teacher_accounts_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_accounts_teacher FOREIGN KEY (staff_id) REFERENCES teacher (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE mail_items (
  mail_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mail_item_id),
  KEY idx_mail_items_sender (sender_user_id),
  CONSTRAINT fk_mail_items_sender FOREIGN KEY (sender_user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_messages (
  mail_item_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (mail_item_id),
  CONSTRAINT fk_notification_messages_mail FOREIGN KEY (mail_item_id) REFERENCES mail_items (mail_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE mail_recipients (
  recipient_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mail_item_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NULL,
  PRIMARY KEY (recipient_id),
  UNIQUE KEY uk_mail_recipients_item_user (mail_item_id, recipient_user_id),
  KEY idx_mail_recipients_user_read (recipient_user_id, read_at),
  CONSTRAINT fk_mail_recipients_mail FOREIGN KEY (mail_item_id) REFERENCES mail_items (mail_item_id) ON DELETE CASCADE,
  CONSTRAINT fk_mail_recipients_user FOREIGN KEY (recipient_user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE substitution_requests (
  mail_item_id BIGINT UNSIGNED NOT NULL,
  offering_id BIGINT UNSIGNED NOT NULL,
  week_no INT NOT NULL,
  substitute_staff_id CHAR(4) NOT NULL,
  status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  reason VARCHAR(255) NULL,
  PRIMARY KEY (mail_item_id),
  KEY idx_substitution_requests_offering_week (offering_id, week_no, status),
  KEY idx_substitution_requests_substitute (substitute_staff_id, status),
  CONSTRAINT fk_substitution_requests_mail FOREIGN KEY (mail_item_id) REFERENCES mail_items (mail_item_id) ON DELETE CASCADE,
  CONSTRAINT fk_substitution_requests_offering FOREIGN KEY (offering_id) REFERENCES course_offerings (offering_id),
  CONSTRAINT fk_substitution_requests_substitute FOREIGN KEY (substitute_staff_id) REFERENCES teacher (staff_id),
  CONSTRAINT chk_substitution_requests_week CHECK (week_no BETWEEN 1 AND 16)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE grades (
  grade_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  selection_id BIGINT UNSIGNED NOT NULL,
  regular_score DECIMAL(5,2) NULL,
  exam_score DECIMAL(5,2) NULL,
  PRIMARY KEY (grade_id),
  UNIQUE KEY uk_grades_selection (selection_id),
  CONSTRAINT fk_grades_selection FOREIGN KEY (selection_id) REFERENCES course_selection (selection_id) ON DELETE CASCADE,
  CONSTRAINT chk_grades_regular_score CHECK (regular_score IS NULL OR (regular_score >= 0 AND regular_score <= 100)),
  CONSTRAINT chk_grades_exam_score CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TRIGGER IF EXISTS trg_course_selection_after_insert;
DROP TRIGGER IF EXISTS trg_substitution_requests_before_insert;
DROP TRIGGER IF EXISTS trg_substitution_requests_before_update;

DELIMITER $$

CREATE TRIGGER trg_course_selection_after_insert
AFTER INSERT ON course_selection
FOR EACH ROW
BEGIN
  INSERT INTO grades (selection_id)
  VALUES (NEW.selection_id)
  ON DUPLICATE KEY UPDATE
    selection_id = VALUES(selection_id);
END $$

CREATE TRIGGER trg_substitution_requests_before_insert
BEFORE INSERT ON substitution_requests
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mail_items AS mi
    JOIN teacher_accounts AS ta ON ta.user_id = mi.sender_user_id
    JOIN course_offerings AS co ON co.offering_id = NEW.offering_id
    WHERE mi.mail_item_id = NEW.mail_item_id
      AND co.staff_id = ta.staff_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'substitution request sender must own the offering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM course_offerings
    WHERE offering_id = NEW.offering_id
      AND staff_id = NEW.substitute_staff_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'substitute teacher must be different from original teacher';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM course_offerings AS co
    JOIN course AS c ON c.course_id = co.course_id
    JOIN course_hour_options AS cho ON cho.credit_hours = c.credit_hours
    WHERE co.offering_id = NEW.offering_id
      AND NEW.week_no <= cho.required_weeks
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'substitution week exceeds course required weeks';
  END IF;

  IF NEW.status IN ('pending', 'accepted') AND EXISTS (
    SELECT 1
    FROM substitution_requests
    WHERE offering_id = NEW.offering_id
      AND week_no = NEW.week_no
      AND status IN ('pending', 'accepted')
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'duplicate active substitution request for this offering and week';
  END IF;
END $$

CREATE TRIGGER trg_substitution_requests_before_update
BEFORE UPDATE ON substitution_requests
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mail_items AS mi
    JOIN teacher_accounts AS ta ON ta.user_id = mi.sender_user_id
    JOIN course_offerings AS co ON co.offering_id = NEW.offering_id
    WHERE mi.mail_item_id = NEW.mail_item_id
      AND co.staff_id = ta.staff_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'substitution request sender must own the offering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM course_offerings
    WHERE offering_id = NEW.offering_id
      AND staff_id = NEW.substitute_staff_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'substitute teacher must be different from original teacher';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM course_offerings AS co
    JOIN course AS c ON c.course_id = co.course_id
    JOIN course_hour_options AS cho ON cho.credit_hours = c.credit_hours
    WHERE co.offering_id = NEW.offering_id
      AND NEW.week_no <= cho.required_weeks
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'substitution week exceeds course required weeks';
  END IF;

  IF NEW.status IN ('pending', 'accepted') AND EXISTS (
    SELECT 1
    FROM substitution_requests
    WHERE offering_id = NEW.offering_id
      AND week_no = NEW.week_no
      AND status IN ('pending', 'accepted')
      AND mail_item_id <> NEW.mail_item_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'duplicate active substitution request for this offering and week';
  END IF;
END $$

DELIMITER ;

INSERT INTO department (dept_id, dept_name)
VALUES
  ('01', '计算机学院'),
  ('02', '通讯学院'),
  ('03', '材料学院'),
  ('04', '经济管理学院'),
  ('05', '外国语学院');

INSERT INTO semesters (semester_id, semester_name, start_date, end_date, is_current)
VALUES
  ('201201', '2012学年第一学期', '2012-09-01', '2013-01-20', 0),
  ('201202', '2012学年第二学期', '2013-03-01', '2013-07-10', 0),
  ('201301', '2013学年第一学期', '2013-09-01', '2014-01-20', 0),
  ('201302', '2013学年第二学期', '2014-03-01', '2014-07-10', 0),
  ('201401', '2014学年第一学期', '2014-09-01', '2015-01-20', 0),
  ('201402', '2014学年第二学期', '2015-03-01', '2015-07-10', 1);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('course_selection_open', '1');

INSERT INTO student_statuses (status_code, status_name, can_select_course)
VALUES
  ('normal', '正常', 1),
  ('suspended', '休学', 0),
  ('graduated', '毕业', 0);

INSERT INTO professional_ranks (rank_id, rank_name)
VALUES
  (1, '教授'),
  (2, '副教授'),
  (3, '讲师');

INSERT INTO course_hour_options (credit_hours, required_weeks)
VALUES
  (16, 4),
  (32, 8),
  (48, 12),
  (64, 16);

INSERT INTO classrooms (building_no, room_no, capacity, status)
VALUES
  ('A', '101', 60, 'available'),
  ('A', '102', 60, 'available'),
  ('A', '203', 80, 'available'),
  ('A', '304', 90, 'available'),
  ('A', '405', 100, 'available'),
  ('B', '101', 60, 'available'),
  ('B', '102', 60, 'available'),
  ('B', '202', 80, 'available'),
  ('B', '305', 90, 'available'),
  ('B', '405', 100, 'available'),
  ('C', '101', 60, 'available'),
  ('C', '102', 60, 'available'),
  ('C', '204', 80, 'available'),
  ('C', '306', 90, 'available'),
  ('C', '405', 100, 'available'),
  ('D', '101', 60, 'available'),
  ('D', '102', 60, 'available'),
  ('D', '203', 80, 'available'),
  ('D', '304', 90, 'available'),
  ('D', '405', 100, 'available'),
  ('E', '101', 60, 'available'),
  ('E', '202', 80, 'available'),
  ('E', '203', 80, 'available'),
  ('E', '303', 90, 'available'),
  ('E', '405', 100, 'available'),
  ('F', '101', 60, 'available'),
  ('F', '102', 60, 'available'),
  ('F', '204', 80, 'available'),
  ('F', '306', 90, 'available'),
  ('F', '405', 100, 'available'),
  ('G', '101', 60, 'available'),
  ('G', '102', 60, 'available'),
  ('G', '203', 80, 'available'),
  ('G', '305', 90, 'available'),
  ('G', '405', 100, 'available');

INSERT INTO student (student_id, name, sex, date_of_birth, native_place, mobile_phone, dept_id, status_code)
VALUES
  ('1101', '李明', '男', '1993-03-06', '上海', '13613005486', '02', 'normal'),
  ('1102', '刘晓明', '男', '1992-12-08', '安徽', '18913457890', '01', 'normal'),
  ('1103', '张颖', '女', '1993-01-05', '江苏', '18826490423', '01', 'normal'),
  ('1104', '刘晶晶', '女', '1994-11-06', '上海', '13331934111', '01', 'normal'),
  ('1105', '刘成刚', '男', '1990-06-06', '上海', '18015872567', '01', 'normal'),
  ('1106', '李二丽', '女', '1993-05-04', '江苏', '18107620945', '01', 'normal'),
  ('1107', '张晓峰', '男', '1992-08-16', '浙江', '13912341078', '01', 'normal'),
  ('1108', '王晨', '男', '1993-09-12', '山东', '13700000000', '01', 'normal'),
  ('1109', '赵雨晴', '女', '1994-02-17', '浙江', '13700000001', '01', 'normal'),
  ('1110', '陈思远', '男', '1993-07-21', '江苏', '13700000002', '02', 'normal'),
  ('1111', '周雅雯', '女', '1994-04-03', '福建', '13700000003', '02', 'normal'),
  ('1112', '黄子豪', '男', '1992-10-11', '广东', '13700000004', '03', 'normal'),
  ('1113', '吴欣怡', '女', '1993-12-24', '湖北', '13700000005', '03', 'normal'),
  ('1114', '郑浩然', '男', '1994-01-15', '河南', '13700000006', '04', 'normal'),
  ('1115', '许佳宁', '女', '1993-08-29', '上海', '13700000007', '04', 'normal'),
  ('1116', '孙一鸣', '男', '1992-11-30', '安徽', '13700000008', '05', 'normal'),
  ('1117', '朱琳', '女', '1994-06-19', '江西', '13700000009', '05', 'normal'),
  ('1118', '胡嘉豪', '男', '1993-05-09', '湖南', '13700000010', '01', 'normal'),
  ('1119', '林可欣', '女', '1994-03-22', '浙江', '13700000011', '01', 'normal'),
  ('1120', '高远', '男', '1992-09-14', '山东', '13700000012', '02', 'normal'),
  ('1121', '罗婧', '女', '1993-11-08', '四川', '13700000013', '02', 'normal'),
  ('1122', '梁博文', '男', '1994-07-02', '广东', '13700000014', '03', 'normal'),
  ('1123', '宋佳琪', '女', '1993-02-26', '江苏', '13700000015', '03', 'normal'),
  ('1124', '唐昊', '男', '1992-12-18', '重庆', '13700000016', '04', 'normal'),
  ('1125', '韩悦', '女', '1994-05-13', '河南', '13700000017', '04', 'normal'),
  ('1126', '谢文轩', '男', '1993-06-06', '湖北', '13700000018', '05', 'normal'),
  ('1127', '邓雨薇', '女', '1994-09-25', '湖南', '13700000019', '05', 'normal'),
  ('1128', '曹宇航', '男', '1993-01-18', '河北', '13700000020', '01', 'normal'),
  ('1129', '彭诗涵', '女', '1994-10-07', '江西', '13700000021', '01', 'normal'),
  ('1130', '袁泽宇', '男', '1992-08-05', '辽宁', '13700000022', '02', 'normal'),
  ('1131', '曾梦瑶', '女', '1993-04-16', '福建', '13700000023', '02', 'normal'),
  ('1132', '田嘉诚', '男', '1994-12-01', '山西', '13700000024', '03', 'normal'),
  ('1133', '叶雨桐', '女', '1993-07-27', '浙江', '13700000025', '03', 'normal'),
  ('1134', '丁睿', '男', '1992-05-20', '上海', '13700000026', '04', 'normal'),
  ('1135', '潘思琪', '女', '1994-11-11', '安徽', '13700000027', '04', 'normal'),
  ('1136', '邹俊杰', '男', '1993-03-03', '江苏', '13700000028', '05', 'normal'),
  ('1137', '姜雪', '女', '1994-01-09', '山东', '13700000029', '05', 'normal'),
  ('1138', '范成', '男', '1992-06-28', '广东', '13700000030', '01', 'normal'),
  ('1139', '秦悦然', '女', '1993-10-31', '四川', '13700000031', '02', 'normal'),
  ('1140', '姚天宇', '男', '1994-04-24', '重庆', '13700000032', '03', 'normal');

INSERT INTO teacher (staff_id, name, sex, date_of_birth, professional_rank_id, salary, dept_id)
VALUES
  ('0101', '陈迪茂', '男', '1983-03-06', 1, 7567, '01'),
  ('0102', '马小红', '女', '1992-12-08', 1, 5845, '01'),
  ('0103', '吴宝钢', '男', '1990-11-06', 3, 5554, '01'),
  ('0201', '张心颖', '女', '1970-01-05', 1, 9200, '02'),
  ('0104', '周建国', '男', '1981-09-18', 2, 6800, '01'),
  ('0105', '秦晓岚', '女', '1986-04-22', 3, 6100, '01'),
  ('0202', '林海', '男', '1980-07-12', 2, 7000, '02'),
  ('0301', '顾明', '男', '1978-10-30', 1, 8800, '03'),
  ('0401', '何静', '女', '1984-05-14', 2, 7200, '04'),
  ('0501', '沈佳怡', '女', '1987-12-02', 3, 5900, '05');

INSERT INTO course (course_id, course_name, credit, credit_hours, dept_id)
VALUES
  ('08301001', '分子物理学', 4, 48, '03'),
  ('08302001', '通信学', 3, 32, '02'),
  ('08305001', '离散数学', 4, 48, '01'),
  ('08305002', '数据库原理', 4, 64, '01'),
  ('08305003', '数据结构', 4, 64, '01'),
  ('08305004', '系统结构', 6, 64, '01'),
  ('08305005', '操作系统', 4, 48, '01'),
  ('08305006', '计算机网络', 4, 48, '01'),
  ('08305007', '软件工程', 3, 48, '01'),
  ('08305008', '人工智能导论', 3, 48, '01'),
  ('08305009', 'Web应用开发', 3, 48, '01'),
  ('08302002', '数字信号处理', 3, 48, '02'),
  ('08302003', '移动通信', 3, 48, '02'),
  ('08301002', '材料力学', 4, 48, '03'),
  ('08301003', '工程材料学', 3, 48, '03'),
  ('08306001', '管理学原理', 3, 48, '04'),
  ('08306002', '会计学基础', 3, 48, '04'),
  ('08307001', '大学英语', 2, 32, '05');

INSERT INTO course_offerings (semester_id, course_id, staff_id, class_time, capacity, status, classroom_building_no, classroom_room_no)
VALUES
  ('201201', '08305001', '0103', '星期三5-6', 50, 'open', 'A', '101'),
  ('201201', '08305002', '0101', '星期二3-4', 50, 'open', 'A', '102'),
  ('201201', '08302001', '0201', '星期三1-2', 45, 'open', 'B', '101'),
  ('201201', '08301001', '0301', '星期四1-2', 50, 'open', 'C', '101'),
  ('201201', '08307001', '0501', '星期五3-4', 50, 'open', 'D', '101'),
  ('201201', '08306001', '0401', '星期三9-10', 50, 'open', 'E', '101'),
  ('201202', '08305002', '0101', '星期三1-2', 60, 'open', 'A', '203'),
  ('201202', '08305002', '0102', '星期三3-4', 55, 'open', 'B', '101'),
  ('201202', '08305002', '0103', '星期三5-6', 55, 'open', 'B', '202'),
  ('201202', '08305003', '0102', '星期五5-6', 55, 'open', 'C', '101'),
  ('201202', '08305005', '0104', '星期一3-4', 70, 'open', 'B', '305'),
  ('201202', '08302002', '0202', '星期二5-6', 70, 'open', 'D', '203'),
  ('201202', '08301002', '0301', '星期四5-6', 70, 'open', 'E', '202'),
  ('201301', '08305001', '0102', '星期一5-6', 70, 'closed', 'C', '204'),
  ('201301', '08305004', '0101', '星期二1-2', 50, 'open', 'D', '101'),
  ('201301', '08305006', '0105', '星期二3-4', 70, 'open', 'D', '203'),
  ('201301', '08305007', '0104', '星期三5-6', 80, 'open', 'E', '303'),
  ('201301', '08302003', '0202', '星期四1-2', 70, 'open', 'F', '204'),
  ('201301', '08301003', '0301', '星期五5-6', 70, 'open', 'G', '203'),
  ('201301', '08306002', '0401', '星期三9-10', 80, 'open', 'A', '304'),
  ('201302', '08301001', '0201', '星期四1-2', 70, 'closed', 'F', '204'),
  ('201302', '08302001', '0201', '星期一5-6', 70, 'open', 'A', '203'),
  ('201302', '08305002', '0101', '星期二1-2', 50, 'open', 'B', '101'),
  ('201302', '08305003', '0102', '星期二3-4', 60, 'open', 'B', '202'),
  ('201302', '08305005', '0104', '星期三1-2', 80, 'open', 'C', '306'),
  ('201302', '08305008', '0105', '星期三3-4', 90, 'open', 'D', '405'),
  ('201302', '08306001', '0401', '星期四5-6', 50, 'open', 'E', '101'),
  ('201302', '08307001', '0501', '星期五7-8', 50, 'open', 'G', '101'),
  ('201401', '08305001', '0103', '星期一1-2', 50, 'open', 'A', '101'),
  ('201401', '08305004', '0101', '星期一3-4', 50, 'open', 'A', '102'),
  ('201401', '08305006', '0105', '星期二1-2', 70, 'open', 'A', '203'),
  ('201401', '08305007', '0104', '星期二3-4', 80, 'open', 'B', '305'),
  ('201401', '08305009', '0105', '星期三5-6', 80, 'open', 'C', '306'),
  ('201401', '08302002', '0202', '星期四1-2', 70, 'open', 'D', '203'),
  ('201401', '08301002', '0301', '星期五1-2', 70, 'open', 'E', '202'),
  ('201401', '08306002', '0401', '星期五3-4', 80, 'closed', 'F', '306'),
  ('201402', '08305002', '0101', '星期一1-2', 50, 'open', 'A', '101'),
  ('201402', '08305003', '0102', '星期一3-4', 70, 'open', 'A', '203'),
  ('201402', '08305005', '0104', '星期二1-2', 60, 'open', 'B', '202'),
  ('201402', '08305006', '0105', '星期二3-4', 80, 'open', 'B', '305'),
  ('201402', '08305008', '0105', '星期三1-2', 70, 'open', 'C', '204'),
  ('201402', '08305009', '0104', '星期三3-4', 80, 'open', 'C', '306'),
  ('201402', '08302003', '0202', '星期四1-2', 70, 'open', 'D', '203'),
  ('201402', '08301003', '0301', '星期四3-4', 80, 'open', 'E', '303'),
  ('201402', '08307001', '0501', '星期五1-2', 50, 'open', 'F', '101'),
  ('201402', '08305001', '0103', '星期一1-2', 50, 'open', 'A', '102'),
  ('201402', '08305004', '0104', '星期一1-2', 60, 'open', 'A', '203'),
  ('201402', '08302001', '0201', '星期一1-2', 50, 'open', 'B', '101'),
  ('201402', '08306001', '0401', '星期一1-2', 60, 'open', 'E', '101'),
  ('201402', '08305002', '0102', '星期一3-4', 55, 'open', 'B', '102'),
  ('201402', '08305005', '0105', '星期一3-4', 60, 'open', 'B', '202'),
  ('201402', '08302002', '0202', '星期一3-4', 70, 'open', 'D', '203'),
  ('201402', '08301001', '0301', '星期一3-4', 60, 'open', 'C', '101'),
  ('201402', '08305003', '0101', '星期二1-2', 60, 'open', 'C', '102'),
  ('201402', '08305006', '0101', '星期二1-2', 60, 'open', 'C', '204'),
  ('201402', '08305007', '0105', '星期二1-2', 70, 'open', 'D', '304'),
  ('201402', '08301002', '0301', '星期二1-2', 70, 'open', 'E', '202'),
  ('201402', '08305004', '0101', '星期二3-4', 50, 'open', 'D', '101'),
  ('201402', '08305008', '0103', '星期二3-4', 70, 'open', 'E', '203'),
  ('201402', '08302003', '0201', '星期二3-4', 70, 'open', 'F', '204'),
  ('201402', '08306002', '0401', '星期二3-4', 70, 'open', 'F', '306'),
  ('201402', '08305001', '0102', '星期三1-2', 60, 'open', 'G', '101'),
  ('201402', '08305007', '0101', '星期三1-2', 60, 'open', 'G', '102'),
  ('201402', '08302001', '0202', '星期三1-2', 70, 'open', 'G', '203'),
  ('201402', '08301002', '0102', '星期三1-2', 70, 'open', 'A', '304'),
  ('201402', '08305002', '0103', '星期三3-4', 55, 'open', 'B', '405'),
  ('201402', '08305005', '0101', '星期三3-4', 60, 'open', 'C', '405'),
  ('201402', '08302002', '0201', '星期三3-4', 70, 'open', 'D', '405'),
  ('201402', '08301001', '0102', '星期三3-4', 70, 'open', 'E', '405'),
  ('201402', '08305006', '0103', '星期四1-2', 70, 'open', 'F', '405'),
  ('201402', '08306001', '0101', '星期四1-2', 60, 'open', 'A', '405'),
  ('201402', '08305008', '0102', '星期四3-4', 60, 'open', 'C', '102'),
  ('201402', '08302003', '0101', '星期四3-4', 60, 'open', 'D', '102'),
  ('201402', '08305009', '0105', '星期五1-2', 80, 'open', 'E', '203'),
  ('201402', '08306002', '0501', '星期五1-2', 70, 'open', 'G', '305');

-- bcrypt hash generated for plaintext password: 123456
SET @default_password_hash = '$2b$10$KPmJk68I/oJ01w9MleuPouus0itqy7t3McS3B0/KkH7AOSfObPIUu';

INSERT INTO users (password_hash, status)
VALUES (@default_password_hash, 'active');

INSERT INTO admin_accounts (user_id, username, display_name)
SELECT user_id, 'admin', '系统管理员'
FROM users
WHERE user_id = LAST_INSERT_ID();

INSERT INTO users (password_hash, status)
SELECT @default_password_hash, 'active'
FROM student
ORDER BY student_id;

SET @student_user_start = LAST_INSERT_ID();

INSERT INTO student_accounts (user_id, student_id)
SELECT @student_user_start + s.rn - 1, s.student_id
FROM (
  SELECT student_id, ROW_NUMBER() OVER (ORDER BY student_id) AS rn
  FROM student
) AS s;

INSERT INTO users (password_hash, status)
SELECT @default_password_hash, 'active'
FROM teacher
ORDER BY staff_id;

SET @teacher_user_start = LAST_INSERT_ID();

INSERT INTO teacher_accounts (user_id, staff_id)
SELECT @teacher_user_start + t.rn - 1, t.staff_id
FROM (
  SELECT staff_id, ROW_NUMBER() OVER (ORDER BY staff_id) AS rn
  FROM teacher
) AS t;

DROP TEMPORARY TABLE IF EXISTS seed_course_selection_scores;
CREATE TEMPORARY TABLE seed_course_selection_scores (
  student_id CHAR(4) NOT NULL,
  semester CHAR(6) NOT NULL,
  course_id CHAR(8) NOT NULL,
  staff_id CHAR(4) NOT NULL,
  score DECIMAL(5,2) NULL,
  PRIMARY KEY (student_id, semester, course_id, staff_id)
);

INSERT INTO seed_course_selection_scores (student_id, semester, course_id, staff_id, score)
VALUES
  ('1101', '201201', '08305001', '0103', 57.75),
  ('1101', '201202', '08305002', '0101', 63.60),
  ('1101', '201301', '08305004', '0101', NULL),
  ('1101', '201302', '08302001', '0201', 86.40),
  ('1102', '201201', '08305001', '0103', 78.20),
  ('1102', '201202', '08305002', '0101', 84.50),
  ('1102', '201202', '08305003', '0102', 91.10),
  ('1102', '201301', '08305001', '0102', 73),
  ('1102', '201301', '08305004', '0101', NULL),
  ('1102', '201302', '08301001', '0201', 88),
  ('1102', '201302', '08302001', '0201', 92),
  ('1103', '201201', '08305001', '0103', 67.50),
  ('1103', '201202', '08305002', '0102', 72),
  ('1103', '201202', '08305003', '0102', 77),
  ('1103', '201301', '08305001', '0102', NULL),
  ('1103', '201301', '08305004', '0101', NULL),
  ('1103', '201302', '08301001', '0201', NULL),
  ('1103', '201302', '08302001', '0201', NULL),
  ('1104', '201201', '08305001', '0103', 95),
  ('1104', '201202', '08305002', '0101', 90),
  ('1104', '201202', '08305003', '0102', 81),
  ('1104', '201301', '08305001', '0102', 86),
  ('1104', '201301', '08305004', '0101', 95),
  ('1104', '201302', '08301001', '0201', 90),
  ('1104', '201302', '08302001', '0201', 93),
  ('1105', '201201', '08305001', '0103', 59),
  ('1105', '201202', '08305002', '0101', 66),
  ('1105', '201202', '08305003', '0102', 70),
  ('1105', '201301', '08305004', '0101', NULL),
  ('1105', '201302', '08302001', '0201', NULL),
  ('1106', '201201', '08305001', '0103', 82),
  ('1106', '201202', '08305002', '0102', 75),
  ('1106', '201202', '08305003', '0102', 69),
  ('1106', '201301', '08305004', '0101', NULL),
  ('1106', '201302', '08301001', '0201', 80),
  ('1107', '201201', '08305001', '0103', 88),
  ('1107', '201202', '08305002', '0103', 92),
  ('1107', '201202', '08305003', '0102', 85),
  ('1107', '201301', '08305001', '0102', 79),
  ('1107', '201301', '08305004', '0101', NULL),
  ('1107', '201302', '08302001', '0201', 87),
  ('1101', '201401', '08305001', '0103', 73),
  ('1102', '201401', '08305004', '0101', 84),
  ('1103', '201401', '08305006', '0105', 95),
  ('1104', '201401', '08305007', '0104', 59),
  ('1105', '201401', '08305009', '0105', 70),
  ('1106', '201401', '08302002', '0202', 81),
  ('1107', '201401', '08301002', '0301', 92),
  ('1108', '201401', '08306002', '0401', 56),
  ('1109', '201401', '08305001', '0103', 67),
  ('1110', '201401', '08305004', '0101', 78),
  ('1111', '201401', '08305006', '0105', 89),
  ('1112', '201401', '08305007', '0104', 53),
  ('1113', '201401', '08305009', '0105', 64),
  ('1114', '201401', '08302002', '0202', 75),
  ('1115', '201401', '08301002', '0301', 86),
  ('1116', '201401', '08306002', '0401', 97),
  ('1117', '201401', '08305001', '0103', 61),
  ('1118', '201401', '08305004', '0101', 72),
  ('1119', '201401', '08305006', '0105', 83),
  ('1120', '201401', '08305007', '0104', 94),
  ('1121', '201401', '08305009', '0105', 58),
  ('1122', '201401', '08302002', '0202', 69),
  ('1123', '201401', '08301002', '0301', 80),
  ('1124', '201401', '08306002', '0401', 91),
  ('1125', '201401', '08305001', '0103', 55),
  ('1126', '201401', '08305004', '0101', 66),
  ('1127', '201401', '08305006', '0105', 77),
  ('1128', '201401', '08305007', '0104', 88),
  ('1129', '201401', '08305009', '0105', 52),
  ('1130', '201401', '08302002', '0202', 63),
  ('1131', '201401', '08301002', '0301', 74),
  ('1132', '201401', '08306002', '0401', 85),
  ('1133', '201401', '08305001', '0103', 96),
  ('1134', '201401', '08305004', '0101', 60),
  ('1135', '201401', '08305006', '0105', 71),
  ('1136', '201401', '08305007', '0104', 82),
  ('1137', '201401', '08305009', '0105', 93),
  ('1138', '201401', '08302002', '0202', 57),
  ('1139', '201401', '08301002', '0301', 68),
  ('1140', '201401', '08306002', '0401', 79),
  ('1101', '201402', '08305005', '0104', NULL),
  ('1102', '201402', '08305006', '0105', 88),
  ('1103', '201402', '08305008', '0105', 95),
  ('1104', '201402', '08305009', '0104', NULL),
  ('1105', '201402', '08302003', '0202', 81),
  ('1106', '201402', '08301003', '0301', 88),
  ('1107', '201402', '08307001', '0501', NULL),
  ('1108', '201402', '08305002', '0101', 74),
  ('1109', '201402', '08305003', '0102', 81),
  ('1110', '201402', '08305005', '0104', NULL),
  ('1111', '201402', '08305006', '0105', 95),
  ('1112', '201402', '08305008', '0105', 74),
  ('1113', '201402', '08305009', '0104', NULL),
  ('1114', '201402', '08302003', '0202', 88),
  ('1115', '201402', '08301003', '0301', 95),
  ('1116', '201402', '08307001', '0501', NULL),
  ('1117', '201402', '08305002', '0101', 81),
  ('1118', '201402', '08305003', '0102', 88),
  ('1119', '201402', '08305005', '0104', NULL),
  ('1120', '201402', '08305006', '0105', 74),
  ('1121', '201402', '08305008', '0105', 81),
  ('1122', '201402', '08305009', '0104', NULL),
  ('1123', '201402', '08302003', '0202', 95),
  ('1124', '201402', '08301003', '0301', 74),
  ('1125', '201402', '08307001', '0501', NULL),
  ('1126', '201402', '08305002', '0101', 88),
  ('1127', '201402', '08305003', '0102', 95),
  ('1128', '201402', '08305005', '0104', NULL),
  ('1129', '201402', '08305006', '0105', 81),
  ('1130', '201402', '08305008', '0105', 88),
  ('1131', '201402', '08305009', '0104', NULL),
  ('1132', '201402', '08302003', '0202', 74),
  ('1133', '201402', '08301003', '0301', 81),
  ('1134', '201402', '08307001', '0501', NULL),
  ('1135', '201402', '08305002', '0101', 95),
  ('1136', '201402', '08305003', '0102', 74),
  ('1137', '201402', '08305005', '0104', NULL),
  ('1138', '201402', '08305006', '0105', 88),
  ('1139', '201402', '08305008', '0105', 95),
  ('1140', '201402', '08305009', '0104', NULL),
  ('1101', '201201', '08305002', '0101', 71),
  ('1101', '201301', '08305001', '0102', 72),
  ('1101', '201302', '08307001', '0501', 79),
  ('1102', '201201', '08302001', '0201', 82),
  ('1102', '201202', '08305002', '0102', 89),
  ('1103', '201201', '08301001', '0301', 93),
  ('1103', '201202', '08305002', '0103', 53),
  ('1103', '201301', '08305006', '0105', 94),
  ('1104', '201201', '08307001', '0501', 57),
  ('1104', '201301', '08305007', '0104', 58),
  ('1104', '201302', '08305002', '0101', 65),
  ('1105', '201201', '08306001', '0401', 68),
  ('1105', '201202', '08305005', '0104', 75),
  ('1105', '201301', '08302003', '0202', 69),
  ('1105', '201302', '08305003', '0102', 76),
  ('1106', '201202', '08302002', '0202', 86),
  ('1106', '201301', '08301003', '0301', 80),
  ('1106', '201302', '08305005', '0104', 87),
  ('1107', '201201', '08305002', '0101', 90),
  ('1107', '201202', '08301002', '0301', 97),
  ('1107', '201301', '08306002', '0401', 91),
  ('1107', '201302', '08305008', '0105', 98),
  ('1108', '201201', '08302001', '0201', 54),
  ('1108', '201202', '08305002', '0101', 61),
  ('1108', '201301', '08305001', '0102', 55),
  ('1108', '201302', '08306001', '0401', 62),
  ('1109', '201201', '08301001', '0301', 65),
  ('1109', '201202', '08305002', '0102', 72),
  ('1109', '201301', '08305004', '0101', 66),
  ('1109', '201302', '08307001', '0501', 73),
  ('1110', '201201', '08307001', '0501', 76),
  ('1110', '201202', '08305002', '0103', 83),
  ('1110', '201301', '08305006', '0105', 77),
  ('1110', '201302', '08301001', '0201', 84),
  ('1111', '201201', '08306001', '0401', 87),
  ('1111', '201202', '08305003', '0102', 94),
  ('1111', '201301', '08305007', '0104', 88),
  ('1111', '201302', '08302001', '0201', 95),
  ('1112', '201201', '08305001', '0103', 98),
  ('1112', '201202', '08305005', '0104', 58),
  ('1112', '201301', '08302003', '0202', 52),
  ('1112', '201302', '08305002', '0101', 59),
  ('1113', '201201', '08305002', '0101', 62),
  ('1113', '201202', '08302002', '0202', 69),
  ('1113', '201301', '08301003', '0301', 63),
  ('1113', '201302', '08305003', '0102', 70),
  ('1114', '201201', '08302001', '0201', 73),
  ('1114', '201202', '08301002', '0301', 80),
  ('1114', '201301', '08306002', '0401', 74),
  ('1114', '201302', '08305005', '0104', 81),
  ('1115', '201201', '08301001', '0301', 84),
  ('1115', '201202', '08305002', '0101', 91),
  ('1115', '201301', '08305001', '0102', 85),
  ('1115', '201302', '08305008', '0105', 92),
  ('1116', '201201', '08307001', '0501', 95),
  ('1116', '201202', '08305002', '0102', 55),
  ('1116', '201301', '08305004', '0101', 96),
  ('1116', '201302', '08306001', '0401', 56),
  ('1117', '201201', '08306001', '0401', 59),
  ('1101', '201402', '08302003', '0201', 77),
  ('1101', '201402', '08301002', '0102', 73),
  ('1101', '201402', '08301001', '0102', 98),
  ('1102', '201402', '08305006', '0101', 88),
  ('1102', '201402', '08301002', '0102', NULL),
  ('1102', '201402', '08301001', '0102', 90),
  ('1103', '201402', '08305004', '0101', 95),
  ('1103', '201402', '08301001', '0102', 82),
  ('1103', '201402', '08302003', '0202', NULL),
  ('1104', '201402', '08306002', '0401', 73),
  ('1104', '201402', '08301002', '0102', NULL),
  ('1104', '201402', '08302003', '0202', 70),
  ('1105', '201402', '08305001', '0102', NULL),
  ('1105', '201402', '08301001', '0102', 95),
  ('1105', '201402', '08301003', '0301', 77),
  ('1106', '201402', '08301001', '0102', 87),
  ('1106', '201402', '08302003', '0202', 83),
  ('1106', '201402', '08305009', '0105', NULL),
  ('1107', '201402', '08305005', '0101', 94),
  ('1107', '201402', '08302003', '0202', NULL),
  ('1107', '201402', '08301003', '0301', 90),
  ('1108', '201402', '08305006', '0103', 72),
  ('1108', '201402', '08301003', '0301', 82),
  ('1108', '201402', '08305009', '0105', NULL),
  ('1109', '201402', '08302003', '0101', NULL),
  ('1109', '201402', '08305009', '0105', 89),
  ('1109', '201402', '08302001', '0201', 75),
  ('1110', '201402', '08306002', '0501', 86),
  ('1110', '201402', '08302001', '0201', 96),
  ('1110', '201402', '08301001', '0301', NULL),
  ('1111', '201402', '08305001', '0103', 93),
  ('1111', '201402', '08301001', '0301', 84),
  ('1111', '201402', '08301002', '0301', 80),
  ('1112', '201402', '08306001', '0401', 71),
  ('1112', '201402', '08301001', '0301', NULL),
  ('1112', '201402', '08301002', '0301', 72),
  ('1113', '201402', '08305002', '0102', NULL),
  ('1113', '201402', '08301002', '0301', 93),
  ('1113', '201402', '08302003', '0201', NULL),
  ('1114', '201402', '08301002', '0301', 85),
  ('1114', '201402', '08302003', '0201', 81),
  ('1114', '201402', '08301002', '0102', 77),
  ('1115', '201402', '08305006', '0101', 92),
  ('1115', '201402', '08302003', '0201', NULL),
  ('1115', '201402', '08301002', '0102', 98),
  ('1116', '201402', '08305004', '0101', 70),
  ('1116', '201402', '08301002', '0102', 90),
  ('1116', '201402', '08301001', '0102', NULL),
  ('1117', '201402', '08306002', '0401', NULL),
  ('1117', '201402', '08301002', '0102', 82),
  ('1117', '201402', '08301001', '0102', 78),
  ('1118', '201402', '08305001', '0102', 84),
  ('1118', '201402', '08301001', '0102', NULL),
  ('1118', '201402', '08302003', '0202', 95),
  ('1119', '201402', '08301001', '0102', 91),
  ('1119', '201402', '08302003', '0202', 87),
  ('1119', '201402', '08301003', '0301', 73),
  ('1120', '201402', '08305005', '0101', 98),
  ('1120', '201402', '08302003', '0202', 79),
  ('1120', '201402', '08301003', '0301', NULL),
  ('1121', '201402', '08305006', '0103', NULL),
  ('1121', '201402', '08301003', '0301', 86),
  ('1121', '201402', '08305009', '0105', 72),
  ('1122', '201402', '08302003', '0101', 83),
  ('1122', '201402', '08305009', '0105', 93),
  ('1122', '201402', '08302001', '0201', 79),
  ('1123', '201402', '08306002', '0501', 90),
  ('1123', '201402', '08302001', '0201', NULL),
  ('1123', '201402', '08301001', '0301', 96),
  ('1124', '201402', '08305001', '0103', 97),
  ('1124', '201402', '08301001', '0301', 88),
  ('1124', '201402', '08301002', '0301', NULL),
  ('1125', '201402', '08306001', '0401', NULL),
  ('1125', '201402', '08301001', '0301', 80),
  ('1125', '201402', '08301002', '0301', 76),
  ('1126', '201402', '08305002', '0102', 82),
  ('1126', '201402', '08301002', '0301', NULL),
  ('1126', '201402', '08302003', '0201', 93),
  ('1127', '201402', '08301002', '0301', 89),
  ('1127', '201402', '08302003', '0201', 85)
ON DUPLICATE KEY UPDATE
  score = VALUES(score);

INSERT INTO course_selection (student_id, offering_id)
SELECT seed.student_id, co.offering_id
FROM seed_course_selection_scores AS seed
JOIN course_offerings AS co
  ON co.semester_id = seed.semester
 AND co.course_id = seed.course_id
 AND co.staff_id = seed.staff_id;

UPDATE grades AS g
JOIN course_selection AS cs ON cs.selection_id = g.selection_id
JOIN course_offerings AS co ON co.offering_id = cs.offering_id
JOIN seed_course_selection_scores AS seed
  ON seed.student_id = cs.student_id
 AND seed.semester = co.semester_id
 AND seed.course_id = co.course_id
 AND seed.staff_id = co.staff_id
SET g.regular_score = seed.score,
    g.exam_score = seed.score;

-- Clean invalid historical selections introduced by older seed versions.
-- Keep the graded selection first, then the lower generated selection id.
DELETE cs
FROM course_selection AS cs
JOIN (
  SELECT selection_id
  FROM (
    SELECT
      cs.selection_id,
      ROW_NUMBER() OVER (
        PARTITION BY cs.student_id, co.semester_id, co.course_id
        ORDER BY (g.regular_score IS NOT NULL AND g.exam_score IS NOT NULL) DESC,
                 cs.selection_id ASC
      ) AS rn
    FROM course_selection AS cs
    JOIN course_offerings AS co ON co.offering_id = cs.offering_id
    LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
  ) AS ranked_same_course
  WHERE rn > 1
) AS invalid_same_course ON invalid_same_course.selection_id = cs.selection_id;

DELETE cs
FROM course_selection AS cs
JOIN (
  SELECT selection_id
  FROM (
    SELECT
      cs.selection_id,
      ROW_NUMBER() OVER (
        PARTITION BY cs.student_id, c.semester_id, c.class_time
        ORDER BY (g.regular_score IS NOT NULL AND g.exam_score IS NOT NULL) DESC,
                 cs.selection_id ASC
      ) AS rn
    FROM course_selection AS cs
    LEFT JOIN grades AS g ON g.selection_id = cs.selection_id
    JOIN course_offerings AS c ON c.offering_id = cs.offering_id
  ) AS ranked_same_time
  WHERE rn > 1
) AS invalid_same_time ON invalid_same_time.selection_id = cs.selection_id;

DROP TEMPORARY TABLE IF EXISTS seed_course_selection_scores;

CREATE OR REPLACE VIEW v_grades AS
SELECT
  grade_id,
  selection_id,
  regular_score,
  exam_score,
  CASE
    WHEN regular_score IS NULL OR exam_score IS NULL THEN NULL
    ELSE ROUND(regular_score * 0.4 + exam_score * 0.6, 2)
  END AS score,
  CASE
    WHEN regular_score IS NULL OR exam_score IS NULL THEN 'pending'
    ELSE 'submitted'
  END AS grade_status
FROM grades;

DROP PROCEDURE IF EXISTS sp_course_grade_statistics;

DELIMITER $$

CREATE PROCEDURE sp_course_grade_statistics(IN p_offering_id BIGINT UNSIGNED)
BEGIN
  SELECT
    c.offering_id,
    c.semester_id AS semester,
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
  FROM course_offerings AS c
  JOIN course AS co ON co.course_id = c.course_id
  JOIN teacher AS t ON t.staff_id = c.staff_id
  LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
  LEFT JOIN v_grades AS g ON g.selection_id = cs.selection_id
  WHERE c.offering_id = p_offering_id
  GROUP BY c.offering_id, c.semester_id, c.course_id, co.course_name, c.staff_id, t.name;
END $$

DELIMITER ;

CREATE OR REPLACE VIEW v_computer_failed_student AS
SELECT
  s.student_id,
  s.name,
  s.sex,
  s.mobile_phone,
  c.course_name,
  g.score
FROM student AS s
JOIN course_selection AS cs ON s.student_id = cs.student_id
JOIN course_offerings AS co ON co.offering_id = cs.offering_id
JOIN course AS c ON c.course_id = co.course_id
JOIN v_grades AS g ON g.selection_id = cs.selection_id
WHERE s.dept_id = (SELECT dept_id FROM department WHERE dept_name = '计算机学院')
  AND g.score < 60;

CREATE OR REPLACE VIEW v_course_offering_detail AS
SELECT
  c.offering_id,
  c.semester_id AS semester,
  s.semester_name,
  c.course_id,
  co.course_name,
  co.credit,
  co.credit_hours,
  cho.required_weeks,
  co.dept_id,
  d.dept_name,
  c.staff_id,
  t.name AS teacher_name,
  c.class_time,
  CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom,
  c.capacity,
  c.status,
  COUNT(cs.selection_id) AS selected_count,
  (c.capacity - COUNT(cs.selection_id)) AS remaining_capacity
FROM course_offerings AS c
JOIN course AS co ON co.course_id = c.course_id
JOIN course_hour_options AS cho ON cho.credit_hours = co.credit_hours
JOIN department AS d ON d.dept_id = co.dept_id
JOIN teacher AS t ON t.staff_id = c.staff_id
LEFT JOIN semesters AS s ON s.semester_id = c.semester_id
LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
GROUP BY
  c.offering_id, c.semester_id, s.semester_name, c.course_id, co.course_name,
  co.credit, co.credit_hours, cho.required_weeks, co.dept_id, d.dept_name, c.staff_id, t.name,
  c.class_time, c.classroom_building_no, c.classroom_room_no, c.capacity, c.status;

CREATE OR REPLACE VIEW v_student_timetable AS
SELECT
  cs.selection_id,
  cs.student_id,
  st.name AS student_name,
  c.offering_id,
  c.semester_id AS semester,
  co.course_id,
  co.course_name,
  co.credit_hours,
  cho.required_weeks,
  t.staff_id,
  t.name AS teacher_name,
  c.class_time,
  CONCAT(c.classroom_building_no, c.classroom_room_no) AS classroom
FROM course_selection AS cs
JOIN student AS st ON st.student_id = cs.student_id
JOIN course_offerings AS c ON c.offering_id = cs.offering_id
JOIN course AS co ON co.course_id = c.course_id
JOIN course_hour_options AS cho ON cho.credit_hours = co.credit_hours
JOIN teacher AS t ON t.staff_id = c.staff_id;

CREATE OR REPLACE VIEW v_course_grade_summary AS
SELECT
  c.offering_id,
  c.semester_id AS semester,
  c.course_id,
  co.course_name,
  c.staff_id,
  t.name AS teacher_name,
  COUNT(cs.selection_id) AS selected_count,
  SUM(CASE WHEN g.score IS NOT NULL THEN 1 ELSE 0 END) AS graded_count,
  ROUND(AVG(g.score), 2) AS average_score,
  MAX(g.score) AS max_score,
  MIN(g.score) AS min_score
FROM course_offerings AS c
JOIN course AS co ON co.course_id = c.course_id
JOIN teacher AS t ON t.staff_id = c.staff_id
LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
LEFT JOIN v_grades AS g ON g.selection_id = cs.selection_id
GROUP BY c.offering_id, c.semester_id, c.course_id, co.course_name, c.staff_id, t.name;

CREATE OR REPLACE VIEW v_teacher_course_summary AS
SELECT
  t.staff_id,
  t.name AS teacher_name,
  COUNT(DISTINCT c.offering_id) AS offering_count,
  COUNT(cs.selection_id) AS student_count
FROM teacher AS t
LEFT JOIN course_offerings AS c ON c.staff_id = t.staff_id
LEFT JOIN course_selection AS cs ON cs.offering_id = c.offering_id
GROUP BY t.staff_id, t.name;

SELECT 'school database rebuilt successfully' AS message;

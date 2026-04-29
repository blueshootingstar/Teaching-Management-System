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
  address VARCHAR(100) NOT NULL,
  phone_code VARCHAR(20) NOT NULL,
  PRIMARY KEY (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE semesters (
  semester_id CHAR(6) NOT NULL,
  semester_name VARCHAR(40) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (semester_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE classrooms (
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

CREATE TABLE student (
  student_id CHAR(4) NOT NULL,
  name VARCHAR(50) NOT NULL,
  sex ENUM('男','女') NOT NULL,
  date_of_birth DATE NOT NULL,
  native_place VARCHAR(50) NOT NULL,
  mobile_phone VARCHAR(20) NOT NULL,
  dept_id CHAR(2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT '正常',
  PRIMARY KEY (student_id),
  KEY idx_student_dept_name (dept_id, name DESC),
  CONSTRAINT fk_student_department FOREIGN KEY (dept_id) REFERENCES department (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE teacher (
  staff_id CHAR(4) NOT NULL,
  name VARCHAR(50) NOT NULL,
  sex ENUM('男','女') NOT NULL,
  date_of_birth DATE NOT NULL,
  professional_ranks VARCHAR(20) NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  dept_id CHAR(2) NOT NULL,
  PRIMARY KEY (staff_id),
  KEY idx_teacher_dept (dept_id),
  CONSTRAINT fk_teacher_department FOREIGN KEY (dept_id) REFERENCES department (dept_id)
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
  CONSTRAINT fk_course_department FOREIGN KEY (dept_id) REFERENCES department (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `class` (
  offering_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  semester CHAR(6) NOT NULL,
  course_id CHAR(8) NOT NULL,
  staff_id CHAR(4) NOT NULL,
  class_time VARCHAR(50) NOT NULL,
  capacity INT NOT NULL DEFAULT 60,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  classroom VARCHAR(10) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (semester, course_id, staff_id),
  UNIQUE KEY uk_class_offering_id (offering_id),
  KEY idx_class_course (course_id),
  KEY idx_class_teacher (staff_id),
  KEY idx_class_semester_status (semester, status),
  KEY idx_class_classroom (classroom),
  CONSTRAINT fk_class_semester FOREIGN KEY (semester) REFERENCES semesters (semester_id),
  CONSTRAINT fk_class_course FOREIGN KEY (course_id) REFERENCES course (course_id),
  CONSTRAINT fk_class_teacher FOREIGN KEY (staff_id) REFERENCES teacher (staff_id),
  CONSTRAINT fk_class_classroom FOREIGN KEY (classroom) REFERENCES classrooms (classroom_id),
  CONSTRAINT chk_class_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE course_selection (
  selection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id CHAR(4) NOT NULL,
  semester CHAR(6) NOT NULL,
  course_id CHAR(8) NOT NULL,
  staff_id CHAR(4) NOT NULL,
  score DECIMAL(5,2) NULL,
  selection_status ENUM('selected','dropped') NOT NULL DEFAULT 'selected',
  selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dropped_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, semester, course_id, staff_id),
  UNIQUE KEY uk_course_selection_id (selection_id),
  KEY idx_selection_student_status (student_id, selection_status),
  KEY idx_selection_offering_lookup (semester, course_id, staff_id, selection_status),
  CONSTRAINT fk_selection_student FOREIGN KEY (student_id) REFERENCES student (student_id),
  CONSTRAINT fk_selection_class FOREIGN KEY (semester, course_id, staff_id)
    REFERENCES `class` (semester, course_id, staff_id),
  CONSTRAINT chk_selection_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE users (
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

CREATE TABLE grades (
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
  CONSTRAINT chk_grades_score CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  CONSTRAINT chk_grades_regular_score CHECK (regular_score IS NULL OR (regular_score >= 0 AND regular_score <= 100)),
  CONSTRAINT chk_grades_exam_score CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

INSERT INTO department (dept_id, dept_name, address, phone_code)
VALUES
  ('01', '计算机学院', '上大东校区三号楼', '65347567'),
  ('02', '通讯学院', '上大东校区二号楼', '65341234'),
  ('03', '材料学院', '上大东校区四号楼', '65347890'),
  ('04', '经济管理学院', '上大东校区五号楼', '65345678'),
  ('05', '外国语学院', '上大东校区六号楼', '65349876');

INSERT INTO semesters (semester_id, semester_name, start_date, end_date, is_current)
VALUES
  ('201201', '2012学年第一学期', '2012-09-01', '2013-01-20', 0),
  ('201202', '2012学年第二学期', '2013-03-01', '2013-07-10', 0),
  ('201301', '2013学年第一学期', '2013-09-01', '2014-01-20', 0),
  ('201302', '2013学年第二学期', '2014-03-01', '2014-07-10', 0),
  ('201401', '2014学年第一学期', '2014-09-01', '2015-01-20', 0),
  ('201402', '2014学年第二学期', '2015-03-01', '2015-07-10', 1);

INSERT INTO classrooms (classroom_id, building, floor_no, room_no, capacity, status)
VALUES
  ('A101', 'A', 1, '101', 60, 'available'),
  ('A102', 'A', 1, '102', 60, 'available'),
  ('A203', 'A', 2, '203', 80, 'available'),
  ('A304', 'A', 3, '304', 90, 'available'),
  ('A405', 'A', 4, '405', 100, 'available'),
  ('B101', 'B', 1, '101', 60, 'available'),
  ('B102', 'B', 1, '102', 60, 'available'),
  ('B202', 'B', 2, '202', 80, 'available'),
  ('B305', 'B', 3, '305', 90, 'available'),
  ('B405', 'B', 4, '405', 100, 'available'),
  ('C101', 'C', 1, '101', 60, 'available'),
  ('C102', 'C', 1, '102', 60, 'available'),
  ('C204', 'C', 2, '204', 80, 'available'),
  ('C306', 'C', 3, '306', 90, 'available'),
  ('C405', 'C', 4, '405', 100, 'available'),
  ('D101', 'D', 1, '101', 60, 'available'),
  ('D102', 'D', 1, '102', 60, 'available'),
  ('D203', 'D', 2, '203', 80, 'available'),
  ('D304', 'D', 3, '304', 90, 'available'),
  ('D405', 'D', 4, '405', 100, 'available'),
  ('E101', 'E', 1, '101', 60, 'available'),
  ('E202', 'E', 2, '202', 80, 'available'),
  ('E203', 'E', 2, '203', 80, 'available'),
  ('E303', 'E', 3, '303', 90, 'available'),
  ('E405', 'E', 4, '405', 100, 'available'),
  ('F101', 'F', 1, '101', 60, 'available'),
  ('F102', 'F', 1, '102', 60, 'available'),
  ('F204', 'F', 2, '204', 80, 'available'),
  ('F306', 'F', 3, '306', 90, 'available'),
  ('F405', 'F', 4, '405', 100, 'available'),
  ('G101', 'G', 1, '101', 60, 'available'),
  ('G102', 'G', 1, '102', 60, 'available'),
  ('G203', 'G', 2, '203', 80, 'available'),
  ('G305', 'G', 3, '305', 90, 'available'),
  ('G405', 'G', 4, '405', 100, 'available');

INSERT INTO student (student_id, name, sex, date_of_birth, native_place, mobile_phone, dept_id, status)
VALUES
  ('1101', '李明', '男', '1993-03-06', '上海', '13613005486', '02', '正常'),
  ('1102', '刘晓明', '男', '1992-12-08', '安徽', '18913457890', '01', '正常'),
  ('1103', '张颖', '女', '1993-01-05', '江苏', '18826490423', '01', '正常'),
  ('1104', '刘晶晶', '女', '1994-11-06', '上海', '13331934111', '01', '正常'),
  ('1105', '刘成刚', '男', '1990-06-06', '上海', '18015872567', '01', '正常'),
  ('1106', '李二丽', '女', '1993-05-04', '江苏', '18107620945', '01', '正常'),
  ('1107', '张晓峰', '男', '1992-08-16', '浙江', '13912341078', '01', '正常'),
  ('1108', '王晨', '男', '1993-09-12', '山东', '13700000000', '01', '正常'),
  ('1109', '赵雨晴', '女', '1994-02-17', '浙江', '13700000001', '01', '正常'),
  ('1110', '陈思远', '男', '1993-07-21', '江苏', '13700000002', '02', '正常'),
  ('1111', '周雅雯', '女', '1994-04-03', '福建', '13700000003', '02', '正常'),
  ('1112', '黄子豪', '男', '1992-10-11', '广东', '13700000004', '03', '正常'),
  ('1113', '吴欣怡', '女', '1993-12-24', '湖北', '13700000005', '03', '正常'),
  ('1114', '郑浩然', '男', '1994-01-15', '河南', '13700000006', '04', '正常'),
  ('1115', '许佳宁', '女', '1993-08-29', '上海', '13700000007', '04', '正常'),
  ('1116', '孙一鸣', '男', '1992-11-30', '安徽', '13700000008', '05', '正常'),
  ('1117', '朱琳', '女', '1994-06-19', '江西', '13700000009', '05', '正常'),
  ('1118', '胡嘉豪', '男', '1993-05-09', '湖南', '13700000010', '01', '正常'),
  ('1119', '林可欣', '女', '1994-03-22', '浙江', '13700000011', '01', '正常'),
  ('1120', '高远', '男', '1992-09-14', '山东', '13700000012', '02', '正常'),
  ('1121', '罗婧', '女', '1993-11-08', '四川', '13700000013', '02', '正常'),
  ('1122', '梁博文', '男', '1994-07-02', '广东', '13700000014', '03', '正常'),
  ('1123', '宋佳琪', '女', '1993-02-26', '江苏', '13700000015', '03', '正常'),
  ('1124', '唐昊', '男', '1992-12-18', '重庆', '13700000016', '04', '正常'),
  ('1125', '韩悦', '女', '1994-05-13', '河南', '13700000017', '04', '正常'),
  ('1126', '谢文轩', '男', '1993-06-06', '湖北', '13700000018', '05', '正常'),
  ('1127', '邓雨薇', '女', '1994-09-25', '湖南', '13700000019', '05', '正常'),
  ('1128', '曹宇航', '男', '1993-01-18', '河北', '13700000020', '01', '正常'),
  ('1129', '彭诗涵', '女', '1994-10-07', '江西', '13700000021', '01', '正常'),
  ('1130', '袁泽宇', '男', '1992-08-05', '辽宁', '13700000022', '02', '正常'),
  ('1131', '曾梦瑶', '女', '1993-04-16', '福建', '13700000023', '02', '正常'),
  ('1132', '田嘉诚', '男', '1994-12-01', '山西', '13700000024', '03', '正常'),
  ('1133', '叶雨桐', '女', '1993-07-27', '浙江', '13700000025', '03', '正常'),
  ('1134', '丁睿', '男', '1992-05-20', '上海', '13700000026', '04', '正常'),
  ('1135', '潘思琪', '女', '1994-11-11', '安徽', '13700000027', '04', '正常'),
  ('1136', '邹俊杰', '男', '1993-03-03', '江苏', '13700000028', '05', '正常'),
  ('1137', '姜雪', '女', '1994-01-09', '山东', '13700000029', '05', '正常'),
  ('1138', '范成', '男', '1992-06-28', '广东', '13700000030', '01', '正常'),
  ('1139', '秦悦然', '女', '1993-10-31', '四川', '13700000031', '02', '正常'),
  ('1140', '姚天宇', '男', '1994-04-24', '重庆', '13700000032', '03', '正常');

INSERT INTO teacher (staff_id, name, sex, date_of_birth, professional_ranks, salary, dept_id)
VALUES
  ('0101', '陈迪茂', '男', '1983-03-06', '教授', 7567, '01'),
  ('0102', '马小红', '女', '1992-12-08', '教授', 5845, '01'),
  ('0103', '吴宝钢', '男', '1990-11-06', '讲师', 5554, '01'),
  ('0201', '张心颖', '女', '1970-01-05', '教授', 9200, '02'),
  ('0104', '周建国', '男', '1981-09-18', '副教授', 6800, '01'),
  ('0105', '秦晓岚', '女', '1986-04-22', '讲师', 6100, '01'),
  ('0202', '林海', '男', '1980-07-12', '副教授', 7000, '02'),
  ('0301', '顾明', '男', '1978-10-30', '教授', 8800, '03'),
  ('0401', '何静', '女', '1984-05-14', '副教授', 7200, '04'),
  ('0501', '沈佳怡', '女', '1987-12-02', '讲师', 5900, '05');

INSERT INTO course (course_id, course_name, credit, credit_hours, dept_id)
VALUES
  ('08301001', '分子物理学', 4, 40, '03'),
  ('08302001', '通信学', 3, 30, '02'),
  ('08305001', '离散数学', 4, 40, '01'),
  ('08305002', '数据库原理', 4, 50, '01'),
  ('08305003', '数据结构', 4, 50, '01'),
  ('08305004', '系统结构', 6, 60, '01'),
  ('08305005', '操作系统', 4, 48, '01'),
  ('08305006', '计算机网络', 4, 48, '01'),
  ('08305007', '软件工程', 3, 36, '01'),
  ('08305008', '人工智能导论', 3, 36, '01'),
  ('08305009', 'Web应用开发', 3, 40, '01'),
  ('08302002', '数字信号处理', 3, 36, '02'),
  ('08302003', '移动通信', 3, 36, '02'),
  ('08301002', '材料力学', 4, 48, '03'),
  ('08301003', '工程材料学', 3, 36, '03'),
  ('08306001', '管理学原理', 3, 36, '04'),
  ('08306002', '会计学基础', 3, 36, '04'),
  ('08307001', '大学英语', 2, 32, '05');

INSERT INTO `class` (semester, course_id, staff_id, class_time, capacity, status, classroom)
VALUES
  ('201201', '08305001', '0103', '星期三5-6', 50, 'open', 'A101'),
  ('201201', '08305002', '0101', '星期二3-4', 50, 'open', 'A102'),
  ('201201', '08302001', '0201', '星期三1-2', 45, 'open', 'B101'),
  ('201201', '08301001', '0301', '星期四1-2', 50, 'open', 'C101'),
  ('201201', '08307001', '0501', '星期五3-4', 50, 'open', 'D101'),
  ('201201', '08306001', '0401', '星期三9-10', 50, 'open', 'E101'),
  ('201202', '08305002', '0101', '星期三1-2', 60, 'open', 'A203'),
  ('201202', '08305002', '0102', '星期三3-4', 55, 'open', 'B101'),
  ('201202', '08305002', '0103', '星期三5-6', 55, 'open', 'B202'),
  ('201202', '08305003', '0102', '星期五5-6', 55, 'open', 'C101'),
  ('201202', '08305005', '0104', '星期一3-4', 70, 'open', 'B305'),
  ('201202', '08302002', '0202', '星期二5-6', 70, 'open', 'D203'),
  ('201202', '08301002', '0301', '星期四5-6', 70, 'open', 'E202'),
  ('201301', '08305001', '0102', '星期一5-6', 70, 'closed', 'C204'),
  ('201301', '08305004', '0101', '星期二1-2', 50, 'open', 'D101'),
  ('201301', '08305006', '0105', '星期二3-4', 70, 'open', 'D203'),
  ('201301', '08305007', '0104', '星期三5-6', 80, 'open', 'E303'),
  ('201301', '08302003', '0202', '星期四1-2', 70, 'open', 'F204'),
  ('201301', '08301003', '0301', '星期五5-6', 70, 'open', 'G203'),
  ('201301', '08306002', '0401', '星期三9-10', 80, 'open', 'A304'),
  ('201302', '08301001', '0201', '星期四1-2', 70, 'closed', 'F204'),
  ('201302', '08302001', '0201', '星期一5-6', 70, 'open', 'A203'),
  ('201302', '08305002', '0101', '星期二1-2', 50, 'open', 'B101'),
  ('201302', '08305003', '0102', '星期二3-4', 60, 'open', 'B202'),
  ('201302', '08305005', '0104', '星期三1-2', 80, 'open', 'C306'),
  ('201302', '08305008', '0105', '星期三3-4', 90, 'open', 'D405'),
  ('201302', '08306001', '0401', '星期四5-6', 50, 'open', 'E101'),
  ('201302', '08307001', '0501', '星期五7-8', 50, 'open', 'G101'),
  ('201401', '08305001', '0103', '星期一1-2', 50, 'open', 'A101'),
  ('201401', '08305004', '0101', '星期一3-4', 50, 'open', 'A102'),
  ('201401', '08305006', '0105', '星期二1-2', 70, 'open', 'A203'),
  ('201401', '08305007', '0104', '星期二3-4', 80, 'open', 'B305'),
  ('201401', '08305009', '0105', '星期三5-6', 80, 'open', 'C306'),
  ('201401', '08302002', '0202', '星期四1-2', 70, 'open', 'D203'),
  ('201401', '08301002', '0301', '星期五1-2', 70, 'open', 'E202'),
  ('201401', '08306002', '0401', '星期五3-4', 80, 'closed', 'F306'),
  ('201402', '08305002', '0101', '星期一1-2', 50, 'open', 'A101'),
  ('201402', '08305003', '0102', '星期一3-4', 70, 'open', 'A203'),
  ('201402', '08305005', '0104', '星期二1-2', 60, 'open', 'B202'),
  ('201402', '08305006', '0105', '星期二3-4', 80, 'open', 'B305'),
  ('201402', '08305008', '0105', '星期三1-2', 70, 'open', 'C204'),
  ('201402', '08305009', '0104', '星期三3-4', 80, 'open', 'C306'),
  ('201402', '08302003', '0202', '星期四1-2', 70, 'open', 'D203'),
  ('201402', '08301003', '0301', '星期四3-4', 80, 'open', 'E303'),
  ('201402', '08307001', '0501', '星期五1-2', 50, 'open', 'F101'),
  ('201402', '08305001', '0103', '星期一1-2', 50, 'open', 'A102'),
  ('201402', '08305004', '0104', '星期一1-2', 60, 'open', 'A203'),
  ('201402', '08302001', '0201', '星期一1-2', 50, 'open', 'B101'),
  ('201402', '08306001', '0401', '星期一1-2', 60, 'open', 'E101'),
  ('201402', '08305002', '0102', '星期一3-4', 55, 'open', 'B102'),
  ('201402', '08305005', '0105', '星期一3-4', 60, 'open', 'B202'),
  ('201402', '08302002', '0202', '星期一3-4', 70, 'open', 'D203'),
  ('201402', '08301001', '0301', '星期一3-4', 60, 'open', 'C101'),
  ('201402', '08305003', '0101', '星期二1-2', 60, 'open', 'C102'),
  ('201402', '08305006', '0101', '星期二1-2', 60, 'open', 'C204'),
  ('201402', '08305007', '0105', '星期二1-2', 70, 'open', 'D304'),
  ('201402', '08301002', '0301', '星期二1-2', 70, 'open', 'E202'),
  ('201402', '08305004', '0101', '星期二3-4', 50, 'open', 'D101'),
  ('201402', '08305008', '0103', '星期二3-4', 70, 'open', 'E203'),
  ('201402', '08302003', '0201', '星期二3-4', 70, 'open', 'F204'),
  ('201402', '08306002', '0401', '星期二3-4', 70, 'open', 'F306'),
  ('201402', '08305001', '0102', '星期三1-2', 60, 'open', 'G101'),
  ('201402', '08305007', '0101', '星期三1-2', 60, 'open', 'G102'),
  ('201402', '08302001', '0202', '星期三1-2', 70, 'open', 'G203'),
  ('201402', '08301002', '0102', '星期三1-2', 70, 'open', 'A304'),
  ('201402', '08305002', '0103', '星期三3-4', 55, 'open', 'B405'),
  ('201402', '08305005', '0101', '星期三3-4', 60, 'open', 'C405'),
  ('201402', '08302002', '0201', '星期三3-4', 70, 'open', 'D405'),
  ('201402', '08301001', '0102', '星期三3-4', 70, 'open', 'E405'),
  ('201402', '08305006', '0103', '星期四1-2', 70, 'open', 'F405'),
  ('201402', '08306001', '0101', '星期四1-2', 60, 'open', 'A405'),
  ('201402', '08305008', '0102', '星期四3-4', 60, 'open', 'C102'),
  ('201402', '08302003', '0101', '星期四3-4', 60, 'open', 'D102'),
  ('201402', '08305009', '0105', '星期五1-2', 80, 'open', 'E203'),
  ('201402', '08306002', '0501', '星期五1-2', 70, 'open', 'G305');

-- bcrypt hash generated for plaintext password: 123456
SET @default_password_hash = '$2b$10$KPmJk68I/oJ01w9MleuPouus0itqy7t3McS3B0/KkH7AOSfObPIUu';

INSERT INTO users (username, password_hash, role, display_name, status)
VALUES ('admin', @default_password_hash, 'admin', '系统管理员', 'active');

INSERT INTO users (username, password_hash, role, display_name, student_id, status)
SELECT student_id, @default_password_hash, 'student', name, student_id, 'active'
FROM student;

INSERT INTO users (username, password_hash, role, display_name, staff_id, status)
SELECT staff_id, @default_password_hash, 'teacher', name, staff_id, 'active'
FROM teacher;

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

INSERT INTO course_selection (student_id, semester, course_id, staff_id, score, selection_status)
SELECT student_id, semester, course_id, staff_id, score, 'selected'
FROM seed_course_selection_scores;

INSERT INTO grades (selection_id, score, grade_status, graded_at)
SELECT cs.selection_id,
       cs.score,
       CASE WHEN cs.score IS NULL THEN 'pending' ELSE 'submitted' END,
       CASE WHEN cs.score IS NULL THEN NULL ELSE NOW() END
FROM course_selection AS cs
WHERE NOT EXISTS (
  SELECT 1
  FROM grades AS g
  WHERE g.selection_id = cs.selection_id
);

UPDATE grades AS g
JOIN course_selection AS cs ON cs.selection_id = g.selection_id
JOIN seed_course_selection_scores AS seed
  ON seed.student_id = cs.student_id
 AND seed.semester = cs.semester
 AND seed.course_id = cs.course_id
 AND seed.staff_id = cs.staff_id
SET g.regular_score = seed.score,
    g.exam_score = seed.score,
    g.score = seed.score,
    g.grade_status = IF(seed.score IS NULL, 'pending', 'submitted'),
    g.graded_at = IF(seed.score IS NULL, NULL, COALESCE(g.graded_at, NOW())),
    cs.score = seed.score;

-- Clean invalid historical selections introduced by older seed versions.
-- Keep the graded selection first, then the earlier selected record.
DELETE cs
FROM course_selection AS cs
JOIN (
  SELECT selection_id
  FROM (
    SELECT
      selection_id,
      ROW_NUMBER() OVER (
        PARTITION BY student_id, semester, course_id
        ORDER BY (score IS NOT NULL) DESC, selected_at ASC, selection_id ASC
      ) AS rn
    FROM course_selection
    WHERE selection_status = 'selected'
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
        PARTITION BY cs.student_id, c.semester, c.class_time
        ORDER BY (cs.score IS NOT NULL) DESC, cs.selected_at ASC, cs.selection_id ASC
      ) AS rn
    FROM course_selection AS cs
    JOIN class AS c
      ON c.semester = cs.semester
     AND c.course_id = cs.course_id
     AND c.staff_id = cs.staff_id
    WHERE cs.selection_status = 'selected'
  ) AS ranked_same_time
  WHERE rn > 1
) AS invalid_same_time ON invalid_same_time.selection_id = cs.selection_id;

DROP TEMPORARY TABLE IF EXISTS seed_course_selection_scores;

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
  FROM `class` AS c
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

CREATE OR REPLACE VIEW v_computer_failed_student AS
SELECT
  s.student_id,
  s.name,
  s.sex,
  s.mobile_phone,
  c.course_name,
  cs.score
FROM student AS s
JOIN course_selection AS cs ON s.student_id = cs.student_id
JOIN course AS c ON cs.course_id = c.course_id
WHERE s.dept_id = (SELECT dept_id FROM department WHERE dept_name = '计算机学院')
  AND cs.score < 60;

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
FROM `class` AS c
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
JOIN `class` AS c
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
FROM `class` AS c
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
LEFT JOIN `class` AS c ON c.staff_id = t.staff_id
LEFT JOIN course_selection AS cs
  ON cs.semester = c.semester
 AND cs.course_id = c.course_id
 AND cs.staff_id = c.staff_id
 AND cs.selection_status = 'selected'
GROUP BY t.staff_id, t.name;

SELECT 'school database rebuilt successfully' AS message;

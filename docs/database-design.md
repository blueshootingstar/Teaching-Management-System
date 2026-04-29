# School 数据库设计说明

本文档说明教学事务管理系统使用的 `school` 数据库。说明内容以 `database/00_rebuild_school_from_scratch.sql` 为准，该脚本可以从空 MySQL 环境完整创建数据库、表、测试数据、触发器、存储过程和视图。

## 1. 数据库定位

`school` 数据库服务于 B/S 架构的教学事务管理系统，系统角色包括：

- 管理员：维护学生、教师、课程、学期、开课信息，查看统计分析。
- 学生：查询当前学期课程、选课/退课、查看课表、查看成绩和绩点。
- 教师：查看授课课程、查看学生名单、录入成绩、查看课程成绩统计。

数据库设计以原始 School 数据库为基础，保留院系、学生、教师、课程、开课、选课等核心表，同时增加用户登录、学期、教室、独立成绩等教学事务管理系统需要的表。当前设计不是“零冗余极简生产模型”，而是兼顾三类目标：

- 兼容原始 School 数据库结构和实验背景。
- 满足数据库课程对触发器、存储过程、视图、复杂查询的要求。
- 支撑当前前后端系统的 REST API 和页面功能。

## 2. 初始化方式

推荐从 0 初始化：

```bash
mysql -uroot -p < database/00_rebuild_school_from_scratch.sql
```

该脚本会执行：

- `DROP DATABASE IF EXISTS school`
- 创建 `school` 数据库。
- 创建所有基础表和扩展表。
- 插入测试数据。
- 创建触发器、存储过程和视图。

因此它适合队友本地开发、云服务器部署和演示环境初始化。`database/02_schema.sql`、`database/03_seed.sql` 等脚本保留给“已经存在原始 School 数据库，只做增量升级”的情况。

## 3. 核心实体关系

系统核心数据链路如下：

```text
department 1--N student
department 1--N teacher
department 1--N course

semesters 1--N class
course    1--N class
teacher   1--N class
classrooms 1--N class

student 1--N course_selection
class   1--N course_selection
course_selection 1--1 grades

users 0/1--1 student
users 0/1--1 teacher
```

其中 `class` 表在本系统中表示“开课记录”，不是行政班级。一个开课记录表示某门课程在某个学期由某位教师授课，包含上课时间、教室、容量和开放状态。

## 4. 表设计详解

### 4.1 `department` 院系表

作用：保存学校院系基础信息，是学生、教师、课程的上级组织。

关键字段：

- `dept_id`：院系编号，主键，例如 `01`。
- `dept_name`：院系名称，例如 `计算机学院`。
- `address`：院系地址，保留原 School 数据。
- `phone_code`：院系联系电话，保留原 School 数据。

约束与索引：

- 主键：`dept_id`。

系统使用：

- 管理员维护学生、教师、课程时，通过院系下拉选择 `dept_id`。
- 学生、教师、课程列表通过该表展示院系名称。
- `v_computer_failed_student` 视图使用院系名称筛选计算机学院学生。

设计说明：该表属于原始 School 基础表，`address` 和 `phone_code` 当前页面展示较少，但作为原始院系资料保留。

### 4.2 `student` 学生表

作用：保存学生基础信息。

关键字段：

- `student_id`：学号，主键，例如 `1102`。
- `name`：学生姓名。
- `sex`：性别，枚举 `男` / `女`。
- `date_of_birth`：出生日期。
- `native_place`：籍贯。
- `mobile_phone`：联系电话。
- `dept_id`：所属院系，外键。
- `status`：学籍状态，默认 `正常`。

约束与索引：

- 主键：`student_id`。
- 外键：`dept_id` 引用 `department.dept_id`。
- 索引：`dept_id, name`，便于按院系和姓名查询。

系统使用：

- 管理员学生管理页面进行增删改查。
- 登录用户表 `users` 通过 `student_id` 绑定学生账号。
- 学生选课、课表、成绩均以 `student_id` 作为学生身份。
- 教师查看学生名单时读取学生姓名和联系方式。

设计说明：学生基础信息和登录账号分开。`student` 保存业务实体，`users` 保存认证信息，这样同一个学生实体可以独立于登录密码和账号状态管理。

### 4.3 `teacher` 教师表

作用：保存教师基础信息。

关键字段：

- `staff_id`：教工号，主键，例如 `0101`。
- `name`：教师姓名。
- `sex`：性别。
- `date_of_birth`：出生日期。
- `professional_ranks`：职称。
- `salary`：薪资。
- `dept_id`：所属院系，外键。

约束与索引：

- 主键：`staff_id`。
- 外键：`dept_id` 引用 `department.dept_id`。
- 索引：`dept_id`。

系统使用：

- 管理员教师管理页面进行增删改查。
- 开课管理通过教师下拉选择 `staff_id`。
- 教师登录后通过 `users.staff_id` 绑定到教师身份。
- 教师端只展示该教师自己的授课课程和学生名单。

设计说明：教师删除前需要检查是否已有开课记录。若已有开课记录，后端拒绝删除，前端禁用删除按钮并提示原因。

### 4.4 `course` 课程表

作用：保存课程基础信息，不表示某次具体授课。

关键字段：

- `course_id`：课程号，主键，例如 `08305002`。
- `course_name`：课程名称，例如 `数据库原理`。
- `credit`：学分。
- `credit_hours`：学时。
- `dept_id`：开课院系，外键。

约束与索引：

- 主键：`course_id`。
- 外键：`dept_id` 引用 `department.dept_id`。
- 索引：`dept_id`、`course_name`。

系统使用：

- 管理员课程管理页面维护课程基础信息。
- 开课管理从课程表中选择课程。
- 学生可选课程、课表、成绩页面展示课程名、学分等信息。
- 统计分析按课程汇总平均分和排名。

设计说明：`course` 只描述课程本身。某课程在哪个学期、哪个老师、哪个教室上课，由 `class` 表描述。

### 4.5 `semesters` 学期表

作用：保存学期信息，并标识当前学期。

关键字段：

- `semester_id`：学期号，主键，格式为 `YYYY01` 或 `YYYY02`。
- `semester_name`：学期名称，例如 `2013学年第二学期`。
- `start_date`：开始日期。
- `end_date`：结束日期。
- `is_current`：是否当前学期。
- `created_at` / `updated_at`：创建和更新时间。

约束与索引：

- 主键：`semester_id`。

系统使用：

- 学生可选课程默认查询当前学期。
- 学生课表和成绩页面可以按学期筛选。
- 管理员可以设置当前学期，也可以新增下一学期。
- 开课记录通过 `class.semester` 关联学期。

业务规则：

- 学期号不可自由编辑。
- 管理员只能“新增下一学期”和“设为当前学期”。
- 新增规则：`YYYY01 -> YYYY02 -> (YYYY+1)01`。
- 固定日期规则：
  - 第一学期：`YYYY-09-01` 到 `(YYYY+1)-01-20`。
  - 第二学期：`(YYYY+1)-03-01` 到 `(YYYY+1)-07-10`。
- 同一时刻应有且仅有一个 `is_current = 1`。

设计说明：学期是历史维度，不允许随意修改或删除。否则会影响开课、选课、成绩、统计等历史数据的一致性。

### 4.6 `classrooms` 教室表

作用：保存教室基础信息和容量。

关键字段：

- `classroom_id`：教室编号，主键，例如 `A101`。
- `building`：楼栋，例如 `A`。
- `floor_no`：楼层。
- `room_no`：房间号。
- `capacity`：教室容量。
- `status`：教室状态，枚举 `available` / `disabled`。
- `created_at` / `updated_at`：创建和更新时间。

约束与索引：

- 主键：`classroom_id`。
- 检查约束：`capacity > 0`。
- 索引：`building, floor_no`。

系统使用：

- 管理员开课管理中通过教室下拉选择教室。
- 后端创建或更新开课记录时校验课程容量不能超过教室容量。
- 学生课表和教师课程列表展示教室编号。

设计说明：教室独立建表后，系统可以统一控制容量上限，避免开课容量随意填写。当前脚本初始化 A-G 楼若干常用教室。

### 4.7 `class` 开课表

作用：保存具体开课记录。它表示“某学期某课程由某教师授课”，不是行政班级。

关键字段：

- `offering_id`：开课 ID，自增唯一键，供 REST API 使用。
- `semester`：学期号，外键。
- `course_id`：课程号，外键。
- `staff_id`：授课教师号，外键。
- `class_time`：上课时间，例如 `星期三1-4`。
- `capacity`：课程容量。
- `status`：开课状态，枚举 `open` / `closed`。
- `classroom`：教室编号，外键。
- `created_at` / `updated_at`：创建和更新时间。

约束与索引：

- 原始复合主键：`semester, course_id, staff_id`。
- 唯一键：`offering_id`。
- 外键：
  - `semester` 引用 `semesters.semester_id`。
  - `course_id` 引用 `course.course_id`。
  - `staff_id` 引用 `teacher.staff_id`。
  - `classroom` 引用 `classrooms.classroom_id`。
- 检查约束：`capacity > 0`。
- 索引：课程、教师、学期状态、教室。

系统使用：

- 管理员开课管理维护开课记录。
- 学生可选课程查询以当前学期的 `class` 为数据源。
- 学生选课时通过 `offering_id` 定位开课记录。
- 教师端通过 `staff_id` 查询自己的授课课程。
- 统计分析和存储过程以开课记录为统计对象。

业务规则：

- `open` 表示学生可以选课。
- `closed` 表示课程存在但不可再选。
- 创建和更新时，容量必须大于 0，且不能超过教室容量。
- 如果已有学生选课，开课容量不能被改小到低于当前已选人数。
- 如果已有选课记录，开课记录不能删除。

设计说明：保留原始复合主键是为了兼容原 School 数据库。新增 `offering_id` 是为了前后端 API 更方便操作，因为 URL 中传一个 ID 比传学期、课程号、教师号三元组更稳定。

### 4.8 `course_selection` 选课表

作用：保存学生选课记录，也保留原始 School 中的兼容成绩字段。

关键字段：

- `selection_id`：选课 ID，自增唯一键，供 REST API 和成绩表关联使用。
- `student_id`：学生学号，外键。
- `semester`：学期号。
- `course_id`：课程号。
- `staff_id`：教师号。
- `score`：兼容原 School 的总评成绩字段。
- `selection_status`：选课状态，枚举 `selected` / `dropped`。
- `selected_at`：选课时间。
- `dropped_at`：退课时间。
- `created_at` / `updated_at`：创建和更新时间。

约束与索引：

- 原始复合主键：`student_id, semester, course_id, staff_id`，防止同一学生重复选择同一开课。
- 唯一键：`selection_id`。
- 外键：
  - `student_id` 引用 `student.student_id`。
  - `semester, course_id, staff_id` 引用 `class` 的复合主键。
- 检查约束：`score` 为空或位于 0 到 100。
- 索引：`student_id, selection_status` 和 `semester, course_id, staff_id, selection_status`。

系统使用：

- 学生选课成功后插入选课记录。
- 学生退课时按 `selection_id` 删除未出成绩的选课记录。
- 学生课表和成绩页面查询选课记录。
- 教师学生名单从选课记录中获取学生。
- 统计分析按选课记录统计人数。

业务规则：

- 已录入成绩的课程不能退课。
- 选课时检查是否重复、是否满员、是否时间冲突、开课状态是否为 `open`。
- 当前实现退课会删除未出成绩的选课记录；`dropped` 状态字段保留给未来改成保留退课历史的方案。

设计说明：`course_selection.score` 与 `grades.score` 有重复，这是有意保留的兼容冗余。原始 School 数据库把成绩放在选课表中，本系统新增独立 `grades` 表后仍保留该字段，以便兼容旧查询、旧视图和实验数据。

### 4.9 `grades` 成绩表

作用：保存独立成绩记录，与选课记录一一对应。

关键字段：

- `grade_id`：成绩 ID，主键。
- `selection_id`：选课 ID，唯一外键。
- `regular_score`：平时成绩。
- `exam_score`：考试成绩。
- `score`：总评成绩。
- `grade_status`：成绩状态，枚举 `pending` / `submitted`。
- `graded_at`：成绩录入时间。
- `created_at` / `updated_at`：创建和更新时间。

约束与索引：

- 主键：`grade_id`。
- 唯一键：`selection_id`，保证一条选课记录只有一条成绩记录。
- 外键：`selection_id` 引用 `course_selection.selection_id`，并设置 `ON DELETE CASCADE`。
- 检查约束：三个成绩字段均为空或位于 0 到 100。
- 索引：`grade_status`。

系统使用：

- 触发器在选课后自动创建待录入成绩。
- 教师录入平时成绩和考试成绩。
- 后端按 `总评成绩 = 平时成绩 * 40% + 考试成绩 * 60%` 计算 `score`。
- 学生成绩页面展示成绩和绩点。
- 成绩统计、GPA 走势和课程平均分排名以该表为主要来源。

设计说明：`score` 理论上可以由平时成绩和考试成绩计算得到，但存储总评成绩可以保证历史结果稳定，并简化统计查询。教师录入成绩时，后端同步更新 `grades.score` 和 `course_selection.score`。

### 4.10 `users` 用户表

作用：保存系统登录账号、密码哈希、角色和角色绑定信息。

关键字段：

- `user_id`：用户 ID，主键。
- `username`：登录账号，唯一。
- `password_hash`：bcrypt 密码哈希。
- `role`：角色，枚举 `admin` / `teacher` / `student`。
- `display_name`：显示名称。
- `student_id`：学生账号绑定的学号。
- `staff_id`：教师账号绑定的教工号。
- `status`：账号状态，枚举 `active` / `disabled`。
- `last_login_at`：最近登录时间。
- `created_at` / `updated_at`：创建和更新时间。

约束与索引：

- 主键：`user_id`。
- 唯一键：`username`。
- 外键：
  - `student_id` 引用 `student.student_id`。
  - `staff_id` 引用 `teacher.staff_id`。
- 检查约束：
  - 管理员不绑定学生或教师。
  - 学生必须绑定 `student_id`。
  - 教师必须绑定 `staff_id`。
- 索引：角色、学生绑定、教师绑定。

系统使用：

- 登录接口按 `username` 查找用户。
- 使用 bcrypt 校验密码。
- 登录成功后生成 JWT，JWT 中包含角色和绑定 ID。
- 前端根据角色进入管理员、教师或学生界面。

设计说明：登录账号与业务实体分离后，学生和教师基础信息可以独立维护，账号禁用、密码修改、角色判断也更清晰。

## 5. 触发器设计

### `trg_course_selection_after_insert`

触发时机：向 `course_selection` 插入选课记录后自动执行。

作用：

- 自动向 `grades` 表插入一条对应成绩记录。
- 如果插入的选课记录已有 `score`，则成绩状态为 `submitted`。
- 如果 `score` 为空，则成绩状态为 `pending`。

必要性：

- 保证每条选课记录都有一条成绩记录。
- 教师录入成绩时不需要临时创建成绩行，只需要更新已有行。
- 避免“学生已选课但成绩表没有对应记录”的数据缺口。

## 6. 存储过程设计

### `sp_course_grade_statistics(p_offering_id)`

作用：统计某个开课记录的成绩情况。

输入：

- `p_offering_id`：开课 ID。

输出字段：

- 开课信息：`offering_id`、`semester`、`course_id`、`course_name`、`staff_id`、`teacher_name`。
- 人数统计：`selected_count`、`graded_count`。
- 成绩统计：`average_score`、`max_score`、`min_score`。
- 分布统计：`pass_count`、`fail_count`、`excellent_count`。

系统使用：

- 教师端课程统计。
- 管理员统计分析。
- 实验报告展示存储过程调用。

设计说明：将成绩统计封装在存储过程中，可以体现数据库端统计能力，也减少后端重复编写复杂聚合 SQL。

## 7. 视图设计

### `v_computer_failed_student`

作用：查询计算机学院不及格学生。该视图来自原始 School 实验背景，用于保留原始查询要求。

### `v_course_offering_detail`

作用：汇总开课详情，包含学期、课程、院系、教师、时间、教室、容量、已选人数和剩余容量。

用途：可选课程查询、开课展示、报告查询。

### `v_student_timetable`

作用：汇总学生选课后的课表信息，包含学生、课程、教师、时间和教室。

用途：学生课表查询和实验报告查询。

### `v_course_grade_summary`

作用：按开课记录汇总成绩统计，包括选课人数、已录成绩人数、平均分、最高分和最低分。

用途：成绩统计展示和报告查询。

### `v_teacher_course_summary`

作用：按教师汇总授课门数和学生人数。

用途：教师授课统计和报告查询。

## 8. 关键业务规则

### 8.1 选课规则

学生选课时后端检查：

- 开课记录必须存在。
- `class.status` 必须为 `open`。
- 学生不能重复选择同一开课。
- 当前已选人数不能超过 `class.capacity`。
- 同一学期不能选择相同 `class_time` 的课程。

### 8.2 退课规则

学生退课时后端检查：

- 选课记录必须属于当前学生。
- 若成绩已录入，则不能退课。
- 未录成绩的选课记录可以删除。

### 8.3 成绩规则

教师录入：

- 平时成绩：0 到 100。
- 考试成绩：0 到 100。
- 总评成绩：`平时成绩 * 40% + 考试成绩 * 60%`。

系统同步：

- 更新 `grades.regular_score`。
- 更新 `grades.exam_score`。
- 更新 `grades.score`。
- 更新 `course_selection.score` 以兼容旧结构。

### 8.4 GPA 规则

GPA 不直接存入数据库，由前端基于成绩和学分计算。规则为：

- 90-100：4.0
- 85-89：3.7
- 82-84：3.3
- 78-81：3.0
- 75-77：2.7
- 72-74：2.3
- 68-71：2.0
- 64-67：1.5
- 60-63：1.0
- 60 以下：0

未录入成绩不参与 GPA 计算。

### 8.5 学期规则

管理员不能手动编辑学期号、学期名和日期，只能：

- 设置当前学期。
- 新增下一学期。

新增下一学期由后端按最大 `semester_id` 自动生成，避免人工输入导致学期号不规范。

### 8.6 删除规则

为保证历史数据完整性，后端在删除前检查依赖：

- 学生已有选课或成绩时不能删除。
- 教师已有开课记录时不能删除。
- 课程已有开课或选课记录时不能删除。
- 学期不允许删除。
- 开课记录已有选课时不能删除。

前端对不可删除记录禁用删除按钮，并通过悬浮提示显示原因。

## 9. 兼容与冗余说明

当前数据库存在一些有意保留的冗余或兼容字段：

- `course_selection.score` 与 `grades.score`：
  - 原始 School 将成绩放在选课表。
  - 本系统新增 `grades` 表作为成绩主表。
  - 为兼容原始查询和视图，保留并同步 `course_selection.score`。

- `class` 的复合主键与 `offering_id`：
  - 复合主键 `semester, course_id, staff_id` 来自原始 School。
  - `offering_id` 方便 REST API 使用单个 ID 操作开课。

- `course_selection` 的复合主键与 `selection_id`：
  - 复合主键防止同一学生重复选择同一开课。
  - `selection_id` 方便退课、成绩关联和 API 操作。

- `grades.score` 与 `regular_score` / `exam_score`：
  - 总评成绩可计算，但保存下来便于统计和保持历史结果稳定。

- 时间戳字段：
  - `created_at`、`updated_at`、`selected_at`、`dropped_at` 等字段用于审计和未来扩展。
  - 当前页面不一定全部展示，但对后续追踪数据变化有意义。

这些设计不是无意义重复，而是在原始数据库兼容、实验要求和系统开发便利之间做出的折中。

## 10. 测试数据说明

从 0 初始化脚本会插入以下测试数据：

- 院系：3 个。
- 学生：7 个。
- 教师：4 个。
- 课程：6 门。
- 学期：4 个，当前学期为 `201302`。
- 教室：21 间，覆盖 A-G 楼。
- 开课记录：9 条。
- 选课记录：41 条。
- 成绩记录：41 条，由触发器随选课记录自动生成。
- 用户账号：12 个，包括管理员、学生和教师。

默认测试密码均为 `123456`：

- 管理员：`admin`
- 学生：使用学号登录，例如 `1102`
- 教师：使用教工号登录，例如 `0101`

测试数据覆盖了：

- 多学期成绩。
- 当前学期选课。
- 已录成绩和待录入成绩。
- 不同教师授课。
- 不同教室容量。
- 可选、已关闭课程。

## 11. 与系统模块的对应关系

- 管理员学生管理：`student`、`department`、`users`、`course_selection`、`grades`。
- 管理员教师管理：`teacher`、`department`、`users`、`class`。
- 管理员课程管理：`course`、`department`、`class`、`course_selection`。
- 管理员学期管理：`semesters`、`class`。
- 管理员开课管理：`class`、`course`、`teacher`、`semesters`、`classrooms`、`course_selection`。
- 学生选课：`class`、`course`、`teacher`、`course_selection`、`grades`。
- 学生课表：`course_selection`、`class`、`course`、`teacher`。
- 学生成绩：`course_selection`、`grades`、`class`、`course`、`teacher`。
- 教师课程：`class`、`course`、`course_selection`。
- 教师成绩录入：`grades`、`course_selection`、`class`。
- 统计分析：`sp_course_grade_statistics`、`grades`、`course_selection`、`class`、`course`、`teacher`、`student`。

## 12. 总结

`school` 数据库围绕教学事务管理的核心流程设计：

1. 管理员维护基础数据。
2. 管理员按学期创建开课记录。
3. 学生在当前学期选课。
4. 选课触发成绩记录创建。
5. 教师录入成绩。
6. 学生查看课表、成绩和绩点。
7. 管理员和教师查看统计分析。

该设计保留原 School 数据库的核心结构，同时增加用户、学期、教室、成绩等系统化管理能力，能够支撑当前前后端功能，也满足数据库实验中对触发器、存储过程、视图和复杂查询的要求。

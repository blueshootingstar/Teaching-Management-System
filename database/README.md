# Database Scripts

## 从 0 初始化

推荐给队友本地环境和演示环境使用：

```bash
mysql -uroot -p < database/00_rebuild_school_from_scratch.sql
```

`00_rebuild_school_from_scratch.sql` 会删除并重新创建 `school` 数据库，包含：

- 基础表：`department`、`student`、`teacher`、`course`、`course_offerings`、`course_selection`
- 字典表：`student_statuses`、`professional_ranks`、`course_hour_options`
- 扩展表：`users`、`admin_accounts`、`student_accounts`、`teacher_accounts`、`semesters`、`classrooms`、`grades`、`system_settings`
- 信箱和代课表：`mail_items`、`notification_messages`、`mail_recipients`、`substitution_requests`
- 测试数据和默认账号
- 触发器：选课后自动创建成绩记录；防止同一开课同一教学周存在重复有效代课申请；防止代课周次超过课程学时对应周数
- 存储过程：课程成绩统计
- 视图：开课详情、学生课表、成绩统计、教师授课统计等
- 默认系统设置：全局选课开关 `course_selection_open = 1`，成绩查询开关 `grade_query_open = 0`，成绩上传开关 `grade_upload_open = 0`

默认测试密码都是 `123456`。学生账号格式为 `1xxx`，教师账号格式为 `0xxx`，数据库用检查约束保证两类登录账号不会冲突。管理员新增学生或教师时可以填写初始密码；编辑时可以填写重置密码。数据库只保存 `users.password_hash`，不保存密码明文。

当前脚本按 3NF 收口：学生表只保存 `status_code`，选课资格来自 `student_statuses.can_select_course`；教师表只保存 `professional_rank_id`，职称名称来自 `professional_ranks`；课程表只保存固定 `credit_hours`，上课周数来自 `course_hour_options.required_weeks`；信箱不保存 `message_type`、课程名、教师名、教室展示名等可推导字段。

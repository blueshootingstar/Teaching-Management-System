# Database Scripts

## 从 0 初始化

推荐给队友本地环境和演示环境使用：

```bash
mysql -uroot -p < database/00_rebuild_school_from_scratch.sql
```

`00_rebuild_school_from_scratch.sql` 会删除并重新创建 `school` 数据库，包含：

- 原始 School 基础表：`department`、`student`、`teacher`、`course`、`class`、`course_selection`
- 扩展表：`users`、`admin_profiles`、`semesters`、`classrooms`、`grades`
- 测试数据和默认账号
- 触发器：选课后自动创建成绩记录
- 存储过程：课程成绩统计
- 视图：开课详情、学生课表、成绩统计、教师授课统计等

默认测试密码都是 `123456`。

# API 设计

所有接口返回统一格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

错误返回：

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

## 认证

- `POST /api/auth/login`
- `GET /api/auth/me`

登录成功后返回 JWT，前端在后续请求中使用 `Authorization: Bearer <token>`。

## 管理员

- `GET/POST /api/admin/students`
- `PUT/DELETE /api/admin/students/:id`
- `GET/POST /api/admin/teachers`
- `PUT/DELETE /api/admin/teachers/:id`
- `GET/POST /api/admin/courses`
- `PUT/DELETE /api/admin/courses/:id`
- `GET/POST /api/admin/semesters`
- `PUT/DELETE /api/admin/semesters/:id`
- `PUT /api/admin/semesters/:id/current`
- `GET/POST /api/admin/course-offerings`
- `PUT/DELETE /api/admin/course-offerings/:id`
- `GET /api/admin/departments`
- `GET /api/admin/classrooms`

## 学生

- `GET /api/student/semesters`
- `GET /api/student/available-courses`，支持 `keyword`、`hasCapacity`、`onlyUnselected` 查询，并返回 `is_selected`、`selection_id`
- `POST /api/student/select-course`
- `DELETE /api/student/drop-course/:selectionId`
- `GET /api/student/my-courses`
- `GET /api/student/timetable`
- `GET /api/student/my-grades`

## 教师

- `GET /api/teacher/my-courses`
- `GET /api/teacher/course-students/:courseOfferingId`
- `PUT /api/teacher/grades/:gradeId`，提交 `regular_score`、`exam_score`，后端自动计算总评成绩。
- `GET /api/teacher/course-statistics/:courseOfferingId`

## 统计

- `GET /api/statistics/course/:courseOfferingId`
- `GET /api/statistics/student/:studentId`
- `GET /api/statistics/teacher/:teacherId`
- `GET /api/statistics/semester/:semesterId`
- `GET /api/statistics/course-ranking`

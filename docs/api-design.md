# API 设计

所有接口返回统一格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

普通错误返回：

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

表单校验错误返回：

```json
{
  "code": 400,
  "message": "表单校验失败",
  "data": {
    "fieldErrors": {
      "student_id": "学号已存在",
      "mobile_phone": "电话需为 5-20 位数字"
    }
  }
}
```

前端表单收到 `fieldErrors` 后会把错误显示在对应字段下方，而不是只弹出笼统提示。

## 认证

- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/password`，提交 `old_password`、`new_password` 修改当前用户密码。

登录成功后返回 JWT，前端在后续请求中使用 `Authorization: Bearer <token>`。密码只保存 bcrypt hash，不保存明文。

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
- `GET /api/admin/course-selection-window`
- `PUT /api/admin/course-selection-window`，提交 `is_open` 控制全局选课开关。
- `GET/POST /api/admin/course-offerings`
- `PUT/DELETE /api/admin/course-offerings/:id`
- `GET /api/admin/departments`
- `GET /api/admin/classrooms`，返回 `classroom` 展示值以及 `building_no`、`room_no`、`capacity`。
- `GET /api/admin/student-statuses`，返回学生状态字典和 `can_select_course`。
- `GET /api/admin/professional-ranks`，返回教师职称字典。
- `GET /api/admin/course-hour-options`，返回固定学时选项及其对应上课周数。
- `POST /api/admin/notifications`，提交 `scope`、`title`、`content` 给教师和/或学生发送信箱通知。
- `GET /api/admin/notifications`，返回全部通知历史，含发送人、`recipient_count`、`read_count` 查询聚合值。
- `DELETE /api/admin/notifications/:mailItemId`，任意管理员可删除任意通知，并通过外键级联删除收件人的对应信箱记录。

新增或编辑学生时，接口使用 `status_code`，可选提交 `password` 作为初始密码或重置密码。新增或编辑教师时，接口使用 `professional_rank_id`，也可选提交 `password`。新增或编辑课程时，`credit_hours` 必须来自固定学时选项，接口返回的 `required_weeks` 是 JOIN 得到的展示值。空密码表示使用默认密码或保持原密码。

## 学生

- `GET /api/student/semesters`
- `GET /api/student/course-selection-window`，返回全局选课开关和当前学生状态选课资格。
- `GET /api/student/available-courses`，支持 `keyword`、`hasCapacity`、`onlyUnselected` 查询；学生状态不可选课或全局选课关闭时返回空课程列表和原因。
- `POST /api/student/select-course`，后端强制校验全局开关、学生状态、开课状态、容量、重复选课和时间冲突。
- `DELETE /api/student/drop-course/:selectionId`，后端强制校验全局开关、学生状态和成绩状态。
- `GET /api/student/my-courses`
- `GET /api/student/timetable`，支持 `semester`、`week`，按教学周返回实际授课教师。
- `GET /api/student/my-grades`

`正常` 学生可以选课和退课；`休学`、`毕业` 学生可以登录并查看历史课程、课表、成绩，但不能选课或退课。

## 教师

- `GET /api/teacher/semesters`
- `GET /api/teacher/my-courses`，支持 `semester` 按学期筛选。
- `GET /api/teacher/timetable`，支持 `semester`、`week`，返回教师某周上课表。
- `GET /api/teacher/substitute-candidates`，提交 `offeringId`、`week` 查询可代课教师，同时返回该课程该周是否已存在待处理或已同意代课申请。
- `POST /api/teacher/substitution-requests`，提交 `offeringId`、`weekNo`、`substituteStaffId`、`reason`。
- `POST /api/teacher/substitution-requests/:id/accept`
- `POST /api/teacher/substitution-requests/:id/reject`
- `GET /api/teacher/course-students/:courseOfferingId`
- `PUT /api/teacher/grades/:gradeId`，提交 `regular_score`、`exam_score`，总评成绩由数据库视图计算。
- `GET /api/teacher/course-statistics/:courseOfferingId`

教师和学生周课表只返回课程有效上课周数内的数据。代课申请只保存 `offering_id`、`week_no`、目标代课教师和状态。课程名、学期、上课时间、教师名、教室、周数上限等由查询 JOIN 得到。

## 信箱

- `GET /api/mailbox/unread-count`
- `GET /api/mailbox`，返回当前用户收到的通知和代课申请。
- `PUT /api/mailbox/:recipientId/read`，标记当前用户的一条收件记录为已读。

接口返回的 `item_type` 是查询派生值，不是数据库基础字段。教师和学生右上角信箱图标展示未读红点，点开列表后再进入详情，进入详情时自动转为已读。管理员右上角是发送通知入口，可以管理全部通知历史，不接收通知。

## 统计

- `GET /api/statistics/course/:courseOfferingId`
- `GET /api/statistics/student/:studentId`
- `GET /api/statistics/teacher/:teacherId`
- `GET /api/statistics/semester/:semesterId`
- `GET /api/statistics/course-ranking`

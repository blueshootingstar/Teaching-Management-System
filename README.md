# 教学事务管理系统

这是一个基于 `school` 数据库的数据库课程实验项目，采用 B/S 架构实现教学事务管理。系统包含管理员、教师、学生三类角色，支持学生选课、退课、周课表查询、成绩查询、教师成绩录入、教师代课审批、信箱通知、管理员基础数据维护和统计分析。

本文档面向 clone 项目的队友，按顺序执行即可在本地运行完整系统。

## 技术栈

- 前端：React、Vite、TypeScript、Ant Design、Axios、ECharts
- 后端：Node.js、Express、TypeScript、mysql2、JWT、bcryptjs
- 数据库：MySQL 8.x，包含表、外键、触发器、存储过程、视图和演示数据

## 目录结构

```text
teaching-management-system/
├─ backend/                 # Express + TypeScript 后端
├─ frontend/                # React + Vite 前端
├─ database/                # 数据库从 0 初始化脚本
├─ docs/                    # 数据库设计、API、部署等文档
└─ README.md
```

## 环境要求

请先安装：

- Node.js 18 或更高版本
- npm，通常随 Node.js 一起安装
- MySQL 8.x
- Git

可以用下面命令检查：

```bash
node -v
npm -v
mysql --version
git --version
```

如果在 Windows PowerShell 中执行 `npm -v` 提示禁止运行 `npm.ps1`，可以改用 `cmd` 运行命令，或者执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

也可以临时使用：

```powershell
npm.cmd -v
```

## 从 GitHub 拉取项目

```bash
git clone <你的仓库地址>
cd teaching-management-system
```

后续命令默认都在 `teaching-management-system` 根目录下执行。

## 初始化数据库

第一次运行请使用完整重建脚本：

```bash
mysql -uroot -p < database/00_rebuild_school_from_scratch.sql
```

执行后输入你本机 MySQL 的 `root` 密码。该脚本会删除并重新创建 `school` 数据库，包含完整表结构、演示数据、触发器、存储过程和视图。

注意：`00_rebuild_school_from_scratch.sql` 会重建数据库。如果你已经在本机数据库里手动改过数据，执行前请先备份。

## 配置并启动后端

进入后端目录：

```bash
cd backend
```

安装依赖：

```bash
npm install
```

复制环境变量文件：

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

Windows CMD：

```cmd
copy .env.example .env
```

macOS / Linux：

```bash
cp .env.example .env
```

打开 `backend/.env`，按自己的 MySQL 配置修改：

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=school
JWT_SECRET=please_change_this_secret
```

启动后端开发服务器：

```bash
npm run dev
```

看到类似下面输出即表示后端启动成功：

```text
Backend server running at http://localhost:3000
```

可以在浏览器访问：

```text
http://localhost:3000/api/health
```

如果返回 `success`，说明后端可以访问。

## 配置并启动前端

另开一个终端，回到项目根目录后进入前端目录：

```bash
cd frontend
```

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

前端默认访问地址：

```text
http://localhost:5173
```

前端已经配置了开发代理，浏览器请求 `/api` 会自动转发到 `http://localhost:3000`，所以本地开发时需要前端和后端同时运行。

## 默认账号

所有演示账号默认密码都是：

```text
123456
```

常用账号：

| 角色 | 账号示例 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `123456` |
| 学生 | `1101`、`1102`、`1103` | `123456` |
| 教师 | `0101`、`0102`、`0301` | `123456` |

学生账号就是 `student.student_id`，格式为 `1xxx`；教师账号就是 `teacher.staff_id`，格式为 `0xxx`。两类账号格式互斥，登录时不会因为号码相同产生身份歧义。

管理员新增学生或教师时可以填写初始密码；编辑学生或教师时可以填写重置密码；登录后也可以在右上角修改自己的密码。数据库只保存 bcrypt 哈希，不保存密码明文。

## 常用命令

后端：

```bash
cd backend
npm run dev      # 开发模式
npm run build    # TypeScript 编译
npm start        # 运行编译后的 dist/app.js
```

前端：

```bash
cd frontend
npm run dev      # 开发模式
npm run build    # 构建生产版本
npm run preview  # 预览构建结果
```

## 常见问题

### 1. npm 不是内部或外部命令

说明 Node.js 没装好，或者 Node.js 没加入系统 PATH。重新安装 Node.js 后重启终端。

### 2. PowerShell 提示无法加载 npm.ps1

这是 PowerShell 执行策略问题。可以改用 CMD，或者执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 3. npm 报错找不到 package.json

说明你在错误目录执行了 `npm install` 或 `npm run dev`。

后端命令必须在：

```text
teaching-management-system/backend
```

前端命令必须在：

```text
teaching-management-system/frontend
```

项目根目录没有 `package.json`，不要在根目录执行 `npm run dev`。

### 4. 后端启动后登录失败

优先检查：

- MySQL 服务是否启动
- 是否已经执行 `database/00_rebuild_school_from_scratch.sql`
- `backend/.env` 里的 `DB_PASSWORD` 是否是你的本机 MySQL 密码
- `DB_NAME` 是否为 `school`

### 5. 端口被占用

默认端口：

- 后端：`3000`
- 前端：`5173`

如果端口被占用，可以先关闭旧进程，或修改配置：

- 后端端口在 `backend/.env` 的 `PORT`
- 前端端口在 `frontend/package.json` 的 `dev` 脚本或 `vite.config.ts`

### 6. 数据库脚本执行后中文乱码

请确认 MySQL 使用 `utf8mb4`。本项目初始化脚本已经设置了字符集，通常不需要额外处理。

## Git 协作注意

不要提交这些内容：

- `backend/.env`
- `backend/node_modules/`
- `frontend/node_modules/`
- `backend/dist/`
- `frontend/dist/`
- `frontend/tsconfig.tsbuildinfo`

推荐提交：

- 源代码
- `package.json`
- `package-lock.json`
- `database/*.sql`
- `docs/*.md`
- `README.md`

每个人 clone 后自己执行 `npm install`，不需要把 `node_modules` 上传到 GitHub。

## 数据库说明

推荐阅读：

- `docs/database-design.md`：完整数据库设计说明
- `database/README.md`：数据库脚本说明
- `docs/api-design.md`：接口设计说明
- `docs/local-development.md`：本地开发补充说明

当前数据库的核心表包括：

- `department`：院系
- `student_statuses`：学生状态字典和选课资格
- `professional_ranks`：教师职称字典
- `course_hour_options`：课程固定学时和对应上课周数
- `student`：学生
- `teacher`：教师
- `course`：课程
- `semesters`：学期
- `classrooms`：教室
- `course_offerings`：开课记录
- `course_selection`：选课记录
- `grades`：成绩
- `users`：登录凭证
- `admin_accounts`：管理员账号
- `student_accounts`：学生账号绑定
- `teacher_accounts`：教师账号绑定
- `mail_items`、`notification_messages`、`mail_recipients`：信箱通知与收件状态
- `substitution_requests`：教师单周代课申请
- `system_settings`：系统设置

全局选课、当前学期成绩查询和成绩上传开关保存在 `system_settings`，管理员可以开启或关闭对应功能；开启或关闭前会二次确认，避免误触。学生状态来自 `student_statuses`：正常学生可以选课和退课，休学和毕业学生可以登录查看历史课程、课表和历史成绩，但不能参与选课或退课，并会在选课页看到原因提示。成绩查询关闭时，学生不能查看当前学期成绩，但历史学期成绩仍可查看；成绩上传关闭时，教师不能录入或修改成绩。

课程学时来自 `course_hour_options`，目前固定为 `16/32/48/64` 学时，对应 `4/8/12/16` 周。学生和教师周课表只显示课程有效上课周数内的安排，代课申请也不能超过该课程对应周数。

信箱入口位于页面右上角。教师和学生看到收件图标，未读时显示红点，点开后先看标题列表，再进入详情并自动标为已读；管理员看到通知发送入口，可以查看全部历史通知并删除，删除后收件人的对应通知也会被级联删除。

数据库基础表按 3NF 设计：学生表不重复保存状态名称或选课资格，教师表不重复保存职称名称，课程表不重复保存上课周数，信箱不保存 `message_type`、课程名、教师名、教室展示名等可由关联表查询得到的展示字段。

## 本地启动顺序总结

最短流程如下：

```bash
# 1. 初始化数据库
mysql -uroot -p < database/00_rebuild_school_from_scratch.sql

# 2. 启动后端
cd backend
npm install
npm run dev

# 3. 另开终端启动前端
cd frontend
npm install
npm run dev
```

其中后端第一次启动前必须先复制 `.env` 文件：

- Windows PowerShell：`Copy-Item .env.example .env`
- Windows CMD：`copy .env.example .env`
- macOS / Linux：`cp .env.example .env`

然后访问：

```text
http://localhost:5173
```

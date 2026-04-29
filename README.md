# 教学事务管理系统

这是一个基于 `school` 数据库的数据库课程实验项目，采用 B/S 架构实现教学事务管理。系统包含管理员、教师、学生三类角色，支持学生选课、退课、课表查询、成绩查询、教师成绩录入、管理员基础数据维护和统计分析。

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
├─ database/                # 数据库初始化和增量脚本
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

如果只是想给已有的 `school` 数据库补充演示数据，可以执行：

```bash
mysql -uroot -p school < database/03_seed.sql
```

`database/07_report_queries.sql` 是实验报告展示用查询，不是启动系统必须执行的脚本。

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

学生账号一般就是 `student.student_id`，教师账号一般就是 `teacher.staff_id`。

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
- `student`：学生
- `teacher`：教师
- `course`：课程
- `semesters`：学期
- `classrooms`：教室
- `class`：开课记录
- `course_selection`：选课记录
- `grades`：成绩
- `users`：登录用户

其中 `class` 在本系统里表示“开课记录”，不是行政班级。

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

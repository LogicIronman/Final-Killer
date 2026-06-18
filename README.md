# 期末杀手（Final Killer）

面向大学生《马克思主义基本原理》期末复习场景的刷题 Web 应用。项目已进入 **Phase 4**，当前具备完整学习闭环、共享考试日程、实时倒计时和管理员日程维护能力。

仓库内置 455 道正式题目，可直接在本地启动，不依赖第三方数据库或云服务。

## 目录

- [主要功能](#主要功能)
- [技术栈](#技术栈)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [可用脚本](#可用脚本)
- [项目结构](#项目结构)
- [核心业务规则](#核心业务规则)
- [环境变量](#环境变量)
- [API 概览](#api-概览)
- [数据库](#数据库)
- [题库格式与导入](#题库格式与导入)
- [测试与构建](#测试与构建)
- [生产部署](#生产部署)
- [当前范围与后续计划](#当前范围与后续计划)
- [常见问题](#常见问题)

## 主要功能

### 用户系统

- 用户名和密码注册、登录、退出。
- 密码使用 `bcryptjs` 哈希后保存，不在数据库中存储明文密码。
- 登录成功后签发有效期为 7 天的 JWT。
- 前端通过 `Authorization: Bearer <token>` 调用受保护接口。
- 支持 `user` 与 `admin` 两种服务端角色；管理员账号由部署环境变量创建或提升。

### 游客模式

- 无需注册即可进入题库练习。
- 游客进度保存在浏览器 `localStorage` 中，不写入服务器数据库。
- 游客数据只在当前浏览器中有效，清理站点数据或更换设备后无法恢复。
- 游客进度不会在注册或登录后自动合并到账号。

### 刷题与判分

- 支持单选题、多选题和判断题。
- 每轮默认随机抽取 10 道尚未完成的新题。
- 提交后立即显示正确或错误状态、正确答案和题目解析。
- 多选答案会先去重、转大写并排序，因此 `AC`、`CA` 和 `AAC` 按同一答案处理。
- 判断题兼容选项键及中文答案，例如 `A`、`B`、`对`、`错`。
- 已提交的当前题目会锁定，避免重复提交。
- 支持返回上一题，并保留本轮选择、判分结果和解析。
- 支持 `A-E` 或 `1-5` 选择；Enter 提交，提交后再次按 Enter 进入下一题。
- 复习模式优先抽取连续答对次数更低、较早答错的题目。
- 复习答错会清零连续正确次数，连续答对 3 次后进入已完成。

### 学习进度

- 仪表盘展示题目总数、未做题、复习中、已完成、累计正确率和今日刷题数。
- 新题一次答对后进入“已完成”。
- 新题答错后进入“复习中”，并记录错误次数和错误历史。
- 错题本按最近答题时间展示曾经答错的题目。
- 支持为题目添加或取消重点标记。
- 支持进入重点题列表集中查看并取消标记。
- 登录用户可以查看按累计答题提交次数统计的全站排行榜。
- 已完成列表和题目详情支持查看正确答案、解析及错误历史。
- 支持重置单题进度，使题目重新回到未做状态。

### 考试日程与倒计时

- 主页展示最近一场未来考试的天、时、分、秒倒计时。
- 存在多场未来考试时，可以横向切换查看不同课程。
- 所有登录用户和游客都可以读取共享考试日程。
- 管理员可以在独立页面添加、修改和删除考试日程。
- 管理员可以在题库管理页上传 JSON、校验差异、备份导入并回滚历史版本。
- 管理接口同时校验 JWT 和管理员角色，前端隐藏入口不作为权限边界。

## 技术栈

### 前端

- React 18
- TypeScript
- Vite 6
- Tailwind CSS 3
- React Router 6
- Lucide React
- 本地实现的 shadcn 风格基础组件

### 后端

- Node.js
- Express 4
- TypeScript
- Node.js 内置 `node:sqlite`
- Zod 参数校验
- bcryptjs 密码哈希
- JSON Web Token 身份认证

### 工程组织

- npm workspaces 管理 `client` 和 `server`。
- 单仓库同时包含前端、后端、题库、测试和部署文档。
- 开发环境由 Vite 将 `/api` 请求代理到 Express。
- 生产环境由 Express 同时提供 API 和 `client/dist` 静态文件。

## 系统要求

建议使用以下环境：

- Node.js 22 或更高版本，推荐当前 Node.js LTS。
- npm 10 或更高版本。
- Windows PowerShell、macOS Terminal 或 Linux Shell。

项目使用 Node.js 内置的 `node:sqlite`，旧版本 Node.js 可能无法运行。可先检查版本：

```bash
node --version
npm --version
```

## 快速开始

### 1. 安装依赖

在仓库根目录执行：

```bash
npm install
```

如果 Windows PowerShell 因执行策略阻止 `npm.ps1`，可使用：

```powershell
npm.cmd install
```

### 2. 配置环境变量

本地开发可以直接使用代码中的默认值。需要覆盖默认配置时，可参考根目录的 `.env.example` 设置系统环境变量，或将其复制为项目根目录下的 `.env`：

```powershell
Copy-Item .env.example .env
```

生产环境必须设置独立且足够强的 `JWT_SECRET`，不要使用仓库中的开发默认值。

### 3. 初始化数据库和题库

```bash
npm run seed
```

该命令会：

1. 创建 SQLite 数据库及所需数据表。
2. 校验 `data/questions.json` 的字段、题目 ID 和答案。
3. 将 455 道题导入默认题库。

> **注意：** 当前 seed 实现会先清空题库、用户学习进度和每日统计，再重新导入题目。已有正式数据时，请先备份数据库，不要直接执行该命令。

### 4. 启动开发环境

```bash
npm run dev
```

启动后访问：

- 前端：<http://localhost:5173>
- 后端：<http://localhost:4000>
- 健康检查：<http://localhost:4000/api/health>

根脚本会并行启动前端与后端：

- Vite 负责前端热更新。
- `tsx watch` 负责后端 TypeScript 文件热重载。
- 前端 `/api/*` 请求由 Vite 代理到 `http://localhost:4000`。

## 可用脚本

以下命令均在仓库根目录执行：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动前端和后端开发服务器 |
| `npm run build` | 编译后端，并构建前端生产文件 |
| `npm run test` | 运行后端单元测试 |
| `npm run seed` | 创建数据库并重新导入题库 |
| `npm start` | 启动已构建的生产服务 |

也可以单独运行某个 workspace：

```bash
npm run dev --workspace client
npm run dev --workspace server
npm run test --workspace server
npm run build --workspace client
npm run build --workspace server
```

## 项目结构

```text
Final Killer/
├─ client/                         # React 前端
│  ├─ src/
│  │  ├─ components/              # 页面布局与基础 UI 组件
│  │  ├─ pages/                   # 登录、仪表盘、刷题及各学习列表页面
│  │  ├─ api.ts                   # API 请求与 JWT 注入
│  │  ├─ auth.tsx                 # 登录态和游客态管理
│  │  ├─ guestProgress.ts         # 游客本地判分与进度
│  │  └─ styles.css               # Tailwind 与全局视觉样式
│  ├─ vite.config.ts              # Vite 配置及 API 代理
│  └─ tailwind.config.ts          # 设计令牌与 Tailwind 配置
├─ server/                         # Express 后端
│  ├─ src/
│  │  ├─ lib/                     # API 响应与判分等纯逻辑
│  │  ├─ middleware/              # JWT 鉴权中间件
│  │  ├─ routes/                  # HTTP 路由
│  │  ├─ services/                # 认证、题库和学习进度服务
│  │  ├─ scripts/seed.ts          # 题库导入脚本
│  │  ├─ app.ts                   # Express 应用装配
│  │  ├─ config.ts                # 环境配置
│  │  └─ db.ts                    # SQLite 连接及建表
│  └─ data/                        # 本地 SQLite 数据库，默认被 Git 忽略
├─ data/questions.json             # 455 道正式题目源文件
├─ docs/
│  ├─ agents/                     # Agent 工作流说明
│  └─ DEPLOYMENT.md               # 部署与备份指南
├─ CONTEXT.md                      # 项目领域术语
├─ AGENTS.md                       # Agent 协作约定
├─ .env.example                    # 环境变量示例
└─ package.json                    # npm workspaces 与根脚本
```

## 核心业务规则

### 进度状态

每位登录用户对每道题拥有独立进度，状态包括：

| 状态 | 含义 |
| --- | --- |
| `unseen` | 尚未完成的新题，或只进行了重点标记但尚未答题 |
| `reviewing` | 曾经答错，当前仍在复习队列中 |
| `done` | 当前被视为已经掌握 |

### 状态转换

- 新题模式答对：进入 `done`。
- 新题模式答错：进入 `reviewing`。
- 复习模式答错：保持 `reviewing`，连续答对次数清零。
- 复习模式连续答对 3 次：进入 `done`。

复习模式页面、服务器进度和游客本地进度使用同一状态转换规则。单题重置会删除该题进度、错误历史和重点标记，但不会回滚每日历史统计。

### 登录用户与游客的差异

| 能力 | 登录用户 | 游客 |
| --- | --- | --- |
| 数据位置 | SQLite | 浏览器 localStorage |
| 跨设备同步 | 可通过同一服务端账号保留 | 不支持 |
| 清理浏览器后保留 | 是 | 否 |
| 当前题库 | 服务端数据库题库 | 前端打包的 JSON 题库 |
| 账号合并 | 不适用 | 暂不支持合并到账号 |

## 环境变量

`.env.example` 包含以下配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 开发环境内置值 | JWT 签名密钥，生产环境必须修改 |
| `DATABASE_PATH` | `server/data/final-killer.db` | SQLite 数据库路径 |
| `PORT` | `4000` | Express 监听端口 |
| `CLIENT_ORIGIN` | `http://localhost:5173` | 开发环境允许跨域访问的前端地址 |
| `ADMIN_USERNAME` | 空 | 启动时创建或提升的管理员用户名；留空则不自动配置管理员 |
| `ADMIN_PASSWORD` | 空 | 管理员密码；生产环境必须使用独立强密码 |

生产环境示例：

```text
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_PATH=D:/data/final-killer.db
PORT=4000
CLIENT_ORIGIN=https://example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

不要提交真实的 `.env`、数据库文件或生产密钥。仓库的 `.gitignore` 已忽略这些文件。

## API 概览

所有接口统一返回以下结构：

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

失败时 `ok` 为 `false`，`error` 包含机器可读的 `code` 和面向用户的 `message`：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "用户名长度必须为 3-20"
  }
}
```

除注册、登录和健康检查外，接口均需要请求头：

```text
Authorization: Bearer <token>
```

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 否 | 服务健康检查 |
| `POST` | `/api/auth/register` | 否 | 注册并返回用户信息和 JWT |
| `POST` | `/api/auth/login` | 否 | 登录并返回用户信息和 JWT |
| `GET` | `/api/auth/me` | 是 | 获取当前登录用户 |
| `GET` | `/api/questions/new?limit=10` | 是 | 随机获取 1-50 道未做新题 |
| `GET` | `/api/questions/review?limit=10` | 是 | 按优先级获取 1-50 道复习题 |
| `GET` | `/api/questions/:id` | 是 | 获取题目详情、进度和错误历史 |
| `POST` | `/api/progress/answer` | 是 | 提交答案并更新学习进度 |
| `GET` | `/api/progress/stats` | 是 | 获取仪表盘统计数据 |
| `GET` | `/api/progress/wrong-answers` | 是 | 获取曾经答错的题目 |
| `GET` | `/api/progress/marked` | 是 | 获取当前用户的重点题 |
| `GET` | `/api/progress/completed` | 是 | 获取当前用户的已完成题目 |
| `POST` | `/api/progress/mark` | 是 | 添加或取消重点标记 |
| `POST` | `/api/progress/reset` | 是 | 重置一道题的学习进度 |
| `GET` | `/api/leaderboard` | 是 | 获取注册用户刷题排行榜 |
| `GET` | `/api/exams` | 否 | 获取按时间排序的共享考试日程 |
| `POST` | `/api/exams` | 管理员 | 创建考试日程 |
| `PUT` | `/api/exams/:id` | 管理员 | 修改考试日程 |
| `DELETE` | `/api/exams/:id` | 管理员 | 删除考试日程 |
| `GET` | `/api/admin/question-bank` | 管理员 | 获取当前题库和备份版本 |
| `POST` | `/api/admin/question-bank/preview` | 管理员 | 校验上传题库并生成差异预览 |
| `POST` | `/api/admin/question-bank/import` | 管理员 | 备份并导入已确认的预览 |
| `POST` | `/api/admin/question-bank/versions/:id/rollback` | 管理员 | 回滚题库版本并备份当前状态 |

注册和登录请求体：

```json
{
  "username": "student01",
  "password": "123456"
}
```

用户名长度为 3-20 个字符，密码至少 6 位。

提交答案请求体：

```json
{
  "questionId": "405382435",
  "answer": "B",
  "mode": "new"
}
```

`mode` 可取 `new` 或 `review`。多选题的 `answer` 使用选项键组合，例如 `ACD`。

重点标记请求体：

```json
{
  "questionId": "405382435",
  "isMarked": true
}
```

## 数据库

默认数据库文件位于：

```text
server/data/final-killer.db
```

服务启动时会自动执行幂等建表，并在题库为空时自动导入 `data/questions.json`。

主要数据表：

| 表 | 作用 |
| --- | --- |
| `users` | 用户名、密码哈希、注册和最后登录时间 |
| `quiz_banks` | 题库元数据和题目总数 |
| `questions` | 题干、选项、答案、章节、题型和解析 |
| `user_progress` | 每位用户每道题的状态、次数、错题历史和重点标记 |
| `daily_logs` | 每日新题、复习、正确和错误数量 |
| `exam_schedules` | 全站共享的课程考试时间 |
| `app_settings` | 幂等初始化标记等应用级配置 |

备份时建议先停止写入，再复制 SQLite 文件：

```powershell
Copy-Item server\data\final-killer.db D:\backup\final-killer.db
```

恢复时停止服务，用备份文件替换当前数据库后重新启动。不要在恢复数据库后立即运行 `npm run seed`，否则学习进度会被清空。

## 题库格式与导入

题库源文件为 JSON 数组。单道题格式如下：

管理员登录后可访问 `/admin/question-bank`，选择 JSON 文件并依次完成“校验与差异预览 → 备份并导入”。预览有效期为 30 分钟；如果期间题库已被其他管理员修改，必须重新上传确认。导入会保留未变化题目的学习进度，并清除内容变化或删除题目的旧进度。

每次导入和回滚前都会在 SQLite 中保存完整题库版本，包括题目、学习进度和每日统计。回滚也会先备份当前状态，因此可以撤销一次回滚。

```json
{
  "id": "405382435",
  "question": "共产主义社会制度具有巨大优越性的根本保证是( )。",
  "options": {
    "A": "社会制度的和谐完善",
    "B": "创造出前所未有的高水平的劳动生产率",
    "C": "人的精神境界的极大提高",
    "D": "科学技术的不断进步和创新"
  },
  "correctAnswer": "B",
  "chapter": "第七章",
  "type": "single",
  "explanation": "正确答案是B。"
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 题目唯一 ID，整个题库不可重复 |
| `question` | 是 | 题干 |
| `options` | 是 | 选项键到选项文本的映射，至少 2 项 |
| `correctAnswer` | 是 | 正确答案；多选题写成 `ABC` 形式 |
| `chapter` | 否 | 章节名称 |
| `type` | 是 | `single`、`multiple` 或 `judge` |
| `explanation` | 否 | 提交答案后展示的解析 |

替换题库的一般流程：

1. 备份 `server/data/final-killer.db`。
2. 更新 `data/questions.json`。
3. 确保题目 ID 唯一、答案对应现有选项。
4. 在可接受清空现有进度的环境中执行 `npm run seed`。
5. 启动服务并检查 `/api/health` 与题目数量。

## 测试与构建

### 运行测试

```bash
npm test
```

当前测试覆盖：

- 单选题判分。
- 多选题忽略顺序并去重后的判分。
- 判断题按选项键或中文标签判分。
- 新题答对进入 `done`。
- 新题答错进入 `reviewing` 并写入错题历史。
- 总题数、未做、复习中、已完成和正确率统计。
- 只标记未答题后，题目仍保留在新题池。
- 排行榜按刷题量、累计正确数和用户 ID 稳定排序。
- 复习队列按连续答对次数和最后答错时间排序。
- 复习连续答对 3 次进入 `done`，答错后连续次数归零。
- 题目详情返回错误历史，单题重置后重新进入新题池。
- 考试日程默认数据、按时间排序、管理员 CRUD 和不存在记录处理。

### 生产构建

```bash
npm run build
```

构建产物：

- `client/dist/`：前端静态资源。
- `server/dist/`：后端 JavaScript。

推荐在提交或部署前执行：

```bash
npm test
npm run build
```

## 生产部署

最小生产启动流程：

```bash
npm install
npm run seed
npm run build
npm start
```

生产服务默认监听 `4000` 端口。后端检测到 `client/dist` 后，会直接提供前端静态资源，因此浏览器只需访问后端服务地址。

实际部署时建议：

- 使用 systemd、PM2、Docker 或其他进程管理器托管 Node.js 服务。
- 使用 Nginx 或 Caddy 反向代理并启用 HTTPS。
- 将 SQLite 数据库放在持久化磁盘上。
- 定期备份数据库，并验证备份可恢复。
- 在进程管理器中注入 `JWT_SECRET` 等环境变量。
- 只在首次初始化或明确接受清空进度时执行 `npm run seed`。

Nginx 示例、SQLite 备份和题库导入注意事项见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 当前范围与后续计划

Phase 1 已实现：

- 注册、登录和 JWT 鉴权。
- 游客本地练习。
- 新题随机抽取和三类题型判分。
- 登录用户服务端进度持久化。
- 仪表盘统计、错题本和重点标记。

Phase 2 当前已实现：

- 刷题会话上一题回看及选择、结果保留。
- 字母键、数字键和 Enter 连续刷题操作。
- 登录用户与游客的重点题列表。
- 按累计答题提交次数统计的注册用户排行榜。

Phase 3 当前已实现：

- 登录用户与游客的正式复习模式。
- 连续答对 3 次的掌握闭环。
- 已完成题目列表。
- 题目详情、错误历史和学习统计。
- 单题进度重置。

Phase 4 当前已实现：

- 全站共享的多课程考试日程。
- 主页最近考试实时倒计时与多考试切换。
- 由环境变量配置的管理员账号和服务端角色鉴权。
- 管理员考试日程添加、修改和删除页面。
- 管理员题库 JSON 校验、差异预览、版本备份、导入和回滚页面。
- 兼容现有数据库的幂等表结构迁移与默认考试初始化。

当前尚未实现：

- 游客进度迁移到登录账号。
- 多题库创建与切换。
- 找回密码、邮箱验证和第三方登录。
- 题库 JSON 导出、用户管理和内容审核。
- 学习材料上传、AI 解析和个性化推荐。
- 完整的端到端浏览器自动化测试。

## 常见问题

### PowerShell 提示无法运行 npm.ps1

这是 Windows 执行策略导致的，可直接改用 `npm.cmd`：

```powershell
npm.cmd run dev
```

### 前端能打开，但接口请求失败

确认后端正在监听 `4000` 端口，并访问：

```text
http://localhost:4000/api/health
```

开发环境中还应确认 `client/vite.config.ts` 的代理目标与后端端口一致。

### 修改端口后前端无法连接后端

如果修改 `PORT`，还需要同步修改 `client/vite.config.ts` 中 `/api` 的代理地址，或在生产环境让前后端通过同一域名访问。

### 为什么游客数据消失了

游客数据只保存在 `localStorage`。无痕模式结束、清理浏览器数据、更换浏览器或设备都会导致数据不可用。需要长期保存时应注册并登录。

### 为什么执行 seed 后账号还在，但学习进度消失了

当前导入逻辑会清空题库、学习进度和每日统计，但不会删除 `users` 表中的账号。这是为了重新建立题库关联。正式环境导入前务必备份数据库。

### 数据库不存在怎么办

运行 `npm run seed`，或直接启动后端。服务会创建数据库目录、执行建表，并在题库为空时自动导入默认题库。

## 相关文档

- [部署说明](docs/DEPLOYMENT.md)
- [领域术语](CONTEXT.md)
- [Agent 协作指南](AGENTS.md)
- [Issue Tracker 约定](docs/agents/issue-tracker.md)

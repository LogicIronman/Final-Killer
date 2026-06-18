# 期末杀手 - 实现提示词

你是一个资深全栈工程师。请在当前仓库中实现一个面向大学生的马克思主义基本原理刷题复习网站，项目名为「期末杀手」。

目标不是做展示页，而是做一个可部署、可登录、可刷题、可追踪进度的真实小型 Web 应用。优先完成 MVP，保证 10-40 人在服务器上同时使用时稳定可用。

---

## 1. 执行方式

### 1.1 开始前先检查仓库

实现前先阅读当前仓库结构，不要假设项目已经初始化：

- 如果仓库为空，创建完整项目。
- 如果已有前后端代码，优先沿用现有技术栈、目录结构和代码风格。
- 如果已有 `AGENTS.md`、`CLAUDE.md`、`CONTEXT.md`、`docs/adr/` 或 `docs/agents/`，先阅读再修改。
- 如果需要使用工程技能，请先完成 `setup-matt-pocock-skills` 所需的仓库配置：
  - issue tracker：若无 GitHub/GitLab remote，默认使用本地 markdown。
  - triage labels：默认使用 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。
  - domain docs：默认单上下文，根目录 `CONTEXT.md` + `docs/adr/`。

### 1.2 开发原则

- 优先实现 Phase 1，不要一开始铺开所有扩展功能。
- 保持代码结构清晰，前后端边界明确。
- 数据必须持久化到服务器 SQLite，不要只存在浏览器本地。
- 游客模式可以用浏览器本地状态，但登录用户的数据必须存在数据库。
- 所有 API 返回结构保持一致，错误信息要可读。
- 每完成一个阶段，运行可用的构建、类型检查或测试命令。
- 最后提供启动方式、部署说明和默认配置说明。

---

## 2. 产品目标

开发一个通用刷题复习网站，首个题库为「马克思主义基本原理」期末复习题库。

核心用户是大学生，典型使用场景：

- 考前快速刷新题。
- 自动收集错题。
- 反复复习错题，直到连续答对 3 次。
- 查看总体进度、正确率和每日刷题记录。
- 管理员可替换或导入题库，使系统以后能用于其他课程。

---

## 3. 技术栈

使用以下技术栈，除非仓库中已经存在明确冲突的实现：

- 前端：React 18 + TypeScript + Vite
- 样式：Tailwind CSS + shadcn/ui
- 后端：Node.js + Express
- 数据库：SQLite3
- 认证：JWT
- 部署：Node 服务 + Nginx 反向代理

建议目录结构：

```text
.
├─ client/                 # React 前端
├─ server/                 # Express 后端
├─ data/
│  └─ questions.json       # 初始题库
├─ docs/
│  ├─ DEPLOYMENT.md
│  └─ agents/
├─ CONTEXT.md
└─ README.md
```

如果现有仓库已有其他结构，沿用现有结构，不要为了匹配上方示例做无意义迁移。

---

## 4. MVP 范围

Phase 1 必须完成以下功能：

1. 用户注册、登录、登出、游客模式。
2. JWT 鉴权和当前用户接口。
3. SQLite 建表和初始化脚本。
4. 导入或加载 `data/questions.json` 题库。
5. 新题模式：从未做题中抽题、答题、记录进度。
6. 复习模式的基础数据写入：答错进入复习队列。
7. 主页仪表盘：显示总题数、未做题、复习中、已完成、正确率。
8. 错题本基础列表。
9. 响应式页面，手机和桌面都能正常使用。
10. README 中写清楚本地启动和部署步骤。

Phase 1 不要求完成：

- 排行榜。
- 笔记系统。
- 深色模式。
- 完整管理员后台。
- 完整学习资料管理。
- 复杂图表和热力图。

这些可以预留接口和数据表，但不要阻塞核心刷题流程。

---

## 5. 核心功能

### 5.1 用户系统

注册：

- 字段：用户名、密码、确认密码。
- 用户名唯一。
- 用户名长度 3-20。
- 密码需要后端哈希保存，不能明文存储。
- 注册成功后可直接登录或返回登录页。

登录：

- 用户名 + 密码验证。
- 成功后返回 JWT token。
- token 默认有效期 7 天。
- 前端保存 token，并在请求中带上 `Authorization: Bearer <token>`。

登出：

- 清除前端 token 和用户状态。
- 跳转到登录页或游客首页。

游客模式：

- 无需登录即可刷题。
- 数据只保存在浏览器本地状态或 localStorage。
- 游客数据不写入服务器数据库。
- 页面上要清楚区分游客状态和登录状态。

### 5.2 刷题模式

#### 新题模式

目标：学习从未做过的题。

规则：

- 从当前题库中 `status = unseen` 的题目随机抽取。
- 每轮默认 10 题。
- 每轮内题目不重复。
- 显示题干、选项、题型、章节。
- 支持单选、多选、判断。
- 用户提交后显示正确/错误反馈和解析。
- 答对：题目进入 `done`。
- 答错：题目进入 `reviewing`，并记录到错题本。
- 支持跳过当前题，跳过不改变进度。
- 支持标记或取消标记重点题。

#### 复习模式

目标：巩固做错过或仍在复习中的题。

规则：

- 从 `status = wrong` 或 `status = reviewing` 的题目中抽取。
- 优先出现连续答对次数低的题。
- 答对：`consecutive_correct + 1`。
- 答错：`consecutive_correct = 0`。
- 连续答对 3 次后，题目进入 `done`。
- 复习题答错后仍保持复习中。

### 5.3 进度追踪

每个登录用户在每个题库下有独立进度。

状态定义：

| 状态 | 含义 |
|---|---|
| `unseen` | 从未做过 |
| `reviewing` | 做错过，仍需复习 |
| `done` | 已完成 |

统计分类：

| 分类 | 说明 |
|---|---|
| 总题数 | 当前题库题目总数 |
| 未做题 | 当前用户从未做过的题 |
| 复习中 | 做错过，连续答对少于 3 次 |
| 已完成 | 新题一次答对，或复习连续答对 3 次 |
| 错题本 | 所有曾经做错过的题 |
| 重点题 | 用户手动标记的题 |

### 5.4 数据可视化

Phase 1 只需做基础仪表盘：

- 总题数。
- 已完成数。
- 未做数。
- 复习中数量。
- 正确率。
- 今日刷题数。

后续增强：

- 进度占比图。
- 刷题日历热力图。
- 连续打卡天数。
- 正确率趋势。

### 5.5 题库管理

网站定位为通用刷题工具，题库和网站代码解耦。

题库要求：

- 初始题库文件位于 `data/questions.json`。
- 当前题库共 455 题：
  - 导论 25
  - 第一章 65
  - 第二章 65
  - 第三章 65
  - 第四章 65
  - 第五章 101
  - 第六章 39
  - 第七章 30
- 题型分布：
  - 单选题 262
  - 多选题 125
  - 判断题 68

题目字段：

```json
{
  "id": "q001",
  "question": "马克思主义最本质的特征是？",
  "options": {
    "A": "实践性",
    "B": "阶级性",
    "C": "科学性",
    "D": "革命性"
  },
  "correctAnswer": "A",
  "chapter": "第一章",
  "type": "single",
  "explanation": "..."
}
```

题型规则：

- `single`：单选，答案如 `"A"`。
- `multiple`：多选，答案如 `"ABCD"`，判分时忽略选择顺序。
- `judge`：判断题，选项可以是 `{ "A": "对", "B": "错" }`，答案建议统一归一化为 `"A"` 或 `"B"`。

后续管理员功能：

- 上传 JSON 题库。
- 校验格式并给出具体错误。
- 覆盖式导入或新增题库。
- 多题库切换。
- 导出当前题库为 JSON。

---

## 6. 数据库设计

使用 SQLite。字段名可根据实现习惯微调，但必须覆盖以下信息。

### 6.1 users

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
created_at TEXT NOT NULL,
last_login_at TEXT
```

### 6.2 quiz_banks

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL,
description TEXT,
question_count INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

### 6.3 questions

```sql
id TEXT PRIMARY KEY,
quiz_bank_id INTEGER NOT NULL,
question TEXT NOT NULL,
options_json TEXT NOT NULL,
correct_answer TEXT NOT NULL,
chapter TEXT,
type TEXT NOT NULL,
explanation TEXT,
FOREIGN KEY (quiz_bank_id) REFERENCES quiz_banks(id)
```

### 6.4 user_progress

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
quiz_bank_id INTEGER NOT NULL,
question_id TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'unseen',
total_attempts INTEGER NOT NULL DEFAULT 0,
correct_count INTEGER NOT NULL DEFAULT 0,
wrong_count INTEGER NOT NULL DEFAULT 0,
consecutive_correct INTEGER NOT NULL DEFAULT 0,
first_wrong_at TEXT,
last_answered_at TEXT,
is_marked INTEGER NOT NULL DEFAULT 0,
wrong_history_json TEXT,
UNIQUE(user_id, quiz_bank_id, question_id)
```

### 6.5 daily_logs

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
quiz_bank_id INTEGER NOT NULL,
date TEXT NOT NULL,
new_questions_count INTEGER NOT NULL DEFAULT 0,
review_questions_count INTEGER NOT NULL DEFAULT 0,
correct_count INTEGER NOT NULL DEFAULT 0,
wrong_count INTEGER NOT NULL DEFAULT 0,
total_time_minutes INTEGER NOT NULL DEFAULT 0,
UNIQUE(user_id, quiz_bank_id, date)
```

### 6.6 materials

学习资料属于 Phase 4，可先不实现完整页面，但可以预留表。

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT,
title TEXT NOT NULL,
description TEXT,
file_path TEXT NOT NULL,
file_type TEXT,
file_size INTEGER,
upload_time TEXT NOT NULL,
download_count INTEGER NOT NULL DEFAULT 0,
is_previewable INTEGER NOT NULL DEFAULT 0
```

---

## 7. API 设计

所有 API 返回 JSON。建议统一格式：

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

失败时：

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

### 7.1 认证

- `POST /api/auth/register`：注册。
- `POST /api/auth/login`：登录。
- `GET /api/auth/me`：获取当前用户。

### 7.2 题目

- `GET /api/questions`：题目列表，支持分页、章节、题型筛选。
- `GET /api/questions/:id`：题目详情。
- `GET /api/questions/new?limit=10`：获取新题。
- `GET /api/questions/review?limit=10`：获取复习题。

### 7.3 进度

- `POST /api/progress/answer`：提交答题记录。
- `GET /api/progress/stats`：用户统计。
- `GET /api/progress/wrong-answers`：错题列表。
- `GET /api/progress/completed`：已完成列表。
- `POST /api/progress/reset`：重置某题进度。
- `POST /api/progress/mark`：标记或取消标记重点题。

答题提交请求示例：

```json
{
  "quizBankId": 1,
  "questionId": "405382435",
  "mode": "new",
  "answer": "B"
}
```

响应示例：

```json
{
  "ok": true,
  "data": {
    "isCorrect": true,
    "correctAnswer": "B",
    "explanation": "正确答案是B。",
    "progress": {
      "status": "done",
      "consecutiveCorrect": 1
    }
  },
  "error": null
}
```

### 7.4 日志

- `GET /api/daily-log`：每日刷题记录。
- `POST /api/daily-log`：记录当日刷题。

### 7.5 管理

管理员能力可以在 Phase 3/4 实现：

- `POST /api/admin/import`：导入题库。
- `GET /api/admin/export`：导出当前题库。
- `GET /api/admin/stats`：系统统计。
- `POST /api/admin/materials`：上传学习资料。
- `DELETE /api/admin/materials/:id`：删除学习资料。

### 7.6 学习资料

学习资料可以在 Phase 4 实现：

- `GET /api/materials`：资料列表。
- `GET /api/materials/:id`：资料详情。
- `GET /api/materials/:id/download`：下载资料。
- `GET /api/materials/:id/preview`：预览资料。

---

## 8. 页面结构

必须实现的页面：

| 页面 | 路由 | Phase | 说明 |
|---|---:|---:|---|
| 登录页 | `/login` | 1 | 登录、注册、游客模式 |
| 主页 | `/` | 1 | 仪表盘、统计、模式入口 |
| 新题模式 | `/practice/new` | 1 | 从未做题中抽题 |
| 复习模式 | `/practice/review` | 2 | 从错题和复习中抽题 |
| 错题本 | `/wrong-answers` | 1 | 查看错题，进入练习 |
| 已完成 | `/completed` | 2 | 查看已完成题 |
| 题目详情 | `/question/:id` | 2 | 查看题目、解析、历史 |
| 设置 | `/settings` | 3 | 重置进度、导入导出、题库切换 |
| 学习资料 | `/materials` | 4 | 资料列表 |
| 资料详情 | `/materials/:id` | 4 | 资料预览或下载 |

---

## 9. 前端设计要求

整体风格：

- 简约、清晰、偏工具型。
- 不做营销落地页。
- 首屏直接服务刷题和进度查看。
- 红色和金色可作为点缀，不能让界面显得刺眼。
- 页面密度适中，减少装饰，强调题目阅读体验。

响应式：

- 手机端：单栏布局，底部固定主要操作按钮，按钮适合触摸。
- 桌面端：可使用左右布局，例如左侧题目，右侧进度/统计。
- 文本不能溢出按钮、卡片或表格。

交互：

- 选项需要有明确选中状态。
- 提交后显示正确/错误状态。
- 禁止重复提交同一道题。
- 加载、空状态、错误状态都要处理。
- 复习队列为空时给出明确提示。

快捷键：

- 桌面端支持 `A/B/C/D/E` 选择。
- `Enter` 提交。
- 右箭头进入下一题。
- 多选题快捷键可切换选中状态。

动效：

- 正确反馈：轻微绿色脉冲。
- 错误反馈：轻微红色提示或抖动。
- 连续答对 3 次：可以使用小型庆祝效果。
- 页面切换和数字变化可有过渡。
- 必须尊重 `prefers-reduced-motion`。

---

## 10. 关键业务逻辑

### 10.1 状态流转

```text
unseen -> 新题答对 -> done
unseen -> 新题答错 -> reviewing
reviewing -> 答对且 consecutive_correct < 3 -> reviewing
reviewing -> 答对且 consecutive_correct >= 3 -> done
reviewing -> 答错 -> reviewing, consecutive_correct = 0
done -> 用户手动重置 -> unseen
```

### 10.2 判分规则

单选：

- 用户答案等于正确答案即正确。

多选：

- 用户答案和正确答案归一化后比较。
- 归一化方式：去重、排序、转大写。
- 例如 `BA` 和 `AB` 视为相同。

判断：

- 建议在导入时归一化为选项 key。
- 如果题库答案是 `"对"` 或 `"错"`，后端需要能兼容映射到对应选项。

### 10.3 抽题规则

新题模式：

- 登录用户：从当前题库中排除已有 `user_progress` 且状态非 `unseen` 的题。
- 游客：从本地已做记录中排除。
- 随机抽取，最多返回 `limit` 条。

复习模式：

- 从当前用户当前题库中 `status = reviewing` 的题抽取。
- 优先级：
  1. `consecutive_correct` 更低的优先。
  2. 最近答错时间更早的优先。
  3. 同优先级内随机。

### 10.4 每日打卡

- 每天至少提交 1 题算打卡。
- 日期使用服务器本地日期或统一时区，文档中说明。
- 连续天数从今天或昨天向前推算，断签后重新计算。

---

## 11. 开发阶段

### Phase 1 - 核心闭环

完成可用闭环：

1. 初始化前后端项目。
2. 建立 SQLite 数据库和迁移/初始化脚本。
3. 实现注册、登录、鉴权。
4. 加载初始题库。
5. 实现新题模式。
6. 实现答题提交和进度记录。
7. 实现主页统计。
8. 实现错题本基础列表。
9. 完成本地启动文档。

验收标准：

- 用户可以注册并登录。
- 登录后可以刷 10 道新题。
- 答对后题目进入已完成。
- 答错后题目进入复习中并出现在错题本。
- 刷题后主页统计发生变化。
- 刷新页面后登录用户进度不丢失。
- 游客可以刷题，但数据不写入服务器。

### Phase 2 - 复习系统

完成错题复习闭环：

1. 实现复习模式。
2. 实现连续答对 3 次进入已完成。
3. 实现已完成题目页面。
4. 实现题目详情页。
5. 支持重置单题进度。

验收标准：

- 答错的新题会进入复习模式。
- 复习题连续答对 3 次后进入已完成。
- 复习中再次答错会重置连续答对次数。
- 用户可以查看题目解析和历史记录。

### Phase 3 - 体验增强

增强但不破坏核心闭环：

1. 章节筛选。
2. 题型筛选。
3. 数据图表和热力图。
4. 数据导入导出。
5. 键盘快捷键。
6. 深色模式。
7. 动效优化。

### Phase 4 - 扩展功能

可选扩展：

1. 管理员题库导入、导出、切换。
2. 学习资料上传、下载、预览。
3. 刷题计时。
4. 排行榜。
5. 笔记功能。

---

## 12. 种子题目示例

如果 `data/questions.json` 已存在，直接使用完整文件。不要用示例覆盖完整题库。

单选题：

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
  "explanation": "正确答案是B。创造出前所未有的高水平的劳动生产率符合题意。"
}
```

多选题：

```json
{
  "id": "405382440",
  "question": "下列选项中属于共产主义含义的有()。",
  "options": {
    "A": "共产主义是一种社会理想",
    "B": "共产主义是一种社会制度",
    "C": "共产主义是一种科学理论",
    "D": "共产主义是一种现实运动"
  },
  "correctAnswer": "ABCD",
  "chapter": "第七章",
  "type": "multiple",
  "explanation": "正确答案是ABCD。各正确选项均符合题意。"
}
```

判断题：

```json
{
  "id": "405382450",
  "question": "社会主义的目标是社会的发展。",
  "options": {
    "A": "对",
    "B": "错"
  },
  "correctAnswer": "错",
  "chapter": "第七章",
  "type": "judge",
  "explanation": "该判断错误。这一表述不符合马克思主义基本原理。"
}
```

---

## 13. 交付物

完成后需要交付：

- 可运行的前端和后端代码。
- SQLite 初始化和题库导入方式。
- `README.md`：本地开发、环境变量、常用命令。
- `docs/DEPLOYMENT.md`：服务器部署、Nginx 反代、数据备份说明。
- 如使用 agent skills，补充 `AGENTS.md` 或 `CLAUDE.md` 与 `docs/agents/`。
- 简要说明已完成的 Phase、未完成的 Phase 和后续建议。

---

## 14. 非功能要求

安全：

- 密码必须哈希。
- JWT secret 必须来自环境变量，开发环境可提供默认示例。
- 后端要校验所有输入。
- 不要把管理员上传路径暴露为任意文件读取漏洞。

可靠性：

- SQLite 写入要处理错误。
- API 出错时返回稳定 JSON。
- 前端不能因为单个请求失败白屏。

可维护性：

- 业务逻辑不要全部堆在路由里。
- 抽题、判分、进度更新建议拆成独立服务函数。
- 数据库访问建议集中封装。
- 题库导入校验建议独立实现。

性能：

- 40 人并发以内 SQLite 足够。
- 常用查询需要合理索引。
- 题目列表分页，不要一次性返回全部题目给列表页。

---

## 15. 最终验收清单

在结束前逐项确认：

- 注册可用。
- 登录可用。
- JWT 鉴权可用。
- 游客模式可用。
- 初始题库加载成功。
- 新题模式可刷题。
- 单选、多选、判断题判分正确。
- 答错进入错题本和复习中。
- 已完成、未做、复习中统计正确。
- 页面刷新后登录用户进度仍在。
- 手机端布局可用。
- 桌面端布局可用。
- README 启动步骤可执行。
- 构建、类型检查或测试命令已运行，并记录结果。

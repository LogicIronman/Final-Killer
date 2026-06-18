# Final Killer 上传 GitHub 与服务器部署前指南

> 适用项目：`D:\项目\Final Killer`  
> 编写日期：2026-06-18  
> 后续服务器部署参考：[[Final Killer 阿里云部署指南]]

## 1. 当前仓库状态

当前项目已经初始化 Git，但还没有正式发布：

| 检查项 | 当前状态 | 影响 |
|---|---|---|
| 当前分支 | `main` | 可直接作为 GitHub 默认分支 |
| 本地提交 | 还没有首次提交 | 上传前必须先整理暂存内容 |
| GitHub remote | 尚未配置 | 创建 GitHub 仓库后再添加 `origin` |
| `.env` | 已被 `.gitignore` 忽略 | 正确，真实密码不能提交 |
| SQLite 数据库 | `*.db` 已被忽略 | 数据库不会随代码上传 |
| `.idea/` | 未完整忽略 | 必须在首次提交前加入根 `.gitignore` |
| `.impeccable/` | 未忽略 | 属于本地工具状态，建议忽略 |
| `.env.example` | 当前不存在 | 建议创建仅含占位符的模板 |
| `data/questions.json` | 约 289 KB | 可直接使用 Git，不需要 Git LFS |
| LICENSE | 当前不存在 | 公开仓库前必须决定授权方式 |

## 2. 首次上传前必须完成

### 2.1 优先创建私有仓库

建议第一次上传时选择 **Private**，原因如下：

- 题库内容是否允许公开传播需要先确认。
- 项目目前没有 LICENSE；没有许可证不等于允许他人自由使用。
- 可以先在服务器使用只读 Deploy Key 拉取代码，部署稳定后再决定是否公开。

如果准备公开仓库，应先确认：

1. `data/questions.json` 的题目来源及公开授权。
2. README、开发日志和需求文档中没有个人信息。
3. 采用哪种开源许可证，例如 MIT；不准备授权则保持私有。

### 2.2 完善根目录 `.gitignore`

当前 `.gitignore` 已覆盖 `.env`、`*.db`、`dist/` 和 `node_modules/`，但仍建议补充：

```gitignore
# IDE 与本地工具状态
.idea/
.impeccable/
.tmp/

# 所有本地环境变量，仅允许模板
.env
.env.*
!.env.example

# SQLite 主文件及 WAL/SHM 临时文件
*.db
*.db-*
*.db-journal
*.sqlite
*.sqlite-*

# 构建、依赖与日志
node_modules/
dist/
*.log
coverage/
.vite/
```

`.scratch/` 不建议忽略。该目录是本仓库在 `AGENTS.md` 中约定的本地 Markdown issue tracker，属于项目协作资料。

### 2.3 创建安全的 `.env.example`

只提交占位符，不能写入真实服务器域名、密码或密钥：

```dotenv
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_PATH=./server/data/final-killer.db
PORT=4000
CLIENT_ORIGIN=https://your-domain.example
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

注意：

- 真实配置写在服务器 `.env`，该文件不得提交。
- `JWT_SECRET` 建议至少 32 字节随机值。
- 修改 `JWT_SECRET` 会导致所有现有登录令牌失效。
- 后端每次启动都会用 `ADMIN_PASSWORD` 同步管理员密码，因此服务器环境变量必须妥善保存。

### 2.4 确认绝不上传的内容

以下文件只能留在本机或服务器：

```text
.env
server/data/final-killer.db
server/server/data/final-killer.db
*.db-wal
*.db-shm
node_modules/
client/dist/
server/dist/
.idea/
.impeccable/
*.log
```

仓库中目前存在本地 SQLite 文件，但都应由忽略规则排除。GitHub 只保存源码和初始题库 JSON，不保存用户账号、密码哈希、学习进度或题库版本快照。

## 3. 本地发布前验证

在 PowerShell 中进入项目：

```powershell
Set-Location 'D:\项目\Final Killer'
```

### 3.1 检查运行环境

```powershell
node --version
npm --version
git --version
```

项目使用 `node:sqlite`，服务器和本地均建议使用 **Node.js 22**。

### 3.2 安装、测试和构建

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

当前基线应满足：

- 服务端测试全部通过。
- TypeScript 编译无错误。
- Vite 生产构建成功。
- `client/dist/index.html` 已生成，但 `dist/` 不应提交。

### 3.3 检查忽略规则

```powershell
git status --short --ignored
git check-ignore -v .env
git check-ignore -v server/data/final-killer.db
git check-ignore -v .idea/workspace.xml
git check-ignore -v .impeccable/live/config.json
```

四条 `git check-ignore` 都应该显示命中的 `.gitignore` 规则。

### 3.4 扫描敏感信息

```powershell
rg -n -S "PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH" . `
  --glob "!node_modules/**" `
  --glob "!.git/**" `
  --glob "!client/dist/**" `
  --glob "!server/dist/**"
```

出现变量名本身是正常的；需要拦截的是实际密码、Token、私钥正文和真实生产密钥。

还要人工检查：

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/development/`
- `optimized-final-killer-prompt.md`
- `data/questions.json` 的来源与授权

## 4. 创建首次提交

### 4.1 配置 Git 身份

只在尚未配置时执行：

```powershell
git config --global user.name "你的 GitHub 用户名"
git config --global user.email "你的 GitHub 邮箱"
git config --global init.defaultBranch main
```

如果不希望公开真实邮箱，可以使用 GitHub 提供的 `noreply` 邮箱。

### 4.2 暂存后必须复核

完成 `.gitignore` 和 `.env.example` 后：

```powershell
git add .
git status --short
git diff --cached --stat
git diff --cached
```

不要看到以下路径：

```text
.env
.idea/
.impeccable/
node_modules/
client/dist/
server/dist/
任何 .db、.db-wal、.db-shm 文件
```

进一步检查即将提交的文件：

```powershell
git ls-files
git ls-files | Select-String -Pattern '\.env$|\.db($|-)|\.idea|node_modules|[/\\]dist[/\\]'
```

第二条命令应没有输出；`.env.example` 不会匹配 `\.env$`，可以正常提交。

### 4.3 首次提交

```powershell
git commit -m "feat: complete Final Killer MVP"
git log --oneline -1
```

如果复核时发现误暂存文件，使用以下命令移出暂存区，不会删除本地文件：

```powershell
git restore --staged <文件路径>
```

## 5. 创建 GitHub 仓库并推送

### 5.1 在 GitHub 网站创建仓库

1. GitHub 右上角选择 **New repository**。
2. 仓库名建议使用 `final-killer`。
3. 第一次建议选择 **Private**。
4. 不要勾选自动创建 README、`.gitignore` 或 LICENSE，避免和本地首次提交冲突。
5. 创建后复制仓库地址。

### 5.2 添加远程地址

HTTPS：

```powershell
git remote add origin https://github.com/<用户名>/final-killer.git
```

或已经配置 SSH 密钥时使用 SSH：

```powershell
git remote add origin git@github.com:<用户名>/final-killer.git
```

确认地址：

```powershell
git remote -v
```

### 5.3 首次推送

```powershell
git branch -M main
git push -u origin main
```

HTTPS 推送时不能使用 GitHub 登录密码，需要浏览器授权、Personal Access Token 或 Git Credential Manager。

### 5.4 GitHub 页面二次检查

推送后打开 GitHub 仓库，确认：

- [ ] 源码、README、`package-lock.json` 和 `data/questions.json` 存在。
- [ ] `.env` 不存在。
- [ ] 所有 SQLite 数据库不存在。
- [ ] `.idea/`、`.impeccable/`、`node_modules/`、`dist/` 不存在。
- [ ] GitHub 默认分支为 `main`。
- [ ] 仓库可见性符合预期。
- [ ] GitHub Secret Scanning 没有报警。

一旦真实密码曾经进入 Git 历史，仅删除文件不够，必须立即轮换密码或密钥；对公开仓库还需要清理历史记录。

## 6. 服务器从 GitHub 拉取代码

### 6.1 私有仓库推荐 Deploy Key

在服务器生成只读部署密钥：

```bash
ssh-keygen -t ed25519 -C "final-killer-deploy" -f ~/.ssh/final-killer-deploy
cat ~/.ssh/final-killer-deploy.pub
```

将公钥添加到：

```text
GitHub 仓库 → Settings → Deploy keys → Add deploy key
```

只需读取代码时不要勾选 **Allow write access**。

配置服务器 SSH：

```bash
cat >> ~/.ssh/config << 'EOF'
Host github-final-killer
  HostName github.com
  User git
  IdentityFile ~/.ssh/final-killer-deploy
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config ~/.ssh/final-killer-deploy
ssh -T git@github-final-killer
```

克隆：

```bash
git clone git@github-final-killer:<用户名>/final-killer.git /opt/final-killer
cd /opt/final-killer
```

### 6.2 在服务器创建真实 `.env`

```bash
cd /opt/final-killer
cp .env.example .env
nano .env
chmod 600 .env
```

生成随机密钥示例：

```bash
openssl rand -hex 32
```

必须修改：

- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

建议让 SQLite 保存在明确的持久化路径，并确保运行用户有写权限。

## 7. 首次部署与以后更新的区别

### 7.1 首次部署

首次部署且数据库不存在时：

```bash
cd /opt/final-killer
npm ci
npm run seed
npm run build
pm2 start npm --name final-killer -- start
pm2 save
```

`npm run seed` 只允许在首次创建数据库时运行。

### 7.2 以后更新代码

已有用户数据后：

```bash
cd /opt/final-killer
pm2 stop final-killer
cp server/data/final-killer.db /backup/final-killer-$(date +%Y%m%d-%H%M%S).db
git pull --ff-only origin main
npm ci
npm test
npm run build
pm2 restart final-killer --update-env
```

**不要再次执行 `npm run seed`。** 它会清空用户学习进度和每日统计。

服务重启时会自动执行幂等数据库迁移，包括题库预览表的 `base_updated_at` 兼容修复。更新后应重新上传题库文件生成新的差异预览。

日常题库更新使用管理员页面：

```text
/admin/question-bank
```

流程为：上传 JSON → 校验 → 差异预览 → 备份旧版本 → 导入；需要时可从后台回滚。

## 8. 上线后的验证清单

```bash
curl http://127.0.0.1:4000/api/health
pm2 status
pm2 logs final-killer --lines 100
```

健康检查应包含：

```json
{"ok":true,"data":{"status":"ready"},"error":null}
```

浏览器检查：

- [ ] HTTPS 可以访问，HTTP 自动跳转 HTTPS。
- [ ] 普通用户可以注册、登录和刷题。
- [ ] 管理员可以进入 `/admin/exams`。
- [ ] 管理员可以进入 `/admin/question-bank` 并生成差异预览。
- [ ] 普通用户无法调用管理员 API。
- [ ] 服务器防火墙只向公网开放 22、80、443，不直接开放 4000。
- [ ] SQLite 自动备份任务已配置并完成一次恢复演练。

## 9. 本项目最容易踩的坑

1. **把 `.env` 或数据库推到 GitHub**：先检查暂存区再提交。
2. **把 `.idea/` 一起首提**：根 `.gitignore` 必须显式忽略。
3. **在已有数据的服务器运行 seed**：会清空学习进度。
4. **服务器 Node.js 版本过低**：项目依赖 Node.js 22 的 `node:sqlite`。
5. **把 4000 端口暴露到公网**：应只由 Nginx 访问 `127.0.0.1:4000`。
6. **直接复制运行中的 SQLite 文件**：应先停服务，或使用 SQLite 在线备份方案。
7. **修改 `JWT_SECRET` 后用户全部掉线**：这是预期行为。
8. **私有仓库在服务器使用个人密码拉取**：使用只读 Deploy Key。
9. **忘记备份题库版本数据**：题库版本也存储在 SQLite 数据库中。
10. **首次推送后才检查版权**：题库和文档公开前先确认授权。

## 10. 推荐执行顺序

- [ ] 补全根 `.gitignore`。
- [ ] 创建无真实秘密的 `.env.example`。
- [ ] 决定仓库保持 Private 还是公开，并确认题库授权。
- [ ] 执行 `npm ci`、`npm test`、`npm run build`。
- [ ] 扫描密码、Token、私钥和个人信息。
- [ ] `git add .` 后完整复核暂存区。
- [ ] 创建首次提交。
- [ ] 创建空 GitHub 仓库并添加 `origin`。
- [ ] 推送 `main`，在 GitHub 网页再次检查文件。
- [ ] 私有仓库配置服务器只读 Deploy Key。
- [ ] 在服务器创建 `.env`，不要从本机上传真实 `.env`。
- [ ] 首次部署只运行一次 seed；以后更新先备份数据库且不再 seed。
- [ ] 配置 HTTPS、PM2、Nginx 和 SQLite 定时备份。

---

相关笔记：[[Git 使用指南]]、[[Final Killer 阿里云部署指南]]。

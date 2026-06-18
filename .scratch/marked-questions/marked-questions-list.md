---
labels:
  - ready-for-agent
type: AFK
status: completed
---

# 增加重点题列表

## What to build

让仪表盘的重点题统计成为可进入的学习入口，提供重点题列表并支持取消重点。登录用户从 SQLite 读取，游客从浏览器本地进度读取。

## Acceptance criteria

- [ ] 仪表盘重点题数据可以进入重点题页面。
- [ ] 页面展示题干、章节、题型、选项和重点状态。
- [ ] 登录用户的重点题从服务端数据库读取。
- [ ] 游客重点题从 localStorage 读取。
- [ ] 用户可以在列表中取消重点，列表和统计随之更新。
- [ ] 无重点题、加载中和请求失败都有明确状态。
- [ ] 仅标记但未答题的题目仍可继续出现在新题模式中。

## Blocked by

None - can start immediately

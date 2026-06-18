---
labels:
  - ready-for-agent
type: AFK
status: completed
---

# Phase 3 完成正式复习系统

## What to build

完成从错题进入复习队列、按优先级抽题、连续答对 3 次后掌握的完整路径，并提供已完成列表、题目详情、错误历史和单题重置。登录用户使用 SQLite，游客使用 localStorage。

## Acceptance criteria

- [ ] 复习模式只抽取 `reviewing` 题目。
- [ ] 连续答对次数低的题优先，之后按最近答错时间从早到晚排序。
- [ ] 复习答错后连续答对次数归零。
- [ ] 复习连续答对 3 次后进入 `done`。
- [ ] 登录用户和游客使用一致规则。
- [ ] 仪表盘和导航可进入复习模式与已完成列表。
- [ ] 题目详情展示正确答案、解析、进度和错误历史。
- [ ] 单题重置后回到未做状态，重点标记一并清除。
- [ ] 服务层状态转换、排序、详情和重置有自动化测试。

## Blocked by

None - can start immediately

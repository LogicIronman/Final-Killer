---
labels:
  - ready-for-agent
type: AFK
status: completed
---

# Phase 4 考试日程与倒计时

## What to build

为所有学习者提供共享考试日程和主页倒计时，并提供受服务端角色保护的管理员维护界面。部署者通过环境变量创建或提升管理员账号。

## Acceptance criteria

- [x] 主页展示最近一场未来考试的天、时、分、秒倒计时。
- [x] 存在多场未来考试时可以切换查看。
- [x] 游客和普通登录用户只能读取日程。
- [x] 管理员可以添加、修改和删除日程。
- [x] 管理接口由服务端角色校验保护。
- [x] 无日程、加载失败和删除确认状态完整。
- [x] 考试日程迁移兼容现有 SQLite 数据库。
- [x] 服务层 CRUD、排序和不存在记录有自动化测试。

## Blocked by

None - completed

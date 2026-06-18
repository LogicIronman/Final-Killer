---
labels:
  - ready-for-agent
type: AFK
status: completed
---

# 完善键盘连续刷题操作

## What to build

扩展刷题页键盘操作，让用户可以用字母键或数字键选择答案，并让 Enter 在“提交答案”和“进入下一题”之间根据当前题目状态自然切换。

## Acceptance criteria

- [ ] `A-E` 可选择对应字母选项。
- [ ] `1-5` 可按当前选项顺序选择第 1-5 个选项。
- [ ] 未提交时按 Enter 提交已选择的答案。
- [ ] 提交后无论答案正确或错误，按 Enter 都进入下一题。
- [ ] 按键自动连发不会造成重复提交或跨越多道题。
- [ ] 页面快捷键说明与实际行为一致。

## Blocked by

- `.scratch/practice-improvements/practice-session-history.md`

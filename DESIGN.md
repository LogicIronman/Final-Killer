# Design System

## Direction

期末杀手采用白底、高对比、工具型产品界面。视觉基于 HP 风格设计指导：Electric Blue 是唯一主操作色，近黑色承载标题和导航，浅灰用于区分工作区域。红色和绿色仅表达错误与正确状态。

## Color

- Primary: `#024ad8`
- Primary hover: `#0e3191`
- Primary soft: `#c9e0fc`
- Ink: `#1a1a1a`
- Body text: `#3d3d3d`
- Muted text: `#636363`
- Canvas: `#ffffff`
- Secondary surface: `#f7f7f7`
- Divider: `#e8e8e8`
- Disabled: `#c2c2c2`
- Success: `#26734d`
- Danger: `#b3262b`

Electric Blue 只用于主按钮、当前选中状态、链接和必要的信息强调。排行榜名次不使用大面积金银铜装饰。

## Typography

使用 `Manrope, Inter, system-ui, sans-serif`。产品界面采用固定字号，不随视口流体缩放。标题使用中等字重，正文保持至少 16px；按钮标签可使用现有大写和轻微字距规则。

## Shape and Depth

- 按钮、输入框和紧凑交互控件：4px 圆角。
- 卡片和主要内容容器：最大 16px 圆角。
- 标签：8px 圆角。
- 阴影仅使用现有 Soft Lift：`0 2px 8px rgba(26, 26, 26, 0.08)`。
- 不同时叠加细边框和宽模糊阴影作为装饰。

## Product Components

- 主操作按钮使用 Electric Blue，次操作使用描边或无底色按钮。
- 表格使用清晰行分隔和对齐，不把每一行做成卡片。
- 正确和错误反馈必须同时包含图标、文字和语义色。
- 加载、空状态、错误状态和禁用状态必须完整。
- 重点题和当前用户使用浅蓝背景或蓝色图标标记，不改变整体布局。

## Layout

- 页面内容宽度沿用 `max-w-6xl`。
- 手机单栏；桌面刷题页使用主工作区加辅助栏。
- 导航在窄屏可横向滚动，但核心内容不得依赖横向滚动。
- 表格在极窄屏可放入明确的横向滚动容器。
- 交互目标最小尺寸为 44x44px。

## Motion

动效只用于状态反馈，时长 150-250ms。保留答对脉冲与答错轻微位移动效，并在 `prefers-reduced-motion` 下退化为近乎即时状态变化。

## Do Not

- 不使用渐变文字、玻璃拟态、装饰性色块或大面积渐变。
- 不在工具页加入营销式 Hero 或夸张大标题。
- 不使用只靠颜色区分的状态。
- 不用圆形胶囊按钮替代现有 4px 圆角操作控件。


# AI 管家

AI 管家各模块的高保真 UI Demo，供设计评审与开发参考。页面使用示例数据，交互在浏览器本地演示。

**[打开全部 Demo](https://wangyekai918-star.github.io/ai-butler/)**

## 事件详情

| Demo | 场景 | 在线演示 | 源码 |
| --- | --- | --- | --- |
| 经营风险 · 调价策略 | 从充电量异常定位原因，展示分时服务费调整与执行复盘。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/%E4%BA%8B%E4%BB%B6%E8%AF%A6%E6%83%85/%E7%BB%8F%E8%90%A5%E9%A3%8E%E9%99%A9_%E8%B0%83%E4%BB%B7%E7%AD%96%E7%95%A5/%E7%BB%8F%E8%90%A5%E9%A3%8E%E9%99%A9_%E8%B0%83%E4%BB%B7%E7%AD%96%E7%95%A5.html) | [目录](./事件详情/经营风险_调价策略/) |
| 经营风险 · 促销策略 | 分析用户流失与充电表现，展示促销决策及转化效果。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/%E4%BA%8B%E4%BB%B6%E8%AF%A6%E6%83%85/%E7%BB%8F%E8%90%A5%E9%A3%8E%E9%99%A9_%E4%BF%83%E9%94%80%E7%AD%96%E7%95%A5/%E7%BB%8F%E8%90%A5%E9%A3%8E%E9%99%A9_%E4%BF%83%E9%94%80%E7%AD%96%E7%95%A5.html) | [目录](./事件详情/经营风险_促销策略/) |
| 经营机会 | 通过五步分析评估经营机会，形成调价建议并跟踪效果。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/%E4%BA%8B%E4%BB%B6%E8%AF%A6%E6%83%85/%E7%BB%8F%E8%90%A5%E6%9C%BA%E4%BC%9A/%E7%BB%8F%E8%90%A5%E6%9C%BA%E4%BC%9A.html) | [目录](./事件详情/经营机会/) |
| 社会事件 | 在多个电站间切换，查看事件影响、决策执行评估与决策复盘。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/%E4%BA%8B%E4%BB%B6%E8%AF%A6%E6%83%85/%E7%A4%BE%E4%BC%9A%E4%BA%8B%E4%BB%B6/%E7%A4%BE%E4%BC%9A%E4%BA%8B%E4%BB%B6.html) | [目录](./事件详情/社会事件/) |
| 经营风险 · 通知决策 | 完成异常分析与通知决策，展示通知内容和发送结果。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/%E4%BA%8B%E4%BB%B6%E8%AF%A6%E6%83%85/%E7%BB%8F%E8%90%A5%E9%A3%8E%E9%99%A9_%E9%80%9A%E7%9F%A5%E5%86%B3%E7%AD%96/%E7%BB%8F%E8%90%A5%E9%A3%8E%E9%99%A9_%E9%80%9A%E7%9F%A5%E5%86%B3%E7%AD%96.html) | [目录](./事件详情/经营风险_通知决策/) |

## 充电安全

安全看板、车辆防护、安全评估和防护预警共用一个 Demo，支持页签切换、筛选、分页与评估详情查看。

| 页签 | 场景 | 在线演示 |
| --- | --- | --- |
| 安全看板 | 查看安全防护概览、AI防护趋势、实时明细与预警/阻断排名。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/充电安全/充电安全.html?tab=safe) |
| 车辆防护 | 查看车辆类型、健康状态和车型预警/阻断分布。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/充电安全/充电安全.html?tab=vehicle) |
| 安全评估 | 筛选车辆评估记录，查看指标得分及评估详情。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/充电安全/充电安全.html?tab=evaluation) |
| 防护预警 | 按级别、时间、订单筛选预警和已阻断记录。 | [在线演示](https://wangyekai918-star.github.io/ai-butler/充电安全/充电安全.html?tab=warn) |

[查看充电安全源码与说明](./充电安全/)。页面使用虚拟车辆、订单和电站示例，本地运行交互，无需连接业务服务。

## 目录约定

```text
AI 管家/
├── index.html                 # 全部 Demo 的在线入口
├── style.css                  # 入口页样式
├── README.md                  # 项目说明与各 Demo 在线链接
├── AGENTS.md                  # AI 协作与项目开发约定
├── AI管家UI风格规范.md
├── design-reference/          # 公共风格依据与参数
├── 事件详情/                  # 事件详情模块
│   ├── 经营风险_调价策略/
│   ├── 经营风险_促销策略/
│   ├── 经营机会/
│   ├── 社会事件/
│   └── 经营风险_通知决策/
└── 充电安全/                  # 与事件详情同级，包含四个页签
```

每个 Demo 独立维护一个 HTML、一个 `style.css`、一个 `app.js`、`README.md` 和 `assets/`。HTML、CSS、JS 同级存放，运行资源不跨 Demo 引用。

后续其他模块在仓库根目录新建模块文件夹，在模块内继续按 Demo 建独立目录，并同步更新本 README 和入口页。界面延续 [AI 管家 UI 风格规范](./AI管家UI风格规范.md)，业务按对应 PRD、原型和最新设计要求落实。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8767/>。项目为静态 HTML，无需安装依赖或构建。

## 在线发布

GitHub Pages 从 `main` 分支根目录发布；后续提交并推送到 `main` 会自动更新在线演示。

本地 `.history/` 备份、系统文件和临时文件通过 `.gitignore` 排除。产品原型和内部 PRD 不随仓库分发。各 Demo 说明中的 `.history/` 路径仅指本地迭代记录。

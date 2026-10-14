# 汽水老师 · 编程课堂（站点总说明）

纯静态站点，无构建步骤：双击 `index.html` 即可浏览，也可放到任意静态服务器 / 对象存储。

## 三条课程线

| 课程线 | 面向 | 入口 | 内容 |
|---|---|---|---|
| **Scratch** | 6–12 岁 | `lesson.html`（L1）、`lesson-s2.html`（L2）、`lesson-s3.html`（L3）、`lesson-scratch-l1-01.html`（L1 第 1 课） | 图形化编程启蒙 → 游戏创作 → 创意大师 |
| **Python** | 9–16 岁 | `lesson-p1.html`（P1）、`lesson-p2.html`（P2）、`lesson-p3.html`（P3·AI 与竞赛） | 基础语法 → 游戏与数据 → 算法与 AI |
| **uni-app x**（大学进阶） | 大学生（已会 H5/CSS3/JS） | `uni-app/index.html` | 4 模块 13 章 + 4 份附录：从工程结构到打包发布，含两个完整项目 |

首页 `index.html` 的「大学进阶 · uni-app x」区块是第三条线的入口。

## 目录结构

```
kids-coding-site/
├─ index.html                站点首页（Scratch / Python / 大学进阶 三条线）
├─ lesson*.html              Scratch 与 Python 的课时页（共 7 个）
├─ uni-appx/                 uni-app x 大学课程（整合副本，18 个页面 + 自己的 assets）
│  ├─ index.html             课程首页与完整目录
│  ├─ chapter-01..13.html    13 章正文
│  ├─ appendix-a..d.html     4 份附录
│  └─ assets/                style.css（样式令牌）、lesson.js（交互）、README 说明
├─ assets/
│  ├─ annotate.js            批注层脚本（全站共用一份）
│  └─ annotate.css           批注层样式（用 var(--x, 兜底值) 适配不同配色）
└─ src/image/                图片资源
```

## 批注功能（全站可用）

每一页顶部栏都有「**✍ 批注**」按钮，三种批注形态：

1. **选中文字** → 弹出工具条：黄/绿/粉高亮、✍ 写批注、☑ 待办、❝ 引用；
2. **鼠标移到区块**（表格 / 代码卡片 / 步骤块 / 作业…）→ 点右上角「**＋ 便签**」写整块意见；
3. **小节/课时级**：抽屉底部「＋ 本节待办」，把当前小节加入待办清单。

数据保存在浏览器本机（`localStorage`，键 `uxa_annotations_v1`），支持：

- 抽屉三个页签：本页 / 待办（跨页汇总、可勾完成）/ 导出；
- **导出**：复制为 Markdown、下载全站或本页 JSON、下载 Markdown 文件；
- **导入**：合并模式（同 id 覆盖），用于换电脑或把批注交给别人。

### 维护须知（重要）

- 课时页是"外壳 + 脚本渲染"：`<body>` 里只有 `#app`，正文由内联脚本注入；
  并且**同一个 HTML 文件里用 hash 切换多节课**（如 `lesson-p1.html#p1-02`）。
  因此批注按「**文件名 + `::` + 当前标题**」分桶，并用 MutationObserver 在整块重渲染后
  自动贴回当前课的批注——改动课时页的渲染逻辑时请留意这一点。
- 批注层的两个文件在 `assets/`，与 `uni-appx/` 里的大学课程**共用同一份**
  （`uni-appx/` 的页面用 `../assets/annotate.*` 引用）。
  独立的 `uni-appx-site/` 目录里另有一份同样的拷贝，**改批注功能时两处需同步**。
- 回归测试：`node _tools/check-annotate.js`（在 Node 的 DOM 树桩里跑锚点、刷新复原、
  切课时换桶、Markdown 导出）。
- 链接完整性：`node _tools/check-site-links.js --site=kids-coding-site`。

## 自检工具（仓库根目录 `_tools/`）

```powershell
node _tools/check-site-links.js --site=kids-coding-site          # 本目录所有页面内引用是否存在
node _tools/check-site-links.js --site=kids-coding-site/uni-appx # 大学课程副本的引用完整性
$env:UXA_SITE='kids-coding-site/uni-appx'; node _tools/check-site-links.js   # 大学课程的章节结构校验
node _tools/check-html.js kids-coding-site/index.html            # 标签/脚本/引用/转义
node _tools/check-css.js  kids-coding-site/index.html            # 花括号配平、var() 是否有定义
node _tools/check-annotate.js                                    # 批注层回归测试
```

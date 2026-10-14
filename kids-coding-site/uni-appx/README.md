# uni-app x 大学课堂 · 站点说明（整合副本）

> **这一份是 `kids-coding-site/` 里的整合副本**，通过 `kids-coding-site/index.html` 的
> 「大学进阶 · uni-app x」入口进入。它与独立的 `uni-appx-site/` 内容一致，区别只有一处：
> **批注层共用上级目录的那一份** —— `../assets/annotate.js` 与 `../assets/annotate.css`
> （与 kids 的 8 个课时页共用，全站只维护一份批注代码）。
>
> 本目录内的 `assets/style.css`、`assets/lesson.js` 仍是本副本自己的，可独立改动。
> 校验命令：`node _tools/check-site-links.js --site=kids-coding-site/uni-appx`（通用链接完整性）
> 或 `$env:UXA_SITE='kids-coding-site/uni-appx'; node _tools/check-site-links.js`（完整章节结构校验）。

面向大学生（已具备 H5 / CSS3 / JavaScript 基础）的 uni-app x 学习站点。
纯静态页面，无构建步骤：双击 `index.html` 即可浏览，也可放到任意静态服务器。

## 文件结构

```
kids-coding-site/uni-appx/          ← 本副本（同一份内容也存在于独立的 uni-appx-site/）
├─ index.html              课程首页 + 完整目录（4 模块 13 章 + 4 个附录）
├─ chapter-01.html         第 1 章《走进 uni-app x》                ✅ 已完成
├─ chapter-02.html         第 2 章《布局与基础组件》                 ✅ 已完成
├─ chapter-03.html         第 3 章《样式进阶：ucss 与主题》          ✅ 已完成
├─ chapter-04.html         第 4 章《响应式数据与模板语法》            ✅ 已完成
├─ chapter-05.html         第 5 章《事件与表单交互》                 ✅ 已完成
├─ chapter-06.html         第 6 章《组件化开发与组件通信》            ✅ 已完成
├─ chapter-07.html         第 7 章《页面路由与生命周期》              ✅ 已完成
├─ chapter-08.html         第 8 章《网络请求与数据展示》              ✅ 已完成
├─ chapter-09.html         第 9 章《本地存储与全局状态管理》          ✅ 已完成
├─ chapter-10.html         第 10 章《设备能力与 UTS 插件入门》        ✅ 已完成
├─ chapter-11.html         第 11 章《项目①：校园课程表 App》          ✅ 已完成
├─ chapter-12.html         第 12 章《项目②：校园二手交易 App》        ✅ 已完成
├─ chapter-13.html         第 13 章《打包与多端发布》                  ✅ 已完成（结课章）
├─ appendix-a.html         附录 A《Web → uni-app x 速查表》          ✅ 已完成
├─ appendix-b.html         附录 B《编译错误与真机问题排错手册》       ✅ 已完成
├─ appendix-c.html         附录 C《模式选型指南》                    ✅ 已完成
├─ appendix-d.html         附录 D《课程设计选题库与评分标准》         ✅ 已完成
├─ README.md               本文件（维护说明与约定）
└─ assets/
   ├─ style.css            全站共享样式（设计令牌与组件类，改一处全站生效）
   ├─ lesson.js            全站共享交互（代码高亮、演练区、测验、任务清单、目录抽屉）
   ├─ style.css 的用法不变；批注层的两个文件在上级目录：
   │   ../assets/annotate.js   批注层脚本（与 kids 课时页共用）
   └─   ../assets/annotate.css  批注层样式（用 var(--x, 兜底值) 适配两站配色）
```

> **本副本引用的是上级共享的批注层**：`../assets/annotate.{js,css}`。
> 独立的 `uni-appx-site/assets/annotate.{js,css}` 是另一份同样的拷贝——修改批注功能时两处需要同步，
> `_tools/check-annotate.js` 可对任意一份做回归测试。

**站点状态：全部完成**（13 章 + 4 附录 + 首页），目录中不再有"制作中"项，
全站 18 个页面的"上一章/下一章"与"上一篇/下一篇"已构成完整单链。

新增章节时，把 `index.html` 的对应卡片从 `chapter-card locked` 改成 `<a class="chapter-card ready" href="...">`，
并在所有页面的 `SITE_OUTLINE` 里把该项的 `href` 从 `'#'` 改成真实文件名（原本 `'#'` 的项点击会提示"制作中"）。
每章的"上一章/下一章"导航在页面底部的 `.lesson-nav` 里手工维护——
**这些手工维护的链接最容易出错，所以专门有 `_tools/check-site-links.js` 兜底。**

## 每章页面的固定结构

1. `.read-progress` 阅读进度条 → `.topbar` 顶部栏（含"课程目录"抽屉按钮）
2. `.chapter-hero` 章头（模块/章号/难度/前置 + 学时、节数、题量、作业数）
3. `.goals-card` 学习目标卡（4 条）
4. `#tocStrip` 章内锚点导航（由脚本按 `.lesson-section` 自动生成）
5. `.section-wrap` 双栏：左正文 + 右 `#sideToc` 侧边目录（脚本自动生成、滚动高亮）
6. `#sec-quiz` 随堂测验区（`#quizMount` + `#quizScore`）
7. 小结 → 任务清单（`data-task-id`）→ 星级作业 → `.lesson-nav` 上下章导航
8. `.drawer` 目录抽屉 + 页脚

正文里每个小节写成：

```html
<section class="lesson-section" id="sec-2-1" data-nav="2.1 小节名">
  <div class="sec-head">
    <span class="sec-no">2.1</span>
    <h2>小节标题</h2>
    <span class="sec-time">20 分钟 · 讲练结合</span>
  </div>
  <div class="sec-body"> …正文、代码卡片、演练区、任务、提示框… </div>
</section>
```

常用样式类：`.callout.tip/.info/.warn/.danger/.ok`、`.code-card`（配 `.code-tabs`/`.code-pane`）、
`.table-wrap > table.cmp`、`.playground`（代码↔手机联动）、`.task-list`、`.quiz`、`.summary-card`、`.kp-chips`。

## 页面脚本要定义的三份数据

```js
window.SITE_OUTLINE = [ { group: '模块一 · 起步', items: [ { no:'01', title:'…', href:'chapter-01.html', current:true } ] } ];
window.QUIZ_DATA    = [ { q:'题干', opts:['A','B'], answer:1, explain:'解析' } ];   // answer 为数组即多选
window.PG_DEMOS     = { 演练区名: { examples: [ { name, file, navbar, hint, state, code:{template,script,style}, render(state), actions:{…} } ] } };
```

页面里的演练区容器写成 `<div class="playground" data-playground="演练区名"></div>`，
`data-bind="动作名"` 的节点会被绑定到同示例的 `actions.动作名`。

## 批注系统（../assets/annotate.js + annotate.css）

教师备课与学生笔记共用的一套轻量批注层，**不改动任何课程内容文件**，也不依赖本站特有类名（可移植）：

| 形态 | 操作方式 | 数据要点 |
|---|---|---|
| `highlight` | 选中文字 → 浮动工具条（黄/绿/粉高亮、✍写批注、☑待办、❝引用） | 锚点 = 容器元素路径 + 容器内字符偏移 + 容器文字签名 |
| `note` | 鼠标移到区块（表格 / 代码卡片 / 提示框 / 测验 / 作业 / 任务清单 / 步骤块 …）→ 点「＋ 便签」 | 锚点 = 元素路径 + 文字签名；标记渲染在 fixed 覆盖层，**不插进正文** |
| `bookmark` | 抽屉里「＋ 本节待办」，或把已有高亮标为待办 | 锚点 = 小节元素路径 |

- 存储：`localStorage` 单键 `uxa_annotations_v1`；
  **桶键 = 文件名 + `'::' + document.title`**（见下"动态作用域"）。浏览器禁用本地存储时会提示导出备份。
- 导出：复制为 Markdown / 下载全站或本页 JSON / 下载 Markdown；导入为**合并**模式（同 id 覆盖）。
- **锚点容错**：重新加载时核对容器文字签名，不一致就把该条标记为"定位失败"（列表可见），绝不乱贴。
- **动态作用域**：kids-coding-site 的课时页在同一个 HTML 里用 hash 切换多节课并整块重渲染 `#app`。
  这类页面必须按"课"分桶，否则两节课的批注会互相串——所以桶键带上 `document.title`，
  并用 `MutationObserver` 在重渲染后自动贴回当前课的批注。页面也可用 `window.UXA_SCOPE` 显式指定。
- 跨页"定位"用 `?uxa=<批注id>`（不用 hash，因为 kids 站点用 hash 切课时）。
- 保留的测试钩子：`window.UniXAnnotate._test`（`pathOf` / `offsetIn` / `wrapRange` / `applyAll` /
  `pageKey` / `onDomMaybeChanged` / `toMarkdown` …），只给 `_tools/check-annotate.js` 用，页面逻辑不依赖。

## 三条硬约定（踩过坑）

1. **内联脚本里不能出现字面量 `</script>` 或 `<!--`**：示例代码字符串必须写成 `<\/script>` 与 `<\!--`，
   否则浏览器会把脚本块提前截断，整页白屏。
   反过来，**静态 `<pre>` 代码卡片里要直接写 `&lt;/script&gt;`**，不要带反斜杠——反斜杠会被原样显示出来。
   （两处都写错很难靠肉眼发现，所以交给 `_tools/check-html.js` 自动检查。）
2. **App 端 uvue 只支持官方清单内的 CSS**：不要用 `gap` / `row-gap`（用 `margin`）、`float`、`grid`、
   伪元素 `::before`、伪类 `:hover/:active`、标签与 id 选择器、`window` / `document`。
3. **示例代码必须与"官方口径"一致**：尺寸单位优先 `px`（`rpx` 仅用于按 750px 设计稿等比缩放），
   `flex-direction` 默认 `column`，样式不继承、文字必须放 `text`，只用单一 class 选择器。

## 自检工具

```powershell
node _tools/check-site-links.js                                                       # 全站目录/导航/卡片/资源一致性（推荐先跑这个）
node _tools/check-annotate.js                                                         # 批注系统的锚点与导出（DOM 树桩实测）
node _tools/check-html.js    uni-appx-site/index.html uni-appx-site/chapter-01.html   # 标签/脚本/资源引用/转义
node _tools/check-chapter.js uni-appx-site/chapter-01.html                            # 数据、渲染与交互构建
node _tools/check-css.js     uni-appx-site/chapter-03.html                            # 花括号配平、var() 是否有定义
node _tools/fix-script-escapes.js uni-appx-site/chapter-03.html                       # 修复脚本区的二次转义
node _tools/fix-demo-escapes.js   uni-appx-site/chapter-04.html                       # 修复演练区代码里的二次转义
```

`check-site-links.js` 检查五件事：① `SITE_OUTLINE` 里非 `'#'` 的 href 目标都存在；
② 章节 01→13、附录 A→D 各自构成完整单链（上一篇/下一篇不能跳号）；
③ 目标已存在的相邻页不允许再挂 `data-soon` 占位提示；④ 首页 `ready` 卡片指向真实文件、`locked` 卡片不指向真实文件；
⑤ `assets/` 静态资源引用都存在（扫描时会剥掉 `<pre>` / `<code>` / 脚本正文，避免示例代码造成假报错）。

**两个"转义"不要搞混（都靠上面的工具兜底）**

| 位置 | 注释与标签应该怎么写 | 说明 |
|---|---|---|
| 静态 `<pre>` 代码卡片 | `&lt;!--` / `&lt;/script&gt;`（HTML 实体，不能带反斜杠） | 直接写 `<` 会被当成真标签；带反斜杠会多显示一个 `\` |
| 演练区（PG_DEMOS）代码字符串 | `<\!--` / `<\/script>`（带反斜杠），标签直接写 `<view>` | 纯文本场景；写实体学生就会看到 `&lt;view&gt;` |
| 测验（QUIZ_DATA）文案 | `&lt;view&gt;`（实体） | 它是按 HTML 插入渲染的 |

`check-chapter.js` 会在 Node 里用 DOM 桩真实执行页面脚本与 `lesson.js`，校验：
测验数据与渲染数量一致、每个演练示例都能渲染、`data-bind` 都有对应 `actions`、
高亮函数可用、任务 ID 唯一、锚点数量匹配，并用"uvue 语法守卫"扫描示例代码里的违规写法
（`gap` / `float` / `grid` / 伪元素 / 伪类 / 标签与 id 选择器 / `window` / `document`），
同时拦截"代码字符串里二次转义 HTML 实体"这类显示缺陷。新章节写完先跑这三个脚本，再提交。

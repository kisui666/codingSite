/* ============================================================
   汽水老师 · 编程课堂  批注系统（annotate.js） v2
   —— 可移植的独立模块：不依赖任何站点特定的 CSS 类或变量
      （界面样式在配套的 annotate.css 里，用 var(--x, 兜底值) 读取站点令牌）

   三种批注形态：
     ① highlight  选中文字 → 高亮 + 写批注
     ② note       区块（表格 / 代码卡片 / 提示框 / 步骤块 …）→ 便签
     ③ bookmark   小节 / 课时级 → 书签与待办

   数据存 localStorage（键 uxa_annotations_v1），支持导出/导入 JSON 与复制为 Markdown。

   ★ 动态作用域（重要）
     有些站点（如 kids-coding-site 的课时页）在同一个 HTML 文件里用 hash 切换多节课，
     并通过 innerHTML 整块重渲染 #app。这类页面的批注必须按"课"分桶，否则两节课的批注会互相串。
     因此桶键 = 文件名 + '::' + 当前 document.title（动态页的标题会随课时变化，静态页则恒定）。
     页面需要显式指定时，设置 window.UXA_SCOPE = '作用域名' 即可。
     同时用 MutationObserver 监测整块重渲染，自动重新贴回当前课的批注。
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'uxa_annotations_v1';
  var SCHEMA = 1;

  var FILE = (function () {
    var p = location.pathname.split('/');
    return p[p.length - 1] || 'index.html';
  })();

  /* ---------------- 基础工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function norm(s) { return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function stamp(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function dayStamp(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function toast(msg) {
    if (window.UniX && window.UniX.toast) { window.UniX.toast(msg); return; }
    var el = $('#uxaToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'uxaToast';
      el.className = 'uxa-toast';
      el.setAttribute('data-uxa-ui', '1');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------------- 作用域（桶键） ---------------- */
  // PAGE 是当前批注桶；静态页 = 文件名，动态多课时页 = 文件名::标题
  var PAGE = FILE;

  function scopeKey() {
    if (typeof window.UXA_SCOPE === 'string' && window.UXA_SCOPE.length > 0) {
      return FILE + '::' + norm(window.UXA_SCOPE);
    }
    var t = norm(document.title);
    return t.length > 0 ? FILE + '::' + t : FILE;
  }

  function pageTitle(bucket) {
    if (bucket === PAGE) return norm(document.title) || FILE;
    var i = bucket.indexOf('::');
    return i > 0 ? bucket.slice(i + 2) : bucket.replace(/\.html$/, '');
  }

  // 桶键 → 文件名（跨页跳转只认文件名；kids 站点的 hash 用来切课时，不能被占用）
  function fileOf(bucket) {
    var i = bucket.indexOf('::');
    return i > 0 ? bucket.slice(0, i) : bucket;
  }

  /* ---------------- 存储层 ---------------- */
  var storageOK = true;
  var store = { v: SCHEMA, pages: {} };

  function readStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { v: SCHEMA, pages: {} };
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return { v: SCHEMA, pages: {} };
      if (!obj.pages) obj.pages = {};
      return obj;
    } catch (e) {
      return { v: SCHEMA, pages: {} };
    }
  }

  function writeStore(s) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      storageOK = true;
      return true;
    } catch (e) {
      storageOK = false;
      return false;
    }
  }

  store = readStore();

  function listPage(bucket) {
    var arr = store.pages[bucket];
    return Array.isArray(arr) ? arr : [];
  }

  function allItems() {
    var out = [];
    Object.keys(store.pages).forEach(function (b) {
      listPage(b).forEach(function (it) { out.push({ page: b, item: it }); });
    });
    out.sort(function (a, b) { return (b.item.created || 0) - (a.item.created || 0); });
    return out;
  }

  function findItem(id) {
    var keys = Object.keys(store.pages);
    for (var i = 0; i < keys.length; i++) {
      var arr = store.pages[keys[i]];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j].id === id) return { page: keys[i], item: arr[j] };
      }
    }
    return null;
  }

  function addItem(bucket, item) {
    if (!store.pages[bucket]) store.pages[bucket] = [];
    store.pages[bucket].push(item);
    save();
    return item;
  }

  function removeItem(id) {
    Object.keys(store.pages).forEach(function (b) {
      store.pages[b] = listPage(b).filter(function (it) { return it.id !== id; });
      if (store.pages[b].length === 0) delete store.pages[b];
    });
    save();
  }

  function save() {
    if (!writeStore(store)) toast('批注无法保存到本地（浏览器限制），请用"导出 JSON"备份');
    refreshCounters();
  }

  function todoCount() {
    var n = 0;
    allItems().forEach(function (e) { if (e.item.todo && !e.item.done) n++; });
    return n;
  }

  // 兼容旧版本：以前把批注存在"纯文件名"桶里，首次加载时迁移到作用域桶
  function migrateLegacyBucket() {
    if (PAGE === FILE) return;
    if (listPage(PAGE).length > 0) return;
    var legacy = listPage(FILE);
    if (legacy.length === 0) return;
    store.pages[PAGE] = legacy.slice();
    delete store.pages[FILE];
    writeStore(store);
  }

  /* ---------------- 锚点：元素路径 ---------------- */
  // 计算路径时跳过本脚本注入的界面节点（data-uxa-ui），保证刷新后稳定
  function pathOf(el) {
    var path = [];
    var cur = el;
    while (cur && cur !== document.body) {
      var parent = cur.parentNode;
      if (!parent) return null;
      var idx = -1, n = 0;
      for (var i = 0; i < parent.children.length; i++) {
        var ch = parent.children[i];
        if (ch.hasAttribute && ch.hasAttribute('data-uxa-ui')) continue;
        if (ch === cur) { idx = n; break; }
        n++;
      }
      if (idx < 0) return null;
      path.unshift(idx);
      cur = parent;
    }
    return cur === document.body ? path : null;
  }

  function elByPath(path) {
    if (!path || !path.length) return null;
    var cur = document.body;
    for (var i = 0; i < path.length; i++) {
      var want = path[i], n = 0, found = null;
      for (var j = 0; j < cur.children.length; j++) {
        var ch = cur.children[j];
        if (ch.hasAttribute && ch.hasAttribute('data-uxa-ui')) continue;
        if (n === want) { found = ch; break; }
        n++;
      }
      if (!found) return null;
      cur = found;
    }
    return cur;
  }

  // 文字签名：判断页面结构是否变了；变了就诚实标记"定位失败"，绝不乱贴
  function sigOf(el) { return norm(el.textContent).slice(0, 60); }

  /* ---------------- 锚点：文字区间 ---------------- */
  var ANCHOR_BLOCK_SEL = 'table.cmp, .code-card, .callout, .goals-card, .summary-card, .quiz, .homework, ' +
    '.task-list, .chapter-hero, .ax-hero, .sec-body, .step-content, .step-block, .demo-box, ' +
    '.knowledge-points, .hw-item, .container, section.section';

  var NOTE_BLOCK_SEL = 'table.cmp, .code-card, .callout, .goals-card, .summary-card, .quiz, .homework, ' +
    '.task-list, .sec-body, .step-block, .step-content, .demo-box, .knowledge-points, .hw-item, ' +
    '.container, section.section';

  // 选区锚点容器：优先最小的稳定区块（无关文字变化不会让偏移错位）
  function containerOf(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !el.closest) return $('main') || document.body;
    var block = el.closest(ANCHOR_BLOCK_SEL);
    if (block) return block;
    var sec = el.closest('section.lesson-section') || el.closest('section.section');
    if (sec) return sec;
    return $('main') || document.body;
  }

  // 节点位置 → 相对容器的字符偏移
  function offsetIn(container, node, offset) {
    var total = 0, result = -1, done = false;
    (function walk(n) {
      if (done) return;
      if (n === node) {
        if (n.nodeType === 3) { result = total + offset; done = true; return; }
        var count = 0;
        for (var i = 0; i < n.childNodes.length; i++) {
          if (i === offset) { result = total + count; done = true; return; }
          count += (n.childNodes[i].textContent || '').length;
        }
        result = total + count; done = true; return;
      }
      if (n.nodeType === 3) { total += (n.textContent || '').length; return; }
      if (n.hasAttribute && n.hasAttribute('data-uxa-ui')) return;
      for (var k = 0; k < n.childNodes.length; k++) {
        walk(n.childNodes[k]);
        if (done) return;
      }
    })(container);
    return result;
  }

  function textNodesOf(container) {
    var out = [];
    (function walk(n) {
      if (n.nodeType === 3) { out.push(n); return; }
      if (n.hasAttribute && n.hasAttribute('data-uxa-ui')) return;
      for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
    })(container);
    return out;
  }

  // 把容器内 [s,e) 的文字包进 span（支持跨多个文字节点）
  function wrapRange(container, s, e, id, color) {
    var nodes = textNodesOf(container);
    var pos = 0, made = 0;
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i], len = (t.textContent || '').length;
      var a = pos, b = pos + len;
      pos = b;
      if (b <= s || a >= e) continue;
      var from = Math.max(0, s - a), to = Math.min(len, e - a);
      if (to <= from) continue;
      var target = t;
      try {
        if (from > 0) target = target.splitText(from);
        if (to - from < (target.textContent || '').length) target.splitText(to - from);
      } catch (err) { continue; }
      var span = document.createElement('span');
      span.className = 'uxa-hl uxa-hl-' + (color || 'yellow');
      span.setAttribute('data-uxa-id', id);
      target.parentNode.insertBefore(span, target);
      span.appendChild(target);
      made++;
    }
    return made;
  }

  function unwrap(id) {
    $$('[data-uxa-id="' + id + '"]').forEach(function (sp) {
      var p = sp.parentNode;
      if (!p) return;
      while (sp.firstChild) p.insertBefore(sp.firstChild, sp);
      p.removeChild(sp);
      if (p.normalize) p.normalize();
    });
  }

  // 重叠判定：优先用 Range.intersectsNode（真实 DOM 层最准）；不支持时退回同容器偏移比较
  function overlaps(container, s, e, range, containerPath) {
    if (range && range.intersectsNode) {
      var spans = $$('[data-uxa-id]');
      for (var i = 0; i < spans.length; i++) {
        try {
          if (range.intersectsNode(spans[i])) return findItem(spans[i].getAttribute('data-uxa-id'));
        } catch (err) { /* 个别浏览器可能抛错，忽略 */ }
      }
      return null;
    }
    var hit = null;
    var key = JSON.stringify(containerPath || []);
    listPage(PAGE).forEach(function (it) {
      if (hit || it.type !== 'highlight' || !it.h || it.broken) return;
      if (JSON.stringify(it.h.c) !== key) return;
      if (s < it.h.e && e > it.h.s) hit = it;
    });
    return hit;
  }

  /* ---------------- 便签覆盖层 ---------------- */
  // 便签标记统一放在 fixed 层：完全不改动正文 DOM，重渲染后重算位置
  var pinLayer = null;
  var pinTargets = {};

  function positionPins() {
    if (!pinLayer) return;
    var vh = window.innerHeight || 800;
    Object.keys(pinTargets).forEach(function (id) {
      var btn = pinLayer.querySelector('[data-uxa-pin="' + id + '"]');
      var el = pinTargets[id];
      if (!btn || !el) return;
      var r = el.getBoundingClientRect();
      if (r.bottom < 40 || r.top > vh - 20 || r.width < 60) { btn.style.display = 'none'; return; }
      btn.style.display = '';
      btn.style.top = Math.max(4, r.top + 6) + 'px';
      btn.style.left = Math.max(4, r.right - 34) + 'px';
    });
  }

  var pinRaf = 0;
  function schedulePinPosition() {
    if (pinRaf) return;
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    pinRaf = raf(function () { pinRaf = 0; positionPins(); });
  }

  function pinElement(it) {
    var el = elByPath(it.t.c);
    if (!el) { markBroken(it); return; }
    if (it.t.sig && sigOf(el) !== it.t.sig) { markBroken(it); return; }
    if (!pinLayer) return;
    var pin = document.createElement('button');
    pin.className = 'uxa-pin' + (it.todo && !it.done ? ' is-todo' : '');
    pin.setAttribute('data-uxa-ui', '1');
    pin.setAttribute('data-uxa-pin', it.id);
    pin.title = '查看批注：' + (it.note ? it.note.slice(0, 40) : (it.t && it.t.label) || '（无文字）');
    pin.textContent = it.todo ? '☑' : '📝';
    pin.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      openEditor(it, pin);
    });
    pinLayer.appendChild(pin);
    pinTargets[it.id] = el;
    positionPins();
  }

  function markBroken(it) {
    if (!it.broken) { it.broken = true; writeStore(store); }
  }

  /* ---------------- 应用已有批注 ---------------- */
  var applying = false;
  var lastApplyAt = 0;

  function applyAll() {
    applying = true;
    try {
      // 重渲染后旧引用失效：便签层整体重建
      if (pinLayer) $$('[data-uxa-pin]').forEach(function (p) { p.remove(); });
      pinTargets = {};

      // 高亮按起始偏移倒序应用，避免前面的包裹影响后面的偏移
      var hls = listPage(PAGE).filter(function (it) {
        return it.type === 'highlight' && it.h && !it.broken;
      });
      hls.sort(function (a, b) { return b.h.s - a.h.s; });
      hls.forEach(function (it) {
        var c = elByPath(it.h.c);
        if (!c) { markBroken(it); return; }
        if (it.h.sig && sigOf(c) !== it.h.sig) { markBroken(it); return; }
        unwrap(it.id);
        if (wrapRange(c, it.h.s, it.h.e, it.id, it.color) === 0) markBroken(it);
      });

      listPage(PAGE).forEach(function (it) {
        if (it.type === 'note' && it.t) pinElement(it);
      });

      positionPins();
      refreshCounters();
    } finally {
      applying = false;
      lastApplyAt = Date.now();
    }
  }

  function missingHighlights() {
    var list = listPage(PAGE).filter(function (it) {
      return it.type === 'highlight' && it.h && !it.broken;
    });
    for (var i = 0; i < list.length; i++) {
      if (!document.querySelector('[data-uxa-id="' + list[i].id + '"]')) return true;
    }
    return false;
  }

  /* ---------------- 重渲染监测（一文件多课时的站点必需） ---------------- */
  var mutTimer = 0;
  var observedRoot = null;

  function watchRoot() {
    var root = document.getElementById('app') || $('main') || document.body;
    if (!root || root === observedRoot) return;
    observedRoot = root;
    if (typeof MutationObserver !== 'function') return;
    var mo = new MutationObserver(function () {
      if (applying) return;
      if (Date.now() - lastApplyAt < 200) return;
      clearTimeout(mutTimer);
      mutTimer = setTimeout(onDomMaybeChanged, 320);
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  function onDomMaybeChanged() {
    if (applying) return;
    var key = scopeKey();
    if (key !== PAGE) {
      // 切到另一节课（或标题变了）：换桶并重新贴回
      PAGE = key;
      migrateLegacyBucket();
      applyAll();
      renderPanel();
      return;
    }
    if (missingHighlights()) applyAll();
  }

  /* ---------------- 界面注入 ---------------- */
  function injectUI() {
    // 顶部入口按钮：优先放进站点自己的工具栏，否则悬浮在右下角
    var host = $('.topbar-actions') || $('.topbar-inner') || $('.topbar');
    var btn = document.createElement('button');
    btn.className = 'uxa-btn uxa-btn-ghost uxa-btn-sm uxa-open';
    btn.setAttribute('data-uxa-ui', '1');
    btn.innerHTML = '✍ 批注 <span class="uxa-count" id="uxaCount"></span>';
    btn.addEventListener('click', function () { openDrawer(); });
    if (host) host.appendChild(btn);
    else {
      btn.classList.add('uxa-fab');
      document.body.appendChild(btn);
    }

    // 选区工具条
    var tb = document.createElement('div');
    tb.className = 'uxa-toolbar';
    tb.setAttribute('data-uxa-ui', '1');
    tb.innerHTML =
      '<button class="uxa-tb-btn" data-act="hl-yellow" title="黄色高亮"><span class="uxa-dot" style="background:#FFD84D"></span>高亮</button>' +
      '<button class="uxa-tb-btn" data-act="hl-green" title="绿色高亮"><span class="uxa-dot" style="background:#5ED6A0"></span></button>' +
      '<button class="uxa-tb-btn" data-act="hl-pink" title="粉色高亮"><span class="uxa-dot" style="background:#FF9BB3"></span></button>' +
      '<span class="uxa-tb-sep"></span>' +
      '<button class="uxa-tb-btn" data-act="note">✍ 写批注</button>' +
      '<button class="uxa-tb-btn" data-act="todo">☑ 待办</button>' +
      '<button class="uxa-tb-btn" data-act="quote">❝ 引用</button>' +
      '<span class="uxa-tb-sep"></span>' +
      '<button class="uxa-tb-btn uxa-tb-close" data-act="close">✕</button>';
    document.body.appendChild(tb);

    // 已有高亮的操作条
    var ht = document.createElement('div');
    ht.className = 'uxa-toolbar uxa-toolbar-hit';
    ht.setAttribute('data-uxa-ui', '1');
    ht.innerHTML =
      '<button class="uxa-tb-btn" data-act="edit">✎ 编辑批注</button>' +
      '<button class="uxa-tb-btn" data-act="todo-toggle">☑ 待办</button>' +
      '<button class="uxa-tb-btn" data-act="del">🗑 删除</button>' +
      '<button class="uxa-tb-btn uxa-tb-close" data-act="close">✕</button>';
    document.body.appendChild(ht);

    // 区块便签：悬停出现的 ＋ 按钮（fixed 定位，不改动布局）
    var noteAdd = document.createElement('button');
    noteAdd.className = 'uxa-note-add';
    noteAdd.setAttribute('data-uxa-ui', '1');
    noteAdd.textContent = '＋ 便签';
    noteAdd.title = '给这个区块加一条批注';
    document.body.appendChild(noteAdd);

    // 便签标记覆盖层
    pinLayer = document.createElement('div');
    pinLayer.className = 'uxa-pin-layer';
    pinLayer.setAttribute('data-uxa-ui', '1');
    document.body.appendChild(pinLayer);

    // 编辑器
    var ed = document.createElement('div');
    ed.className = 'uxa-editor';
    ed.setAttribute('data-uxa-ui', '1');
    ed.innerHTML =
      '<div class="uxa-ed-head"><span class="uxa-ed-title">批注</span>' +
      '<button class="uxa-ed-x" data-act="close">✕</button></div>' +
      '<blockquote class="uxa-ed-quote"></blockquote>' +
      '<textarea class="uxa-ed-text" rows="4" placeholder="写下你的批注…（Ctrl+Enter 保存）"></textarea>' +
      '<div class="uxa-ed-foot">' +
      '<label class="uxa-ed-todo"><input type="checkbox" class="uxa-ed-todobox" /> 加入待办</label>' +
      '<span class="uxa-ed-actions">' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm" data-act="del">删除</button>' +
      '<button class="uxa-btn uxa-btn-primary uxa-btn-sm" data-act="save">保存</button>' +
      '</span></div>';
    document.body.appendChild(ed);

    // 抽屉与遮罩
    var mask = document.createElement('div');
    mask.className = 'uxa-mask';
    mask.setAttribute('data-uxa-ui', '1');
    document.body.appendChild(mask);

    var dw = document.createElement('aside');
    dw.className = 'uxa-drawer';
    dw.setAttribute('data-uxa-ui', '1');
    dw.innerHTML =
      '<div class="uxa-dw-head"><h3>✍ 我的批注</h3>' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm" data-act="close">✕</button></div>' +
      '<div class="uxa-tabs">' +
      '<button class="uxa-tab active" data-tab="page">本页</button>' +
      '<button class="uxa-tab" data-tab="todo">待办 <span class="uxa-tab-n" id="uxaTodoN">0</span></button>' +
      '<button class="uxa-tab" data-tab="io">导出</button></div>' +
      '<div class="uxa-dw-body" id="uxaBody"></div>' +
      '<div class="uxa-dw-foot">' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm" data-act="add-section">＋ 本节待办</button>' +
      '<span class="uxa-foot-note">自动存在本机浏览器</span></div>';
    document.body.appendChild(dw);

    bindToolbars(tb, ht);
    bindNoteAdd(noteAdd);
    bindEditor(ed);
    bindDrawer(dw, mask);
  }

  /* ---------------- 选区 → 工具条 ---------------- */
  var lastSel = null;

  function currentSelection() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var text = norm(sel.toString());
    if (text.length < 2) return null;
    var range = sel.getRangeAt(0);
    var node = range.startContainer;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || (el.closest && el.closest('[data-uxa-ui]'))) return null;
    var container = containerOf(node);
    if (!container) return null;
    if (!container.contains(range.endContainer)) return null;
    var s = offsetIn(container, range.startContainer, range.startOffset);
    var e = offsetIn(container, range.endContainer, range.endOffset);
    if (s < 0 || e < 0 || e <= s) return null;
    var rect;
    try { rect = range.getBoundingClientRect(); } catch (err) { rect = { top: 120, left: 40, right: 340, bottom: 160, width: 300, height: 40 }; }
    if (!rect || (!rect.width && !rect.height)) rect = { top: 120, left: 40, right: 340, bottom: 160, width: 300, height: 40 };
    return {
      container: container, s: s, e: e, quote: text.slice(0, 300),
      rect: rect, sig: sigOf(container), range: range, cpath: pathOf(container)
    };
  }

  function onSelectEnd() {
    setTimeout(function () {
      var info = currentSelection();
      if (!info) { hideToolbar(); return; }
      var sel = window.getSelection && window.getSelection();
      var hitEl = null;
      if (sel && sel.anchorNode) {
        var n = sel.anchorNode;
        var el = n.nodeType === 1 ? n : n.parentElement;
        hitEl = el && el.closest ? el.closest('[data-uxa-id]') : null;
      }
      if (hitEl) {
        var found = findItem(hitEl.getAttribute('data-uxa-id'));
        if (found) { showHitToolbar(found.item, hitEl); return; }
      }
      if (overlaps(info.container, info.s, info.e, info.range, info.cpath)) {
        toast('这段文字已经有批注了，点它可以直接编辑');
        hideToolbar();
        return;
      }
      lastSel = info;
      showToolbar(info.rect);
    }, 10);
  }

  function placeAt(el, rect) {
    if (!el || !rect) return;
    var top = rect.top - el.offsetHeight - 8;
    if (top < 8) top = rect.bottom + 8;
    var left = rect.left + rect.width / 2 - el.offsetWidth / 2;
    var maxLeft = (window.innerWidth || 1200) - el.offsetWidth - 8;
    if (left < 8) left = 8;
    if (left > maxLeft) left = maxLeft;
    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.classList.add('show');
  }

  function showToolbar(rect) {
    var tb = $('.uxa-toolbar:not(.uxa-toolbar-hit)');
    if (tb) placeAt(tb, rect);
  }

  function showHitToolbar(item, el) {
    var ht = $('.uxa-toolbar-hit');
    if (!ht || !el) return;
    ht._itemId = item.id;
    placeAt(ht, el.getBoundingClientRect());
  }

  function hideToolbar() {
    $$('.uxa-toolbar').forEach(function (t) { t.classList.remove('show'); });
    lastSel = null;
  }

  /* ---------------- 创建 / 编辑 / 删除 ---------------- */
  function anchorMeta() {
    return { hash: location.hash || '', title: norm(document.title) };
  }

  function makeHighlight(color, withNote, asTodo) {
    if (!lastSel) return null;
    var it = {
      id: uid(), type: 'highlight', color: color || 'yellow',
      quote: lastSel.quote, note: '', todo: !!asTodo, done: false,
      created: Date.now(), updated: Date.now(), at: anchorMeta(),
      h: { c: pathOf(lastSel.container), s: lastSel.s, e: lastSel.e, sig: lastSel.sig }
    };
    if (wrapRange(lastSel.container, it.h.s, it.h.e, it.id, it.color) === 0) {
      toast('这段内容无法批注（可能已被其他批注包裹）');
      return null;
    }
    addItem(PAGE, it);
    hideToolbar();
    if (window.getSelection) window.getSelection().removeAllRanges();
    if (withNote) openEditor(it, null);
    else toast(asTodo ? '已加入待办' : '已高亮，点它可写批注');
    renderPanel();
    return it;
  }

  function labelOf(el, sec) {
    var secName = sec && sec.getAttribute ? (sec.getAttribute('data-nav') || '') : '';
    var kind = '区块';
    if (el.matches) {
      if (el.matches('table.cmp')) kind = '表格';
      else if (el.matches('.code-card')) kind = '代码卡片';
      else if (el.matches('.callout')) kind = '提示框';
      else if (el.matches('.quiz')) kind = '测验';
      else if (el.matches('.homework') || el.matches('.hw-item')) kind = '作业';
      else if (el.matches('.task-list')) kind = '任务清单';
      else if (el.matches('.goals-card')) kind = '学习目标';
      else if (el.matches('.summary-card')) kind = '小结卡片';
      else if (el.matches('.step-block')) kind = '步骤块';
      else if (el.matches('.step-content')) kind = '步骤内容';
      else if (el.matches('.demo-box')) kind = '演示区';
      else if (el.matches('.knowledge-points')) kind = '知识点';
      else if (el.matches('section.section') || el.matches('section.lesson-section')) kind = '整节';
      else if (el.matches('.chapter-hero')) kind = '章头';
    }
    return (secName ? secName + ' · ' : '') + kind;
  }

  function nearestSection(el) {
    return (el.closest && (el.closest('section.lesson-section') || el.closest('section.section') || el.closest('.step-block'))) || null;
  }

  function makeBlockNote(el) {
    var sec = nearestSection(el);
    var label = labelOf(el, sec);
    var it = {
      id: uid(), type: 'note', color: 'green',
      quote: label, note: '', todo: false, done: false,
      created: Date.now(), updated: Date.now(), at: anchorMeta(),
      t: { c: pathOf(el), sig: sigOf(el), label: label }
    };
    addItem(PAGE, it);
    pinElement(it);
    renderPanel();
    openEditor(it, $('[data-uxa-pin="' + it.id + '"]'));
    return it;
  }

  function makeBookmark(section, asTodo) {
    if (!section) { toast('没有找到当前小节'); return null; }
    var label = labelOf(section, section);
    var dup = listPage(PAGE).filter(function (x) {
      return x.type === 'bookmark' && x.t && x.t.label === label;
    })[0];
    if (dup) { openEditor(dup, $('[data-uxa-pin="' + dup.id + '"]')); return dup; }
    var it = {
      id: uid(), type: 'bookmark', color: 'pink',
      quote: label, note: '', todo: asTodo !== false, done: false,
      created: Date.now(), updated: Date.now(), at: anchorMeta(),
      t: { c: pathOf(section), sig: sigOf(section), label: label }
    };
    addItem(PAGE, it);
    pinElement(it);
    renderPanel();
    openEditor(it, $('[data-uxa-pin="' + it.id + '"]'));
    return it;
  }

  // 当前视口顶部附近的小节（"本节待办"用）
  function currentSection() {
    var secs = $$('section.lesson-section, section.section, .step-block');
    if (!secs.length) return $('.chapter-hero') || $('main');
    var best = secs[0], bestD = Infinity;
    secs.forEach(function (s) {
      var d = Math.abs(s.getBoundingClientRect().top - 100);
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }

  var editorState = null;

  function openEditor(item, anchorEl) {
    var ed = $('.uxa-editor');
    if (!ed) return;
    editorState = { id: item.id };
    var q = $('.uxa-ed-quote', ed);
    var body = item.quote || (item.t && item.t.label) || '';
    if (q) { q.textContent = body; q.style.display = body ? '' : 'none'; }
    var ta = $('.uxa-ed-text', ed);
    if (ta) ta.value = item.note || '';
    var box = $('.uxa-ed-todobox', ed);
    if (box) box.checked = !!item.todo;
    ed.classList.add('show');
    var rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
    var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
    if (rect && rect.width) {
      var top = rect.bottom + 8;
      if (top + 260 > vh) top = Math.max(8, rect.top - 268);
      ed.style.top = top + 'px';
      ed.style.left = Math.min(Math.max(8, rect.left - 140), vw - 348) + 'px';
    } else {
      ed.style.top = Math.max(80, vh / 2 - 140) + 'px';
      ed.style.left = Math.max(8, vw / 2 - 170) + 'px';
    }
    hideToolbar();
    setTimeout(function () { if (ta) ta.focus(); }, 30);
  }

  function closeEditor() {
    var ed = $('.uxa-editor');
    if (ed) ed.classList.remove('show');
    editorState = null;
  }

  function saveEditor() {
    if (!editorState) return;
    var found = findItem(editorState.id);
    if (!found) { closeEditor(); return; }
    var ed = $('.uxa-editor');
    var ta = $('.uxa-ed-text', ed);
    var box = $('.uxa-ed-todobox', ed);
    found.item.note = ta ? ta.value : '';
    found.item.todo = box ? box.checked : false;
    // 空便签没有意义，直接移除
    if (!found.item.note && !found.item.todo && found.item.type === 'note') {
      deleteItem(found.item.id, true);
      toast('空便签已移除');
      return;
    }
    found.item.updated = Date.now();
    save();
    if (found.item.type === 'note' || found.item.type === 'bookmark') pinElement(found.item);
    closeEditor();
    renderPanel();
    toast('已保存');
  }

  function deleteItem(id, silent) {
    unwrap(id);
    var pin = $('[data-uxa-pin="' + id + '"]');
    if (pin) pin.remove();
    delete pinTargets[id];
    removeItem(id);
    closeEditor();
    renderPanel();
    if (!silent) toast('已删除');
  }

  /* ---------------- 抽屉与面板 ---------------- */
  function openDrawer() {
    var dw = $('.uxa-drawer'), mask = $('.uxa-mask');
    if (dw) dw.classList.add('open');
    if (mask) mask.classList.add('open');
    renderPanel();
  }

  function closeDrawer() {
    var dw = $('.uxa-drawer'), mask = $('.uxa-mask');
    if (dw) dw.classList.remove('open');
    if (mask) mask.classList.remove('open');
  }

  var panelTab = 'page';

  function renderPanel() {
    var body = $('#uxaBody');
    if (!body) return;
    if (panelTab === 'io') { renderIO(body); return; }
    if (panelTab === 'todo') { renderTodo(body); return; }
    var items = listPage(PAGE).slice().sort(function (a, b) { return (a.created || 0) - (b.created || 0); });
    if (!items.length) {
      body.innerHTML = '<div class="uxa-empty">本页还没有批注。<br /><br />' +
        '· 选中任意文字 → 高亮 / 写批注 / 标待办<br />' +
        '· 鼠标移到某个区块 → 点右上角「＋ 便签」<br />' +
        '· 点已有的高亮可以直接编辑<br />' +
        '· 点下方「＋ 本节待办」把当前小节加进待办</div>';
      return;
    }
    body.innerHTML = items.map(itemHtml).join('');
    bindPanelItems(body);
  }

  function renderTodo(body) {
    var groups = {};
    allItems().forEach(function (e) {
      if (!e.item.todo) return;
      if (!groups[e.page]) groups[e.page] = [];
      groups[e.page].push(e.item);
    });
    var keys = Object.keys(groups);
    if (!keys.length) {
      body.innerHTML = '<div class="uxa-empty">还没有待办。<br /><br />选中文字后点工具条上的「☑ 待办」，' +
        '或点下方「＋ 本节待办」。</div>';
      return;
    }
    var html = '';
    keys.forEach(function (b) {
      var list = groups[b];
      var open = list.filter(function (x) { return !x.done; }).length;
      html += '<div class="uxa-grp"><div class="uxa-grp-head">' +
        (b === PAGE ? '本页' : '<a href="' + esc(fileOf(b)) + '">' + esc(pageTitle(b)) + '</a>') +
        ' <span class="uxa-grp-n">' + open + ' / ' + list.length + ' 未完成</span></div>';
      html += list.map(itemHtml).join('');
      html += '</div>';
    });
    body.innerHTML = html;
    bindPanelItems(body);
  }

  function itemHtml(it) {
    var kind = it.type === 'highlight' ? '高亮' : (it.type === 'note' ? '便签' : '书签');
    var quote = it.quote || (it.t && it.t.label) || '';
    return '<div class="uxa-item' + (it.done ? ' is-done' : '') + (it.broken ? ' is-broken' : '') + '" data-id="' + it.id + '">' +
      '<div class="uxa-item-head">' +
      '<span class="uxa-kind uxa-kind-' + it.type + '">' + kind + '</span>' +
      (it.todo ? '<span class="uxa-kind uxa-kind-todo">待办</span>' : '') +
      (it.broken ? '<span class="uxa-kind uxa-kind-broken" title="页面结构已变化，可能无法定位">定位失败</span>' : '') +
      '<span class="uxa-time">' + stamp(it.created) + '</span>' +
      '</div>' +
      (quote ? '<div class="uxa-quote">' + esc(quote) + '</div>' : '') +
      (it.note ? '<div class="uxa-note">' + esc(it.note).replace(/\n/g, '<br />') + '</div>'
        : '<div class="uxa-note uxa-note-empty">（没有文字批注）</div>') +
      '<div class="uxa-item-acts">' +
      (it.todo ? '<button class="uxa-mini" data-act="toggle-done">' + (it.done ? '↺ 恢复' : '✓ 完成') + '</button>' : '') +
      '<button class="uxa-mini" data-act="jump">定位</button>' +
      '<button class="uxa-mini" data-act="edit">编辑</button>' +
      '<button class="uxa-mini uxa-mini-danger" data-act="del">删除</button>' +
      '</div></div>';
  }

  function bindPanelItems(root) {
    $$('.uxa-item', root).forEach(function (box) {
      var id = box.getAttribute('data-id');
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
        if (!b) return;
        ev.preventDefault();
        var act = b.getAttribute('data-act');
        var found = findItem(id);
        if (!found) return;
        if (act === 'del') { deleteItem(id); return; }
        if (act === 'edit') { openEditor(found.item, b); return; }
        if (act === 'toggle-done') {
          found.item.done = !found.item.done;
          found.item.updated = Date.now();
          save();
          renderPanel();
          toast(found.item.done ? '已完成' : '已恢复');
          return;
        }
        if (act === 'jump') jumpTo(found);
      });
    });
  }

  function jumpTo(found) {
    var it = found.item;
    if (found.page !== PAGE) {
      // 跨页：用 ?uxa= 传批注 id；同时带上创建时所在的 hash（kids 站点靠 hash 定位课时）
      var hash = (it.at && it.at.hash) || '';
      location.href = fileOf(found.page) + '?uxa=' + encodeURIComponent(it.id) + hash;
      return;
    }
    var el = it.type === 'highlight' ? $('[data-uxa-id="' + it.id + '"]') : $('[data-uxa-pin="' + it.id + '"]');
    closeDrawer();
    if (el) {
      var y = el.getBoundingClientRect().top + (window.pageYOffset || 0) - 90;
      try { window.scrollTo({ top: y, behavior: 'smooth' }); } catch (err) { window.scrollTo(0, y); }
      el.classList.add('uxa-flash');
      setTimeout(function () { el.classList.remove('uxa-flash'); }, 1400);
    } else {
      toast('这一条已无法在当前页面定位（页面结构可能变了）');
    }
  }

  /* ---------------- 导出 / 导入 ---------------- */
  function renderIO(body) {
    var mine = listPage(PAGE).length;
    var all = allItems().length;
    body.innerHTML =
      '<div class="uxa-io">' +
      '<p class="uxa-io-p">本页 <b>' + mine + '</b> 条，全站 <b>' + all + '</b> 条。' +
      '批注保存在这台电脑的浏览器里（换设备请导出文件）。</p>' +
      '<div class="uxa-io-row">' +
      '<button class="uxa-btn uxa-btn-primary uxa-btn-sm" data-io="md">复制为 Markdown</button>' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm" data-io="dl-json">导出全部 JSON</button></div>' +
      '<div class="uxa-io-row">' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm" data-io="dl-page">仅导出本页 JSON</button>' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm" data-io="dl-md">下载 Markdown 文件</button></div>' +
      '<div class="uxa-io-row"><label class="uxa-file">导入 JSON<input type="file" accept=".json,application/json" data-io="import" /></label></div>' +
      '<div class="uxa-io-row">' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm uxa-danger" data-io="clear-page">清空本页批注</button>' +
      '<button class="uxa-btn uxa-btn-ghost uxa-btn-sm uxa-danger" data-io="clear-all">清空全部批注</button></div>' +
      '<p class="uxa-io-hint">导入为"合并"模式：同 id 覆盖，其余追加。清空操作不可撤销。</p>' +
      '</div>';
    bindIOInput(body);
  }

  function bindIOInput(body) {
    var file = $('input[data-io="import"]', body);
    if (!file) return;
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(String(reader.result));
          if (!obj || !obj.pages) throw new Error('bad');
          var n = 0;
          Object.keys(obj.pages).forEach(function (b) {
            if (!store.pages[b]) store.pages[b] = [];
            (obj.pages[b] || []).forEach(function (it) {
              var idx = -1;
              for (var i = 0; i < store.pages[b].length; i++) {
                if (store.pages[b][i].id === it.id) { idx = i; break; }
              }
              if (idx >= 0) store.pages[b][idx] = it; else store.pages[b].push(it);
              n++;
            });
          });
          save();
          applyAll();
          renderPanel();
          toast('已导入 ' + n + ' 条批注');
        } catch (e) {
          toast('导入失败：文件不是有效的批注 JSON');
        }
      };
      reader.readAsText(f);
    });
  }

  function handleIO(act) {
    if (act === 'md') { copyMarkdown(); return; }
    if (act === 'dl-json') {
      download('批注-全部-' + dayStamp(Date.now()) + '.json', JSON.stringify(store, null, 2), 'application/json');
      return;
    }
    if (act === 'dl-page') {
      var one = { v: SCHEMA, pages: {} };
      one.pages[PAGE] = listPage(PAGE);
      download('批注-' + FILE.replace(/\.html$/, '') + '-' + dayStamp(Date.now()) + '.json', JSON.stringify(one, null, 2), 'application/json');
      return;
    }
    if (act === 'dl-md') { download('批注-' + dayStamp(Date.now()) + '.md', toMarkdown(), 'text/markdown'); return; }
    if (act === 'clear-page') {
      if (window.confirm('确定清空本页（' + pageTitle(PAGE) + '）的全部批注？此操作不可撤销。')) {
        clearCurrentBucket();
        renderPanel();
        toast('本页批注已清空');
      }
      return;
    }
    if (act === 'clear-all') {
      if (window.confirm('确定清空全部页面的批注？此操作不可撤销。')) {
        clearCurrentBucket();
        store = { v: SCHEMA, pages: {} };
        writeStore(store);
        refreshCounters();
        renderPanel();
        toast('全部批注已清空');
      }
    }
  }

  function clearCurrentBucket() {
    listPage(PAGE).forEach(function (it) {
      unwrap(it.id);
      var p = $('[data-uxa-pin="' + it.id + '"]');
      if (p) p.remove();
      delete pinTargets[it.id];
    });
    delete store.pages[PAGE];
    writeStore(store);
    refreshCounters();
  }

  function toMarkdown() {
    var lines = [];
    lines.push('# 汽水老师编程课堂 · 我的批注');
    lines.push('');
    lines.push('导出时间：' + stamp(Date.now()));
    lines.push('');
    var items = allItems();
    if (!items.length) return lines.join('\n') + '（暂无批注）\n';

    var byPage = {};
    items.forEach(function (e) {
      if (!byPage[e.page]) byPage[e.page] = [];
      byPage[e.page].push(e.item);
    });

    Object.keys(byPage).forEach(function (b) {
      lines.push('## ' + pageTitle(b) + '（' + fileOf(b) + '）');
      lines.push('');
      var list = byPage[b].slice().sort(function (a, c) { return (a.created || 0) - (c.created || 0); });
      var notes = list.filter(function (x) { return !x.todo; });
      var todos = list.filter(function (x) { return x.todo; });

      if (notes.length) {
        lines.push('### 批注与便签');
        lines.push('');
        notes.forEach(function (it) {
          var where = it.t && it.t.label ? '（' + it.t.label + '）' : '';
          lines.push('**' + (it.type === 'highlight' ? '高亮' : it.type === 'note' ? '便签' : '书签') + where + '**');
          if (it.quote) { lines.push(''); lines.push('> ' + norm(it.quote)); }
          lines.push('');
          lines.push(it.note ? it.note : '_（没有文字批注）_');
          lines.push('');
        });
      }
      if (todos.length) {
        lines.push('### 待办');
        lines.push('');
        todos.forEach(function (it) {
          var label = it.note ? it.note : (it.quote || (it.t && it.t.label) || '');
          lines.push('- ' + (it.done ? '[x]' : '[ ]') + ' ' + norm(label));
        });
        lines.push('');
      }
    });
    return lines.join('\n');
  }

  function copyMarkdown() {
    var md = toMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(function () {
        toast('已复制 Markdown，可直接粘到 Word / 微信');
      }, function () { fallbackCopy(md); });
    } else fallbackCopy(md);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('data-uxa-ui', '1');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); }
    catch (e) { toast('复制失败，请改用"下载 Markdown 文件"'); }
    document.body.removeChild(ta);
  }

  function download(name, content, mime) {
    try {
      var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.setAttribute('data-uxa-ui', '1');
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
      toast('已下载：' + name);
    } catch (e) {
      toast('当前环境不支持直接下载，请改用"复制为 Markdown"');
    }
  }

  /* ---------------- 计数 ---------------- */
  function refreshCounters() {
    var n = listPage(PAGE).length;
    var el = $('#uxaCount');
    if (el) {
      el.textContent = n > 0 ? String(n) : '';
      el.style.display = n > 0 ? '' : 'none';
    }
    var tn = $('#uxaTodoN');
    if (tn) tn.textContent = String(todoCount());
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindToolbars(tb, ht) {
    tb.addEventListener('mousedown', function (e) { e.preventDefault(); });  // 保住选区
    tb.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'close') { hideToolbar(); return; }
      if (act === 'quote') { if (lastSel) fallbackCopy(lastSel.quote); hideToolbar(); return; }
      if (act === 'note') { makeHighlight('yellow', true, false); return; }
      if (act === 'todo') { makeHighlight('pink', true, true); return; }
      if (act.indexOf('hl-') === 0) { makeHighlight(act.slice(3), false, false); }
    });

    ht.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ht.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      var found = ht._itemId ? findItem(ht._itemId) : null;
      if (act === 'close' || !found) { hideToolbar(); return; }
      if (act === 'edit') { openEditor(found.item, $('[data-uxa-id="' + found.item.id + '"]')); hideToolbar(); return; }
      if (act === 'del') { deleteItem(found.item.id); hideToolbar(); return; }
      if (act === 'todo-toggle') {
        found.item.todo = !found.item.todo;
        found.item.updated = Date.now();
        save();
        renderPanel();
        toast(found.item.todo ? '已加入待办' : '已移出待办');
        hideToolbar();
      }
    });
  }

  var hoverBlock = null;

  function bindNoteAdd(noteAdd) {
    document.addEventListener('mouseover', function (ev) {
      var el = ev.target;
      if (!el || !el.closest || el.closest('[data-uxa-ui]')) return;
      var block = el.closest(NOTE_BLOCK_SEL);
      if (!block) return;
      hoverBlock = block;
      var r = block.getBoundingClientRect();
      if (r.width < 120) return;
      noteAdd.style.top = Math.max(4, r.top + 6) + 'px';
      noteAdd.style.left = Math.max(4, r.right - 84) + 'px';
      noteAdd.classList.add('show');
    });
    window.addEventListener('scroll', function () { noteAdd.classList.remove('show'); }, true);
    document.addEventListener('mouseout', function (ev) {
      if (!hoverBlock) return;
      var to = ev.relatedTarget;
      if (to && (to === noteAdd || (to.closest && to.closest('[data-uxa-ui]')) ||
        (hoverBlock.contains && hoverBlock.contains(to)))) return;
      noteAdd.classList.remove('show');
      hoverBlock = null;
    });
    noteAdd.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (hoverBlock) makeBlockNote(hoverBlock);
    });
  }

  function bindEditor(ed) {
    ed.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'save') saveEditor();
      else if (act === 'close') closeEditor();
      else if (act === 'del' && editorState) deleteItem(editorState.id);
    });
    var ta = $('.uxa-ed-text', ed);
    if (ta) {
      ta.addEventListener('keydown', function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); saveEditor(); }
        if (ev.key === 'Escape') closeEditor();
      });
    }
  }

  function bindDrawer(dw, mask) {
    dw.addEventListener('click', function (ev) {
      var io = ev.target.closest ? ev.target.closest('[data-io]') : null;
      if (io) {
        ev.preventDefault();
        var ioAct = io.getAttribute('data-io');
        if (ioAct !== 'import') handleIO(ioAct);   // import 交给 input 的 change
        return;
      }
      var b = ev.target.closest ? ev.target.closest('[data-act],[data-tab]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'close') { closeDrawer(); return; }
      if (act === 'add-section') { makeBookmark(currentSection(), true); return; }
      var tab = b.getAttribute('data-tab');
      if (tab) {
        panelTab = tab;
        $$('.uxa-tab', dw).forEach(function (t) { t.classList.toggle('active', t === b); });
        renderPanel();
      }
    });
    mask.addEventListener('click', closeDrawer);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    try {
      PAGE = scopeKey();
      migrateLegacyBucket();
      injectUI();
      applyAll();
      renderPanel();

      document.addEventListener('mouseup', onSelectEnd);
      document.addEventListener('touchend', onSelectEnd);
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { hideToolbar(); closeEditor(); }
      });
      document.addEventListener('click', function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest('.uxa-toolbar') || t.closest('.uxa-editor') || t.closest('.uxa-drawer') ||
          t.closest('.uxa-pin-layer')) return;
        // 点已有高亮 → 直接打开编辑
        var hl = t.closest('[data-uxa-id]');
        if (hl) {
          var f = findItem(hl.getAttribute('data-uxa-id'));
          if (f) { openEditor(f.item, hl); return; }
        }
        hideToolbar();
      });
      window.addEventListener('scroll', function () {
        schedulePinPosition();
        var ed = $('.uxa-editor');
        if (ed && ed.classList.contains('show')) return;
        hideToolbar();
      }, { passive: true });
      window.addEventListener('resize', schedulePinPosition);
      window.addEventListener('load', schedulePinPosition);
      setTimeout(positionPins, 300);

      watchRoot();

      // 从别的页面"定位"过来：xxx.html?uxa=<批注id>
      var m = (location.search || '').match(/[?&]uxa=([^&]+)/);
      if (m) {
        var id = decodeURIComponent(m[1]);
        var found = findItem(id);
        if (found) setTimeout(function () { jumpTo(found); }, 420);
      }

      if (!storageOK) toast('当前浏览器无法保存批注（建议用 Chrome 打开，并及时导出 JSON）');
    } catch (e) {
      if (window.console) console.log('批注模块初始化失败：', e);
      try { toast('批注功能初始化失败，请刷新页面重试'); } catch (e2) { /* 忽略 */ }
    }
  }

  if (document.readyState === 'complete') setTimeout(init, 60);
  else window.addEventListener('load', function () { setTimeout(init, 60); });

  window.UniXAnnotate = {
    version: 2,
    store: function () { return store; },
    export: toMarkdown,
    reapply: applyAll,
    // 供 _tools/check-annotate.js 做回归测试（页面逻辑不依赖这些）
    _test: {
      init: init,
      pageKey: function () { return scopeKey(); },
      onDomMaybeChanged: onDomMaybeChanged,
      fileOf: fileOf,
      pathOf: pathOf,
      elByPath: elByPath,
      offsetIn: offsetIn,
      sigOf: sigOf,
      wrapRange: wrapRange,
      unwrap: unwrap,
      overlaps: overlaps,
      toMarkdown: toMarkdown,
      applyAll: applyAll,
      listPage: listPage,
      setStore: function (s) { store = s; },
      getStore: function () { return store; }
    }
  };
})();

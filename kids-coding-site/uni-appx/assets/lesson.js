/* ============================================================
   汽水老师 · uni-app x 大学课堂  共享交互脚本
   纯原生 JS，无依赖，可直接 file:// 打开
   依赖页面定义（可选）：
     window.SITE_OUTLINE  侧边/抽屉目录数据
     window.QUIZ_DATA     随堂测验题目
     window.PG_DEMOS      代码-手机联动演练区
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式忽略 */ } }
  };

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- 代码高亮（轻量正则版） ---------------- */
  var KEYWORDS = ('const let var function return if else for while do break continue ' +
    'import from export default class extends new delete typeof instanceof in of as ' +
    'interface type enum readonly public private static async await try catch throw ' +
    'null undefined true false this void').split(' ');

  var KW_RE = new RegExp('\\b(?:' + KEYWORDS.join('|') + ')\\b', 'g');

  var PATTERNS = {
    html: /&lt;!--[\s\S]*?--&gt;|&lt;\/?[A-Za-z][\w-]*|[\w:@.\-\[\]]+(?=\s*=)|"[^"]*"|'[^']*'|\{\{[\s\S]*?\}\}/g,
    ts: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`[^`]*`|"[^"\n]*"|'[^'\n]*'|\b(?:const|let|var|function|return|if|else|for|while|import|from|export|default|class|extends|new|interface|type|as|async|await|try|catch|throw|null|undefined|true|false|this|void|readonly|enum|of|in)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\s*\()|\b[A-Z][A-Za-z0-9_]*\b/g,
    css: /\/\*[\s\S]*?\*\/|[.#][A-Za-z][\w-]*|[\w-]+(?=\s*:)|#[0-9A-Fa-f]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rpx|%|s|ms|vh|vw|em|rem)?\b|"[^"]*"/g,
    json: /"[^"]*"(?=\s*:)|"[^"]*"|\b\d+(?:\.\d+)?\b|\b(?:true|false|null)\b|[\{\}\[\],]/g,
    bash: /#[^\n]*|"[^"]*"|'[^']*'|\b(?:npm|pnpm|npx|git|adb|node|hbuilderx|cli)\b|--?[\w-]+/g
  };

  function classify(tok, lang) {
    // 注释（HTML 注释 / JS 注释 / bash 注释）
    if (/^&lt;!--/.test(tok)) return 'tk-cmt';
    if (/^\/[\/\*]/.test(tok)) return 'tk-cmt';
    if (lang === 'bash' && /^#/.test(tok)) return 'tk-cmt';
    // 颜色值（必须早于"#"开头即注释"的判断）
    if (/^#[0-9A-Fa-f]{3,8}$/.test(tok)) return 'tk-num';
    // 字符串与模板串
    if (/^["'`]/.test(tok)) return 'tk-str';
    // 模板插值 {{ }}
    if (/^\{\{/.test(tok)) return 'tk-key';
    // 布尔与数字
    if (/^(true|false|null|undefined)$/.test(tok) || /^\d/.test(tok)) return 'tk-num';
    // HTML：标签名与属性名
    if (lang === 'html') {
      if (/^&lt;\/?/.test(tok)) return 'tk-tag';
      if (/^[\w:@.\-\[\]]+$/.test(tok)) return 'tk-attr';
    }
    // CSS：选择器与属性名
    if (lang === 'css') {
      if (/^[.#]/.test(tok)) return 'tk-tag';
      if (/^[\w-]+$/.test(tok)) return 'tk-attr';
    }
    // JSON：键 / 值
    if (lang === 'json' && /^"/.test(tok)) return 'tk-attr';
    // TS/JS：关键字、类型、函数名
    if (lang === 'ts') {
      KW_RE.lastIndex = 0;
      if (KW_RE.test(tok)) return 'tk-key';
      if (/^[A-Z]/.test(tok)) return 'tk-key';
      if (/^[A-Za-z_$]/.test(tok)) return 'tk-fn';
    }
    if (lang === 'bash' && /^--?/.test(tok)) return 'tk-attr';
    return null;
  }

  function highlight(code, lang) {
    var re = PATTERNS[lang] || PATTERNS.ts;
    re.lastIndex = 0;
    return String(code).replace(re, function (m) {
      var c = classify(m, lang);
      return c ? '<span class="' + c + '">' + m + '</span>' : m;
    });
  }

  function renderCode(target, code, lang) {
    target.innerHTML = highlight(esc(code), lang || 'ts');
  }

  /* ---------------- 代码卡片：标签页 + 复制 ---------------- */
  function initCodeCards() {
    $$('.code-card').forEach(function (card) {
      var tabs = $$('.code-tab', card);
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          $$('.code-pane', card).forEach(function (p) { p.classList.remove('active'); });
          var pane = $('.code-pane[data-pane="' + tab.getAttribute('data-tab') + '"]', card);
          if (pane) pane.classList.add('active');
        });
      });

      // 高亮所有代码块
      $$('pre[data-lang]', card).forEach(function (pre) {
        var raw = pre.getAttribute('data-src');
        if (raw === null) {
          // 首次运行：把原始文本缓存到 data-src，再高亮
          raw = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
          pre.setAttribute('data-src', raw);
        }
        renderCode(pre, raw, pre.getAttribute('data-lang'));
        var codeEl = document.createElement('code');
        codeEl.innerHTML = pre.innerHTML;
        pre.innerHTML = '';
        pre.appendChild(codeEl);
      });

      var copyBtn = $('.code-copy', card);
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var active = $('.code-pane.active pre[data-lang]', card) || $('pre[data-lang]', card);
          var text = active ? active.getAttribute('data-src') : '';
          var done = function () {
            copyBtn.classList.add('done');
            copyBtn.textContent = '✓ 已复制';
            toast('代码已复制到剪贴板');
            setTimeout(function () { copyBtn.classList.remove('done'); copyBtn.textContent = '复制'; }, 1600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
          } else { fallbackCopy(text, done); }
        });
      }
    });
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择代码'); }
    document.body.removeChild(ta);
  }

  /* ---------------- 阅读进度条 ---------------- */
  function initReadProgress() {
    var bar = $('.read-progress');
    if (!bar) return;
    var update = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? (window.scrollY / h) * 100 : 0;
      bar.style.width = Math.max(0, Math.min(100, p)) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------------- 目录抽屉 ---------------- */
  function initDrawer(outline) {
    var drawer = $('#drawer'), mask = $('#drawerMask'), body = $('#drawerBody');
    if (!drawer || !mask || !body) return;
    if (outline && outline.length) {
      body.innerHTML = outline.map(function (g) {
        return '<div class="drawer-group"><div class="g-title">' + g.group + '</div>' +
          g.items.map(function (it) {
            var cls = 'drawer-link' + (it.current ? ' active' : '');
            var attr = it.href && it.href !== '#' ? ' href="' + it.href + '"' : '';
            var tag = attr ? 'a' : 'div';
            var locked = (!it.href || it.href === '#') ? ' data-locked="1"' : '';
            return '<' + tag + ' class="' + cls + '"' + attr + locked + '>' +
              '<span class="no">' + it.no + '</span><span>' + it.title + '</span></' + tag + '>';
          }).join('') + '</div>';
      }).join('');
    }
    var open = function () { drawer.classList.add('open'); mask.classList.add('open'); };
    var close = function () { drawer.classList.remove('open'); mask.classList.remove('open'); };
    $$('[data-drawer-open]').forEach(function (b) { b.addEventListener('click', open); });
    mask.addEventListener('click', close);
    $$('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    body.addEventListener('click', function (e) {
      var locked = e.target.closest ? e.target.closest('[data-locked]') : null;
      if (locked) { e.preventDefault(); toast('该章节正在制作中，先学第 1 章打基础吧'); }
    });
  }

  /* ---------------- 章节内锚点导航 + 滚动高亮 ---------------- */
  function initSectionNav() {
    var secs = $$('.lesson-section');
    var strip = $('#tocStrip'), side = $('#sideToc');
    if (secs.length) {
      if (strip) {
        strip.innerHTML = secs.map(function (s) {
          return '<button class="toc-chip" data-target="' + s.id + '">' + s.getAttribute('data-nav') + '</button>';
        }).join('');
        strip.addEventListener('click', function (e) {
          var chip = e.target.closest ? e.target.closest('.toc-chip') : null;
          if (!chip) return;
          var el = document.getElementById(chip.getAttribute('data-target'));
          if (el) window.scrollTo({ top: el.offsetTop - 110, behavior: 'smooth' });
        });
      }
      if (side) {
        side.innerHTML = '<div class="st-title">本章目录</div>' + secs.map(function (s) {
          return '<a href="#' + s.id + '">' + s.getAttribute('data-nav') + '</a>';
        }).join('');
      }
    }

    var links = $$('#sideToc a, #tocStrip .toc-chip');
    if (!links.length) return;
    var setActive = function (id) {
      links.forEach(function (l) {
        var t = l.getAttribute('data-target') || (l.getAttribute('href') || '').replace('#', '');
        l.classList.toggle('active', t === id);
      });
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) setActive(en.target.id);
        });
      }, { rootMargin: '-110px 0px -60% 0px', threshold: 0 });
      secs.forEach(function (s) { io.observe(s); });
    }
    setActive(secs.length ? secs[0].id : '');
  }

  /* ---------------- 滚动出现动画 ---------------- */
  function initReveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
    els.forEach(function (e, i) { e.style.transitionDelay = Math.min(i % 5, 4) * 60 + 'ms'; io.observe(e); });
  }

  /* ---------------- 任务清单（本地保存） ---------------- */
  function initTasks() {
    var items = $$('.task-item[data-task-id]');
    items.forEach(function (it) {
      var id = 'uniappx.task.' + it.getAttribute('data-task-id');
      if (LS.get(id) === '1') it.classList.add('done');
      it.addEventListener('click', function () {
        it.classList.toggle('done');
        LS.set(id, it.classList.contains('done') ? '1' : '0');
        updateTaskCounter();
      });
    });
    updateTaskCounter();
  }

  function updateTaskCounter() {
    var all = $$('.task-item[data-task-id]');
    var counter = $('#taskCounter');
    if (!counter || !all.length) return;
    var done = all.filter(function (i) { return i.classList.contains('done'); }).length;
    counter.textContent = done + ' / ' + all.length + ' 已完成';
    counter.style.color = done === all.length ? 'var(--mint)' : '';
  }

  /* ---------------- 随堂测验 ---------------- */
  function initQuiz(data) {
    var mount = $('#quizMount');
    if (!mount) return;
    var list = data || window.QUIZ_DATA || [];
    if (!list.length) return;

    mount.innerHTML = list.map(function (q, qi) {
      var multi = Object.prototype.toString.call(q.answer) === '[object Array]';
      return '<div class="q-item" data-q="' + qi + '">' +
        '<div class="q-title"><span class="qn">' + (qi + 1) + '.</span>' +
        '<span>' + q.q + '</span>' +
        '<span class="q-type">' + (multi ? '多选' : '单选') + '</span></div>' +
        (q.code ? '<pre class="code-block q-code" data-lang="' + (q.codeLang || 'ts') + '">' + esc(q.code) + '</pre>' : '') +
        '<div class="q-opts">' +
        q.opts.map(function (o, oi) {
          var key = 'ABCDEFG'[oi];
          return '<div class="q-opt" data-oi="' + oi + '"><span class="key">' + key + '</span><span>' + o + '</span></div>';
        }).join('') +
        '</div>' +
        (multi ? '<div style="margin-top:12px"><button class="btn btn-primary btn-sm" data-submit="1">提交答案</button></div>' : '') +
        '<div class="q-explain"><strong>解析：</strong>' + q.explain + '</div>' +
        '</div>';
    }).join('') +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding-top:16px;">' +
      '<span style="font-size:13px;color:var(--text-sub)">选完即时判分，可反复作答</span>' +
      '<button class="btn btn-ghost btn-sm" data-quiz-reset="1">重做本组测验</button></div>';

    // 高亮测验里的代码
    $$('pre[data-lang]', mount).forEach(function (pre) {
      var raw = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
      pre.setAttribute('data-src', raw);
      renderCode(pre, raw, pre.getAttribute('data-lang'));
    });

    var answered = {};
    var correctCount = 0;

    function scoreLabel() {
      var el = $('#quizScore');
      if (el) el.textContent = '得分 ' + correctCount + ' / ' + list.length;
    }

    function judge(qi) {
      var q = list[qi];
      var multi = Object.prototype.toString.call(q.answer) === '[object Array]';
      var wrap = $('.q-item[data-q="' + qi + '"]', mount);
      var opts = $$('.q-opt', wrap);
      var picked = opts.filter(function (o) { return o.classList.contains('picked'); })
        .map(function (o) { return Number(o.getAttribute('data-oi')); });
      var correct = multi ? q.answer.slice().sort().join(',') : String(q.answer);
      var got = multi ? picked.slice().sort().join(',') : String(picked[0]);

      opts.forEach(function (o) {
        var oi = Number(o.getAttribute('data-oi'));
        var isCorrect = multi ? q.answer.indexOf(oi) > -1 : oi === q.answer;
        o.classList.add('locked');
        if (isCorrect) o.classList.add('correct');
        else if (picked.indexOf(oi) > -1) o.classList.add('wrong');
      });
      $('.q-explain', wrap).classList.add('show');
      answered[qi] = (got === correct);
      recount();
    }

    function recount() {
      correctCount = Object.keys(answered).filter(function (k) { return answered[k]; }).length;
      scoreLabel();
    }

    mount.addEventListener('click', function (e) {
      var t = e.target;
      var opt = t.closest ? t.closest('.q-opt') : null;
      var wrap = t.closest ? t.closest('.q-item') : null;

      if (opt && wrap) {
        var qi = Number(wrap.getAttribute('data-q'));
        if ($('.q-explain', wrap).classList.contains('show')) return; // 已判分
        var q = list[qi];
        var multi = Object.prototype.toString.call(q.answer) === '[object Array]';
        if (multi) { opt.classList.toggle('picked'); opt.style.borderColor = opt.classList.contains('picked') ? 'var(--primary)' : ''; }
        else {
          $$('.q-opt', wrap).forEach(function (o) { o.classList.remove('picked'); o.style.borderColor = ''; });
          opt.classList.add('picked');
          judge(qi);
        }
        return;
      }
      if (t.getAttribute && t.getAttribute('data-submit') === '1' && wrap) {
        var qi2 = Number(wrap.getAttribute('data-q'));
        if ($('.q-explain', wrap).classList.contains('show')) return;
        if (!$('.q-opt.picked', wrap)) { toast('请先选择至少一个选项'); return; }
        judge(qi2);
        return;
      }
      if (t.getAttribute && t.getAttribute('data-quiz-reset') === '1') {
        answered = {}; correctCount = 0; scoreLabel();
        $$('.q-item', mount).forEach(function (item) {
          $$('.q-opt', item).forEach(function (o) {
            o.classList.remove('correct', 'wrong', 'locked', 'picked');
            o.style.borderColor = '';
          });
          $('.q-explain', item).classList.remove('show');
        });
        toast('已重置，再来一次！');
      }
    });

    scoreLabel();
  }

  /* 演练区：根据代码内容猜测高亮语言，这样"多文件示例"（组件 + 页面）也能正确着色 */
  function guessLang(key, code) {
    if (key === 'style') return 'css';
    if (key === 'json') return 'json';
    if (key === 'bash') return 'bash';
    var t = String(code).trim();
    if (t.indexOf('<template') === 0 || t.indexOf('<script') === 0 ||
      t.indexOf('<style') === 0 || t.indexOf('&lt;!--') === 0 || t.indexOf('<!--') === 0) return 'html';
    if (t.indexOf('@media') === 0 || t.indexOf('.') === 0 || t.indexOf('/*') === 0) return 'css';
    return 'ts';
  }

  /* ---------------- 代码 ↔ 手机联动演练区 ---------------- */
  function initPlaygrounds() {
    var demos = window.PG_DEMOS || {};
    $$('[data-playground]').forEach(function (root) {
      var key = root.getAttribute('data-playground');
      var demo = demos[key];
      if (!demo) return;
      var state = { example: 0 };

      root.innerHTML =
        '<div class="pg-left">' +
          '<div class="pg-toolbar" data-role="examples"></div>' +
          '<div class="code-card" id="pgCode-' + key + '">' +
            '<div class="code-head"><span class="code-dots"><i></i><i></i><i></i></span>' +
            '<span class="code-file" data-role="filename"></span>' +
            '<button class="code-copy">复制</button></div>' +
            '<div class="code-tabs" data-role="tabs"></div>' +
            '<div data-role="panes"></div>' +
          '</div>' +
          '<div class="pg-hint" data-role="hint"></div>' +
        '</div>' +
        '<div class="pg-right">' +
          '<div class="device"><div class="device-screen">' +
            '<div class="device-status"><span data-role="clock">9:41</span>' +
            '<span class="r">▮▮▮ <span class="bat"></span></span></div>' +
            '<div class="uvue-navbar" data-role="navbar"></div>' +
            '<div class="uvue-page" data-role="screen"></div>' +
            '<div class="uv-toast" data-role="toast"></div>' +
          '</div></div>' +
          '<div class="uvue-caption">示意图：近似还原 App 端运行效果</div>' +
        '</div>';

      var examplesBar = $('[data-role="examples"]', root);
      var tabsBar = $('[data-role="tabs"]', root);
      var panes = $('[data-role="panes"]', root);
      var screen = $('[data-role="screen"]', root);
      var navbar = $('[data-role="navbar"]', root);
      var toastBox = $('[data-role="toast"]', root);
      var filename = $('[data-role="filename"]', root);
      var hint = $('[data-role="hint"]', root);
      var codeCard = $('#pgCode-' + key, root);

      examplesBar.innerHTML = demo.examples.map(function (ex, i) {
        return '<button class="pg-btn' + (i === 0 ? ' active' : '') + '" data-ex="' + i + '">' + ex.name + '</button>';
      }).join('') + (demo.extraActions || []).map(function (a, i) {
        return '<button class="pg-btn" data-act="' + i + '" style="border-style:dashed">' + a.label + '</button>';
      }).join('');

      function currentExample() { return demo.examples[state.example]; }

      function paintCode() {
        var ex = currentExample();
        var langs = Object.keys(ex.code || {});
        tabsBar.innerHTML = langs.map(function (l, i) {
          var label = (ex.codeLabels && ex.codeLabels[l]) || l;
          return '<button class="code-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + l + '">' + label + '</button>';
        }).join('');
        panes.innerHTML = langs.map(function (l, i) {
          var lang = guessLang(l, ex.code[l]);
          return '<div class="code-pane' + (i === 0 ? ' active' : '') + '" data-pane="' + l + '">' +
            '<pre class="code-block" data-lang="' + lang + '">' + esc(ex.code[l]) + '</pre></div>';
        }).join('');
        $$('pre[data-lang]', codeCard).forEach(function (pre) {
          var raw = pre.textContent;
          pre.setAttribute('data-src', raw);
          renderCode(pre, raw, pre.getAttribute('data-lang'));
          var codeEl = document.createElement('code');
          codeEl.innerHTML = pre.innerHTML;
          pre.innerHTML = '';
          pre.appendChild(codeEl);
        });
        $$('.code-tab', tabsBar).forEach(function (tab) {
          tab.addEventListener('click', function () {
            $$('.code-tab', tabsBar).forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            $$('.code-pane', panes).forEach(function (p) { p.classList.remove('active'); });
            var p = $('.code-pane[data-pane="' + tab.getAttribute('data-tab') + '"]', panes);
            if (p) p.classList.add('active');
          });
        });
        filename.textContent = ex.file || 'pages/index/index.uvue';
        var copyBtn = $('.code-copy', codeCard);
        copyBtn.onclick = function () {
          var active = $('.code-pane.active pre[data-lang]', codeCard) || $('pre[data-lang]', codeCard);
          fallbackCopy(active ? active.getAttribute('data-src') : '', function () {
            copyBtn.classList.add('done'); copyBtn.textContent = '✓ 已复制';
            setTimeout(function () { copyBtn.classList.remove('done'); copyBtn.textContent = '复制'; }, 1500);
          });
        };
      }

      function paintScreen() {
        var ex = currentExample();
        if (ex.state) {
          Object.keys(ex.state).forEach(function (k) {
            if (!(k in state)) state[k] = ex.state[k];
          });
        }
        navbar.textContent = ex.navbar || 'uni-app x';
        screen.innerHTML = ex.render(state);
        if (hint) hint.innerHTML = '<strong style="color:var(--text)">观测点：</strong>' + (ex.hint || '留意界面与代码的对应关系。');
        $$('[data-bind]', screen).forEach(function (el) {
          el.addEventListener('click', function () {
            var name = el.getAttribute('data-bind');
            var fn = ex.actions && ex.actions[name];
            if (typeof fn === 'function') {
              var r = fn(state);
              paintScreen();
              if (typeof r === 'string') flash(r);
            }
          });
        });
      }

      var flashTimer;
      function flash(msg) {
        toastBox.textContent = msg;
        toastBox.classList.add('show');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(function () { toastBox.classList.remove('show'); }, 1800);
      }

      function repaint() { paintCode(); paintScreen(); }

      examplesBar.addEventListener('click', function (e) {
        var t = e.target;
        var exBtn = t.closest ? t.closest('[data-ex]') : null;
        var actBtn = t.closest ? t.closest('[data-act]') : null;
        if (exBtn) {
          state.example = Number(exBtn.getAttribute('data-ex'));
          $$('[data-ex]', examplesBar).forEach(function (b) { b.classList.toggle('active', b === exBtn); });
          repaint();
        } else if (actBtn) {
          var a = (demo.extraActions || [])[Number(actBtn.getAttribute('data-act'))];
          if (a && typeof a.run === 'function') {
            var msg = a.run(state);
            if (msg && msg.rerender === false) { /* 不动界面 */ } else { paintScreen(); }
            if (typeof msg === 'string') flash(msg);
          }
        }
      });

      repaint();
    });
  }

  /* ---------------- 初始化 ---------------- */
  function boot() {
    initReadProgress();
    initDrawer(window.SITE_OUTLINE);
    initCodeCards();
    initSectionNav();
    initReveal();
    initTasks();
    initQuiz();
    initPlaygrounds();

    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();

    // 未上线章节提示
    document.addEventListener('click', function (e) {
      var locked = e.target.closest ? e.target.closest('[data-soon]') : null;
      if (locked) { e.preventDefault(); toast(locked.getAttribute('data-soon') || '内容正在制作中'); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.UniX = { toast: toast, highlight: highlight, renderCode: renderCode, esc: esc, LS: LS };
})();

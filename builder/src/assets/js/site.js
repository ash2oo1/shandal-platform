/* Shandal System — site behaviour. No dependencies. */
(function () {
  'use strict';
  var root = document.documentElement;
  var lang = root.lang === 'ar' ? 'ar' : 'en';
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* theme */
  $$('#themeBtn,[data-theme-toggle]').forEach(function (themeBtn) { themeBtn.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme');
    var dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next); store.set('shandal-theme', next);
    document.dispatchEvent(new CustomEvent('themechange'));
  }); });

  /* language preference */
  $$('[data-lang-link]').forEach(function (a) { a.addEventListener('click', function () { store.set('shandal-lang', a.getAttribute('data-lang-link')); }); });

  /* header over dark hero */
  var header = $('.site-header');
  if (header && header.classList.contains('on-dark')) {
    var solid = header.classList.contains('scrolled'); var onScroll = function () { header.classList.toggle('scrolled', solid || window.scrollY > 24); };
    onScroll(); addEventListener('scroll', onScroll, { passive: true });
  }

  /* mega menus */
  var openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.btn.setAttribute('aria-expanded', 'false'); openMenu.panel.classList.remove('open'); openMenu = null;
  }
  $$('[data-menu]').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    var li = btn.parentElement, t;
    function open() {
      if (openMenu && openMenu.btn !== btn) closeMenu();
      btn.setAttribute('aria-expanded', 'true'); panel.classList.add('open'); openMenu = { btn: btn, panel: panel };
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); (btn.getAttribute('aria-expanded') === 'true') ? closeMenu() : open(); });
    if (matchMedia('(hover: hover)').matches) {
      li.addEventListener('mouseenter', function () { clearTimeout(t); open(); });
      li.addEventListener('mouseleave', function () { t = setTimeout(closeMenu, 160); });
    }
  });
  document.addEventListener('click', function (e) { if (openMenu && !openMenu.panel.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closeSearch(); closeDrawer(); } });

  /* drawer */
  var drawer = $('#drawer'), burger = $('#burger');
  function closeDrawer() { if (drawer && drawer.classList.contains('open')) { drawer.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; } }
  if (burger) burger.addEventListener('click', function () { drawer.classList.add('open'); burger.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; var c = $('#drawerClose'); c && c.focus(); });
  var dc = $('#drawerClose'); if (dc) dc.addEventListener('click', closeDrawer);
  if (drawer) drawer.addEventListener('click', function (e) { if (e.target.closest('a')) closeDrawer(); });

  /* search */
  var search = $('#search'), sInput = $('#searchInput'), sRes = $('#searchRes');
  var INDEX = window.SHANDAL_INDEX || [];
  function closeSearch() { if (search && !search.hidden) { search.hidden = true; document.body.style.overflow = ''; } }
  function openSearch() { search.hidden = false; document.body.style.overflow = 'hidden'; sInput.value = ''; render(''); setTimeout(function () { sInput.focus(); }, 30); }
  function norm(s) { return (s || '').toLowerCase().normalize('NFKD').replace(/[ً-ٟ]/g, ''); }
  function render(q) {
    var nq = norm(q).trim(), hits = INDEX.filter(function (t) { return !nq || norm(t.k).indexOf(nq) > -1; });
    if (!hits.length) { sRes.innerHTML = '<p class="search-empty">' + (search.getAttribute('data-empty')) + '</p>'; return; }
    sRes.innerHTML = hits.map(function (t, i) {
      return '<a href="' + t.u + '"' + (i === 0 ? ' class="active"' : '') + '>' + t.i + '<span><b>' + t.n + '</b><small>' + t.d + '</small></span></a>';
    }).join('');
  }
  $$('[data-open-search]').forEach(function (b) { b.addEventListener('click', openSearch); });
  if (search) {
    search.addEventListener('click', function (e) { if (e.target === search) closeSearch(); });
    sInput.addEventListener('input', function () { render(sInput.value); });
    sInput.addEventListener('keydown', function (e) {
      var items = $$('a', sRes), i = items.findIndex(function (a) { return a.classList.contains('active'); });
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!items.length) return;
        items[i] && items[i].classList.remove('active');
        i = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[i].classList.add('active'); items[i].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && items[i]) { location.href = items[i].getAttribute('href'); }
    });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && search && search.hidden && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });

  /* table of contents highlight */
  var toc = $$('.toc a');
  if (toc.length && 'IntersectionObserver' in window) {
    var map = {}; toc.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { toc.forEach(function (a) { a.classList.remove('active'); }); var a = map[en.target.id]; a && a.classList.add('active'); }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); s && io.observe(s); });
  }

  /* catalog filters */
  var chips = $$('[data-filter]'), cards = $$('[data-cat]'), findIn = $('#findTool');
  function applyFilter() {
    var on = (chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; })[0] || {}).dataset;
    var cat = on ? on.filter : 'all', q = norm(findIn ? findIn.value : '');
    var shown = 0;
    $$('.cat-block').forEach(function (b) {
      var any = 0;
      $$('[data-cat]', b).forEach(function (c) {
        var ok = (cat === 'all' || c.dataset.cat === cat) && (!q || norm(c.dataset.k).indexOf(q) > -1);
        c.hidden = !ok; if (ok) { any++; shown++; }
      });
      b.hidden = !any;
    });
    var em = $('#noTools'); if (em) em.hidden = shown > 0;
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { chips.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); c.setAttribute('aria-pressed', 'true'); applyFilter(); }); });
  if (findIn) findIn.addEventListener('input', applyFilter);
  if (chips.length && location.hash) { var h = location.hash.slice(1); var c0 = chips.filter(function (c) { return c.dataset.filter === h; })[0]; if (c0) c0.click(); }

  /* AI assistant */
  var aiBtn = $('#aiBtn'), aiPanel = $('#aiPanel');
  if (aiBtn && aiPanel) {
    var body = $('#aiBody'), input = $('#aiInput'), send = $('#aiSend');
    var WORKER = aiPanel.getAttribute('data-endpoint');
    aiBtn.addEventListener('click', function () { aiPanel.hidden = !aiPanel.hidden; aiBtn.setAttribute('aria-expanded', String(!aiPanel.hidden)); if (!aiPanel.hidden) input.focus(); });
    $('#aiClose').addEventListener('click', function () { aiPanel.hidden = true; aiBtn.setAttribute('aria-expanded', 'false'); });
    function add(text, who) { var d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
    function ask(q) {
      q = (q || '').trim(); if (!q) return;
      add(q, 'me'); input.value = '';
      var wait = add(aiPanel.getAttribute('data-wait'), 'bot');
      fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userMessage: (document.body.getAttribute('data-tool') ? '[' + document.body.getAttribute('data-tool') + '] ' : '') + q }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { wait.textContent = (d && d.reply) || aiPanel.getAttribute('data-fail'); })
        .catch(function () { wait.textContent = aiPanel.getAttribute('data-fail'); });
    }
    send.addEventListener('click', function () { ask(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(input.value); });
    $$('[data-ask]', aiPanel).forEach(function (b) { b.addEventListener('click', function () { ask(b.textContent); }); });
  }

  /* contact form → WhatsApp */
  var cf = $('#contactForm');
  if (cf) cf.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(cf), txt = [f.get('topic'), '', f.get('message'), '', '— ' + f.get('name') + (f.get('org') ? ', ' + f.get('org') : '') + (f.get('email') ? ' · ' + f.get('email') : '')].join('\n');
    var url = 'https://wa.me/' + cf.getAttribute('data-wa') + '?text=' + encodeURIComponent(txt);
    var out = $('#contactOut'); out.hidden = false;
    $('#waLink', out).setAttribute('href', url);
    window.open(url, '_blank', 'noopener');
  });

  /* simple notice forms (login, verify) */
  $$('form[data-notice]').forEach(function (fm) {
    fm.addEventListener('submit', function (e) { e.preventDefault(); var n = document.getElementById(fm.getAttribute('data-notice')); if (n) { n.hidden = false; n.focus && n.focus(); } });
  });

  /* copy buttons */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy'), done = function () { var o = b.innerHTML; b.textContent = b.getAttribute('data-done') || '✓'; setTimeout(function () { b.innerHTML = o; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done); else done();
    });
  });

  /* signed-in user chip */
  (function () {
    var sess = null; try { sess = JSON.parse(localStorage.getItem('shandal_session') || 'null'); } catch (e) {}
    if (sess && sess.exp && sess.exp < Date.now()) sess = null;
    var wrap = $('[data-user]'), signin = $('[data-signin]');
    if (!wrap) return;
    if (sess && sess.name) {
      wrap.hidden = false; if (signin) signin.hidden = true;
      var parts = String(sess.name).trim().split(/\s+/);
      $('.av', wrap).textContent = (parts[0] || '?').charAt(0) + (parts[1] ? parts[1].charAt(0) : '');
      $('.nm', wrap).textContent = parts.slice(0, 2).join(' ');
      $('.who-n', wrap).textContent = sess.name;
      var dt = new Date(sess.exp); $('.who-x', wrap).textContent = (lang === 'ar' ? 'حتى ' : 'until ') + dt.toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
      var btn = $('.user-chip', wrap), menu = $('.user-menu', wrap);
      btn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
      document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
      $('[data-logout]', wrap).addEventListener('click', function () { try { localStorage.removeItem('shandal_session'); } catch (e) {} location.reload(); });
    }
  })();

  /* year */
  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
})();
/* sign-out buttons outside the header menu */
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-logout]'); if (!b || b.closest('.user-menu')) return; try { localStorage.removeItem('shandal_session'); } catch (x) {} location.reload(); });

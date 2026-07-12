document.documentElement.classList.add('js');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------
   Unified scroll loop: hero image parallax + cinematic pinned scene
   ------------------------------------------------------------------ */
function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
let ticking = false;

/* ------------------------------------------------------------------
   Hero image parallax
   ------------------------------------------------------------------ */
const heroMedia = document.querySelector('.hero-media');
function render() {
  ticking = false;
  if (heroMedia && !reduceMotion) {
    const vh = window.innerHeight;
    const r = heroMedia.getBoundingClientRect();
    const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
    heroMedia.style.transform = `translateY(${((1 - p) * 40).toFixed(1)}px) scale(${(0.94 + p * 0.06).toFixed(3)})`;
  }
}
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }
if (!reduceMotion && heroMedia) {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  render();
}

/* ------------------------------------------------------------------
   Screenshot carousel: arrows, clickable dots, auto-advance every 5s
   ------------------------------------------------------------------ */
const carousel = document.querySelector('[data-pin]');
const pheads = carousel ? Array.from(carousel.querySelectorAll('.phead')) : [];
const slides = carousel ? Array.from(carousel.querySelectorAll('.slideimg')) : [];
const dots = carousel ? Array.from(carousel.querySelectorAll('.pdot')) : [];

if (carousel && slides.length) {
  carousel.classList.add('scrolly-on');
  const n = slides.length;
  let active = 0;
  let timer = null;
  const AUTO_MS = 5000;

  // initial layout: screen 0 centered, the rest parked off to the right
  slides.forEach((s, i) => {
    s.style.transition = 'none';
    s.style.transform = i === 0 ? 'translateX(0)' : 'translateX(102%)';
  });
  void carousel.offsetWidth;
  slides.forEach((s) => (s.style.transition = ''));

  function mark(idx) {
    pheads.forEach((h, i) => h.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('on', i === idx));
    slides.forEach((s, i) => s.classList.toggle('current', i === idx));
  }
  mark(0);

  // slide to idx; dir = +1 (incoming from right) or -1 (incoming from left)
  function slideTo(idx, dir) {
    if (idx === active) return;
    slides.forEach((s, i) => {
      if (i === active) return;
      s.style.transition = 'none';
      s.style.transform = `translateX(${dir * 102}%)`; // park off the entering side
    });
    void slides[idx].offsetWidth; // reflow so the next transform animates
    slides.forEach((s) => (s.style.transition = ''));
    slides[active].style.transform = `translateX(${-dir * 102}%)`;
    slides[idx].style.transform = 'translateX(0)';
    active = idx;
    mark(idx);
  }

  function go(dir) { slideTo((active + dir + n) % n, dir); }
  function goTo(i) { if (i !== active) slideTo(i, i > active ? 1 : -1); }

  function startAuto() {
    if (reduceMotion) return;
    stopAuto();
    timer = setInterval(() => go(1), AUTO_MS);
  }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  function restart() { stopAuto(); startAuto(); }

  const prevBtn = carousel.querySelector('.car-prev');
  const nextBtn = carousel.querySelector('.car-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { go(-1); restart(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { go(1); restart(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); restart(); }));

  // pause while hovered or focused, and when the tab is hidden
  const stage = carousel.querySelector('.pin-stage');
  stage.addEventListener('mouseenter', stopAuto);
  stage.addEventListener('mouseleave', startAuto);
  stage.addEventListener('focusin', stopAuto);
  stage.addEventListener('focusout', startAuto);
  document.addEventListener('visibilitychange', () => (document.hidden ? stopAuto() : startAuto()));

  startAuto();
}

/* ------------------------------------------------------------------
   Scroll reveal for the lighter sections
   ------------------------------------------------------------------ */
if (!reduceMotion && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => io.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
}

/* ------------------------------------------------------------------
   Installation tabs
   ------------------------------------------------------------------ */
const tabs = document.querySelectorAll('.tab');
tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.hidden = p.id !== btn.dataset.panel;
    });
  });
});
const ua = navigator.userAgent;
const tabWin = document.getElementById('tab-windows');
const tabLinux = document.getElementById('tab-linux');
if (/Windows/i.test(ua) && tabWin) tabWin.click();
else if (/Linux/i.test(ua) && !/Android/i.test(ua) && tabLinux) tabLinux.click();

/* ------------------------------------------------------------------
   Point download buttons at the newest GitHub release
   ------------------------------------------------------------------ */
const REPO = 'AyanaayaW/litranite-releases';
fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
  .then((r) => (r.ok ? r.json() : null))
  .then((rel) => {
    if (!rel || !rel.assets) return;
    const find = (re) => rel.assets.find((a) => re.test(a.name));
    const links = {
      'dl-win': /setup\.exe$/,
      'dl-mac-arm': /aarch64\.dmg$/,
      'dl-mac-intel': /x64\.dmg$/,
      'dl-linux': /\.AppImage$/,
      'dl-deb': /\.deb$/,
      'dl-rpm': /\.rpm$/,
    };
    for (const [id, re] of Object.entries(links)) {
      const el = document.getElementById(id);
      const asset = find(re);
      if (el && asset) el.href = asset.browser_download_url;
    }
    document.querySelectorAll('.js-version').forEach((el) => { el.textContent = rel.tag_name; });
    syncSmart();
  })
  .catch(() => {});

/* ------------------------------------------------------------------
   Copy-to-clipboard (install pages)
   ------------------------------------------------------------------ */
document.querySelectorAll('.cmd-copy').forEach((btn) => {
  btn.addEventListener('click', () => {
    const text = btn.getAttribute('data-copy') || '';
    const done = () => {
      const label = btn.textContent;
      btn.textContent = 'Copied ✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else { fallbackCopy(text, done); }
  });
});
function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta); cb();
}

/* ------------------------------------------------------------------
   Day / night reading toggle
   ------------------------------------------------------------------ */
const root = document.documentElement;
function setTheme(t) {
  root.setAttribute('data-theme', t);
  try { localStorage.setItem('litranite-theme', t); } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#191410' : '#f4ece0');
}
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
}

/* ------------------------------------------------------------------
   Smart, OS-aware download button
   ------------------------------------------------------------------ */
function detectOS() {
  const u = navigator.userAgent;
  if (/Mac/i.test(u) && !/iPhone|iPad|iPod/i.test(u)) return 'mac';
  if (/Win/i.test(u)) return 'windows';
  if (/Linux/i.test(u) && !/Android/i.test(u)) return 'linux';
  if (/iPhone|iPad|iPod|Android/i.test(u)) return 'mobile';
  return null;
}
const OS = detectOS();
const PRIMARY = { mac: 'dl-mac-arm', windows: 'dl-win', linux: 'dl-linux' };
const OS_LABEL = { mac: 'Download for macOS', windows: 'Download for Windows', linux: 'Download for Linux' };
const OS_GUIDE = { mac: 'mac.html', windows: 'windows.html', linux: 'linux.html' };
function syncSmart() {
  // Every primary download CTA opens the matching install guide (which holds
  // the real download + first-run steps), per the desired flow.
  const sd = document.getElementById('smart-download');
  const sg = document.getElementById('smart-guide');
  const hd = document.getElementById('hero-download');
  if (OS && OS !== 'mobile') {
    if (sd) { sd.href = OS_GUIDE[OS]; sd.textContent = OS_LABEL[OS]; }
    if (hd) { hd.href = OS_GUIDE[OS]; hd.textContent = OS_LABEL[OS]; }
    if (sg) { sg.href = '#platforms'; sg.textContent = 'or choose another platform ↓'; }
  } else {
    if (sd) sd.href = '#platforms';
    if (hd) hd.href = '#download';
    if (sg) { sg.href = '#platforms'; sg.textContent = 'choose your platform ↓'; }
  }
}
syncSmart();

/* ------------------------------------------------------------------
   Hand-drawn underline: draw in when the heading scrolls into view
   ------------------------------------------------------------------ */
const ulines = document.querySelectorAll('[data-underline]');
if ('IntersectionObserver' in window && !reduceMotion) {
  const uo = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('uline-in'); uo.unobserve(e.target); } });
  }, { threshold: 0.6 });
  ulines.forEach((el) => uo.observe(el));
} else {
  ulines.forEach((el) => el.classList.add('uline-in'));
}

/* ------------------------------------------------------------------
   Interactive reader demo — select a word to DEFINE it (book popover),
   or a line to SAVE it as a quote. Fills a live vocab bank + quotes,
   just like the real app.
   ------------------------------------------------------------------ */
const demo = document.getElementById('demo-text');
if (demo) {
  /* passages across subjects & ages — the "shuffle" button cycles them */
  const PASSAGES = [
    {
      file: 'Pride & Prejudice.pdf — p.1', page: 'p.1',
      paras: [
        'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.'
      ],
      dict: {
        universally: 'in a way that applies to everyone; without exception',
        acknowledged: 'accepted or admitted to be true',
        fortune: 'a large amount of money, property, or assets',
        possession: 'the state of having or owning something',
        neighbourhood: 'a district or community within a town',
        feelings: 'emotional responses or sensibilities',
        property: 'a thing or things belonging to someone',
        fixed: 'firmly established and unlikely to change',
        considered: 'thought about carefully; regarded as'
      }
    },
    {
      file: 'Emily Dickinson — Hope.pdf', page: 'p.1',
      paras: [
        '“Hope” is the thing with feathers — that perches in the soul,',
        'and sings the tune without the words, and never stops at all.'
      ],
      dict: {
        hope: 'a feeling of expectation and desire for a thing to happen',
        feathers: 'the light structures that cover a bird',
        perches: 'settles or rests on a high point',
        soul: 'the spiritual or emotional core of a person',
        tune: 'a melody or air'
      }
    },
    {
      file: 'Biology — Photosynthesis.pdf — p.4', page: 'p.4',
      paras: [
        'Photosynthesis is the process by which green plants turn sunlight into chemical energy.',
        'Using chlorophyll, a leaf absorbs light and converts carbon dioxide and water into glucose and oxygen.'
      ],
      dict: {
        photosynthesis: 'the process plants use to turn light into energy',
        chlorophyll: 'the green pigment in plants that captures light',
        absorbs: 'takes in or soaks up',
        converts: 'changes something into a different form',
        glucose: 'a simple sugar that stores energy',
        oxygen: 'the gas that living things breathe'
      }
    },
    {
      file: 'Weeknight Pasta.txt', page: 'p.1',
      paras: [
        'Bring a large pot of salted water to a rolling boil, then add the pasta.',
        'Cook until just tender, reserve a cup of the starchy water, and drain the rest.'
      ],
      dict: {
        salted: 'seasoned with salt',
        boil: 'the point at which water bubbles and turns to vapour',
        tender: 'soft and easy to bite through',
        reserve: 'set something aside to use later',
        starchy: 'containing starch, like pasta or potatoes',
        drain: 'let liquid run off'
      }
    }
  ];
  let pIdx = 0;
  let DICT = PASSAGES[0].dict;
  let PAGE = PASSAGES[0].page;

  const COLORS = { amber: 'rgba(233,196,106,.62)', rose: 'rgba(232,153,141,.55)', green: 'rgba(163,177,138,.6)' };
  let current = 'amber';

  const vocabList = document.getElementById('vocab-list');
  const quoteList = document.getElementById('quote-list');
  const vocabCount = document.getElementById('vocab-count');
  const quoteCount = document.getElementById('quote-count');
  const hint = document.getElementById('demo-hint');
  const cta = document.getElementById('reader-cta');
  const fileEl = document.getElementById('reader-file');
  const shuffleBtn = document.getElementById('reader-shuffle');
  const seen = new Set();
  let nQuote = 0, nVocab = 0, acted = false, userActed = false, celebrated = false;
  let savedRange = null;

  /* ---- floating annotation toolbar (built once) ---- */
  const bar = document.createElement('div');
  bar.className = 'sel-bar';
  bar.innerHTML =
    '<button class="sb-sw on" type="button" data-c="amber" style="--sw:#e9c46a" aria-label="Amber"></button>' +
    '<button class="sb-sw" type="button" data-c="rose" style="--sw:#e8998d" aria-label="Rose"></button>' +
    '<button class="sb-sw" type="button" data-c="green" style="--sw:#a3b18a" aria-label="Green"></button>' +
    '<span class="sb-div"></span>' +
    '<button class="sb-act sb-define" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5z"/></svg>Define</button>' +
    '<button class="sb-act sb-quote" type="button"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 6.2c-2 .9-3.3 2.8-3.3 5.3V18h5.6v-5.6H6.9c0-1.7.8-2.8 2.3-3.4zM16.5 6.2c-2 .9-3.3 2.8-3.3 5.3V18h5.6v-5.6h-2.9c0-1.7.8-2.8 2.3-3.4z"/></svg>Save quote</button>';
  document.body.appendChild(bar);
  bar.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive

  bar.querySelectorAll('.sb-sw').forEach((s) => {
    s.addEventListener('click', () => {
      bar.querySelectorAll('.sb-sw').forEach((x) => x.classList.remove('on'));
      s.classList.add('on'); current = s.dataset.c;
    });
  });
  bar.querySelector('.sb-define').addEventListener('click', doDefine);
  bar.querySelector('.sb-quote').addEventListener('click', doQuote);

  function showBar(range, isWord) {
    savedRange = range.cloneRange();
    bar.classList.toggle('word', isWord);
    const r = range.getBoundingClientRect();
    bar.style.left = (r.left + r.width / 2 + window.scrollX) + 'px';
    bar.style.top = (r.top + window.scrollY) + 'px';
    bar.classList.add('show');
  }
  function hideBar() { bar.classList.remove('show'); savedRange = null; }

  /* ---- panel helpers ---- */
  function markActed() { if (acted) return; acted = true; if (cta) cta.classList.add('gone'); if (hint) { hint.classList.add('done'); hint.textContent = '✓ nice — it saved to your panel. keep going.'; } }
  function setCount(el, n) { if (el) el.textContent = n ? String(n) : ''; }

  function linkToSource(li, mark) {
    if (!mark) return;
    li.setAttribute('data-linked', '');
    li.title = 'hover to find it in the text';
    li.addEventListener('mouseenter', () => {
      if (!mark.isConnected) return;
      mark.classList.remove('pulse'); void mark.offsetWidth; mark.classList.add('pulse');
    });
    li.addEventListener('mouseleave', () => mark.classList.remove('pulse'));
  }
  function addVocab(word, def, mark) {
    const key = word.toLowerCase();
    if (seen.has('v:' + key)) return false;
    seen.add('v:' + key);
    const empty = vocabList.querySelector('.rp-empty'); if (empty) empty.remove();
    const li = document.createElement('li');
    li.className = 'rp-item vocab-item';
    li.innerHTML = '<span class="rp-word"></span><span class="rp-def"></span>';
    li.querySelector('.rp-word').textContent = word;
    li.querySelector('.rp-def').textContent = def;
    linkToSource(li, mark);
    vocabList.appendChild(li);
    requestAnimationFrame(() => li.classList.add('in'));
    setCount(vocabCount, ++nVocab); markActed(); maybeCelebrate();
    return true;
  }
  function addQuote(text, mark) {
    const empty = quoteList.querySelector('.rp-empty'); if (empty) empty.remove();
    const li = document.createElement('li');
    li.className = 'rp-item quote-item';
    li.innerHTML = '<span class="rp-quote"></span><span class="rp-page"></span>';
    li.querySelector('.rp-quote').textContent = '“' + text + '”';
    li.querySelector('.rp-page').textContent = PAGE;
    linkToSource(li, mark);
    quoteList.appendChild(li);
    requestAnimationFrame(() => li.classList.add('in'));
    setCount(quoteCount, ++nQuote); markActed(); maybeCelebrate();
  }
  function maybeCelebrate() {
    if (celebrated || nVocab < 1 || nQuote < 1) return;
    celebrated = true;
    const rd = document.querySelector('.reader-demo');
    if (!rd) return;
    const r = rd.getBoundingClientRect();
    const x = r.left + r.width * 0.72 + window.scrollX;
    const y = r.top + r.height * 0.42 + window.scrollY;
    if (!reduceMotion) inkBurst(x, y);
    setTimeout(() => popNote(x, r.top + r.height * 0.3 + window.scrollY, 'that’s the whole workflow ✨'), 120);
  }
  function inkBurst(x, y) {
    const colors = ['#c15f38', '#d9a24c', '#e9c46a', '#a3b18a', '#e8998d'];
    const wrap = document.createElement('div');
    wrap.className = 'ink-burst';
    wrap.style.left = x + 'px'; wrap.style.top = y + 'px';
    document.body.appendChild(wrap);
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('span');
      d.className = 'ink-dot';
      const s = 5 + Math.random() * 7;
      d.style.width = d.style.height = s + 'px';
      d.style.background = colors[i % colors.length];
      wrap.appendChild(d);
      const ang = Math.random() * Math.PI * 2;
      const dist = 45 + Math.random() * 95;
      const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist - 24;
      d.style.transition = 'transform .95s cubic-bezier(.2,.7,.2,1), opacity .95s ease';
      requestAnimationFrame(() => { d.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + (0.3 + Math.random() * 0.8) + ')'; d.style.opacity = '0'; });
    }
    setTimeout(() => wrap.remove(), 1150);
  }
  function popNote(pageX, pageY, msg) {
    const el = document.createElement('div');
    el.className = 'note-pop';
    el.textContent = msg;
    document.body.appendChild(el);
    el.style.left = pageX + 'px';
    el.style.top = pageY + 'px';
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 450); }, 1500);
  }
  function insideMark(node) {
    let n = node.nodeType === 1 ? node : node.parentNode;
    while (n && n !== demo) { if (n.nodeName === 'MARK') return true; n = n.parentNode; }
    return false;
  }
  function applyHighlight(range, kind) {
    const mark = document.createElement('mark');
    mark.className = 'hl' + (kind === 'vocab' ? ' vocabmark' : '');
    mark.style.setProperty('--hl', COLORS[current] || COLORS.amber);
    try { range.surroundContents(mark); }
    catch (e) { mark.appendChild(range.extractContents()); range.insertNode(mark); }
    return mark;
  }
  function rangeCenter(range) { const r = range.getBoundingClientRect(); return [r.left + r.width / 2 + window.scrollX, r.top + window.scrollY]; }
  function clearSelection() { const s = window.getSelection(); if (s) s.removeAllRanges(); }

  function doDefine() {
    if (!savedRange) return;
    const word = savedRange.toString().replace(/[^A-Za-z]/g, '');
    const def = DICT[word.toLowerCase()] || 'a word worth keeping — saved with its sentence';
    const [cx, cy] = rangeCenter(savedRange);
    const mark = applyHighlight(savedRange, 'vocab');
    if (addVocab(word, def, mark)) popNote(cx, cy, 'Added to vocab ✓');
    clearSelection(); hideBar();
  }
  function doQuote() {
    if (!savedRange) return;
    let text = savedRange.toString().replace(/\s+/g, ' ').trim();
    const [cx, cy] = rangeCenter(savedRange);
    const mark = applyHighlight(savedRange, null);
    addQuote(text.length > 72 ? text.slice(0, 70) + '…' : text, mark);
    popNote(cx, cy, 'Quote saved ✓');
    clearSelection(); hideBar();
  }

  /* ---- shuffle to a different passage (subject / age agnostic) ---- */
  function loadPassage(i) {
    const p = PASSAGES[i];
    DICT = p.dict; PAGE = p.page;
    if (fileEl) fileEl.textContent = p.file;
    demo.replaceChildren.apply(demo, p.paras.map((t) => { const el = document.createElement('p'); el.textContent = t; return el; }));
    vocabList.innerHTML = '<li class="rp-empty">select a word →</li>';
    quoteList.innerHTML = '<li class="rp-empty">select a line →</li>';
    nVocab = 0; nQuote = 0; celebrated = false; seen.clear();
    setCount(vocabCount, 0); setCount(quoteCount, 0);
    hideBar();
    if (hint) { hint.classList.remove('done'); hint.innerHTML = 'Select a <b>word</b> → tap the book to define it. Select a <b>line</b> → save it as a quote.'; }
  }
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => { userActed = true; pIdx = (pIdx + 1) % PASSAGES.length; loadPassage(pIdx); });
  }

  /* ---- user selection ---- */
  demo.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!demo.contains(range.commonAncestorContainer)) return;
      if (insideMark(range.startContainer) || insideMark(range.endContainer)) return;
      const text = range.toString().replace(/\s+/g, ' ').trim();
      if (!text) return;
      userActed = true;
      const isWord = text.split(' ').length === 1 && /[A-Za-z]/.test(text);
      showBar(range, isWord);
    }, 0);
  });

  document.addEventListener('mousedown', (e) => { if (!bar.contains(e.target) && !demo.contains(e.target)) hideBar(); });
  window.addEventListener('scroll', () => { if (bar.classList.contains('show')) hideBar(); }, { passive: true });

  /* ---- auto-demo: show the toolbar, then perform the action ---- */
  function autoRange(phrase) {
    const walk = document.createTreeWalker(demo, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walk.nextNode())) {
      const i = node.nodeValue.indexOf(phrase);
      if (i >= 0) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + phrase.length); return r; }
    }
    return null;
  }
  if (!reduceMotion) {
    setTimeout(() => {
      if (userActed) return;
      const r = autoRange('a single man in possession of a good fortune');
      if (r) { showBar(r, false); setTimeout(() => { if (!userActed) doQuote(); }, 1000); }
    }, 1500);
    setTimeout(() => {
      if (userActed || nVocab > 0) return;
      const r = autoRange('universally');
      if (r) { showBar(r, true); setTimeout(() => { if (!userActed) doDefine(); }, 1100); }
    }, 3600);
  }
}

/* ------------------------------------------------------------------
   Feature showcase — tabbed, big screenshots, autoplay
   ------------------------------------------------------------------ */
(function () {
  const tabs = Array.from(document.querySelectorAll('.feature-tab'));
  const slides = Array.from(document.querySelectorAll('.feature-slide'));
  const bar = document.querySelector('.fp-bar');
  const section = document.querySelector('.showcase');
  if (!tabs.length || !slides.length) return;
  const AUTO = 5000;
  let idx = 0, timer = null;

  function restartBar() {
    if (!bar || reduceMotion) return;
    bar.classList.remove('run');
    bar.style.width = '0';
    void bar.offsetWidth;               // reflow so the transition replays
    bar.style.setProperty('--fp-dur', (AUTO / 1000) + 's');
    bar.classList.add('run');
  }
  function show(i) {
    idx = i;
    tabs.forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', String(k === i)); });
    slides.forEach((s, k) => s.classList.toggle('on', k === i));
    restartBar();
  }
  function next() { show((idx + 1) % slides.length); }
  function start() { if (reduceMotion) return; stop(); restartBar(); timer = setInterval(next, AUTO); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  tabs.forEach((t, k) => t.addEventListener('click', () => { show(k); start(); }));
  if (section) {
    section.addEventListener('mouseenter', stop);
    section.addEventListener('mouseleave', start);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  show(0);
  start();
})();

/* ------------------------------------------------------------------
   Reading progress bar (fills as you scroll the page)
   ------------------------------------------------------------------ */
(function () {
  const bar = document.querySelector('.read-progress span');
  if (!bar) return;
  const doc = document.documentElement;
  let raf = false;
  function upd() {
    raf = false;
    const max = doc.scrollHeight - doc.clientHeight;
    bar.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', () => { if (!raf) { raf = true; requestAnimationFrame(upd); } }, { passive: true });
  window.addEventListener('resize', upd);
  upd();
})();

/* ------------------------------------------------------------------
   Little delight: flip the book logo when tapped
   ------------------------------------------------------------------ */
document.querySelectorAll('.logo').forEach((logo) => {
  logo.addEventListener('click', () => {
    const m = logo.querySelectorAll('.logo-mark');
    m.forEach((el) => { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); });
  });
});

/* ------------------------------------------------------------------
   Story comes alive — highlighter sweeps + handwritten margin notes
   light up as the section scrolls into view
   ------------------------------------------------------------------ */
(function () {
  const sweeps = Array.from(document.querySelectorAll('.sweep'));
  const notes = Array.from(document.querySelectorAll('.margin-note'));
  if (!sweeps.length && !notes.length) return;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    sweeps.forEach((s) => s.classList.add('lit'));
    notes.forEach((n) => n.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const delay = parseInt(el.dataset.delay || '0', 10);
      const cls = el.classList.contains('sweep') ? 'lit' : 'in';
      setTimeout(() => el.classList.add(cls), delay);
      io.unobserve(el);
    });
  }, { threshold: 0.55 });
  sweeps.forEach((s, i) => { s.dataset.delay = String(i * 280); io.observe(s); });
  notes.forEach((n, i) => { n.dataset.delay = String(400 + i * 260); io.observe(n); });
})();

/* ------------------------------------------------------------------
   Hero: light up "closely" once the page settles
   ------------------------------------------------------------------ */
(function () {
  const hl = document.querySelector('.hero-hl');
  if (!hl) return;
  if (reduceMotion) { hl.classList.add('lit'); return; }
  setTimeout(() => hl.classList.add('lit'), 1150);
})();

/* ------------------------------------------------------------------
   Scroll-aware nav (condenses after you scroll)
   ------------------------------------------------------------------ */
(function () {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let raf = false;
  function upd() { raf = false; nav.classList.toggle('scrolled', window.scrollY > 16); }
  window.addEventListener('scroll', () => { if (!raf) { raf = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
})();

/* ------------------------------------------------------------------
   Hero typewriter — cycle the audience word
   ------------------------------------------------------------------ */
(function () {
  const el = document.getElementById('type-rot');
  if (!el) return;
  const words = ['students', 'teachers', 'researchers', 'lifelong readers', 'curious minds', 'parents', 'everyone'];
  if (reduceMotion) { el.textContent = 'everyone'; return; }
  let wi = 0, ci = 0, deleting = false;
  function tick() {
    const w = words[wi];
    if (!deleting) {
      ci++; el.textContent = w.slice(0, ci);
      if (ci === w.length) { deleting = true; return setTimeout(tick, 1500); }
      setTimeout(tick, 68 + Math.random() * 52);
    } else {
      ci--; el.textContent = w.slice(0, ci);
      if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; return setTimeout(tick, 320); }
      setTimeout(tick, 38);
    }
  }
  setTimeout(tick, 1000);
})();

/* ------------------------------------------------------------------
   Easter egg — the Konami code rains books & highlighters
   ------------------------------------------------------------------ */
(function () {
  const seq = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
  let pos = 0;
  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    if (k === seq[pos]) { pos++; if (pos === seq.length) { pos = 0; bookRain(); } }
    else { pos = (k === seq[0]) ? 1 : 0; }
  });
  function bookRain() {
    if (reduceMotion || !document.body.animate) return;
    const emojis = ['📖', '✨', '🖍️', '📚', '✍️', '🔖', '📝'];
    for (let i = 0; i < 36; i++) {
      const s = document.createElement('span');
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.cssText = 'position:fixed;top:-48px;z-index:9998;pointer-events:none;font-size:' + (20 + Math.random() * 24) + 'px;left:' + (Math.random() * 100) + 'vw;will-change:transform;';
      document.body.appendChild(s);
      const dur = 2400 + Math.random() * 2000;
      const rot = Math.random() * 720 - 360;
      const anim = s.animate(
        [{ transform: 'translateY(0) rotate(0deg)', opacity: 1 },
         { transform: 'translateY(' + (window.innerHeight + 90) + 'px) rotate(' + rot + 'deg)', opacity: 0.85 }],
        { duration: dur, easing: 'cubic-bezier(.4,.1,.6,1)', delay: Math.random() * 500 }
      );
      anim.onfinish = () => s.remove();
    }
  }
})();

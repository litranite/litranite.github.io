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

// A release whose build failed can exist with no installers attached — that
// happened once and emptied every download button on the site. So: take the
// newest release that actually carries installers, not simply the newest.
function hasInstallers(rel) {
  return !!(rel && rel.assets || []).length &&
    rel.assets.some((a) => /\.(dmg|exe|AppImage|deb|rpm)$/i.test(a.name));
}
fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
  .then((r) => (r.ok ? r.json() : null))
  .then((rel) => (hasInstallers(rel) ? rel
    : fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => (Array.isArray(list) ? list.filter((x) => !x.draft && hasInstallers(x))[0] : null))))
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
    [['file-arm', 'dl-mac-arm'], ['file-intel', 'dl-mac-intel'], ['file-linux', 'dl-linux']].forEach(([fid, lid]) => {
      const f = document.getElementById(fid), l = document.getElementById(lid);
      if (f && l && /\.(dmg|AppImage)$/.test(l.href)) f.textContent = decodeURIComponent(l.href.split('/').pop());
    });
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
   Themes — the app's nine palettes, offered quietly: the sun/moon button
   in the nav, one dot in the demo's window bar, a line in the FAQ, and
   the wax seal at the foot of the page.
   ------------------------------------------------------------------ */
const root = document.documentElement;
const DARK_THEMES = ['dark', 'serif-dark', 'amoled', 'nord', 'catppuccin', 'everforest'];
const THEME_NAMES = { light: 'Light', dark: 'Dark', 'serif-light': 'Serif Light', 'serif-dark': 'Serif Dark',
  amoled: 'AMOLED', nord: 'Nord', blush: 'Blush', catppuccin: 'Catppuccin', everforest: 'Everforest' };
let setTheme = () => {};
(function () {
  const ALL = Object.keys(THEME_NAMES);
  let toastEl = null, toastTimer = null;

  function say(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'theme-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = msg;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  setTheme = function (t, note) {
    root.setAttribute('data-theme', t);
    root.setAttribute('data-scheme', DARK_THEMES.includes(t) ? 'dark' : 'light');
    try { localStorage.setItem('litranite-theme', t); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim());
    if (note) say(note.replace('%s', '<b>' + THEME_NAMES[t] + '</b>'));
  };

  // nav: day <-> night, staying in the spirit of the palette you're on
  const PAIRS = { light: 'dark', dark: 'light', 'serif-light': 'serif-dark', 'serif-dark': 'serif-light',
    amoled: 'light', nord: 'light', catppuccin: 'light', everforest: 'light', blush: 'dark' };
  document.querySelectorAll('.theme-toggle').forEach((t) =>
    t.addEventListener('click', () => setTheme(PAIRS[root.getAttribute('data-theme')] || 'light')));

  // the demo's window bar: step through the nine, the way the app does
  const one = document.getElementById('peb-one');
  if (one) one.addEventListener('click', () => {
    const next = ALL[(ALL.indexOf(root.getAttribute('data-theme')) + 1) % ALL.length];
    setTheme(next, '%s — one of nine themes, same as the app');
  });

  // FAQ: named themes you can try mid-sentence
  document.querySelectorAll('.faq-peb').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.t, 'This is %s. The app has all nine.')));

  // the wax seal: a surprise one
  const seal = document.getElementById('wax-seal');
  if (seal) seal.addEventListener('click', () => {
    const others = ALL.filter((t) => t !== root.getAttribute('data-theme'));
    setTheme(others[Math.floor(Math.random() * others.length)], '%s — the app ships with nine of these');
  });

  setTheme(root.getAttribute('data-theme') || 'light');
})();

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
  const words = ['students', 'IB students', 'teachers', 'researchers', 'lifelong readers', 'curious minds', 'parents', 'everyone'];
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

/* ------------------------------------------------------------------
   "Who it's for" — build the scrolling role marquees
   ------------------------------------------------------------------ */
(function () {
  var r1 = [['📚','Students'],['👩‍🏫','Teachers'],['🔬','Researchers'],['👨‍👩‍👧','Parents'],['📖','Book clubs'],['🗣️','Language learners'],['⚖️','Lawyers'],['🩺','Doctors'],['🎬','Screenwriters'],['📰','Journalists'],['🕯️','Poets']];
  var r2 = [['🗺️','Historians'],['✍️','Writers'],['🎓','PhD candidates'],['🌙','Night-owl readers'],['🏡','Homeschoolers'],['✏️','Editors'],['💡','Curious minds'],['🎯','Debaters'],['🧠','Philosophers'],['☕','Retirees'],['✦','you']];
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function build(id, items) {
    var el = document.getElementById(id);
    if (!el) return;
    var html = items.map(function (it) {
      var you = it[1] === 'you' ? ' you' : '';
      return '<span class="chip' + you + '"><span class="em">' + it[0] + '</span>' + esc(it[1]) + '</span>';
    }).join('');
    el.innerHTML = html + html; // duplicate for a seamless loop
  }
  build('mrow1', r1);
  build('mrow2', r2);
})();

/* ------------------------------------------------------------------
   "Who it's for" cards — tap a tag (or the card) to flip it over and
   play a tiny demo of exactly that feature
   ------------------------------------------------------------------ */
(function () {
  const cards = Array.from(document.querySelectorAll('.who-card[data-role]'));
  if (!cards.length) return;

  // mind-map helper: nodes [label, x, y, main?], edges [a, b, label?]
  function map(nodes, edges) {
    let svg = '<svg viewBox="0 0 320 170" aria-hidden="true">';
    edges.forEach((e, i) => {
      const a = nodes[e[0]], b = nodes[e[1]];
      svg += '<path class="dm-edge" style="--d:' + (0.35 + i * 0.25) + 's" d="M' + a[1] + ' ' + a[2] + ' L' + b[1] + ' ' + b[2] + '"/>';
      if (e[2]) svg += '<text class="dm-lbl dm-node" style="--d:' + (0.6 + i * 0.25) + 's" x="' + (a[1] + b[1]) / 2 + '" y="' + ((a[2] + b[2]) / 2 - 6) + '">' + e[2] + '</text>';
    });
    nodes.forEach((n, i) => {
      const w = n[0].length * 7 + 22;
      svg += '<g class="dm-node' + (n[3] ? ' main' : '') + '" style="--d:' + (n[3] ? 0.1 : 0.3 + i * 0.25) + 's">' +
        '<rect x="' + (n[1] - w / 2) + '" y="' + (n[2] - 13) + '" width="' + w + '" height="26" rx="13"/>' +
        '<text x="' + n[1] + '" y="' + n[2] + '">' + n[0] + '</text></g>';
    });
    return '<div class="dm">' + svg + '</svg></div>';
  }

  const DEMOS = {
    'students-0': {
      cap: 'Select a line and it’s saved as a quote with its page number, ready for your essay.',
      html: '<div class="dm"><div class="dm-file">Macbeth.pdf · Act 1, p.3</div>' +
        '<p class="dm-text">When the hurlyburly’s done, when the battle’s lost and won… <mark class="dm-hl" style="--d:.4s">Fair is foul, and foul is fair</mark>: hover through the fog and filthy air.</p>' +
        '<div class="dm-quote pop" style="--d:1.2s">“Fair is foul, and foul is fair” <span class="dm-pg">p.3</span></div></div>'
    },
    'students-1': {
      cap: 'Tap a word you don’t know and it goes straight into your vocab bank to revise from.',
      html: '<div class="dm"><div class="dm-h">Vocabulary bank <span class="dm-n pop" style="--d:1.4s">3</span></div><ul class="dm-list">' +
        '<li class="pop" style="--d:.2s"><b>equivocate</b><span>speak vaguely to hide the truth</span></li>' +
        '<li class="pop" style="--d:.6s"><b>hubris</b><span>excessive pride or confidence</span></li>' +
        '<li class="pop" style="--d:1s"><b>soliloquy</b><span>a speech to oneself, alone on stage</span></li></ul></div>'
    },
    'students-2': {
      cap: 'Put characters and themes on a mind-map and draw the links between them.',
      html: map([['Macbeth', 160, 85, 1], ['Ambition', 58, 30], ['Guilt', 262, 30], ['Lady M.', 58, 142], ['Prophecy', 262, 142]],
        [[0, 1], [0, 2], [0, 3], [0, 4], [1, 3, 'fuels']])
    },
    'researchers-0': {
      cap: 'Highlight in colour and jot down thoughts as you read, right on the paper.',
      html: '<div class="dm"><div class="dm-file">Lee_2021_sleep-and-memory.pdf · p.12</div>' +
        '<p class="dm-text">Across three cohorts, <mark class="dm-hl" style="--d:.4s">sleep duration predicted recall more strongly than hours studied</mark>, <mark class="dm-hl" style="--d:1.1s;--hl:rgba(163,177,138,.6)">even after controlling for age</mark>.</p>' +
        '<div class="dm-note pop" style="--d:1.7s;margin-top:10px">↳ contradicts Patel (2019)? check methods</div></div>'
    },
    'researchers-1': {
      cap: 'Link findings across sources to see where they agree, and where they don’t.',
      html: map([['Hypothesis', 160, 85, 1], ['Lee 2021', 50, 28], ['Patel 2019', 270, 28], ['Survey data', 160, 150]],
        [[1, 0, 'supports'], [2, 0, 'contradicts'], [3, 0, 'supports']])
    },
    'researchers-2': {
      cap: 'Draft with your saved quotes and page numbers right beside you. No hunting back through PDFs.',
      html: '<div class="dm"><div class="dm-file">Draft · Literature review</div>' +
        '<p class="dm-text"><span class="dm-type" data-type="Recent work suggests that rest matters more than effort: "></span></p>' +
        '<div class="dm-quote pop" style="--d:2.2s">“sleep duration predicted recall more strongly” <span class="dm-cite">Lee, p.12</span></div></div>'
    },
    'teachers-0': {
      cap: 'Mark up the set text before class, so the lines you want to discuss are ready.',
      html: '<div class="dm"><div class="dm-file">Dickinson · Poem 479</div>' +
        '<p class="dm-text">Because I could not stop for Death –<br>He <mark class="dm-hl" style="--d:.4s;--hl:rgba(232,153,141,.55)">kindly</mark> stopped for me –<br>The Carriage held but just Ourselves –<br>And <mark class="dm-hl" style="--d:1s">Immortality</mark>.</p>' +
        '<div class="dm-note pop" style="--d:1.5s;margin-top:8px">ask: why “kindly”? tone shift →</div></div>'
    },
    'teachers-1': {
      cap: 'Keep a reading list for every class, with the texts themselves on the same shelf.',
      html: '<div class="dm"><div class="dm-h">Year 10 · Term 1 reading</div><ul class="dm-list">' +
        '<li class="dm-done" style="--d:.3s"><i class="dm-check" style="--d:.3s"></i><span>Macbeth, Acts 1–2</span></li>' +
        '<li class="dm-done" style="--d:.8s"><i class="dm-check" style="--d:.8s"></i><span>Of Mice and Men, ch. 1–3</span></li>' +
        '<li class="dm-done" style="--d:1.3s"><i class="dm-check" style="--d:1.3s"></i><span>War poetry anthology</span></li>' +
        '<li><i class="dm-check" style="--d:99s"></i><span>Unseen poetry practice</span></li></ul></div>'
    },
    'teachers-2': {
      cap: 'Every unit’s PDFs, notes and quote lists together in one searchable folder.',
      html: '<div class="dm"><div class="dm-h">📁 Unit 3 · War poetry</div><ul class="dm-list">' +
        '<li class="pop" style="--d:.2s"><b>📄</b><span>Dulce et Decorum Est.pdf</span></li>' +
        '<li class="pop" style="--d:.5s"><b>🖍️</b><span>Exposure, annotated</span></li>' +
        '<li class="pop" style="--d:.8s"><b>❝</b><span>Key quotes: 14 saved</span></li>' +
        '<li class="pop" style="--d:1.1s"><b>🗺️</b><span>Themes mind-map</span></li></ul></div>'
    },
    'booklovers-0': {
      cap: 'Jot down what you think as you read, and pick up right where you left off.',
      html: '<div class="dm"><div class="dm-file">Rebecca · Chapter 19</div>' +
        '<p class="dm-text"><span class="dm-type" data-type="Did NOT see that coming. For book club on Thursday: was she lying the whole time? 🤯"></span></p></div>'
    },
    'booklovers-1': {
      cap: 'Highlight the lines you love and find every one of them again in one place.',
      html: '<div class="dm"><div class="dm-file">Favourite lines</div><p class="dm-text">' +
        '<mark class="dm-hl" style="--d:.3s">So we beat on, boats against the current, borne back ceaselessly into the past.</mark><br>' +
        '<mark class="dm-hl" style="--d:1s;--hl:rgba(232,153,141,.55)">I am no bird; and no net ensnares me.</mark><br>' +
        '<mark class="dm-hl" style="--d:1.7s;--hl:rgba(163,177,138,.6)">I’m not afraid of storms, for I’m learning how to sail my ship.</mark></p></div>'
    },
    'booklovers-2': {
      cap: 'Everything is saved on your own computer. No account, no cloud, nothing uploaded.',
      html: '<div class="dm" style="text-align:center"><div class="pop" style="--d:.1s;font-size:44px;line-height:1.2">💻</div>' +
        '<div class="dm-h pop" style="--d:.3s;justify-content:center">Your library lives here.</div>' +
        '<div class="dm-badges"><span class="pop" style="--d:.6s">✓ works offline</span><span class="pop" style="--d:.9s">✓ no account</span><span class="pop" style="--d:1.2s">✓ 0 bytes uploaded</span></div></div>'
    }
  };

  function typeInto(el) {
    const text = el.getAttribute('data-type') || '';
    if (reduceMotion) { el.textContent = text; return; }
    const chars = Array.from(text);         // whole characters, so emoji never split
    let i = 0;
    (function step() {
      if (!el.isConnected) return;
      el.textContent = chars.slice(0, ++i).join('');
      if (i < chars.length) setTimeout(step, 28 + Math.random() * 30);
    })();
  }

  cards.forEach((card) => {
    const front = card.querySelector('.who-front');
    const tags = Array.from(card.querySelectorAll('.who-tag'));
    const role = card.querySelector('.who-front h3').textContent;

    const back = document.createElement('div');
    back.className = 'who-face who-back';
    back.setAttribute('aria-hidden', 'true');
    back.inert = true;
    back.innerHTML =
      '<div class="wb-top"><span class="wb-role"></span><button type="button" class="wb-close">↺ flip back</button></div>' +
      '<div class="wb-tabs" role="tablist"></div><div class="wb-stage"></div><p class="wb-cap"></p>';
    back.querySelector('.wb-role').textContent = role;
    const tabsEl = back.querySelector('.wb-tabs');
    const stage = back.querySelector('.wb-stage');
    const cap = back.querySelector('.wb-cap');
    const tabBtns = tags.map((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wb-tab'; b.setAttribute('role', 'tab');
      b.textContent = t.textContent; b.dataset.demo = t.dataset.demo;
      b.addEventListener('click', () => play(b.dataset.demo));
      tabsEl.appendChild(b);
      return b;
    });
    card.querySelector('.who-inner').appendChild(back);

    let lastTag = tags[0];
    function play(key) {
      const d = DEMOS[key];
      if (!d) return;
      stage.innerHTML = d.html;              // fresh nodes = animations replay
      cap.textContent = d.cap;
      stage.querySelectorAll('[data-type]').forEach((el) => setTimeout(() => typeInto(el), 350));
      tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.demo === key)));
    }
    function flip(open) {
      card.classList.toggle('flipped', open);
      front.inert = open; back.inert = !open;
      front.setAttribute('aria-hidden', String(open));
      back.setAttribute('aria-hidden', String(!open));
      if (open) setTimeout(() => back.querySelector('.wb-close').focus({ preventScroll: true }), 350);
      else if (lastTag) lastTag.focus({ preventScroll: true });
    }

    tags.forEach((t) => t.addEventListener('click', (e) => {
      e.stopPropagation(); lastTag = t; play(t.dataset.demo); flip(true);
    }));
    // clicking anywhere else on the front opens the first demo
    front.addEventListener('click', () => { lastTag = tags[0]; play(tags[0].dataset.demo); flip(true); });
    back.querySelector('.wb-close').addEventListener('click', () => flip(false));
    card.addEventListener('keydown', (e) => { if (e.key === 'Escape' && card.classList.contains('flipped')) flip(false); });
  });
})();

/* ------------------------------------------------------------------
   Partner announcement bar — dismiss, and remember it
   ------------------------------------------------------------------ */
(function () {
  const bar = document.getElementById('partner-bar');
  if (!bar) return;
  bar.querySelector('.pb-close').addEventListener('click', () => {
    bar.remove();
    try { localStorage.setItem('litranite-partner-bar', 'dismissed'); } catch (e) {}
  });
})();

/* ------------------------------------------------------------------
   Referral pass — keep the tear-off notches exactly on the perforation
   (side-by-side on desktop, stacked on phones)
   ------------------------------------------------------------------ */
(function () {
  const pass = document.querySelector('.pass');
  const main = pass && pass.querySelector('.pass-main');
  if (!main) return;
  function place() {
    const stacked = getComputedStyle(pass).gridTemplateColumns.split(' ').length === 1;
    const cut = stacked ? main.offsetHeight / pass.offsetHeight : main.offsetWidth / pass.offsetWidth;
    pass.style.setProperty('--cut', (cut * 100).toFixed(2) + '%');
  }
  place();
  if ('ResizeObserver' in window) new ResizeObserver(place).observe(pass);
  else window.addEventListener('resize', place);
})();

/* ------------------------------------------------------------------
   Mac guide — work out which chip this Mac has, and play the
   step-by-step walkthrough
   ------------------------------------------------------------------ */
(function () {
  const btn = document.getElementById('mac-check');
  const out = document.getElementById('mac-result');

  function chip() {
    const ua = navigator.userAgent;
    if (!/Mac/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)) return 'notmac';
    // Safari and Chrome both report "Intel Mac OS X" whatever the chip, so ask
    // the GPU instead: Apple Silicon renders through an "Apple M…" GPU.
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const r = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        if (/apple m\d|apple gpu|apple silicon/i.test(r)) return 'arm';
        if (/intel|iris|radeon|amd|nvidia|geforce/i.test(r)) return 'intel';
      }
    } catch (e) { /* fall through */ }
    return 'unknown';
  }

  function recommend(kind) {
    const arm = document.getElementById('choice-arm');
    const intel = document.getElementById('choice-intel');
    if (!arm || !intel) return;
    const armBtn = document.getElementById('dl-mac-arm');
    const intelBtn = document.getElementById('dl-mac-intel');
    const match = kind === 'intel' ? intel : arm, other = kind === 'intel' ? arm : intel;
    match.classList.add('is-match'); other.classList.remove('is-match');
    // the recommended one gets the solid button
    [[match, 'btn-solid', 'btn-outline'], [other, 'btn-outline', 'btn-solid']].forEach(([card, add, rm]) => {
      const b2 = card.querySelector('.btn'); b2.classList.add(add); b2.classList.remove(rm);
    });
    void armBtn; void intelBtn;
    const why = document.getElementById('which-why');
    if (why) why.hidden = false;
    match.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  if (btn && out) {
    btn.addEventListener('click', () => {
      const kind = chip();
      out.className = 'which-result';
      if (kind === 'arm') {
        out.innerHTML = 'This looks like an <b>Apple Silicon</b> Mac (M1, M2, M3 or M4) — take the Apple Silicon build below.';
        recommend('arm');
      } else if (kind === 'intel') {
        out.innerHTML = 'This looks like an <b>Intel</b> Mac. We’ve switched the button below to the Intel build for you.';
        recommend('intel');
      } else if (kind === 'notmac') {
        out.className = 'which-result unknown';
        out.innerHTML = 'You don’t seem to be on a Mac right now. Open this page on the Mac you want Litranite on, or check <b>About This Mac</b> there.';
      } else {
        out.className = 'which-result unknown';
        out.innerHTML = 'Your browser won’t tell us — <b>check it yourself</b> below, it only takes two clicks.';
        const man = document.getElementById('which-manual');
        if (man) man.open = true;
      }
    });
  }

  /* ---- the walkthrough ---- */
  const screen = document.getElementById('walk-screen');
  if (!screen) return;
  const scenes = Array.from(screen.querySelectorAll('.scene'));
  const cap = document.getElementById('walk-cap');
  const dots = document.getElementById('walk-dots');
  const play = document.getElementById('walk-play');
  const replay = document.getElementById('walk-replay');
  const CAPS = [
    'Download the build that matches your Mac.',
    'Find the .dmg in Downloads and double-click it.',
    'Drag Litranite onto the Applications folder.',
    'In Applications, right-click Litranite → Open. (Double-clicking won’t work the first time.)',
    'macOS asks once. Click Open.',
    'Still says “damaged”? Paste this in Terminal, once.',
    'That’s it — Litranite opens normally from now on.',
  ];
  const HOLD = [3000, 3200, 3400, 4200, 3400, 4200, 3200];
  const TYPE = 'xattr -cr /Applications/Litranite.app';
  let i = 0, timer = null, typing = null, running = true;

  scenes.forEach((_, k) => { const d = document.createElement('i'); d.addEventListener('click', () => { show(k); pause(true); }); dots.appendChild(d); });

  function typeCmd() {
    const el = screen.querySelector('.sc-type');
    if (!el) return;
    el.textContent = '';
    let n = 0;
    clearInterval(typing);
    typing = setInterval(() => { el.textContent = TYPE.slice(0, ++n); if (n >= TYPE.length) clearInterval(typing); }, 55);
  }
  function show(n) {
    i = (n + scenes.length) % scenes.length;
    scenes.forEach((s, k) => s.classList.toggle('on', k === i));
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === i));
    cap.textContent = CAPS[i];
    if (i === 5) typeCmd();
  }
  function next() { show(i + 1); schedule(); }
  function schedule() { clearTimeout(timer); if (running) timer = setTimeout(next, HOLD[i]); }
  function pause(yes) { running = !yes; play.textContent = running ? 'Pause' : 'Play'; if (running) schedule(); else clearTimeout(timer); }

  play.addEventListener('click', () => pause(running));
  replay.addEventListener('click', () => { show(0); if (!running) pause(false); else schedule(); });
  screen.addEventListener('mouseenter', () => clearTimeout(timer));
  screen.addEventListener('mouseleave', () => schedule());
  document.addEventListener('visibilitychange', () => (document.hidden ? clearTimeout(timer) : schedule()));

  show(0);
  if (reduceMotion) { pause(true); } else { schedule(); }
})();

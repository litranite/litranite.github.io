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
if (/Windows/i.test(ua)) document.getElementById('tab-windows').click();
else if (/Linux/i.test(ua) && !/Android/i.test(ua)) document.getElementById('tab-linux').click();

/* ------------------------------------------------------------------
   Point download buttons at the newest GitHub release
   ------------------------------------------------------------------ */
const REPO = 'AyanaayaW/English-CAS-Project';
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
  })
  .catch(() => {});

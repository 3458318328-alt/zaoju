/* 整屏滚动：纸页翻过 + 阻尼落位
   ────────────────────────────────────────────────
   1) 滚轮一次只走一屏，位置不是"跳"过去，而是每帧靠近剩下的 8.5%，
      越接近越慢，松手之后还会继续滑一小段——这是阻尼；
   2) 换幕时盖一层"纸页"（下一屏背景图 + 纸色），从下往上滑过整屏，
      在它盖住的那一小段里把页面滚到位，再掀开露出新的一屏。
      模板原来是深色渐变罩（纸白底上就是一块灰），这里换成纸色 + 图影；
   3) 手机/触屏保持原生滚动，不做拦截。 */
(() => {
  const scenes = [...document.querySelectorAll('main > .scene')];
  if (scenes.length < 2) return;
  const desktop = matchMedia('(min-width: 821px) and (min-height: 700px) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const RATIO = .085;   // 每帧吃掉剩余距离的比例（越小越"沉"）
  const GESTURE_GAP = 1320; // 一次换幕的锁定时长
  const HOLD = 520;     // 到这一刻纸页已盖住整屏，页面必须滚到位
  const LIFT = 690;     // 开始掀开
  const END = 1250;     // 纸页完全撤走

  let target = window.scrollY;
  let pos = window.scrollY;
  let running = false;
  let lastIndex = -1;
  let lockedUntil = 0, lastWheel = 0, acc = 0;
  let busy = false;                 // 纸页正在走，落位时不重复触发入场
  const timers = [];

  const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const clampY = y => Math.max(0, Math.min(maxY(), y));

  /* 纸页 */
  const veil = document.createElement('div');
  veil.className = 'scene-veil';
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = '<div class="scene-veil-img"></div><div class="scene-veil-tint"></div>' +
    '<div class="scene-veil-card"><em></em><span></span></div>';
  document.body.appendChild(veil);
  const veilImg = veil.querySelector('.scene-veil-img');
  const veilNo = veil.querySelector('.scene-veil-card em');
  const veilTag = veil.querySelector('.scene-veil-card span');

  function indexAt() {
    const mid = innerHeight / 2;
    let best = 0, bestD = Infinity;
    scenes.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function arrive(s) {
    s.classList.remove('scene-arriving');
    void s.offsetWidth;
    s.classList.add('scene-arriving');
  }

  function splash(x, y) {
    window.dispatchEvent(new CustomEvent('scene-water', {
      detail: { x: x == null ? innerWidth * .6 : x, y: y == null ? innerHeight * .56 : y }
    }));
  }

  function settle() {
    running = false;
    document.documentElement.classList.remove('is-damping');
    const i = indexAt();
    if (i === lastIndex) return;
    lastIndex = i;
    if (reduced.matches) return;
    splash();
    if (busy) return;      // 入场留给纸页掀开那一刻
    arrive(scenes[i]);
  }

  function tick() {
    const diff = target - pos;
    if (Math.abs(diff) < .4) {
      pos = target;
      window.scrollTo(0, Math.round(pos));
      settle();
      return;
    }
    pos += diff * RATIO;
    window.scrollTo(0, Math.round(pos));
    requestAnimationFrame(tick);
  }

  function goTo(y) {
    target = clampY(y);
    if (reduced.matches) {
      pos = target;
      window.scrollTo(0, Math.round(target));
      settle();
      return;
    }
    if (!running) {
      running = true;
      pos = window.scrollY;
      document.documentElement.classList.add('is-damping');
      requestAnimationFrame(tick);
    }
  }
  window.dampedScrollTo = goTo;

  /* 换一屏：纸页盖过来 → 底下滚到位 → 掀开 */
  function turn(dir, x, y) {
    const i = indexAt();
    const next = Math.max(0, Math.min(scenes.length - 1, i + dir));
    if (next === i) { goTo(scenes[i].offsetTop); return; }

    const s = scenes[next];
    if (reduced.matches) { goTo(s.offsetTop); return; }

    const now = performance.now();
    lockedUntil = now + GESTURE_GAP;
    busy = true;

    const bg = s.style.getPropertyValue('--bg');
    /* 纸面上印一张下一屏作品的淡影（有作品图就用作品图，没有就用背景），
       比直接用背景更像"翻到下一页" */
    const art = s.querySelector('.project-art img,.hero-feature img,.detail-card img');
    const src = art ? (art.currentSrc || art.getAttribute('src') || '') : '';
    if (src) {
      veilImg.style.backgroundImage = `url("${src}")`;
      veilImg.classList.add('is-art');
      veil.classList.add('has-art');
    } else {
      veilImg.style.backgroundImage = bg || 'none';
      veilImg.classList.remove('is-art');
      veil.classList.remove('has-art');
    }
    veilNo.textContent = String(next + 1).padStart(2, '0');
    const h = s.querySelector('h1,h2');
    veilTag.textContent = (h ? (h.getAttribute('aria-label') || h.textContent) : '').trim();
    veil.style.setProperty('--veil-from', dir > 0 ? '100%' : '-100%');
    veil.style.setProperty('--veil-to', dir > 0 ? '-7%' : '7%');

    veil.classList.remove('in', 'out');
    void veil.offsetWidth;
    requestAnimationFrame(() => veil.classList.add('in'));

    goTo(s.offsetTop);

    timers.push(setTimeout(() => { arrive(s); splash(x, y); }, HOLD));
    timers.push(setTimeout(() => { veil.classList.remove('in'); veil.classList.add('out'); }, LIFT));
    timers.push(setTimeout(() => {
      veil.classList.remove('in', 'out');
      busy = false;
    }, END + 40));
  }

  /* 页内锚点也走同一条缓动，别让它硬跳 */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    let el = null;
    try { el = document.querySelector(id); } catch (err) { return; }
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + window.scrollY;
    goTo(top);
    history.replaceState(null, '', id);
  }, true);

  document.addEventListener('wheel', e => {
    if (!desktop.matches || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest('.exhibit-stage,.detail-stage,video,audio,.detail-player')) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    const now = performance.now();
    if (now < lockedUntil) { lastWheel = now; return; }
    if (now - lastWheel > 240) acc = 0;
    lastWheel = now;
    acc += e.deltaY;
    if (Math.abs(acc) < 26) return;
    const dir = acc > 0 ? 1 : -1;
    acc = 0;
    turn(dir, e.clientX, e.clientY);
  }, { passive: false });

  /* 方向键 / 空格 / PageUp Down 也一并接管 */
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest('input,textarea,select,[contenteditable]')) return;
    const keys = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
    const dir = keys[e.key];
    if (dir === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (performance.now() < lockedUntil) return;
    turn(dir, innerWidth * .5, innerHeight * .5);
  });

  addEventListener('resize', () => {
    if (running) return;
    const y = scenes[indexAt()].offsetTop;
    target = pos = clampY(y);
    window.scrollTo(0, Math.round(pos));
  });
})();

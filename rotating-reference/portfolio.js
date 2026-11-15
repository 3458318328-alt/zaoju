import Canvas from './js/components/Canvas.js';

// Portfolio adaptation of Rotating Infinite Image Gallery, MIT, Oluwaseyi Oluwadare / Codrops.
const projects = [
  {
    "slug": "cover-wide",
    "tag": "LANDSCAPE / 横版封面",
    "title": "横版封面",
    "summary": "三张 16:9 封面：远处一件浪漫，近处一件日常，还有一件很轻的荒诞。",
    "image": "assets/work/work-01.webp"
  },
  {
    "slug": "cover-tall",
    "tag": "PORTRAIT / 竖版封面",
    "title": "竖版封面",
    "summary": "八张竖版。更强的字重、更短的说法、更硬的留白。",
    "image": "assets/work/work-12.webp"
  },
  {
    "slug": "chibi",
    "tag": "VISUAL / 赤壁赋",
    "title": "赤壁赋",
    "summary": "同一段文本的五次视觉：近景、山崖、水面、夜色与山壁。",
    "image": "assets/work/work-02.webp"
  },
  {
    "slug": "ja-poster",
    "tag": "TEAM / 团队项目",
    "title": "J.A. 海报",
    "summary": "花样滑冰跳跃分析工具。本人初稿，团队精修终稿。",
    "image": "assets/work/work-13.webp"
  },
  {
    "slug": "interactive",
    "tag": "INTERACTIVE / 交互作品",
    "title": "交互作品",
    "summary": "植物图鉴网站，与人格行为模拟器。都可在线访问。",
    "image": "assets/work/botany.webp"
  }
];
window.referenceProjects = projects;

const N = projects.length;
const W = 2; // 两侧各 2 张，共 5 张同屏
const pad = n => String(n).padStart(2, '0');
const count = document.querySelector('.stage-count');
const tag = document.querySelector('.reference-tag');
const title = document.querySelector('.reference-title');
const summary = document.querySelector('.reference-summary');
const open = document.querySelector('.reference-open');
const buttons = [...document.querySelectorAll('[data-go]')];
let active = -1, gallery = null;

window.onRotatingUpdate = (i) => {
  if (i === active) return;
  active = i;
  const p = projects[i];
  tag.textContent = p.tag;
  const titleLines = p.title.split(' · ');
  title.replaceChildren(...titleLines.map(line => {
    const span = document.createElement('span');
    span.className = 'title-line';
    span.textContent = line;
    return span;
  }));
  title.setAttribute('aria-label', p.title.replace(' · ', ' '));
  summary.textContent = p.summary;
  count.textContent = pad(i + 1) + ' / ' + pad(N);
  open.href = p.slug + '.html';
  buttons.forEach((b, j) => {
    b.classList.toggle('active', j === i);
    if (i === j) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
};
window.onRotatingUpdate(0);

function go(i) {
  i = ((i % N) + N) % N;
  if (gallery?.medias) {
    const m = gallery.medias[i];
    gallery.scroll.target = m.y - m.extra;
  } else window.fallbackGo?.(i);
}
buttons.forEach((b, i) => b.addEventListener('click', () => go(i)));
document.querySelector('.prev').addEventListener('click', () => go(active - 1));
document.querySelector('.next').addEventListener('click', () => go(active + 1));
open.addEventListener('click', e => {
  if (window.parent !== window && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    window.parent.postMessage({ type: 'portfolio-open-project', slug: projects[active].slug }, location.origin);
  }
});
function send(type) { if (window.parent !== window) window.parent.postMessage({ type }, location.origin); }
document.querySelectorAll('.quick-home,.quick-close').forEach(a => a.addEventListener('click', e => {
  if (window.parent !== window) { e.preventDefault(); send('portfolio-close'); }
}));
document.querySelector('.quick-immersive').addEventListener('click', e => {
  if (window.parent !== window) { e.preventDefault(); send('portfolio-immersive'); }
});

function fallback() {
  document.querySelector('#gl').hidden = true;
  const box = document.querySelector('.reference-fallback');
  box.hidden = false;
  const imgs = projects.map(p => {
    const img = document.createElement('img');
    img.src = p.image; img.alt = '';
    if (p.focusY === 1) img.style.objectPosition = 'center top';
    box.append(img); return img;
  });
  let pos = 0, target = 0, last = 0, frame = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mod = (x, n) => ((x % n) + n) % n;
  function render(t) {
    const dt = last ? Math.min((t - last) / 16.67, 3) : 1; last = t;
    pos += (target - pos) * (1 - Math.pow(.99, dt));
    let nearest = 0, best = Infinity;
    imgs.forEach((img, i) => {
      const d = mod(i - pos + W, 2 * W + 1) - W;
      const y = d * (300 + innerHeight * .048);
      const angle = (.25 + .5 * y / innerHeight) * 180;
      img.style.transform = `translate(-50%,-50%) translateY(${y}px) perspective(1100px) rotateY(${angle}deg)`;
      img.style.opacity = Math.abs(d) < W + .5 ? '1' : '0';
      if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
    });
    window.onRotatingUpdate(nearest);
    if (Math.abs(target - pos) > .0005 && !reduce) frame = requestAnimationFrame(render);
    else { pos = target; frame = 0; last = 0; }
  }
  function wake() { if (!frame) frame = requestAnimationFrame(render); }
  window.fallbackGo = i => {
    const d = mod(i - Math.round(pos) + W, 2 * W + 1) - W;
    target = Math.round(pos) + d;
    if (reduce) pos = target;
    wake();
  };
  window.addEventListener('wheel', e => {
    target += e.deltaY * .005 / ((300 + innerHeight * .048) / (innerHeight / (2 * Math.tan(Math.PI / 8) * 20)));
    if (reduce) pos = target;
    wake();
  }, { passive: true });
  wake();
}

try { gallery = new Canvas(); }
catch (error) { console.warn('3D gallery unavailable; using accessible fallback.', error); fallback(); }

const initial = projects.findIndex(p => location.hash === '#case-' + p.slug);
if (initial > 0) go(initial);

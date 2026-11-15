/* 文字出场
   ────────────────────────────────────────────────
   1) 把正文里手工换行的 <br> 拆成一行一个 span，让每句话自己浮上来，
      而不是整段一起动；
   2) 滚到哪一屏，就给那一屏挂 .scene-arriving，CSS 按元件的顺序放动画
      （期号 → 标题 → 正文逐行 → 链接 → 图版）；
   3) 桌面端的整屏滚动由 scene-transitions.js 在纸页落位那一刻挂同一个 class，
      这里只补首屏和触屏/窄屏（原生滚动，用 IntersectionObserver 判断）。 */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 821px) and (min-height: 700px) and (hover: hover) and (pointer: fine)');
  const scenes = [...document.querySelectorAll('main > .scene')];
  if (!scenes.length) return;

  /* ---------- 1. 正文按 <br> 拆行 ---------- */
  const paras = document.querySelectorAll('main .scene .bodycopy, main .scene .lead');
  paras.forEach(p => {
    if (p.querySelector(':scope > .line')) return;
    const nodes = [...p.childNodes];
    if (!nodes.some(n => n.nodeType === 1 && n.tagName === 'BR')) return;
    const frag = document.createDocumentFragment();
    let line = null;
    const open = () => {
      line = document.createElement('span');
      line.className = 'line';
    };
    open();
    nodes.forEach(n => {
      if (n.nodeType === 1 && n.tagName === 'BR') {
        if (line.childNodes.length) frag.appendChild(line);
        open();
        return;
      }
      /* 行首的缩进空白丢掉，免得每行前面多一格 */
      if (n.nodeType === 3 && !line.childNodes.length && !n.textContent.trim()) return;
      line.appendChild(n.cloneNode(true));
    });
    if (line.childNodes.length) frag.appendChild(line);
    if (frag.childNodes.length > 1) p.replaceChildren(frag);
  });

  /* ---------- 2. 挂 class = 重播动画 ---------- */
  const show = s => {
    s.classList.remove('scene-arriving');
    void s.offsetWidth;
    s.classList.add('scene-arriving');
  };

  if (reduced.matches) return;   // 减少动效：不挂 class，文字就是普通可见状态

  const nativeScroll = !desktop.matches;

  if (nativeScroll) {
    if (!('IntersectionObserver' in window)) { scenes.forEach(show); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting && en.intersectionRatio >= .12) show(en.target);
        else if (!en.isIntersecting) en.target.classList.remove('scene-arriving');
      });
    }, { threshold: [0, .12, .5] });
    scenes.forEach(s => io.observe(s));
    return;
  }

  /* 桌面：首屏由这里起头，其余屏等阻尼滚动落位时由 scene-transitions 挂 */
  show(scenes[0]);
})();

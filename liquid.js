/* 水面折射 —— 按模板源码（reference/template-source/liquid.js）重做。
   ────────────────────────────────────────────────
   源码里其实是两步：
     ① 一张 RG16F 的高度场，用邻域平均跑波动方程（uState 两张乒乓贴图）；
     ② 用高度场求梯度，把背景图按梯度采样回去，再叠一点高光/暗边。
   这就是"整片水面在轻轻晃"的来源，比画同心圆环真实得多。

   我保留这两步，只改动四处：
     1) 只作用于首页的 7 个整屏场景（不再接管作品详情页，那边用静态纸底）；
     2) 点击不再激起水花——原来 DOM 里那圈 .ripple 也一起去掉，
        只有鼠标划过、换幕落地时才起波；
     3) 背景图的取样按 CSS 真实的 background-position/size 换算，
        所以首屏 66% 的偏移不会跳，和静态时的画面完全对得上；
     4) 纸白主题下把高光换成暖白、暗边换成墨，波纹看起来像水痕而不是灰雾。 */
(() => {
  if (matchMedia('(max-width: 820px)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const scenes = [...document.querySelectorAll('main > .scene')];
  if (!scenes.length) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-surface';
  canvas.setAttribute('aria-hidden', 'true');

  let gl, sim, render, targets, media, scene, lastScene;
  let simW = 1, simH = 1, read = 0, failed = false;
  let energy = 0, lastMove = 0, imageToken = 0, mediaReady = false;
  let rect = [0, 0, 1, 1], cw = 1, ch = 1, mediaImage = null;

  let pending = [];

  const vertex = `#version 300 es
    layout(location=0) in vec2 aPosition; out vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;

  /* ① 波动方程：邻域平均 - 自身 = 加速度 */
  const simulation = `#version 300 es
    precision highp float; in vec2 vUv; out vec4 outState;
    uniform sampler2D uState; uniform vec2 uTexel,uPoint,uDirection;
    uniform float uRadius,uStrength,uStretch,uAspect;
    void main(){
      vec2 state=texture(uState,vUv).rg;
      float left=texture(uState,vUv-vec2(uTexel.x,0.)).r;
      float right=texture(uState,vUv+vec2(uTexel.x,0.)).r;
      float down=texture(uState,vUv-vec2(0.,uTexel.y)).r;
      float up=texture(uState,vUv+vec2(0.,uTexel.y)).r;
      float acceleration=(left+right+down+up-4.*state.r)*.42;
      float velocity=(state.g+acceleration)*.984;
      float height=(state.r+velocity)*.998;
      vec2 delta=vUv-uPoint;delta.x*=uAspect;
      vec2 direction=normalize(uDirection+vec2(.0001,0.));
      mat2 basis=mat2(direction.x,-direction.y,direction.y,direction.x);
      vec2 local=basis*delta;local.x/=max(1.,uStretch);
      float pressure=exp(-dot(local,local)/max(.00001,uRadius*uRadius));
      height+=pressure*uStrength;
      outState=vec4(height,velocity,0.,1.);
    }`;

  /* ② 折射成像 */
  const rendering = `#version 300 es
    precision highp float; in vec2 vUv; out vec4 outColor;
    uniform sampler2D uState,uMedia; uniform vec2 uTexel,uCanvas;
    uniform vec4 uRect;                /* ox, oy, dw, dh —— 背景图在场景里的实际矩形 */
    uniform float uTime,uMotionEnergy;

    /* 把屏幕 uv 换算成图片自身的 uv，跟 CSS background-size:cover + position 完全一致 */
    vec2 mediaUv(vec2 uv){
      vec2 px=vec2(uv.x*uCanvas.x,(1.-uv.y)*uCanvas.y);
      vec2 img=(px-uRect.xy)/uRect.zw;
      return clamp(vec2(img.x,1.-img.y),vec2(0.),vec2(1.));
    }

    void main(){
      float hC=texture(uState,vUv).r;
      float hL=texture(uState,vUv-vec2(uTexel.x,0.)).r;
      float hR=texture(uState,vUv+vec2(uTexel.x,0.)).r;
      float hD=texture(uState,vUv-vec2(0.,uTexel.y)).r;
      float hU=texture(uState,vUv+vec2(0.,uTexel.y)).r;
      /* 高度场的振幅在扩散后会掉到千分之几，这里统一放大，
         否则在纸白虚化底上完全看不出位移 */
      const float AMP=8.;
      vec2 slope=vec2(hR-hL,hU-hD)*AMP;
      float curvature=(hL+hR+hD+hU-4.*hC)*AMP;

      /* 静止的时候整片水也在极慢地呼吸，否则像一张死图 */
      vec2 ambient=vec2(
        sin(vUv.y*8.4+uTime*.16)+sin(vUv.y*17.-uTime*.09),
        cos(vUv.x*7.2-uTime*.13)+sin(vUv.x*15.+uTime*.08)
      )*(.00024+uMotionEnergy*.00014);

      vec2 displacement=slope*(.62+uMotionEnergy*.16)+ambient;
      displacement=clamp(displacement,vec2(-.05),vec2(.05));

      vec3 color=texture(uMedia,mediaUv(vUv+displacement)).rgb;

      float ridge=smoothstep(.004,.028,length(slope));
      float crest=smoothstep(.002,.020,abs(curvature));
      float glint=clamp(dot(normalize(vec3(-slope*22.,1.)),normalize(vec3(-.48,.62,.72))),0.,1.);

      color+=vec3(.99,.975,.94)*ridge*(.16+uMotionEnergy*.08)*(.55+glint*.45);
      color-=vec3(.050,.046,.040)*ridge*(1.-glint)*.85;
      color-=vec3(.018,.017,.015)*crest*.45;
      outColor=vec4(color,1.);
    }`;

  function program(v, f) {
    const make = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, v));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, f));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
    return p;
  }

  function texture(unit) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, unit);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, unit);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function target() {
    const t = texture(gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, simW, simH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('water buffer unavailable');
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, fb };
  }

  /* 背景图在场景中的真实矩形：和 CSS 的 cover + background-position 对齐 */
  function computeRect(img) {
    if (!scene) return;
    const w = scene.clientWidth, h = scene.clientHeight;
    cw = w; ch = h;
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale, dh = ih * scale;
    const cs = getComputedStyle(scene);
    const pos = (cs.backgroundPosition || '50% 50%').split(' ');
    const frac = (token, axis) => {
      const t = (token || '50%').trim();
      const box = axis === 'x' ? w : h, size = axis === 'x' ? dw : dh;
      if (t.endsWith('%')) return (parseFloat(t) || 0) / 100;
      if (t.endsWith('px')) {
        const v = parseFloat(t) || 0;
        const span = box - size;
        return span === 0 ? 0 : v / span;
      }
      return .5;
    };
    const ox = (w - dw) * frac(pos[0], 'x');
    const oy = (h - dh) * frac(pos[1] || pos[0], 'y');
    rect = [ox, oy, dw, dh];
  }

  function resize() {
    if (!scene) return;
    const w = scene.clientWidth, h = scene.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    cw = w; ch = h;
    simW = Math.max(180, Math.min(420, Math.round(w * .36)));
    simH = Math.max(110, Math.round(simW * h / w));
    if (targets) targets.forEach(t => { gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.t); });
    targets = [target(), target()];
    read = 0; pending = [];
    /* 窗口尺寸变了，背景图在场景里的矩形也要重算，否则加载时的位置会错 */
    if (mediaImage) computeRect(mediaImage);
  }

  function fallback() {
    failed = true; canvas.remove();
    document.documentElement.dataset.liquidState = 'fallback';
  }

  function sceneAtCenter() {
    return scenes.find(s => {
      const r = s.getBoundingClientRect();
      return r.top <= innerHeight * .5 && r.bottom > innerHeight * .5;
    }) || null;
  }

  function setScene(s) {
    if (!s || s === scene) return;
    scene = s;
    mediaReady = false;
    canvas.hidden = true;
    s.prepend(canvas);
    try { resize(); } catch (e) { fallback(); return; }

    const match = (s.style.getPropertyValue('--bg') || '').match(/url\(["']?([^"')]+)["']?\)/);
    if (!match) return;
    const token = ++imageToken;
    const img = new Image();
    img.onload = () => {
      if (token !== imageToken || failed) return;
      try {
        mediaImage = img;
        computeRect(img);
        gl.bindTexture(gl.TEXTURE_2D, media);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        mediaReady = true;
        lastScene = s;
        canvas.hidden = false;
        document.documentElement.dataset.liquidState = 'ready';
      } catch (e) { fallback(); }
    };
    img.onerror = fallback;
    img.src = match[1];
  }

  const loc = (p, n) => gl.getUniformLocation(p, n);
  const U = {};

  function draw(now) {
    if (!mediaReady) return;
    const index = pending.findIndex(x => x.at <= now);
    const p = index >= 0 ? pending.splice(index, 1)[0]
      : { x: -4, y: -4, dx: 1, dy: 0, r: .01, s: 0, stretch: 1 };

    gl.useProgram(sim);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1 - read].fb);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[read].t);
    gl.uniform1i(U.sState, 0);
    gl.uniform2f(U.sTexel, 1 / simW, 1 / simH);
    gl.uniform2f(U.sPoint, p.x, p.y);
    gl.uniform2f(U.sDir, p.dx, p.dy);
    gl.uniform1f(U.sRadius, p.r);
    gl.uniform1f(U.sStrength, p.s);
    gl.uniform1f(U.sStretch, p.stretch);
    gl.uniform1f(U.sAspect, cw / ch);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    read = 1 - read;

    gl.useProgram(render);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[read].t);
    gl.uniform1i(U.rState, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, media);
    gl.uniform1i(U.rMedia, 1);
    gl.uniform2f(U.rTexel, 1 / simW, 1 / simH);
    gl.uniform2f(U.rCanvas, cw, ch);
    gl.uniform4f(U.rRect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform1f(U.rTime, now * .001);
    energy *= .972;
    gl.uniform1f(U.rEnergy, energy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (failed) return;
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const current = sceneAtCenter();
    if (current !== scene) setScene(current);
    if (!scene || lastScene !== scene || canvas.hidden) return;
    draw(now);
  }

  function point(e) {
    if (!scene) return null;
    const r = scene.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
  }

  function splash(x, y) {
    if (failed || !scene) return;
    const now = performance.now();
    const size = Math.max(1, Math.min(cw, ch));
    [[0, .022, 46, -.16], [105, .038, 74, .078], [285, .06, 112, -.04]].forEach(([delay, min, px, strength]) => {
      pending.push({ x, y, dx: 1, dy: 0, r: Math.max(min, px / size), s: strength, stretch: 1, at: now + delay });
    });
    energy = .86;
    pending = pending.slice(-24);
  }

  try {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('WebGL2 float unavailable');
    sim = program(vertex, simulation);
    render = program(vertex, rendering);
    U.sState = loc(sim, 'uState'); U.sTexel = loc(sim, 'uTexel'); U.sPoint = loc(sim, 'uPoint');
    U.sDir = loc(sim, 'uDirection'); U.sRadius = loc(sim, 'uRadius'); U.sStrength = loc(sim, 'uStrength');
    U.sStretch = loc(sim, 'uStretch'); U.sAspect = loc(sim, 'uAspect');
    U.rState = loc(render, 'uState'); U.rMedia = loc(render, 'uMedia'); U.rTexel = loc(render, 'uTexel');
    U.rCanvas = loc(render, 'uCanvas'); U.rRect = loc(render, 'uRect');
    U.rTime = loc(render, 'uTime'); U.rEnergy = loc(render, 'uMotionEnergy');

    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    media = texture(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([246, 241, 230, 255]));

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback(); }, { once: true });
    addEventListener('resize', () => { if (scene && !failed) { try { resize(); } catch (e) { fallback(); } } });

    /* 鼠标划过：只起一道很浅的尾迹，不点不响 */
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || e.buttons || failed) return;
      if (performance.now() - lastMove < 34) return;
      if (e.target.closest('a,button,video,.detail-player,audio')) return;
      const pt = point(e); if (!pt) return;
      lastMove = performance.now();
      pending.push({ ...pt, dx: e.movementX || 1, dy: -(e.movementY || 0), r: .062, s: -.040, stretch: 1.5, at: lastMove });
      pending = pending.slice(-24);
      energy = Math.max(energy, .62);
    });

    /* 换幕落地时，让水面从中间荡一下 */
    addEventListener('scene-water', e => {
      const pt = point({ clientX: e.detail.x, clientY: e.detail.y });
      if (pt) splash(pt.x, pt.y);
    });

    requestAnimationFrame(frame);
  } catch (error) {
    console.warn('Water refraction unavailable:', error.message || error);
    fallback();
  }
})();

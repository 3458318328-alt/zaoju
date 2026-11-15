const details={"storywork":{"label":"PROJECT","title":"故事策划","entries":[["示例项目","请在这里写项目介绍。","项目展示"]]},"visual":{"label":"PROJECT","title":"视觉设计","entries":[["示例项目","请在这里写项目介绍。","项目展示"]]},"video":{"label":"PROJECT","title":"动态影像","entries":[["示例项目","请在这里写项目介绍。","项目展示"]]},"experience":{"label":"PROJECT","title":"创意实践","entries":[["示例项目","请在这里写项目介绍。","项目展示"]]}};
const dialog=document.querySelector('#detail'), content=document.querySelector('#detail-content');document.querySelectorAll('.detail-btn').forEach(btn=>btn.addEventListener('click',()=>{let d=details[btn.dataset.detail];content.innerHTML=`<p class="dialog-label">${d.label}</p><h2 id="detail-title" class="dialog-title">${d.title}</h2>${d.entries.map(e=>`<article class="entry"><h3>${e[0]}</h3><p>${e[1]}</p><small>${e[2]}</small></article>`).join('')}`;dialog.showModal()}));document.querySelector('#close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});const menu=document.querySelector('.menu'),nav=document.querySelector('.nav');menu.addEventListener('click',()=>{let open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',open)});document.querySelectorAll('.nav nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}));/* 点击水波已去掉：原来每次 pointerdown 都在光标处塞一个 .ripple 圈，太吵。水面交给 liquid.js。 */

/* 首屏字标跟随光标轻微位移，让"造句"两个字有呼吸 */
(()=>{
  const t=document.querySelector('.hero .title-art');
  if(!t)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  let raf=0,tx=0,ty=0,cx=0,cy=0;
  function run(){
    cx+=(tx-cx)*.08;cy+=(ty-cy)*.08;
    t.style.transform='translate3d('+cx.toFixed(2)+'px,'+cy.toFixed(2)+'px,0)';
    raf=(Math.abs(tx-cx)>.04||Math.abs(ty-cy)>.04)?requestAnimationFrame(run):0;
  }
  addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse')return;
    tx=(e.clientX/innerWidth-.5)*11;
    ty=(e.clientY/innerHeight-.5)*7;
    if(!raf)raf=requestAnimationFrame(run);
  },{passive:true});
})();

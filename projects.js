(()=>{
 const media=JSON.parse(document.getElementById('media-data').textContent),cards=[...document.querySelectorAll('.detail-card')],stage=document.getElementById('detail-stage'),counter=document.getElementById('viewer-counter'),title=document.getElementById('detail-media-title'),action=document.getElementById('detail-media-action'),wrap=document.getElementById('detail-player-wrap'),player=document.getElementById('detail-player'),close=document.getElementById('detail-player-close');let index=0,start=null,dragged=false,previousFocus=null,lastWheel=0;
 // 卡片框按作品自身比例来算：横版图就是横卡，竖版图就是竖卡，图片不再被裁
 function sizes(){
   const r=stage.getBoundingClientRect(),W=Math.round(r.width),H=Math.round(r.height);
   if(!W||!H)return {W:0,H:0,gap:0};
   // 主卡不能太大：它一胖，两侧就只剩一条缝，大小对比会失衡。
   // 横版作品（1.78）按宽算会把两边挤没，上限再收紧一档。
   cards.forEach(card=>{
     const im=card.querySelector('img'),ar=im&&im.naturalWidth?im.naturalWidth/im.naturalHeight:4/3;
     const cap=ar>1.4?W*.42:W*.46;
     let h=H*.78,w=h*ar;
     if(w>cap){w=cap;h=w/ar}
     const cw=Math.round(w),ch=Math.round(h);
     if(card._w!==cw||card._h!==ch){card.style.width=cw+'px';card.style.height=ch+'px';card._w=cw;card._h=ch}
   });
   return {W,H,gap:Math.max(16,Math.round(W*.06))};   // 主卡与邻卡之间要留出真正的空当
 }
function update(){
  const {W,H,gap}=sizes(),len=media.length,cur=cards[index],w0=(cur&&cur._w)||300;
  // 大图左右各两张：第一张整张露出来（缩到六成，和主卡隔着空隙），
  // 第二张只剩靠外的一条边压在第一张后面——像一叠摊开的卡，不是糊成一团。
  // 手机上邻卡会缩成指甲盖那么大，不如不摆；窄屏每侧只摆一张
  const MAX_SIDE=W<520?0:(W<720?1:2),PAD=16;
  const gap2=Math.max(16,Math.round(W*.035));
  // 层次：主卡 1 → 第一张 0.66 → 第二张 0.5，越往外越退、越淡
  const opByK=[1,.88,.7];
  const h0=(cur&&cur._h)||300;
  const edge=W/2-PAD;
  // 第二张要露出来的那一条；只有这一侧真的会摆第二张时才预留
  const reveal2=(MAX_SIDE>1&&len>3)?Math.round(Math.min(64,W*.09)):0;

  cards.forEach((card,n)=>{
    let d=n-index;
    if(d>len/2)d-=len;
    if(d< -len/2)d+=len;
    const k=Math.abs(d),bw=card._w||300;
    let dx=0,dy=0,s=1,op=1,hide=false;
    if(k>0){
      // 第一张按主卡的高度定档（0.72），再被剩余纸面收一收——
      // 它必须整张露出来，裁了就只剩一条边，层次全没了。
      const inner1=w0/2+gap2;                                   // 内缘：离主卡留一段纸面
      const room1=Math.max(0,edge-inner1-reveal2);
      const s1=Math.min(.72,room1/bw,(h0*.72)/((card._h||300)));
      const outer1=inner1+bw*s1;                                // 它的外缘
      if(k===1){
        s=s1;
        dx=Math.sign(d)*(inner1+bw*s1/2);
        dy=Math.round(h0*.03);        // 略微下沉，像被主卡压着摊开
        // 小于这个尺寸就不摆：与其塞半张小图，不如只留主卡
        hide=MAX_SIDE<1||s1<.36||room1<40;
      }else{
        // 第二张比第一张再退一档，只露一条边压在第一张身后
        const s2=s1*.76;
        const outer2=Math.min(edge,outer1+64);
        s=s2;
        dx=Math.sign(d)*(outer2-bw*s2/2);
        dy=Math.round(h0*.06);
        hide=k>MAX_SIDE||s2<.28||outer2-outer1<26;
      }
      op=opByK[Math.min(k,MAX_SIDE)];
    }
    card.style.transform=`translate(-50%,-50%) translate(${dx.toFixed(1)}px,${dy}px) scale(${s.toFixed(3)})`;
    card.style.opacity=hide?'0':String(op);
    card.style.visibility=hide?'hidden':'visible';
    card.style.zIndex=String(20-k);
    card.setAttribute('aria-current',String(n===index));
  });
  counter.textContent=String(index+1).padStart(2,'0')+' / '+String(media.length).padStart(2,'0');
  title.textContent=media[index][2];
  action.textContent=media[index][0]==='video'?'播放视频':'查看作品';
}
 function change(step){index=(index+step+media.length)%media.length;update()}
 function open(){if(window.parent!==window)window.parent.postMessage({type:'portfolio-preview',open:true},location.origin);previousFocus=document.activeElement;const [type,src,label,poster]=media[index];player.replaceChildren();const el=document.createElement(type==='video'?'video':'img');el.src=src;if(type==='video'){el.controls=true;el.playsInline=true;el.preload='metadata';el.poster=poster||'';el.setAttribute('aria-label',label)}else el.alt=label;player.append(el);wrap.hidden=false;wrap.classList.add('active');close.focus({preventScroll:true})}
 function dismiss(){if(window.parent!==window)window.parent.postMessage({type:'portfolio-preview',open:false},location.origin);window.parent!==window&&window.parent.postMessage({type:'portfolio-video',playing:false},location.origin);wrap.classList.remove('active');wrap.hidden=true;player.replaceChildren();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true})}
 document.querySelector('.viewer-back').addEventListener('click',e=>{if(window.parent!==window){e.preventDefault();window.parent.postMessage({type:'portfolio-close'},location.origin)}});document.addEventListener('play',e=>{if(e.target instanceof HTMLVideoElement&&window.parent!==window)window.parent.postMessage({type:'portfolio-video',playing:true},location.origin)},true);for(const n of ['pause','ended','emptied'])document.addEventListener(n,e=>{if(e.target instanceof HTMLVideoElement&&window.parent!==window)window.parent.postMessage({type:'portfolio-video',playing:false},location.origin)},true);
 document.getElementById('media-prev').addEventListener('click',()=>change(-1));document.getElementById('media-next').addEventListener('click',()=>change(1));action.addEventListener('click',open);close.addEventListener('click',dismiss);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrap.hidden){e.preventDefault();dismiss()}else if(wrap.hidden&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();change(e.key==='ArrowRight'?1:-1)}});
 stage.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const now=performance.now(),delta=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!delta)return;e.preventDefault();if(now-lastWheel>320){change(delta>0?1:-1);lastWheel=now}},{passive:false});
 stage.addEventListener('pointerdown',e=>{start=e.clientX;dragged=false;stage.classList.add('dragging')});window.addEventListener('pointerup',e=>{if(start===null)return;const delta=e.clientX-start;start=null;stage.classList.remove('dragging');if(Math.abs(delta)>35){dragged=true;change(delta<0?1:-1);setTimeout(()=>dragged=false,250)}});stage.addEventListener('click',e=>{if(dragged)return;const card=e.target.closest('[data-media]');if(!card)return;const n=Number(card.dataset.media);if(n===index)open();else{index=n;update()}});
 // 图片带着 lazy 加载，naturalWidth 要等它到位；尺寸得跟着重算，否则会按 4:3 硬塞
 cards.forEach(c=>{const im=c.querySelector('img');if(im&&!im.complete)im.addEventListener('load',()=>{sizes();update()},{once:true})});
 let rz=0;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{sizes();update()},120)});
 if(window.ResizeObserver)new ResizeObserver(()=>{sizes();update()}).observe(stage);
 sizes();update();
 // 版面（字体、工具栏、滚动条）稳定下来之后尺寸可能还会变一次，再校一遍
 requestAnimationFrame(()=>requestAnimationFrame(()=>{sizes();update()}));
 if(document.readyState==="complete")setTimeout(()=>{sizes();update()},60);
 else window.addEventListener("load",()=>{sizes();update()},{once:true});
})();

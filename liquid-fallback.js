/* Canvas displacement fallback for browsers without float WebGL textures. */
window.startLiquidFallback = function () {
 if (matchMedia('(max-width: 820px)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const scenes=[...document.querySelectorAll('.scene')],canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),base=document.createElement('canvas'),bctx=base.getContext('2d');
 if(!ctx||!bctx)return;canvas.className='liquid-surface';canvas.setAttribute('aria-hidden','true');
 let scene=null,img=null,pulses=[],token=0,lastMove=0,lastX=0,lastY=0,hadPulses=false;
 const sceneAtCenter=()=>document.querySelector('#exhibit-viewer[open], body#exhibit-viewer')||scenes.find(s=>{let r=s.getBoundingClientRect();return r.top<=innerHeight*.5&&r.bottom>innerHeight*.5});
 function size(){if(!scene||!img)return;const w=scene.clientWidth,h=scene.clientHeight;canvas.width=base.width=w;canvas.height=base.height=h;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;bctx.clearRect(0,0,w,h);bctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);ctx.drawImage(base,0,0)}
 function change(next){scene=next;pulses=[];hadPulses=false;canvas.hidden=true;if(!next)return;next.prepend(canvas);const m=(next.id==='exhibit-viewer'?"url('assets/viewer-scene.png')":next.style.getPropertyValue('--bg')).match(/url\(["']?([^"')]+)["']?\)/);if(!m)return;const current=++token,image=new Image();image.onload=()=>{if(current!==token)return;img=image;size();canvas.hidden=false;document.documentElement.dataset.liquidState='canvas-ready'};image.src=m[1]}
 function point(e){if(!scene||canvas.hidden)return null;const r=scene.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;return {x:e.clientX-r.left,y:e.clientY-r.top}}
 function emit(e,power){const p=point(e);if(!p)return;pulses.push({...p,at:performance.now(),power});if(pulses.length>5)pulses.shift()}
 window.addEventListener('scene-water',event=>emit({clientX:event.detail.x,clientY:event.detail.y},1.5));
 document.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||e.buttons||e.target.closest('a,button,video,.detail-player'))return;const now=performance.now();if(now-lastMove<90||Math.hypot(e.clientX-lastX,e.clientY-lastY)<7)return;lastMove=now;lastX=e.clientX;lastY=e.clientY;emit(e,1)});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('a,button,video,.detail-player'))emit(e,1.5)});
 window.addEventListener('resize',size);
 function frame(now){requestAnimationFrame(frame);if(document.hidden)return;let next=sceneAtCenter();if(next!==scene)change(next);if(!scene||!img||canvas.hidden)return;pulses=pulses.filter(p=>now-p.at<2200);if(!pulses.length){if(hadPulses)ctx.drawImage(base,0,0);hadPulses=false;return}hadPulses=true;ctx.drawImage(base,0,0);const tile=9,w=canvas.width,h=canvas.height;
  for(const p of pulses){const age=(now-p.at)/2200,radius=15+age*130,limit=radius+42,fade=(1-age)*p.power;let xmin=Math.max(0,Math.floor((p.x-limit)/tile)*tile),xmax=Math.min(w,p.x+limit),ymin=Math.max(0,Math.floor((p.y-limit)/tile)*tile),ymax=Math.min(h,p.y+limit);
   for(let y=ymin;y<ymax;y+=tile)for(let x=xmin;x<xmax;x+=tile){const dx=x+tile/2-p.x,dy=y+tile/2-p.y,d=Math.hypot(dx,dy)||1,delta=d-radius;if(Math.abs(delta)>35)continue;const amount=Math.sin(delta*.21)*Math.exp(-delta*delta/500)*fade*7;const sx=Math.max(0,Math.min(w-tile,x+amount*dx/d)),sy=Math.max(0,Math.min(h-tile,y+amount*dy/d));ctx.drawImage(base,sx,sy,tile,tile,x,y,tile,tile)}
  }
 }
 requestAnimationFrame(frame);
};

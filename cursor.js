(() => {
 const supported=matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
 if(!supported.matches)return;
 const cursor=document.createElement('div');cursor.className='glow-cursor';cursor.setAttribute('aria-hidden','true');document.body.appendChild(cursor);
 document.documentElement.classList.add('glow-pointer');
 document.addEventListener('pointermove',e=>{
   if(e.pointerType!=='mouse')return;
   const dialog=e.target.closest('dialog[open]');const parent=dialog||document.body;
   if(cursor.parentElement!==parent)parent.appendChild(cursor);
   cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';cursor.classList.add('visible');
   cursor.classList.toggle('interactive',!!e.target.closest('a,button,[role="button"],video,audio'));
   /* 深墨色的点落在深色图上会看不见，图片区域换成浅色点 */
   cursor.classList.toggle('on-media',!!e.target.closest('img,video,.project-art,.hf-item,.world-photo,.detail-card'));
 },{passive:true});
 document.addEventListener('pointerout',e=>{if(!e.relatedTarget)cursor.classList.remove('visible')});
 window.addEventListener('blur',()=>cursor.classList.remove('visible'));
 supported.addEventListener('change',()=>{document.documentElement.classList.toggle('glow-pointer',supported.matches);if(!supported.matches)cursor.classList.remove('visible')});
})();

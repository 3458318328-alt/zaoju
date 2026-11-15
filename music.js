(() => {
 const button = document.getElementById('music-toggle');
 const label = document.getElementById('music-label');
 const status = document.getElementById('music-status');
 const player = document.getElementById('music-player');
 let userPaused = false;
 let awaitingGesture = false;
 const baseVolume = 0.35;
 const videoVolume = 0.09;
 const activeVideos = new Set();
 let projectVideoPlaying = false;
 player.volume = baseVolume;
 document.addEventListener('project-video', e => {projectVideoPlaying = !!e.detail; syncVolume();});
 const syncVolume = () => {
   for (const video of activeVideos) if (!video.isConnected || video.paused || video.ended) activeVideos.delete(video);
   player.volume = (activeVideos.size || projectVideoPlaying) ? videoVolume : baseVolume;
 };
 document.addEventListener('play', event => { if (event.target instanceof HTMLVideoElement) { activeVideos.add(event.target); syncVolume(); } }, true);
 for (const eventName of ['pause','ended','emptied']) document.addEventListener(eventName, event => { if (event.target instanceof HTMLVideoElement) { activeVideos.delete(event.target); syncVolume(); } }, true);
 new MutationObserver(syncVolume).observe(document.body, { childList:true, subtree:true });
 function update() {
   const playing = !player.paused;
   label.textContent = playing ? '暂停音乐' : '播放音乐';
   button.setAttribute('aria-pressed', String(playing));
   button.setAttribute('aria-label', `${playing ? '暂停' : '播放'}背景音乐`);
 }
 player.addEventListener('play', update);
 player.addEventListener('pause', update);
 player.addEventListener('error', () => { status.textContent = '音乐暂时无法播放，请重试'; update(); });
 button.addEventListener('click', async () => {
   status.textContent = '';
   if (!player.paused) { userPaused = true; awaitingGesture = false; player.pause(); return; }
   userPaused = false;
   try { await player.play(); awaitingGesture = false; } catch (_) { status.textContent = '请点击播放音乐'; update(); }
 });
 async function tryAutoplay() {
   if (userPaused || !player.paused) return;
   try { await player.play(); awaitingGesture = false; status.textContent = ''; }
   catch (_) { awaitingGesture = true; update(); }
 }
 for (const type of ['pointerdown','keydown','touchstart','wheel']) document.addEventListener(type, event => {
   if (!awaitingGesture || userPaused || event.target.closest?.('#music-toggle')) return;
   tryAutoplay();
 }, {capture:true, passive:true});
 tryAutoplay();
})();

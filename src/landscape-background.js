// One native video decoder; the temple remains a separate, interactive GLB.
// No image panning, scroll seeking, synthetic water layers or per-frame JavaScript.
export function mountLandscapeBackground(){
  const host=document.querySelector('#aero-background'),toggle=document.querySelector('#ambient-toggle'),label=document.querySelector('#ambient-label')
  if(!host)return
  const root=document.createElement('div');root.className='landscape-scene'
  const view=document.createElement('div');view.className='landscape-view'
  const video=document.createElement('video');video.className='landscape-painting landscape-video'
  video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata'
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1
  view.append(video);root.append(view);host.replaceChildren(root)
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 760px)')
  let manual=false,visible=true,failed=false,disposed=false,loaded=false,blocked=false,playingRequest=false
  let source='',generation=0
  try{manual=sessionStorage.getItem('qnd-background-paused')==='true'}catch{}
  const shouldPause=()=>manual||reduced.matches||document.hidden||!visible||failed||disposed
  function updateUI(){
    host.dataset.paused=String(shouldPause()||video.paused)
    host.dataset.videoReady=String(loaded)
    document.body.dataset.aeroState=reduced.matches?'still':failed?'fallback':loaded?'ready':'loading'
    if(toggle){
      toggle.disabled=reduced.matches
      toggle.setAttribute('aria-pressed',String(manual||reduced.matches||blocked))
      toggle.setAttribute('aria-label',failed?'重新载入山水视频':reduced.matches?'减少动态模式：静态背景':blocked?'播放山水背景':manual?'开启背景流动':'暂停背景流动')
    }
    if(label)label.textContent=failed?'山水载入失败 · 重试':reduced.matches?'山水静观':blocked?'山水静观 · 播放':manual?'山水静观 · 开启':loaded?'山水流动 · 暂停':'山水载入中'
  }
  function sync(){
    if(disposed)return
    if(shouldPause())video.pause()
    else if(source&&!playingRequest&&video.paused&&!blocked){
      const ticket=generation;playingRequest=true
      video.play().then(()=>{if(ticket!==generation||disposed)return;blocked=false;if(shouldPause())video.pause();updateUI()}).catch(error=>{
        if(ticket!==generation||disposed||error.name==='AbortError')return
        if(error.name==='NotAllowedError')blocked=true;else failed=true
        updateUI()
      }).finally(()=>{if(ticket===generation){playingRequest=false;if(!shouldPause()&&video.paused&&!blocked&&!failed)sync()}})
    }
    updateUI()
  }
  function selectSource(retry=false){
    const variant=mobile.matches?'mobile':'wide'
    video.poster=import.meta.env.BASE_URL+`art/gilded-landscape-${variant}-v1.png`
    // Reduced-motion users retain the still image without downloading the movie.
    if(reduced.matches){generation++;playingRequest=false;video.pause();video.removeAttribute('src');video.load();source='';loaded=false;failed=false;blocked=false;sync();return}
    const next=import.meta.env.BASE_URL+`art/gilded-landscape-${variant}-loop-v1.mp4`
    if(next===source&&!retry){sync();return}
    generation++;playingRequest=false;source=next;loaded=false;failed=false;blocked=false
    video.src=next+(retry?'?retry='+Math.round(performance.now()):'');video.load();sync()
  }
  const onLoaded=()=>{loaded=true;failed=false;sync()}
  const onError=()=>{failed=true;loaded=false;video.pause();updateUI()}
  const onToggle=()=>{
    if(failed){selectSource(true);return}
    if(blocked){blocked=false;manual=false}else manual=!manual
    try{sessionStorage.setItem('qnd-background-paused',String(manual))}catch{}
    sync()
  }
  const onMediaChange=()=>selectSource()
  const onPageHide=()=>video.pause()
  video.addEventListener('loadeddata',onLoaded);video.addEventListener('error',onError);video.addEventListener('playing',updateUI);video.addEventListener('pause',updateUI)
  toggle?.addEventListener('click',onToggle);reduced.addEventListener('change',onMediaChange);mobile.addEventListener('change',onMediaChange)
  document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',onPageHide);window.addEventListener('pageshow',sync)
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;sync()});observer.observe(host)
  selectSource()
  if(import.meta.env.DEV)window.__QND_AMBIENT__={state:()=>{const q=video.getVideoPlaybackQuality?.();return {renderer:'native-landscape-video',count:1,paused:shouldPause()||video.paused,loaded,failed,blocked,source:video.currentSrc||source,width:video.videoWidth,height:video.videoHeight,times:[video.currentTime*1000],states:[video.paused?'paused':'running'],duration:video.duration,quality:q?{total:q.totalVideoFrames,dropped:q.droppedVideoFrames}:null}}}
  const cleanup=()=>{
    disposed=true;generation++;observer.disconnect();video.pause();video.removeAttribute('src');video.load()
    toggle?.removeEventListener('click',onToggle);reduced.removeEventListener('change',onMediaChange);mobile.removeEventListener('change',onMediaChange)
    document.removeEventListener('visibilitychange',sync);window.removeEventListener('pagehide',onPageHide);window.removeEventListener('pageshow',sync)
    video.removeEventListener('loadeddata',onLoaded);video.removeEventListener('error',onError);video.removeEventListener('playing',updateUI);video.removeEventListener('pause',updateUI);root.remove()
  }
  if(import.meta.hot)import.meta.hot.dispose(cleanup)
  return cleanup
}

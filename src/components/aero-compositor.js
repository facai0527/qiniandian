// Native-vector adaptation of AeroShards' full stream and folded facets.
// Precompute the stream once. Only transform/opacity animate on the browser compositor:
// no per-frame JS, no low-resolution bitmap and no second continuously rendered GPU canvas.
const NS='http://www.w3.org/2000/svg';
const arc=[0,.028092,.055939,.083892,.112291,.141449,.171637,.203033,.235650,.269282,.303537,.337982,.372308,.406392,.440263,.474026,.507794,.541636,.575553,.609470,.643257,.676761,.709855,.742465,.774594,.806319,.837790,.869218,.900862,.933020,.965991,1];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const random=n=>{let s=(Math.imul(n,747796405)+2891336453)>>>0;let w=Math.imul((s>>>((s>>>28)+4))^s,277803737)>>>0;return ((w>>>22)^w)>>>0;};
const unit=n=>random(n)/4294967296;
const seed=(id,a,b)=>unit((Math.imul(id,a)+b)>>>0);
const hex=color=>`rgb(${color.slice(0,3).map(c=>Math.round(c*255)).join(' ')})`;

function streamFrames(id,width,height,s){
  const aspect=width/height,pi=Math.PI,scale=s.scale;
  const laneSeed=seed(id,2246822519,3266489917),depthSeed=seed(id,668265263,374761393),sizeSeed=seed(id,1597334677,3812015801);
  const signedLane=laneSeed*2-1,lane=Math.sign(signedLane)*Math.abs(signedLane)**.72;
  const baseSize=.0125*s.shardSize*(.46+sizeSeed*.58+sizeSeed**12*1.55);
  const duration=Math.hypot(2.44*aspect,Math.sqrt(5))/(Math.max(.01,s.speed)*.34)*1000;
  const frames=[];
  for(let k=0;k<=48;k++){
    const phase=k/48,u=phase*31,index=Math.min(30,Math.floor(u)),t=arc[index]+(arc[index+1]-arc[index])*(u-index);
    const dx=aspect*2.44,dy=Math.cos((t*1.72-.2)*pi)*1.72*pi*.54+Math.cos(t*pi*3)*pi*3*.12;
    const len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    const laneWidth=(lane*.56+Math.sin(phase*12*pi+depthSeed*12)*.055*s.turbulence)*s.spread*(.46+Math.max(0,Math.sin(phase*pi))**.72*.54);
    const z=Math.cos(t*2*pi-.7)*.22+(depthSeed*2-1)*s.depth+Math.cos(phase*10*pi+laneSeed*8)*.06*s.turbulence;
    const perspective=1/Math.max(.62,1-z*.34),pixel=height*.5*scale*perspective;
    const x=((-aspect*1.22+aspect*2.44*t)+nx*laneWidth)*pixel;
    const y=-(Math.sin((t*1.72-.2)*pi)*.54+Math.sin(t*pi*3)*.12+ny*laneWidth)*pixel;
    const size=baseSize*(.56+1.02*clamp(z*.62+.5,0,1))*pixel;
    const angle=Math.atan2(-dy,dx)*180/pi+90;
    const roll=laneSeed*360+phase*(duration/1000)*s.speed*.34*(-1.5+3.2*depthSeed)*s.spin*2.4*180/pi;
    const alpha=(.6+.34*clamp((z+.68)/1.26,0,1))*Math.min(1,phase*30,(1-phase)*30);
    frames.push({offset:phase,transform:`translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) rotate(${angle.toFixed(3)}deg) rotateY(${roll.toFixed(3)}deg) scale(${(size*.72*2/48).toFixed(4)},${(size*1.26*s.stretch*2/84).toFixed(4)})`,opacity:alpha});
  }
  return {frames,duration,delay:-seed(id,1664525,1013904223)*duration};
}

export function startAeroCompositor({root,canvas,settingsRef,onReady}){
  const layer=document.createElement('div');layer.className='aero-shards__compositor';layer.dataset.renderer='compositor';
  root.append(layer);canvas.hidden=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let animations=[],shards=[],disposed=false,intersecting=true,lastWidth=0,lastHeight=0,lastSignature='';
  let count=0;
  const effectivePause=()=>settingsRef.current.paused||reduced.matches||document.hidden||!intersecting||settingsRef.current.speed<=.0001;
  function pause(){
    const quiet=effectivePause();
    for(const animation of animations){
      if(quiet&&animation.playState!=='paused')animation.pause();
      if(!quiet&&animation.playState!=='running')animation.play();
    }
    layer.dataset.paused=String(quiet);
  }
  function resize(){
    if(disposed)return;
    const width=root.clientWidth,height=root.clientHeight;
    if(!width||!height)return;
    const s=settingsRef.current;
    const signature=[s.scale,s.spread,s.depth,s.turbulence,s.shardSize,s.stretch,s.speed,s.spin].join('|');
    if(width===lastWidth&&height===lastHeight&&signature===lastSignature){pause();return;}
    lastWidth=width;lastHeight=height;lastSignature=signature;
    if(!shards.length){
      count=width<640?64:96;
      const fragment=document.createDocumentFragment();
      for(let i=0;i<count;i++){
        const shard=document.createElement('span');shard.className='aero-shard';
        const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 42');svg.setAttribute('aria-hidden','true');
        const left=document.createElementNS(NS,'path'),right=document.createElementNS(NS,'path');
        left.setAttribute('d','M12 0 0 21 12 42Z');right.setAttribute('d','M12 0 12 42 24 21Z');
        left.setAttribute('fill',hex(s.shard));right.setAttribute('fill',hex(s.accent));
        svg.append(left,right);shard.append(svg);fragment.append(shard);shards.push(shard);
      }
      layer.append(fragment);
    }
    animations=shards.map((shard,i)=>{
      const old=animations[i],oldDuration=old?.effect.getTiming().duration||1;
      const phase=old?.currentTime==null?0:Number(old.currentTime)/oldDuration;
      old?.cancel();
      const {frames,duration,delay}=streamFrames(i,width,height,s);
      const animation=shard.animate(frames,{duration,delay,iterations:Infinity,fill:'both',easing:'linear'});
      animation.currentTime=phase*duration;
      return animation;
    });
    pause();
  }
  function update(){
    for(const shard of shards){const paths=shard.querySelectorAll('path');paths[0].setAttribute('fill',hex(settingsRef.current.shard));paths[1].setAttribute('fill',hex(settingsRef.current.accent));}
    resize();
  }
  // Read-only diagnostics: timeline progress, not an invented count of painted frames.
  layer.__aeroState=()=>({renderer:'compositor',count,paused:effectivePause(),
    vector:true,devicePixelRatio,animations:animations.length,
    times:animations.slice(0,4).map(a=>Number(a.currentTime)||0),states:animations.slice(0,4).map(a=>a.playState)});
  try{resize();}catch(error){shards.forEach(shard=>shard.getAnimations().forEach(a=>a.cancel()));layer.remove();canvas.hidden=false;throw error;}
  const observer=new ResizeObserver(resize);observer.observe(root);
  const visibilityObserver=new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting!==false;pause();},{threshold:0});visibilityObserver.observe(root);
  document.addEventListener('visibilitychange',pause);reduced.addEventListener('change',pause);
  // First commit: native vectors are ready immediately, with no GPU compiler/loading delay.
  const readyFrame=requestAnimationFrame(()=>{if(!disposed)onReady();});
  return {update,dispose(){disposed=true;cancelAnimationFrame(readyFrame);animations.forEach(a=>a.cancel());observer.disconnect();visibilityObserver.disconnect();document.removeEventListener('visibilitychange',pause);reduced.removeEventListener('change',pause);layer.remove();canvas.hidden=false;}};
}

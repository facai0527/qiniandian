const header=document.querySelector('.site-nav'),toggle=document.querySelector('#menu-toggle'),menu=document.querySelector('#chapter-menu')
const mobile=matchMedia('(max-width:760px)')
const setOpen=(open,focus=false)=>{
  header.dataset.menuOpen=String(open)
  toggle.setAttribute('aria-expanded',String(open))
  toggle.setAttribute('aria-label',open?'收起章节菜单':'展开章节菜单')
  if(focus)toggle.focus({preventScroll:true})
}
toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'))
menu.addEventListener('click',event=>{if(event.target.closest('a')&&mobile.matches)setOpen(false,true)})
document.addEventListener('pointerdown',event=>{if(!header.contains(event.target))setOpen(false)})
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')setOpen(false,true)})
header.addEventListener('focusout',event=>{if(event.relatedTarget&&!header.contains(event.relatedTarget))setOpen(false)})
mobile.addEventListener('change',()=>setOpen(false))

// Independent painting layer: can load while the GLB loads, never drives its scroll timeline.
import('./landscape-background.js').then(module=>module.mountLandscapeBackground()).catch(()=>{
    document.body.dataset.aeroState='fallback'
    document.querySelector('#ambient-label').textContent='静态画境'
    document.querySelector('#ambient-toggle').disabled=true
})

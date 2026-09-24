import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AeroShards from './components/AeroShards'
import { palette } from './site-palette.js'

export function mountAeroBackground() {
  const host=document.querySelector('#aero-background')
  const toggle=document.querySelector('#ambient-toggle'),label=document.querySelector('#ambient-label')
  if(!host) return
  const fallback=()=>{
    document.body.dataset.aeroState='fallback'
    label.textContent='静态风纹背景'
    toggle.disabled=true
    toggle.setAttribute('aria-label','当前使用静态风纹背景')
  }
  const root=createRoot(host)
  function Background(){
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    const [manual,setManual]=useState(()=>{try{return sessionStorage.getItem('qnd-background-paused')==='true'}catch{return false}})
    const [quiet,setQuiet]=useState(reduced.matches)
    const [failed,setFailed]=useState(false)
    useEffect(()=>{
      const onReduced=()=>setQuiet(reduced.matches)
      const onToggle=()=>setManual(value=>!value)
      reduced.addEventListener('change',onReduced)
      toggle.addEventListener('click',onToggle)
      return()=>{reduced.removeEventListener('change',onReduced);toggle.removeEventListener('click',onToggle)}
    },[])
    useEffect(()=>{
      if(failed){fallback();return}
      toggle.disabled=quiet
      toggle.setAttribute('aria-pressed',String(manual||quiet))
      toggle.setAttribute('aria-label',quiet?'减少动态模式：静态背景':manual?'开启背景流动':'暂停背景流动')
      label.textContent=quiet?'背景静观':manual?'背景静观 · 开启':'背景流动 · 暂停'
      host.dataset.paused=String(manual||quiet)
      try{sessionStorage.setItem('qnd-background-paused',String(manual))}catch{}
    },[manual,quiet,failed])
    useEffect(()=>{
      const observer=new MutationObserver(()=>{
        if(host.querySelector('.aero-shards[data-ready="true"]'))document.body.dataset.aeroState='ready'
      })
      observer.observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ready']})
      return()=>observer.disconnect()
    },[])
    if(failed)return null
    return <AeroShards backgroundColor={palette.bg} shardColor={palette.shard} accentColor={palette.shardLight}
      placement="full" flow="stream" material="satin" detail="balanced"
      scale={1.15} spread={.8} depth={.5} speed={.48} spin={.25} interaction="none"
      density={.75} shardSize={.68} stretch={1.1} turbulence={.35} glow={.45}
      edgeSoftness={.7} bloom={0} grain={0} chromaticAberration={0} rippleIntensity={0}
      holdToGather={false} compositor paused={manual||quiet} onError={()=>setFailed(true)} />
  }
  root.render(<Background />)
  if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount())
}

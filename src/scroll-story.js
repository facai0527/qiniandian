import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './sen-scroll.css'
import './porcelain-theme.css'
import './palette-theme.css'
import './landscape-background.css'
import './editorial-details.css'
import './compact-navigation.css'
import './refined-navigation.js'
import { partitionForCulling } from './spatial-chunks.js'
import { createTempleLighting, prepareTempleMaterial } from './temple-rendering.js'
import { createDepthPrepass } from './depth-prepass.js'

const $ = (selector) => document.querySelector(selector)
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const ease = x => x * x * (3 - 2 * x)
const mix = (a, b, t) => a + (b - a) * t
const names = ['hero', 'form', 'structure', 'openings', 'interior', 'base']
const titles = ['总览', '琉璃', '檐下', '门窗', '藻井', '构成']
const shotLabels = ['QIGU ALTAR / BEIJING', 'BLUE GLAZED ROOF', 'BRACKETS & BEAMS', 'VERMILION LATTICE', 'DRAGON & PHOENIX CAISSON', 'ARCHITECTURAL ANATOMY']
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const mobile = matchMedia('(max-width: 760px)')
const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
const panels = [...document.querySelectorAll('.story-panel')]
const bodies = panels.map(panel => panel.querySelector('.panel-body'))
const links = [...document.querySelectorAll('[data-step]')]
const track = $('#scroll-story')
const viewport = $('#model-viewport')
const canvas = $('#story-canvas')
const status = $('#load-message')
const retry = $('#retry-model')
const explore = $('#explore-model')
const controlsPanel = $('#model-controls')
let progress = 0, renderedProgress = 0, ready = false, interactive = false, busy = false
let renderer, controls, model, metrics, lighting, stops = [], range = 1
let depthPass
let frame = 0, dirty = true, uiDirty = true, activeStep = -1, scrollStops = [0,1,2,3,4,5]
let viewWidth = 1, viewHeight = 1, pageHeight = innerHeight, lastPose = null, lastMobile = null
let pixelRatioCap = Math.min(devicePixelRatio,mobile.matches ? 1.15 : 1.35), slowFrames = 0, frameWindow = 0, lastDraw = 0
let renderInterval=0, lastPoseTime=0
let assetVariant = '', optimizedUVs = false, spatialStats = null
let lastStructure = '', lastFraming = ''
const gaze={enabled:true,x:0,y:0,targetX:0,targetY:0}
let viewLeft=0,viewTop=0,lastScrollTime=-Infinity
const renderStats = { draws:0, skippedPoses:0, qualityReductions:0 }
const journeyProgress = $('#journey-progress'), motionNote = $('#motion-note')
function requestRender() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(render)
}
function resetGaze(immediate=false){
  gaze.targetX=0;gaze.targetY=0
  if(immediate){gaze.x=0;gaze.y=0;dirty=true}
  requestRender()
}
function gazeAllowed(){return gaze.enabled&&finePointer.matches&&!mobile.matches&&!reduced.matches&&!interactive}
function updateControlHelp(){
  if(interactive)return
  $('#control-help').textContent=mobile.matches?'向下滑动 · 走近祈年殿':gaze.enabled?'移动鼠标轻移视角 · 向下探索':'向下探索 · 走近祈年殿'
}
const bounds = new Map(), materialBounds = []
const uvRepairs = []
let assetUVRepairs = []
const explosionWorld = new Map()
const partLabels = [...document.querySelectorAll('[data-part]')]
const groups = new Map(), transforms = new Map(), groupMaterials = new Map()
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(34, 1, 0.015, 200)
const placement = new THREE.Group()
scene.add(placement)
const groupNames = ['Hall_Roof', 'Hall_Columns', 'Hall_Windows', 'Hall_Interior', 'Hall_Base', 'Hall_Decoration']

function measure() {
  pageHeight = innerHeight
  // Move the same semantic copy into a separated mobile reading area; no duplicate screen-reader text.
  bodies.forEach((body,i) => {
    const parent = mobile.matches ? $('#mobile-copy') : panels[i]
    if (body.parentElement !== parent) parent.append(body)
  })
  scrollStops = panels.map((panel,i) => i === 0 ? track.offsetTop : panel.getBoundingClientRect().top + scrollY - (mobile.matches ? 0 : innerHeight * .30))
  range = scrollStops[5] - scrollStops[0]
  const rect = viewport.getBoundingClientRect()
  viewWidth = rect.width; viewHeight = rect.height;viewLeft=rect.left;viewTop=rect.top
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatioCap, mobile.matches ? 1.15 : 1.35))
    renderer.setSize(viewWidth, viewHeight, false)
    camera.aspect = viewWidth / Math.max(1, viewHeight)
    camera.updateProjectionMatrix()
  }
  dirty = true
  updateProgress()
}

function updateProgress() {
  lastScrollTime=performance.now();gaze.targetX=0;gaze.targetY=0
  const y = clamp(scrollY,scrollStops[0],scrollStops[5])
  const index = Math.max(0,scrollStops.findLastIndex(stop => y >= stop))
  progress = index === 5 ? 5 : index + clamp((y-scrollStops[index]) / Math.max(1,scrollStops[index+1]-scrollStops[index]))
  uiDirty = true
  if (interactive) leaveExplore()
  requestRender()
}

function updateUI() {
  uiDirty = false
  const index = Math.round(progress)
  const modeChanged = lastMobile !== mobile.matches
  const chapterChanged = index !== activeStep
  if(modeChanged)updateControlHelp()
  if (index !== activeStep) {
    activeStep = index
    $('#current-step').textContent = `${String(index + 1).padStart(2, '0')} / 06 — ${titles[index]}`
    $('#shot-label').textContent = shotLabels[index]
    document.body.dataset.chapter = names[index]
    links.forEach(link => {
      const selected = Number(link.dataset.step) === index
      link.toggleAttribute('aria-current', selected)
      if (selected) link.setAttribute('aria-current', 'step')
    })
  }
  journeyProgress.style.transform = `scaleX(${progress / 5})`
  if (modeChanged || chapterChanged) bodies.forEach((body,i) => {
    const hidden = mobile.matches && i !== index
    body.inert = hidden
    if (mobile.matches) body.setAttribute('aria-hidden',String(hidden))
    else body.removeAttribute('aria-hidden')
    body.style.opacity = hidden ? 0 : 1
    body.style.transform = ''
  })
  if (mobile.matches) {
    const body = bodies[index]
    body.style.opacity = reduced.matches ? 1 : 1-ease(clamp((Math.abs(progress-index)-.22)/.28))
    body.style.transform = `translate3d(0,${reduced.matches ? 0 : -(progress-index)*18}px,0)`
  } else {
    const exit = ease(clamp(scrollY/(pageHeight*.55)))
    bodies[0].style.opacity = 1-exit
    bodies[0].style.transform = `translate3d(0,${reduced.matches ? 0 : -exit*65}px,0)`
  }
  // Write only to composited layers, not inherited custom properties on the whole story.
  // The supplied film contains local river/cloud/gold motion: keep its framing locked.
  $('.sky-orbit').style.transform = `translate3d(0,${reduced.matches ? 0 : -progress*7}px,0)`
  const detail = ease(clamp(progress*1.7))
  $('.reading-scrim').style.opacity = detail
  $('.glass-rail').style.opacity = detail
  viewport.style.setProperty('--detail-visibility', detail)
  $('.scene-footer>span:last-child').style.opacity = 1-detail
  motionNote.hidden = !reduced.matches
  lastMobile = mobile.matches
}

function goTo(index) {
  leaveExplore()
  window.scrollTo({ top: scrollStops[index], behavior: reduced.matches ? 'instant' : 'smooth' })
  history.replaceState(null, '', `#${names[index]}`)
}
links.forEach(link => link.addEventListener('click', event => { event.preventDefault(); goTo(Number(link.dataset.step)) }))

function prepare(gltf) {
  optimizedUVs = !!gltf.userData?.qndOptimization
  assetUVRepairs = gltf.userData?.qndOptimization?.uvRepairs || []
  model = gltf.scene
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const scale = 11.8 / Math.max(size.x, size.z)
  // Transform only the external placement group: preserve the exported scene and all node transforms.
  placement.scale.setScalar(scale)
  placement.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
  placement.add(model)
  placement.updateWorldMatrix(true, true)
  metrics = { height: size.y * scale, radius: 5.9, scale }
  // Only the six exported structural groups move. Roof tiers / bracket details remain together.
  const h = metrics.height
  explosionWorld.set('Hall_Roof',new THREE.Vector3(0,h*.78,0))
  explosionWorld.set('Hall_Decoration',new THREE.Vector3(0,h*.78,0))
  explosionWorld.set('Hall_Columns',new THREE.Vector3(-h*.72,h*.28,-.20))
  explosionWorld.set('Hall_Windows',new THREE.Vector3(h*.72,h*.20,.15))
  explosionWorld.set('Hall_Interior',new THREE.Vector3(0,h*.24,0))
  explosionWorld.set('Hall_Base',new THREE.Vector3(0,0,0))
  groupNames.forEach(name => {
    const node = model.getObjectByName(name)
    if (!node) return
    groups.set(name, node)
    bounds.set(name,new THREE.Box3().setFromObject(node))
    const inverse = node.parent.matrixWorld.clone().invert()
    const origin = new THREE.Vector3().applyMatrix4(inverse)
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(inverse).sub(origin)
    const explode = explosionWorld.get(name).clone().applyMatrix4(inverse).sub(origin)
    transforms.set(name, { position:node.position.clone(), quaternion:node.quaternion.clone(), scale:node.scale.clone(), up, explode })
    groupMaterials.set(name, [])
  })
  const cache = new Map()
  model.traverse(object => {
    if (!object.isMesh) return
    let parent = object, group = ''
    while (parent && parent !== model) {
      if (groups.has(parent.name)) { group = parent.name; break }
      parent = parent.parent
    }
    const process = original => {
      const key = `${group}:${original.uuid}`
      if (cache.has(key)) return cache.get(key)
      const material = prepareTempleMaterial(original,renderer)
      material.userData.baseOpacity = material.opacity
      material.userData.baseTransparent = material.transparent
      material.userData.baseDepthWrite = material.depthWrite
      // Double-sided transparent shells otherwise submit the entire architecture twice.
      material.forceSinglePass = true
      if (group) groupMaterials.get(group).push(material)
      cache.set(key, material)
      return material
    }
    object.material = Array.isArray(object.material) ? object.material.map(process) : process(object.material)
    const mats = Array.isArray(object.material) ? object.material : [object.material]
    // Joined Blender groups retain several named UV layers. Some painted primitives have
    // a constant UV0 although their real unwrap survives in UV2/UV3/TEXCOORD_4.
    // Rebind that existing unwrap in memory; never generate a replacement texture or mesh.
    const uvSpan = attr => {
      if (!attr) return 0
      let u0=Infinity,v0=Infinity,u1=-Infinity,v1=-Infinity
      for(let i=0;i<attr.count;i++){u0=Math.min(u0,attr.getX(i));u1=Math.max(u1,attr.getX(i));v0=Math.min(v0,attr.getY(i));v1=Math.max(v1,attr.getY(i))}
      return Math.min(u1-u0,v1-v0)
    }
    if (mats.some(m=>m.map?.channel===0) && uvSpan(object.geometry.attributes.uv)<.0001) {
      const source=Object.entries(object.geometry.attributes).find(([name,attr])=>/^(uv\d*|texcoord_\d+)$/.test(name) && uvSpan(attr)>.01)
      if(source){object.geometry=object.geometry.clone();object.geometry.setAttribute('uv',source[1].clone());uvRepairs.push({mesh:object.name,from:source[0],to:'uv'})}
    } else if (mats.some(m=>m.map?.name==='soffit_paint')) {
      // Ceiling panels came from different joined collections: some use UV0, others the fifth layer.
      // Replace only padded (0,1) coordinates with the surviving per-vertex unwrap.
      const baseUV=object.geometry.attributes.uv
      const alternate=object.geometry.attributes.texcoord_4
      if(baseUV && alternate && uvSpan(alternate)>.01){
        const combined=baseUV.clone();let changed=0
        for(let i=0;i<baseUV.count;i++){
          if(Math.abs(baseUV.getX(i))<.0001 && Math.abs(baseUV.getY(i)-1)<.0001 && (Math.abs(alternate.getX(i))>.0001 || Math.abs(alternate.getY(i)-1)>.0001)){
            combined.setXY(i,alternate.getX(i),alternate.getY(i));changed++
          }
        }
        if(changed){object.geometry=object.geometry.clone();object.geometry.setAttribute('uv',combined);uvRepairs.push({mesh:object.name,from:'texcoord_4 (padded vertices only)',to:'uv',vertices:changed})}
      }
    }
    materialBounds.push({group, name:object.name, materials:mats.map(m=>m.name), maps:mats.map(m=>m.map?.name), box:new THREE.Box3().setFromObject(object)})
    object.updateMatrix()
    if (!groups.has(object.name)) object.matrixAutoUpdate = false // Only the six parent groups animate.
  })
  buildStops()
  const missing = groupNames.filter(name => !groups.has(name))
  if(missing.length) console.warn('Unavailable architectural groups:',missing)
}

function buildStops() {
  const h = metrics.height
  const boxOf = name => bounds.get(name) || new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,h,1))
  const point = (box,x,y,z) => new THREE.Vector3(mix(box.min.x,box.max.x,x),mix(box.min.y,box.max.y,y),mix(box.min.z,box.max.z,z))
  const roof = boxOf('Hall_Roof'), windows = boxOf('Hall_Windows')
  const caisson = materialBounds.find(item=>item.group==='Hall_Interior' && [...item.materials,...item.maps].some(name=>/caisson|藻井|龙纹/i.test(name||'')))
  const inside = caisson ? caisson.box.getCenter(new THREE.Vector3()) : point(boxOf('Hall_Interior'),.5,.92,.5)
  const full = {roof:1,windows:1,decoration:1,columns:1,base:1,lift:0,explode:0}
  // Sen-inspired right reading column, left full-bleed closeups. One real scene and reversible absolute poses.
  stops = [
    { ...full,target:new THREE.Vector3(0,h*.52,0),yaw:.10,pitch:.20,distance:11.2,mobileDistance:15.5,screenX:.5,screenY:.37 },
    { ...full,target:point(roof,.48,.55,.69),yaw:-.18,pitch:.19,distance:3.4,mobileDistance:4.3,screenX:.32,screenY:.50 },
    { ...full,target:point(roof,.64,.04,.90),yaw:.32,pitch:-.06,distance:1.35,mobileDistance:2.1,screenX:.31,screenY:.50,lift:.16 },
    { ...full,target:point(windows,.60,.58,.99),yaw:.10,pitch:.015,distance:1.30,mobileDistance:2.0,screenX:.31,screenY:.50 },
    { ...full,target:inside,yaw:-.12,pitch:-1.46,distance:1.0,mobileDistance:1.6,screenX:.31,screenY:.50,roof:0,windows:0,decoration:0,columns:0,base:0,lift:.16 },
    { ...full,target:new THREE.Vector3(0,h*.80,0),yaw:.20,pitch:.14,distance:20.2,mobileDistance:21.5,screenX:.32,screenY:.48,explode:1 },
  ]
}

function sample(p) {
  const index = Math.min(4, Math.floor(p))
  if(index===4){
    // The final chapter has two distinct beats: withdraw to an assembled panorama, then unfold.
    const u=clamp(p-4),travel=ease(clamp((u-.06)/.43)),unfold=ease(clamp((u-.63)/.30))
    const a=stops[4],b=stops[5]
    const wideTarget=new THREE.Vector3(0,metrics.height*.46,0).lerp(b.target,unfold)
    const value={target:a.target.clone().lerp(wideTarget,travel),explode:unfold,lift:mix(a.lift,0,travel)}
    for(const key of ['yaw','pitch','screenX','screenY']) value[key]=mix(a[key],b[key],travel)
    value.distance=mix(a.distance,mix(18.8,b.distance,unfold),travel)
    value.mobileDistance=mix(a.mobileDistance,mix(20.5,b.mobileDistance,unfold),travel)
    const shell=ease(clamp((travel-.40)/.40))
    for(const key of ['roof','windows','decoration','columns','base']) value[key]=shell
    return value
  }
  // Hold at both reading anchors, travel through the middle, as in the reference's camera timeline.
  const t = ease(clamp((p-index-.24)/.52)), a = stops[index], b = stops[index+1]
  const value = { target:a.target.clone().lerp(b.target,t) }
  for (const key of ['yaw','pitch','distance','mobileDistance','screenX','screenY','lift','roof','windows','decoration','columns','base','explode']) value[key] = mix(a[key],b[key],t)
  // Clear the shell before the camera enters, and restore it only after the camera leaves.
  // This prevents a half-transparent wall from filling the lens during the interior transition.
  if(index===3){
    const shell=1-ease(clamp(t/.50))
    for(const key of ['roof','windows','decoration','columns','base']) value[key]=shell
  }
  return value
}

function opacity(name, alpha) {
  const node = groups.get(name)
  if (node) node.visible = alpha > 0.005
  for (const material of groupMaterials.get(name) || []) {
    const transparent = alpha < 0.995 || material.userData.baseTransparent
    if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true }
    material.opacity = material.userData.baseOpacity * alpha
    material.depthWrite = alpha < 0.995 ? false : material.userData.baseDepthWrite
  }
}

function applyPose(state = sample(reduced.matches ? 0 : renderedProgress)) {
  if (!ready) return
  const structure=[state.lift,state.explode,state.roof,state.windows,state.decoration,state.columns,state.base].join('|')
  if(structure!==lastStructure){
    // Rebuild only when the architectural pose changes, never for gaze-only motion.
    // All transforms remain absolute, preventing drift on reverse or rapid scrolling.
    groups.forEach((node,name) => {
      const initial = transforms.get(name)
      node.position.copy(initial.position)
      node.quaternion.copy(initial.quaternion)
      node.scale.copy(initial.scale)
      if (name === 'Hall_Roof') node.position.addScaledVector(initial.up,state.lift)
      node.position.addScaledVector(initial.explode,state.explode)
    })
    opacity('Hall_Roof',state.roof)
    opacity('Hall_Windows',state.windows)
    opacity('Hall_Decoration',state.decoration)
    opacity('Hall_Columns',state.columns)
    opacity('Hall_Base',state.base)
    lastStructure=structure
  }
  lighting.update(state)
  if (!interactive) {
    // Reserve comfortable framing for a tall/narrow mobile canvas.
    const fit = mobile.matches ? Math.max(1, .85 / camera.aspect) : 1
    const distance = (mobile.matches ? state.mobileDistance : state.distance) * fit
    const width = viewWidth, height = viewHeight
    const x = mobile.matches ? .5 : state.screenX, y = mobile.matches ? .5 : state.screenY
    const framing=[width,height,x,y].join('|')
    if(framing!==lastFraming){camera.setViewOffset(width,height,(.5-x)*width,(.5-y)*height,width,height);lastFraming=framing}
    // Add bounded camera parallax to the absolute scroll pose; never accumulate model transforms.
    const strength=state.distance<5?.25:1
    const yaw=state.yaw+gaze.x*.065*strength,pitch=state.pitch+gaze.y*.032*strength
    const offset = new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(distance)
    camera.position.copy(state.target).add(offset)
    camera.lookAt(state.target)
    controls.target.copy(state.target)
  }
  camera.updateMatrixWorld()
  const width = viewWidth, height = viewHeight
  partLabels.forEach(label=>{
    const name=label.dataset.part,box=bounds.get(name)
    if(!box || state.explode<.65 || interactive){label.style.opacity=0;return}
    const anchor=box.getCenter(new THREE.Vector3())
    anchor.y=box.max.y+.17
    if(name==='Hall_Roof') anchor.y=Math.max(box.max.y,bounds.get('Hall_Decoration')?.max.y||0)+.17
    if(name==='Hall_Base'){anchor.y=.34;anchor.z=box.max.z*.62}
    anchor.addScaledVector(explosionWorld.get(name),state.explode).project(camera)
    label.style.left=`${(anchor.x*.5+.5)*width}px`
    label.style.top=`${(-anchor.y*.5+.5)*height}px`
    label.style.opacity=anchor.z>-1&&anchor.z<1?ease(clamp((state.explode-.65)/.35)):0
  })
}

function enterExplore() {
  if (!ready || interactive) return
  resetGaze(true)
  applyPose()
  interactive = true
  controls.enabled = true
  controls.update()
  viewport.classList.add('is-interactive')
  explore.textContent = '退出自由观察'
  explore.setAttribute('aria-pressed','true')
  controlsPanel.hidden = false
  $('#control-help').textContent = '拖拽旋转 · 按钮缩放 · 页面滚动即返回叙事'
  dirty = true
  requestRender()
}
function leaveExplore() {
  if (!interactive) return
  interactive = false
  resetGaze(true)
  controls.enabled = false
  viewport.classList.remove('is-interactive')
  explore.textContent = '自由观察 ↗'
  explore.setAttribute('aria-pressed','false')
  controlsPanel.hidden = true
  updateControlHelp()
  dirty = true
  requestRender()
}
explore.addEventListener('click', () => interactive ? leaveExplore() : enterExplore())
$('#reset-view').addEventListener('click', leaveExplore)
for (const [id,factor] of [['zoom-in',0.85],['zoom-out',1.18]]) {
  $(id.startsWith('#')?id:`#${id}`).addEventListener('click', () => {
    const offset = camera.position.clone().sub(controls.target)
    offset.setLength(clamp(offset.length()*factor,controls.minDistance,controls.maxDistance))
    camera.position.copy(controls.target).add(offset); controls.update(); dirty=true; requestRender()
  })
}
window.addEventListener('keydown', event => { if (event.key==='Escape') leaveExplore() })

function fail(message) {
  busy = false
  document.body.dataset.modelState = 'error'
  status.textContent = message
  retry.hidden = false
  retry.disabled = false
  $('#load-indicator').hidden = true
}

async function load() {
  if (busy) return
  busy = true
  retry.hidden = true
  $('#load-indicator').hidden = false
  document.body.dataset.modelState = 'loading'
  status.textContent = '正在走近祈年殿 · 0%'
  const draco = new DRACOLoader()
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/gltf/`)
  draco.setWorkerLimit(2)
  const loader = new GLTFLoader().setDRACOLoader(draco)
  const variant = mobile.matches || navigator.deviceMemory <= 4 ? 'lite' : 'web'
  assetVariant = variant
  try {
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/qiniandian_archive_${variant}_v02.glb`, event => {
      const percent = event.total ? Math.min(99, Math.round(event.loaded/event.total*100)) : null
      status.textContent = percent === null ? '正在载入殿宇细节…' : `正在走近祈年殿 · ${percent}%`
      $('#load-indicator').value = percent || 0
    })
    prepare(gltf)
    status.textContent = '正在准备殿宇画面…'
    spatialStats=await partitionForCulling(model)
    lighting.bind(model)
    depthPass.bind(model)
    // Warm both shell passes before scrolling, avoiding a shader-compilation hitch mid-flight.
    for (const name of groupNames) opacity(name,.5)
    await renderer.compileAsync(scene,camera)
    for (const name of groupNames) opacity(name,1)
    await renderer.compileAsync(scene,camera)
    ready = true; busy = false
    document.body.dataset.modelState = 'ready'
    status.textContent = '祈年殿 · 北京天坛'
    $('#load-indicator').hidden = true
    explore.disabled = false
    measure(); dirty = true
  } catch (error) { console.error('Existing GLB loading failed',error); fail('画面暂未载入，仍可继续阅读。请重试。') }
  finally { draco.dispose() }
}

function render(time = 0) {
  frame = 0
  if (document.hidden) return
  if (uiDirty) updateUI()
  if (!renderer || !ready) return
  // On a saturated GPU, don't queue a new million-triangle frame on every UI tick.
  // Text/scroll and the independent video continue at their own cadence; the camera
  // samples absolute elapsed time, so skipped ticks never accumulate motion or drift.
  if(renderInterval&&time-lastDraw<renderInterval-1){requestRender();return}
  const dt=Math.min(.10,Math.max(0,(time-lastPoseTime)/1000));lastPoseTime=time
  const follows=gazeAllowed()&&performance.now()-lastScrollTime>160
  const gx=follows?gaze.targetX:0,gy=follows?gaze.targetY:0
  const gazeMoving=Math.abs(gaze.x-gx)>.00001||Math.abs(gaze.y-gy)>.00001
  if(gazeMoving){
    const damping=1-Math.exp(-12*dt)
    gaze.x=Math.abs(gaze.x-gx)<.0005?gx:mix(gaze.x,gx,damping)
    gaze.y=Math.abs(gaze.y-gy)<.0005?gy:mix(gaze.y,gy,damping)
  }
  const moving = Math.abs(progress-renderedProgress) > .00001
  if (moving) {
    renderedProgress = reduced.matches || Math.abs(progress-renderedProgress)<.0002 ? progress : mix(renderedProgress,progress,1-Math.exp(-7*dt))
  }
  const pose = sample(reduced.matches ? 0 : renderedProgress)
  const signature = [gaze.x,gaze.y,pose.target.x,pose.target.y,pose.target.z,...Object.entries(pose).filter(([key])=>key!=='target').map(([,value])=>value)]
  const changed = !lastPose || signature.some((value,i)=>Math.abs(value-lastPose[i])>1e-8)
  if (dirty || changed) {
    applyPose(pose)
    if (interactive) controls.update()
    depthPass.render(!interactive&&pose.distance>7&&pose.explode<.01&&pose.roof>=.995)
    renderStats.draws++
    lastPose = signature
    dirty=false
    // One-way adaptation for a busy GPU: stable model cadence, not a blurry canvas.
    // Never interpret deliberately skipped ticks as another reason to lower quality.
    const elapsed = time-lastDraw
    if (!renderInterval && (moving || gazeMoving || interactive) && elapsed>0 && elapsed<100) {
      frameWindow++; if(elapsed>25) slowFrames++
      if(frameWindow>=36){
        if(slowFrames>9){
          renderInterval=1000/30
        }
        if(slowFrames>9 && pixelRatioCap>1){
          pixelRatioCap=Math.max(1,pixelRatioCap-.20)
          renderer.setPixelRatio(Math.min(devicePixelRatio,pixelRatioCap))
          dirty=true;renderStats.qualityReductions++
        }
        frameWindow=0;slowFrames=0
      }
    }
    lastDraw=time
    renderStats.frameInterval=renderInterval
  } else if(moving) {
    renderStats.skippedPoses++
  }
  if (moving || dirty || uiDirty || gazeMoving) requestRender()
}

function boot() {
  try {
    renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})
    renderer.setClearColor(0,0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    depthPass=createDepthPrepass(renderer,scene,camera)
    lighting=createTempleLighting(renderer,scene,{compact:mobile.matches||navigator.deviceMemory<=4,invalidate:()=>{dirty=true;requestRender()}})
    controls = new OrbitControls(camera,canvas)
    controls.enabled = false
    controls.enableDamping = false
    controls.enablePan = false
    controls.enableZoom = false // Keep the page wheel for scroll; use explicit zoom buttons.
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
    controls.minDistance = .25; controls.maxDistance = 45
    controls.maxPolarAngle = Math.PI * .99
    controls.addEventListener('change',()=>{dirty=true;requestRender()})
    canvas.addEventListener('webglcontextlost', event => {event.preventDefault();ready=false;fail('三维上下文已暂停，请重新加载恢复。');retry.textContent='重新加载页面';retry.onclick=()=>location.reload()})
    measure(); load(); requestRender()
  } catch (error) { console.error(error); fail('当前浏览器无法启动 WebGL。可继续阅读或在支持 WebGL 的浏览器重试。'); retry.onclick=()=>location.reload() }
}
retry.addEventListener('click',load)
window.addEventListener('scroll',updateProgress,{passive:true})
window.addEventListener('resize',measure)
mobile.addEventListener('change',measure)
reduced.addEventListener('change',()=>{resetGaze(true);leaveExplore();updateProgress()})
finePointer.addEventListener('change',()=>resetGaze(true))
window.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||!ready||!gazeAllowed()||performance.now()-lastScrollTime<160)return
  if(event.target.closest?.('button,a,input,dialog,.site-nav,.reading-journey,.mobile-copy')||scrollY>scrollStops[5]+pageHeight*.5){resetGaze();return}
  const x=(event.clientX-viewLeft)/viewWidth,y=(event.clientY-viewTop)/viewHeight
  if(x<0||x>1||y<0||y>1){resetGaze();return}
  gaze.targetX=clamp((x-.5)*2,-1,1);gaze.targetY=clamp((.5-y)*2,-1,1);requestRender()
},{passive:true})
window.addEventListener('pointerout',event=>{if(!event.relatedTarget)resetGaze()},{passive:true})
window.addEventListener('blur',()=>resetGaze())
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else{dirty=true;lastPoseTime=performance.now();requestRender()}})
measure(); updateUI(); boot()
const initial = names.indexOf(location.hash.slice(1))
if (initial > 0) {
  const alignHash = () => requestAnimationFrame(()=>{measure();window.scrollTo({top:scrollStops[initial],behavior:'instant'})})
  if (document.readyState === 'complete') alignHash()
  else window.addEventListener('load',alignHash,{once:true})
}
document.fonts.ready.then(measure)

if (import.meta.env.DEV) {
  window.__QND_RENDER__={state:()=>lighting?.state()}
  window.__QND_VIEW__={gaze:()=>({...gaze,allowed:gazeAllowed()}),spatial:()=>spatialStats}
  // Read-only diagnostics for scroll reversibility / QA. No production dependency.
  window.__QND_STORY__ = { state:() => ({ ready, progress, renderedProgress, interactive, reduced:reduced.matches, explosion:ready?sample(reduced.matches?0:renderedProgress).explode:0,modelCount:placement.children.length,groupNames:[...groups.keys()], camera:camera.position.toArray(), target:controls?.target.toArray(), triangles:renderer?.info.render.triangles, transforms:[...groups].map(([name,node])=>({name,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),visible:node.visible})), viewport:viewport.getBoundingClientRect().toJSON(), range, scrollStops, uvRepairs, assetUVRepairs, optimizedUVs, quality:{asset:assetVariant,pixelRatio:renderer?.getPixelRatio()},renderStats:{...renderStats},bounds:[...bounds].map(([name,box])=>({name,min:box.min.toArray(),max:box.max.toArray()})), materials:materialBounds.map(item=>({...item,box:{min:item.box.min.toArray(),max:item.box.max.toArray()}})) }) }
}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0})
window.addEventListener('pageshow',event=>{if(event.persisted){dirty=true;requestRender()}})

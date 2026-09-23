import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import './styles.css'

const canvas = document.querySelector('#scene-canvas')
const loadingScreen = document.querySelector('#loading-screen')
const loadingProgress = document.querySelector('#loading-progress')
const loadingStatus = document.querySelector('#loading-status')
const modelStatus = document.querySelector('#model-status')
const chapters = [...document.querySelectorAll('[data-camera]')]
const cameraChapters = ['hero', 'form', 'structure', 'openings', 'interior', 'base']
  .map((id) => document.querySelector(`#${id}`))
  .filter(Boolean)
const navLinks = [...document.querySelectorAll('[data-nav]')]
const historySection = document.querySelector('#studies')
const historyTimeline = document.querySelector('.history-timeline')
const progressDots = [...document.querySelectorAll('.progress-dots i')]
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMobile = window.matchMedia('(pointer: coarse), (max-width: 720px)').matches

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000)
camera.up.set(0, 1, 0)
const worldUpAxis = new THREE.Vector3(0, 1, 0)
const worldRightAxis = new THREE.Vector3(1, 0, 0)
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 1.8))
renderer.setClearColor(0x000000, 0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.AgXToneMapping
renderer.toneMappingExposure = 1.08

const modelRoot = new THREE.Group()
scene.add(modelRoot)

const ambient = new THREE.HemisphereLight(0xd4c7ad, 0x17191a, 0.98)
scene.add(ambient)

const warmKey = new THREE.DirectionalLight(0xf0dcb5, 2.2)
warmKey.position.set(-8, 14, 15)
scene.add(warmKey)

const duskFill = new THREE.DirectionalLight(0xa3bac5, 0.92)
duskFill.position.set(12, 7, 10)
scene.add(duskFill)

const rimLight = new THREE.PointLight(0x9d6459, 0.24, 28)
rimLight.position.set(0, 2, 8)
scene.add(rimLight)

const loader = new GLTFLoader()
const draco = new DRACOLoader()
draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`)
loader.setDRACOLoader(draco)

const pointer = { x: 0, y: 0 }
const smoothedPointer = { x: 0, y: 0 }
const dragOrbit = { x: 0, y: 0 }
const smoothedDrag = { x: 0, y: 0 }
let pointerInside = false
let lastPointerMoveAt = 0
let dragStart = null
let modelMetrics = null
let modelGroups = new Map()
let cameraStates = []
let desiredProgress = 0
let currentProgress = 0
let activeStage = 0
let lastTime = performance.now()

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lerp = (a, b, t) => a + (b - a) * t
const modelPartNames = new Set([
  'Hall_Root',
  'Hall_Roof',
  'Hall_Columns',
  'Hall_Windows',
  'Hall_Interior',
  'Hall_Base',
  'Hall_Decoration',
])

// Several exported GLB materials retain their names but have no glTF baseColorFactor.
// Restore those missing swatches by material name while leaving embedded color maps untouched.
const materialColorFallbacks = new Map([
  ['M_汉白玉_细晶石纹', 0xd8d1c3],
  ['M_汉白玉_浅雕底色', 0xe3ddcf],
  ['M_石雕深凹阴影', 0x625b52],
  ['M_露天石板_00', 0xb9b3a8],
  ['M_露天石板_01', 0xc5bfb3],
  ['M_露天石板_02', 0xada79b],
  ['M_露天石板_03', 0xd0c9bc],
  ['M_露天石板_04', 0xbdb7ab],
  ['M_朱红木柱_漆下木纹', 0xa63a2d],
  ['M_鎏金与贴金', 0xd1a648],
  ['M_青蓝彩漆', 0x365d7e],
  ['M_石绿彩漆', 0x3b705d],
  ['M_木构阴面', 0x452a25],
])
const materialColorPrefixes = [
  ['M_霁蓝琉璃_', 0x28577e],
]

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function prepareMaterials(model) {
  model.traverse((object) => {
    if (!object.isMesh) return
    object.castShadow = true
    object.receiveShadow = true
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!material || material.map) return
      const fallbackColor = materialColorFallbacks.get(material.name)
        ?? materialColorPrefixes.find(([prefix]) => material.name?.startsWith(prefix))?.[1]
      if (fallbackColor) material.color.setHex(fallbackColor)
    })
    let parent = object
    while (parent && parent !== model) {
      if (modelPartNames.has(parent.name)) {
        object.userData.archivePart = parent.name
        break
      }
      parent = parent.parent
    }
  })
}

function normalizeModel(model) {
  const rawBounds = new THREE.Box3().setFromObject(model)
  const rawSize = rawBounds.getSize(new THREE.Vector3())
  const rawCenter = rawBounds.getCenter(new THREE.Vector3())
  model.position.set(-rawCenter.x, -rawBounds.min.y, -rawCenter.z)

  const scale = 11.8 / Math.max(rawSize.x, rawSize.z)
  modelRoot.scale.setScalar(scale)

  const normalizedSize = rawSize.multiplyScalar(scale)
  modelMetrics = {
    width: normalizedSize.x,
    depth: normalizedSize.z,
    height: normalizedSize.y,
    radius: Math.max(normalizedSize.x, normalizedSize.z) * 0.5,
  }
  modelRoot.position.x = isMobile ? 0 : modelMetrics.radius * 0.36

  modelPartNames.forEach((name) => {
    const node = model.getObjectByName(name)
    if (node) modelGroups.set(name, node)
  })
}

function buildCameraStates() {
  const { radius, height } = modelMetrics
  const targetY = height * 0.48
  const subjectFocus = new THREE.Vector3(isMobile ? 0 : radius * 0.36, targetY, 0)
  const roofNode = modelGroups.get('Hall_Roof')

  // Aim the detail shot at the real roof geometry from the loaded GLB.
  // The rest of the journey then eases out into a measured 110-degree orbit.
  let roofFocus = subjectFocus.clone()
  let roofHeight = height * 0.36
  if (roofNode) {
    modelRoot.updateWorldMatrix(true, true)
    const roofBounds = new THREE.Box3().setFromObject(roofNode)
    if (!roofBounds.isEmpty()) {
      const roofSize = roofBounds.getSize(new THREE.Vector3())
      roofFocus = roofBounds.getCenter(new THREE.Vector3())
      roofFocus.y = roofBounds.min.y + roofSize.y * 0.46
      roofHeight = roofSize.y
    }
  }

  const establishingTarget = subjectFocus.clone()
  const roofCloseTarget = roofFocus.clone()
  const orbitDistance = radius * 2.35
  const orbitHeight = height * 0.22
  const orbitState = (angleDegrees) => {
    const angle = THREE.MathUtils.degToRad(angleDegrees)
    const target = subjectFocus.clone()
    return {
      position: target.clone().add(new THREE.Vector3(
        Math.sin(angle) * orbitDistance,
        orbitHeight,
        Math.cos(angle) * orbitDistance,
      )),
      target,
      fov: 37,
    }
  }

  const establishingDistance = radius * 3.15
  const roofCloseOffset = new THREE.Vector3(-radius * 0.18, roofHeight * 0.12, radius * 1.28)
  const finalDistance = radius * 3.7

  cameraStates = [
    // 0 — establish the full silhouette against the dusk sky.
    {
      position: establishingTarget.clone().add(new THREE.Vector3(0, height * 0.27, establishingDistance)),
      target: establishingTarget,
      fov: 39,
    },
    // 1 — move in to the eaves and layered roof, using actual GLB bounds.
    {
      position: roofCloseTarget.clone().add(roofCloseOffset),
      target: roofCloseTarget,
      fov: 35,
    },
    // 2–4 — a restrained three-beat orbit across roughly 110 degrees.
    orbitState(55),
    orbitState(0),
    orbitState(-55),
    // 5 — pull back to a quiet, complete architectural portrait.
    {
      position: subjectFocus.clone().add(new THREE.Vector3(radius * 0.08, height * 0.31, finalDistance)),
      target: subjectFocus.clone(),
      fov: 40,
    },
  ]

  if (isMobile) {
    const mobileFrameShift = new THREE.Vector3(0, -height * 0.07, 0)
    cameraStates = cameraStates.map((state) => ({
      ...state,
      position: state.position.clone().multiplyScalar(1.2).add(mobileFrameShift),
      target: state.target.clone().multiplyScalar(1.2).add(mobileFrameShift),
      fov: state.fov + 4,
    }))
  }
}

function setHighlight(stageIndex) {
  const namesByStage = ['Hall_Root', 'Hall_Roof', 'Hall_Columns', 'Hall_Windows', 'Hall_Interior', 'Hall_Base']
  const activeName = namesByStage[stageIndex] || 'Hall_Root'
  modelGroups.forEach((node, name) => {
    if (!node) return
    node.userData.focused = activeName === 'Hall_Root' || name === activeName
  })
}

function sampleCamera(progress) {
  const maxIndex = cameraStates.length - 1
  const scaled = clamp(progress, 0, maxIndex)
  const index = Math.min(Math.floor(scaled), maxIndex - 1)
  const linearMix = scaled - index
  const mix = linearMix * linearMix * (3 - 2 * linearMix)
  const from = cameraStates[index]
  const to = cameraStates[Math.min(index + 1, maxIndex)]
  return {
    position: from.position.clone().lerp(to.position, mix),
    target: from.target.clone().lerp(to.target, mix),
    fov: lerp(from.fov, to.fov, mix),
  }
}

function updateScrollTarget() {
  const scrollY = window.scrollY
  const starts = cameraChapters.map((chapter) => chapter.offsetTop)

  if (scrollY <= starts[0]) {
    desiredProgress = 0
  } else if (scrollY >= starts[starts.length - 1]) {
    desiredProgress = cameraStates.length - 1
  } else {
    for (let index = 0; index < starts.length - 1; index += 1) {
      if (scrollY >= starts[index] && scrollY < starts[index + 1]) {
        desiredProgress = index + clamp((scrollY - starts[index]) / Math.max(1, starts[index + 1] - starts[index]))
        break
      }
    }
  }

  const nextStage = Math.min(cameraStates.length - 1, Math.round(desiredProgress))
  if (nextStage !== activeStage) {
    activeStage = nextStage
    setHighlight(activeStage)
    updateChapterState(activeStage)
  }

  updateTimelineProgress()
}

function updateTimelineProgress() {
  if (!historySection || !historyTimeline) return

  const sectionBounds = historySection.getBoundingClientRect()
  const progress = clamp(
    (window.innerHeight - sectionBounds.top) / (sectionBounds.height + window.innerHeight),
  )
  historyTimeline.style.setProperty('--timeline-progress', `${progress * 100}%`)

  const activeDots = Math.ceil(progress * progressDots.length)
  progressDots.forEach((dot, index) => dot.classList.toggle('is-active', index < activeDots))
}

function updateChapterState(stageIndex) {
  const stageNames = ['hero', 'form', 'structure', 'openings', 'interior', 'base']
  const activeName = stageNames[stageIndex] || 'base'
  const activeNavName = stageIndex === 5 ? 'studies' : activeName
  document.body.dataset.activeStage = activeName
  navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.nav === activeNavName))
  chapters.forEach((chapter) => {
    chapter.classList.toggle('is-current', Number(chapter.dataset.camera) === stageIndex)
  })
}

function updateCamera(deltaSeconds, time) {
  if (!cameraStates.length) return

  const smoothing = reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 4.2)
  currentProgress = lerp(currentProgress, desiredProgress, smoothing)

  const sampled = sampleCamera(currentProgress)
  camera.fov = lerp(camera.fov, sampled.fov, reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 5))
  camera.updateProjectionMatrix()

  const pointerActive = pointerInside && time - lastPointerMoveAt < 1800
  const pointerEase = reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 6)
  smoothedPointer.x = lerp(smoothedPointer.x, pointerActive ? pointer.x : 0, pointerEase)
  smoothedPointer.y = lerp(smoothedPointer.y, pointerActive ? pointer.y : 0, pointerEase)

  const dragEase = reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 8)
  smoothedDrag.x = lerp(smoothedDrag.x, dragOrbit.x, dragEase)
  smoothedDrag.y = lerp(smoothedDrag.y, dragOrbit.y, dragEase)

  const softenInput = (value) => Math.sign(value) * Math.pow(Math.abs(value), 1.18)
  const idleAllowed = !reducedMotion && !pointerActive && !dragStart
    && Math.abs(smoothedDrag.x) + Math.abs(smoothedDrag.y) < 0.01
  const idleYaw = idleAllowed ? Math.sin(time * 0.000045) * 0.28 : 0
  const idlePitch = idleAllowed ? Math.sin(time * 0.000032 + 1.2) * 0.08 : 0
  const orbitYaw = THREE.MathUtils.degToRad(
    (softenInput(smoothedPointer.x) * 6 + smoothedDrag.x * 8 + idleYaw)
      * (reducedMotion ? 0 : 1),
  )
  const orbitPitch = THREE.MathUtils.degToRad(
    (softenInput(smoothedPointer.y) * 3 + smoothedDrag.y * 4 + idlePitch)
      * (reducedMotion ? 0 : 1),
  )
  const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(worldUpAxis, orbitYaw)
  const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(worldRightAxis, -orbitPitch)
  const orbitQuaternion = yawQuaternion.multiply(pitchQuaternion)
  const offset = sampled.position.clone().sub(sampled.target).applyQuaternion(orbitQuaternion)
  const finalTarget = sampled.target.clone()
  camera.position.copy(finalTarget).add(offset)
  camera.lookAt(finalTarget)
}

function updateScene(time) {
  const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000)
  lastTime = time
  updateCamera(deltaSeconds, time)
  renderer.render(scene, camera)
}

function attachPointerControls() {
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    pointerInside = true
    lastPointerMoveAt = performance.now()
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -((event.clientY / window.innerHeight) * 2 - 1)
  })

  window.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) pointerInside = false
  })

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return
    dragStart = { x: event.clientX, y: event.clientY }
  }, { passive: true })

  window.addEventListener('pointermove', (event) => {
    if (!dragStart || event.pointerType === 'mouse') return
    dragOrbit.x = clamp(dragOrbit.x - (event.clientX - dragStart.x) * 0.003, -0.5, 0.5)
    dragOrbit.y = clamp(dragOrbit.y + (event.clientY - dragStart.y) * 0.003, -0.35, 0.35)
    dragStart = { x: event.clientX, y: event.clientY }
  }, { passive: true })

  const releaseDrag = () => {
    dragStart = null
    dragOrbit.x = 0
    dragOrbit.y = 0
  }
  window.addEventListener('pointerup', releaseDrag, { passive: true })
  window.addEventListener('pointercancel', releaseDrag, { passive: true })
}

function attachNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'))
      if (!target) return
      event.preventDefault()
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    })
  })
}

function observeChapters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible')
    })
  }, { threshold: 0.18 })
  chapters.forEach((chapter) => observer.observe(chapter))

  const timelineObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible')
    })
  }, { threshold: 0.16 })
  document.querySelectorAll('.timeline-entry').forEach((entry) => timelineObserver.observe(entry))
}

function loadModel() {
  const baseUrl = import.meta.env.BASE_URL
  const url = isMobile
    ? `${baseUrl}models/qiniandian_archive_mobile_v01.glb`
    : `${baseUrl}models/qiniandian_archive_master_v01.glb`

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene
      prepareMaterials(model)
      normalizeModel(model)
      modelRoot.add(model)
      buildCameraStates()
      setHighlight(0)
      updateChapterState(0)
      modelStatus.classList.add('is-ready')
      loadingStatus.textContent = '建筑模型已就绪 · LIVE'
      loadingProgress.style.width = '100%'
      window.setTimeout(() => loadingScreen.classList.add('is-hidden'), reducedMotion ? 0 : 700)
      resize()
      updateScrollTarget()
      renderer.setAnimationLoop(updateScene)
    },
    (event) => {
      const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0
      loadingProgress.style.width = `${percent}%`
      loadingStatus.textContent = `加载建筑模型 · ${percent}%`
    },
    (error) => {
      console.error('GLB load failed', error)
      loadingStatus.textContent = 'GLB 加载失败 · 请检查模型路径'
      modelStatus.classList.add('is-error')
      window.setTimeout(() => loadingScreen.classList.add('is-hidden'), 1600)
    },
  )
}

resize()
attachPointerControls()
attachNavigation()
observeChapters()
window.addEventListener('resize', () => {
  resize()
  updateScrollTarget()
})
window.addEventListener('scroll', updateScrollTarget, { passive: true })
loadModel()

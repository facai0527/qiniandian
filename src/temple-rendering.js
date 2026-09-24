import * as THREE from 'three'

// Reference-led display values, not measured pigment/albedo samples.
// Sources and the distinction between surveyed appearance and interpretive geometry:
// ../RENDERING-NOTES.md. Original GLBs and all embedded paintings are preserved.
const colors=new Map([
  ['M_汉白玉_细晶石纹',0xdcdcd3],['M_汉白玉_浅雕底色',0xe6e3d9],
  ['M_石雕深凹阴影',0x797b74],['M_朱红木柱_漆下木纹',0xa32c24],
  ['M_鎏金与贴金',0xe6bc69],['M_青蓝彩漆',0x245575],
  ['M_石绿彩漆',0x28634e],['M_木构阴面',0x503329],
  ['M_露天石板_00',0x9b9a90],['M_露天石板_01',0xa8a497],
  ['M_露天石板_02',0x929388],['M_露天石板_03',0xb2aa98],['M_露天石板_04',0x9f9e94],
])
const roofColors=[0x224571,0x254b79,0x20416d,0x284e7c,0x234773]
// Four depth comparisons with bilinear weights instead of the default sixteen.
// Keep the 2048/1024 shadow resolution, real occluders and a filtered edge.
const filteredShadow=THREE.ShaderChunk.shadowmap_pars_fragment.replace(
  /#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \)[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_VSM \))/,
  `#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
    vec2 texelSize = 1.0 / shadowMapSize;
    vec2 p = shadowCoord.xy * shadowMapSize - 0.5;
    vec2 f = fract(p);
    vec2 uv = (floor(p) + 0.5) * texelSize;
    shadow = mix(
      mix(texture2DCompare(shadowMap, uv, shadowCoord.z), texture2DCompare(shadowMap, uv + vec2(texelSize.x, 0.0), shadowCoord.z), f.x),
      mix(texture2DCompare(shadowMap, uv + vec2(0.0, texelSize.y), shadowCoord.z), texture2DCompare(shadowMap, uv + texelSize, shadowCoord.z), f.x), f.y);
  `)

export function prepareTempleMaterial(original,renderer){
  const material=original.clone(),name=material.name
  // The five exported tile batches keep their independent shade variation.
  if(name.startsWith('M_霁蓝琉璃_')){
    const variant=Number(name.slice(-2))||0
    material.color.setHex(roofColors[variant%roofColors.length])
    material.metalness=0;material.roughness=.32+variant*.012
    material.clearcoat=.38;material.clearcoatRoughness=.25;material.ior=1.48
    material.envMapIntensity=.85
  }else if(name==='M_鎏金与贴金'){
    material.color.setHex(colors.get(name));material.metalness=.88;material.roughness=.3;material.envMapIntensity=1.1
  }else if(material.map){
    // Exported packed maps contain the original ornamental roughness; retain all maps/UVs.
    // Do not interpret the default glTF metallicFactor=1 as an all-metal painted ceiling.
    material.metalness=.035;material.roughness=.72;material.color.setHex(0xf4efe3)
    if(material.isMeshPhysicalMaterial){material.clearcoat=.12;material.clearcoatRoughness=.4}
    material.envMapIntensity=.55
  }else{
    const color=colors.get(name);if(color!==undefined)material.color.setHex(color)
    material.metalness=0;material.envMapIntensity=.55
    material.roughness=/汉白玉/.test(name)?.8:/石板|深凹/.test(name)?.92:/朱红/.test(name)?.4:.56
  }
  for(const key of ['map','roughnessMap','metalnessMap','normalMap']){
    if(material[key]){material[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());material[key].needsUpdate=true}
  }
  material.shadowSide=THREE.FrontSide
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',filteredShadow)}
  material.customProgramCacheKey=()=>'qnd-filtered-shadow-4tap-v1'
  material.userData.renderFinish='reference-daylight-v1'
  return material
}

export function createTempleLighting(renderer,scene,{compact=false,invalidate=()=>{}}={}){
  // Precompute one small, neutral outdoor reflection map. Never render it per frame.
  const skyScene=new THREE.Scene()
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{zenith:{value:new THREE.Color(0xaec7e3)},horizon:{value:new THREE.Color(0xf3eee0)},ground:{value:new THREE.Color(0x655c4b)}},
    vertexShader:'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vDirection;uniform vec3 zenith;uniform vec3 horizon;uniform vec3 ground;
      void main(){vec3 d=normalize(vDirection);vec3 c=mix(horizon,zenith,smoothstep(0.0,.85,d.y));
      c=mix(ground,c,smoothstep(-.3,.06,d.y));
      float glow=pow(max(dot(d,normalize(vec3(-4.5,7.0,5.0))),0.0),28.0);
      gl_FragColor=vec4(c+vec3(1.0,.9,.72)*glow*.8,1.0);}`,
  })
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(30,24,12),skyMaterial);skyScene.add(sphere)
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(skyScene,.04,.1,100)
  scene.environment=environment.texture;scene.environmentIntensity=.55
  sphere.geometry.dispose();skyMaterial.dispose();pmrem.dispose()
  const hemisphere=new THREE.HemisphereLight(0xcbdcf2,0x74604b,.42)
  const sun=new THREE.DirectionalLight(0xfff1dc,3.1)
  sun.position.set(-4.5,7,5);sun.target.position.set(0,1.5,0);sun.castShadow=true
  sun.shadow.mapSize.setScalar(compact?1024:2048)
  Object.assign(sun.shadow.camera,{left:-5.8,right:5.8,top:6.6,bottom:-4.6,near:.1,far:24})
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00015;sun.shadow.normalBias=.006
  const fill=new THREE.DirectionalLight(0xc4d8f5,.42);fill.position.set(7,4,1)
  const ceiling=new THREE.DirectionalLight(0xffebd0,0);ceiling.position.set(0,-5,3)
  scene.add(hemisphere,sun,sun.target,fill,ceiling)
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true
  let lastSignature='',shadowUpdates=0,meshes=[],materials=[],lastShadowTime=-Infinity,pending=0
  function bind(root){
    meshes=[];const unique=new Set()
    root.traverse(mesh=>{
      if(!mesh.isMesh)return
      const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material
      // Flat paving receives architectural shadows; its sub-millimetre seams need no extra depth pass.
      mesh.userData.sunCaster=!/露天石板|石雕深凹/.test(material.name)
      mesh.castShadow=mesh.userData.sunCaster;mesh.receiveShadow=true;meshes.push(mesh)
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])unique.add(m)
    })
    materials=[...unique];lastSignature=''
  }
  function update(pose){
    ceiling.intensity=(1-pose.roof)*1.3
    // Camera motion and the video never invalidate shadows. Only real part transforms do.
    // Fading shells stop casting immediately, avoiding an invisible roof shadowing the caisson.
    const signature=[pose.lift,pose.explode,pose.roof>.995,pose.windows>.995,pose.columns>.995,pose.base>.995,pose.decoration>.995].join('|')
    if(signature===lastSignature)return
    // Limit the expensive depth pass, not model animation or video playback. A deferred
    // invalidation guarantees the exact final shadow is redrawn even if the camera stops.
    const now=performance.now(),interval=compact?100:80
    if(now-lastShadowTime<interval){
      if(!pending)pending=setTimeout(()=>{pending=0;invalidate()},interval-(now-lastShadowTime)+1)
      return
    }
    if(pending){clearTimeout(pending);pending=0}
    for(const mesh of meshes){const m=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;mesh.castShadow=mesh.userData.sunCaster&&m.opacity>.995}
    renderer.shadowMap.needsUpdate=true;shadowUpdates++;lastSignature=signature;lastShadowTime=now
  }
  function state(){return {preset:'reference-daylight-v1',environment:!!scene.environment,shadowMap:sun.shadow.mapSize.toArray(),shadowUpdates,materials:materials.map(m=>({name:m.name,color:'#'+m.color.getHexString(),metalness:m.metalness,roughness:m.roughness,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,map:m.map?.name})),casters:meshes.filter(m=>m.castShadow).length,receivers:meshes.filter(m=>m.receiveShadow).length}}
  return {bind,update,state}
}

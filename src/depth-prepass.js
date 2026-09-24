import * as THREE from 'three'

// Resolve visibility with a cheap depth shader before shading the dense painted building.
// The same meshes, transforms and double-sided surfaces are used in both passes.
export function createDepthPrepass(renderer,scene,camera){
  const depth=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});depth.colorWrite=false
  let meshes=[]
  function bind(root){meshes=[];root.traverse(node=>{if(node.isMesh)meshes.push(node)})}
  function render(usePrepass){
    // Closeups already benefit from spatial culling; a second vertex pass there
    // costs more than it saves. The enclosed overview has the greatest overdraw.
    if(!usePrepass){renderer.render(scene,camera);return}
    const hidden=[]
    for(const mesh of meshes){
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]
      if(mesh.visible&&materials.some(m=>m.transparent||m.alphaTest>0)){hidden.push(mesh);mesh.visible=false}
    }
    const autoClear=renderer.autoClear,shadowUpdate=renderer.shadowMap.needsUpdate
    renderer.autoClear=false;renderer.clear();renderer.shadowMap.needsUpdate=false
    scene.overrideMaterial=depth;renderer.render(scene,camera);scene.overrideMaterial=null
    for(const mesh of hidden)mesh.visible=true
    renderer.shadowMap.needsUpdate=shadowUpdate;renderer.render(scene,camera);renderer.autoClear=autoClear
  }
  return {bind,render}
}

import * as THREE from 'three'

// Rendering-only partitions: keep every triangle/attribute, material and the six animation parents.
// The original Blender/export hierarchy is never rewritten or turned into extra movable parts.
export async function partitionForCulling(root) {
  const report={meshes:0,chunks:0,sourceTriangles:0,partitionTriangles:0}
  const meshes=[]
  root.traverse(mesh=>{if(mesh.isMesh && !mesh.isSkinnedMesh && !Array.isArray(mesh.material) && mesh.geometry.index?.count>90000 && !mesh.geometry.morphAttributes.position)meshes.push(mesh)})
  for(const mesh of meshes){
    const geometry=mesh.geometry,index=geometry.index,position=geometry.attributes.position
    if(geometry.groups.length>1)continue
    geometry.computeBoundingBox()
    const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3())
    const axes=['x','y','z'].sort((a,b)=>size[b]-size[a]).slice(0,2)
    const read={x:i=>position.getX(i),y:i=>position.getY(i),z:i=>position.getZ(i)}
    const divisions=4,bins=Array.from({length:divisions*divisions},()=>[])
    for(let i=0;i<index.count;i+=3){
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2)
      const cell=axes.map(axis=>Math.min(divisions-1,Math.max(0,Math.floor(((read[axis](a)+read[axis](b)+read[axis](c))/3-box.min[axis])/Math.max(size[axis],.0001)*divisions))))
      bins[cell[0]+cell[1]*divisions].push(a,b,c)
    }
    let sum=0
    for(const ids of bins){
      if(!ids.length)continue
      const chunk=new THREE.BufferGeometry()
      // Shared immutable vertex streams: no texture/normal/UV loss and no repeated GPU vertex buffers.
      for(const [name,attribute] of Object.entries(geometry.attributes))chunk.setAttribute(name,attribute)
      chunk.setIndex(new THREE.BufferAttribute(new index.array.constructor(ids),1))
      const bounds=new THREE.Box3().makeEmpty(),point=new THREE.Vector3()
      for(const id of ids){point.fromBufferAttribute(position,id);bounds.expandByPoint(point)}
      chunk.boundingBox=bounds;chunk.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere())
      const part=new THREE.Mesh(chunk,mesh.material)
      part.name=mesh.name+'__render_cell_'+report.chunks
      part.matrixAutoUpdate=false;part.renderOrder=mesh.renderOrder;part.userData.renderPartition=true
      mesh.add(part);sum+=ids.length;report.chunks++
    }
    if(sum!==index.count)throw new Error('Triangle partition invariant failed')
    // Keep the same mesh node and transforms as a container; descendants inherit them exactly.
    geometry.setDrawRange(0,0)
    report.meshes++;report.sourceTriangles+=index.count/3;report.partitionTriangles+=sum/3
    await new Promise(resolve=>requestAnimationFrame(resolve))
  }
  return report
}

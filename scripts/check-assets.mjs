import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root=new URL('../',import.meta.url)
const required=[
  'public/models/qiniandian_archive_web_v02.glb',
  'public/models/qiniandian_archive_lite_v02.glb',
  'public/art/gilded-landscape-wide-loop-v1.mp4',
  'public/art/gilded-landscape-mobile-loop-v1.mp4',
  'public/art/gilded-landscape-wide-v1.png',
  'public/art/gilded-landscape-mobile-v1.png',
  'public/draco/gltf/draco_decoder.wasm',
  'public/draco/gltf/draco_wasm_wrapper.js',
  'public/draco/gltf/draco_decoder.js',
]
for(const name of required){
  const url=new URL(name,root),data=await readFile(url)
  assert(data.length>1024,`${name}: file is missing or is a Git LFS pointer`)
  assert(!data.subarray(0,80).toString().includes('git-lfs.github.com'),`${name}: upload the actual asset, not a Git LFS pointer`)
  if(name.endsWith('.glb')){
    assert.equal(data.toString('ascii',0,4),'glTF')
    const doc=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)))
    for(const group of ['Hall_Base','Hall_Roof','Hall_Columns','Hall_Decoration','Hall_Interior','Hall_Windows'])assert(doc.nodes.some(n=>n.name===group),`${name}: ${group} missing`)
    assert.equal(doc.images.length,8,'Keep all eight embedded paintings')
  }
  if(name.endsWith('.mp4'))assert.equal(data.toString('ascii',4,8),'ftyp')
  console.log(`OK ${name} (${(await stat(fileURLToPath(url))).size} bytes)`)
}

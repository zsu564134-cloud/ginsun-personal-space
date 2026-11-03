import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {createModelDownload} from './model-download.js?v=room-39';
import {interiorPlantAssets} from './interior-plant-assets.js?v=room-39';

// User-authored arrangements retain their internal spacing, textures and proportions.
// Small resumable chunks avoid putting another large request on the entry path.
export function queueInteriorPlants(room,queue,onReady){
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),status={};
 const report=()=>{document.querySelector('#space').dataset.indoorPlants=JSON.stringify(status);};
 for(const [key,asset] of Object.entries(interiorPlantAssets)){
  status[key]={state:'queued'};
  queue.push(async()=>{
   const download=createModelDownload(asset,{onProgress:({loaded,total,retrying})=>{
    status[key]={state:retrying?'retrying':'loading',percent:Math.round(loaded/total*100)};report();
   }});
   try{
    const bytes=await download.load(),gltf=await loader.parseAsync(bytes.buffer,''),plant=gltf.scene;
    plant.name=key==='left'?'植物整合':'植物配景2';
    const sourceBounds=new THREE.Box3().setFromObject(plant,true),size=sourceBounds.getSize(new THREE.Vector3());
    plant.scale.setScalar((key==='left'?1.25:3.1/size.y)*1.25);
    plant.updateMatrixWorld(true);
    const bounds=sourceBounds.clone();bounds.min.multiplyScalar(plant.scale.x);bounds.max.multiplyScalar(plant.scale.x);const center=bounds.getCenter(new THREE.Vector3());
    plant.position.add(key==='left'
     ?new THREE.Vector3(-7.65-bounds.min.x,-.012-bounds.min.y,-2.85-bounds.min.z)
     :new THREE.Vector3(6.6-center.x,-.012-bounds.min.y,-1.6-center.z));
    plant.traverse(o=>{
     if(!o.isMesh)return;
     o.castShadow=true;o.receiveShadow=true;
     for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.roughness=Math.max(.65,m.roughness??.75);m.metalness=0;m.envMapIntensity=.45;
      m.side=THREE.DoubleSide;
      if(m.alphaTest>0){m.transparent=false;m.depthWrite=true;m.alphaToCoverage=true;}
      if(m.transparent){m.depthWrite=false;m.forceSinglePass=true;o.castShadow=false;}
      for(const texture of [m.map,m.normalMap,m.roughnessMap])if(texture)texture.anisotropy=8;
     }
    });
    room.add(plant);plant.updateMatrixWorld(true);onReady(key,plant);
    const placed=bounds.clone().translate(plant.position);
    status[key]={state:'ready',min:placed.min.toArray(),max:placed.max.toArray()};report();
   }catch(error){status[key]={state:'error'};report();console.warn('Interior plant '+key+':',error);}
   finally{download.release();}
  });
 }
 report();
}

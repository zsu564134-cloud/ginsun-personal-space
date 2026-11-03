import * as THREE from 'three';

// The export has six very thin closed glass boxes and 2,500-triangle screw
// heads only 23 mm wide. Resolve these in world units before batching.
export function stabilizeShelfSurface(mesh,material){
 const glass=/^shujia0016$/.test(material.name),screw=/^shujia0018$/.test(material.name);
 if(!glass&&!screw)return;
 mesh.updateWorldMatrix(true,false);
 const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 let geometry,rotation=new THREE.Quaternion();
 if(glass){
  const upright=size.y>size.z;
  geometry=new THREE.PlaneGeometry(Math.max(.01,size.x-.012),Math.max(.01,(upright?size.y:size.z)-.012));
  if(!upright)rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  mesh.userData.shelfGlass=true;
 }else{
  geometry=new THREE.CylinderGeometry(size.x*.5,size.x*.5,size.z,12,1);
  rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  mesh.userData.shelfScrew=true;
 }
 const world=new THREE.Matrix4().compose(center,rotation,new THREE.Vector3(1,1,1));
 geometry.applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert().multiply(world));
 mesh.geometry=geometry;
}

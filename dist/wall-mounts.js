import * as THREE from 'three';

// Preserve the authored x layout. Snap only the five wall-mounted groups
// to the measured concrete face, before hit targets and book pivots are made.
export function anchorWallObjects(root,nodes,wallZ=-3.10){
 const report=[];
 for(const id of [733,1150,2487,2490,2493]){
  const object=nodes.get(id);if(!object)continue;
  root.updateMatrixWorld(true);
  const before=new THREE.Box3().setFromObject(object),dz=wallZ+.004-before.min.z;
  const world=object.getWorldPosition(new THREE.Vector3());world.z+=dz;
  if([2487,2490,2493].includes(id))world.y-=.20;
  object.position.copy(object.parent.worldToLocal(world));object.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(object);
  report.push({id,gap:+(bounds.min.z-wallZ).toFixed(4),top:+bounds.max.y.toFixed(3)});
 }
 return report;
}

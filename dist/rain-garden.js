import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';

// Shared detailed tree geometry. Wind bends from the rooted trunk to the twigs;
// leaves use alpha testing, so overlapping canopies never sort as glass.
export function createRainGarden(scene,mobile,queue){
 const garden=new THREE.Group();garden.name='Living rain garden';scene.add(garden);
 const clock={value:0};
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 queue.unshift(()=>new Promise(resolve=>loader.load('assets/plants/tree-small.glb',gltf=>{
  const source=gltf.scene,b=new THREE.Box3().setFromObject(source),height=b.max.y-b.min.y;
  source.position.y-=b.min.y;source.updateMatrixWorld(true);
  source.traverse(o=>{if(!o.isMesh)return;o.castShadow=false;o.receiveShadow=false;
   const m=o.material=mClone(o.material);m.side=THREE.DoubleSide;
   m.transparent=false;m.alphaTest=m.map&&/leav/i.test(m.name)?.42:0;m.depthWrite=true;m.alphaToCoverage=true;
   m.roughness=.86;m.metalness=0;m.envMapIntensity=.24;m.color.multiplyScalar(.78);
   m.onBeforeCompile=s=>{s.uniforms.gardenTime=clock;
    s.vertexShader='uniform float gardenTime;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     float heightMask=pow(clamp(position.y/${height.toFixed(5)},0.,1.),1.7);
     float phase=modelMatrix[3].x*.7+modelMatrix[3].z*.37;
     transformed.x+=heightMask*(sin(gardenTime*.78+phase)*.075+sin(gardenTime*1.8+position.y*2.1+phase)*.018);
     transformed.z+=heightMask*sin(gardenTime*.58+phase)*.04;`);
   };m.customProgramCacheKey=()=> 'rooted-tree-wind-v1';
  });
  const placements=[[-10.5,1.5,5.2],[-11.8,6.5,6.5],[-14,3,9],[-13,-3,8.7],[-15,10,8.3],[-6,-8,9.5],[-1,-8.6,8.6],[5,-9.5,10],[10,-8,8.7]];
  for(const [i,[x,z,h]] of placements.entries()){if(mobile&&i>5)break;const tree=source.clone(true);tree.position.set(x,-.5,z);tree.scale.setScalar(h/height);tree.rotation.y=i*2.39;garden.add(tree);}
  document.querySelector('#space').dataset.garden='tree-model-ready';resolve();
 },undefined,error=>{console.warn('Garden model:',error);resolve();})));
 const skyMat=new THREE.MeshBasicMaterial({color:'#19252a'});
 for(const [x,z,rot] of [[0,-22,0],[-23,2,Math.PI/2]]){const sky=new THREE.Mesh(new THREE.PlaneGeometry(65,28),skyMat);sky.position.set(x,8,z);sky.rotation.y=rot;garden.add(sky);}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshBasicMaterial({color:'#172326'}));ground.rotation.x=-Math.PI/2;ground.position.set(-5,-.12,-5);garden.add(ground);
 // Three depth layers of narrow tapered streaks, sized in metres (not 1px lines).
 // GPU motion keeps every drop falling even when the CPU is busy loading details.
 const amount=mobile?650:1300,geo=new THREE.InstancedBufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,-.5,1,0,.5,1,0],3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geo.setIndex([0,1,2,2,1,3]);
 let seed=418;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const drops=[],speeds=[];
 for(let i=0;i<amount;i++){const side=i<amount*.55;drops.push(side?-8.6-rnd()*9:-14+rnd()*28,rnd()*15,side?-2+rnd()*15:-4.4-rnd()*13);speeds.push(4.8+rnd()*5,.13+rnd()*.23,.007+rnd()*.009);}
 geo.setAttribute('drop',new THREE.InstancedBufferAttribute(new Float32Array(drops),3));geo.setAttribute('motion',new THREE.InstancedBufferAttribute(new Float32Array(speeds),3));geo.instanceCount=amount;
 const rain=new THREE.Mesh(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:clock},
 vertexShader:`attribute vec3 drop;attribute vec3 motion;uniform float time;varying vec2 vUv;
 void main(){vUv=uv;float y=mod(drop.y-time*motion.x,15.);vec3 center=vec3(drop.x+sin(time*.47)*.14,y,drop.z);
 vec4 p=modelViewMatrix*vec4(center,1.);p.xy+=vec2(position.x*motion.z-position.y*.055,position.y*motion.y);gl_Position=projectionMatrix*p;}`,
 fragmentShader:`varying vec2 vUv;void main(){float edge=1.-smoothstep(.1,.5,abs(vUv.x-.5));float a=edge*sin(vUv.y*3.14159)*.40;gl_FragColor=vec4(.46,.55,.59,a);}`
 }));rain.frustumCulled=false;garden.add(rain);
 return {update(seconds,reduced){clock.value=seconds*(reduced?.3:1);},root:garden};
}
function mClone(m){return m.clone();}

import * as THREE from 'three';
import {monsteraLeaf,leafPigment} from './botanical.js?v=room-11';
import {queueInteriorPlants} from './interior-plants.js?v=room-39';
import {createRainGarden} from './rain-garden.js?v=room-40';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
function mergeChildren(group){const buckets=new Map();for(const mesh of [...group.children]){if(!mesh.isMesh)continue;mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(g);group.remove(mesh);}for(const [material,gs] of buckets){const g=mergeGeometries(gs,false);if(g){const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;group.add(m);}gs.forEach(g=>g.dispose());}}

// Geometry is measured against the unmodified furniture export (metres at web scale).
const random=(seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;})(1221);
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function block(parent,w,h,d,x,y,z,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function branch(parent,a,b,r,material){const v=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(r*.65,r,v.length(),7),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());parent.add(m);return m;}
function canvasTexture(size,paint){const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;}
function concreteMap(){return canvasTexture(1024,(c,n)=>{c.fillStyle='#92918b';c.fillRect(0,0,n,n);for(let i=0;i<57000;i++){const v=95+random()*100;c.fillStyle=`rgba(${v},${v},${v},${.025+random()*.05})`;c.fillRect(random()*n,random()*n,1+random()*5,1+random()*3);}for(let i=0;i<2500;i++){const x=random()*n,y=random()*n;c.strokeStyle=`rgba(60,57,50,${random()*.10})`;c.lineWidth=.5+random();c.beginPath();c.arc(x,y,4+random()*14,random()*6,random()*6);c.stroke();}for(let i=0;i<600;i++){c.fillStyle='#6e6d6844';c.beginPath();c.ellipse(random()*n,random()*n,random()*1.5+.3,random()+.3,0,0,7);c.fill();}});}
function woodMap(){return canvasTexture(512,(c,n)=>{c.fillStyle='#524034';c.fillRect(0,0,n,n);for(let i=0;i<6000;i++){const y=random()*n;c.strokeStyle=`rgba(${random()>.5?'15,10,8':'165,140,107'},${random()*.16})`;c.lineWidth=random()*1.5+.2;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(n*.3,y+random()*9-4,n*.7,y+random()*10-5,n,y+random()*5);c.stroke();}});}
function rugMap(){return canvasTexture(1024,(c,n)=>{c.fillStyle='#202b31';c.fillRect(0,0,n,n);const s=128;for(let y=0;y<n;y+=s)for(let x=0;x<n;x+=s){c.fillStyle=((x+y)/s)%2?'#34464e':'#19252b';c.fillRect(x,y,s,s);}c.fillStyle='#865039';for(let i=0;i<n;i+=s){c.fillRect(i,0,9,n);c.fillRect(0,i,n,9);}for(let i=0;i<110000;i++){c.fillStyle=random()>.5?'#ffffff09':'#00000016';c.fillRect(random()*n,random()*n,.6,2.5);}});}
function leafGeometry(monstera=false){
 const s=new THREE.Shape();s.moveTo(0,0);
 if(monstera){s.bezierCurveTo(-.14,-.02,-.38,.10,-.39,.24);s.bezierCurveTo(-.48,.4,-.44,.58,-.35,.67);s.lineTo(-.13,.39);s.lineTo(-.31,.74);s.bezierCurveTo(-.29,.84,-.24,.88,-.19,.91);s.lineTo(-.075,.59);s.lineTo(-.13,.95);s.quadraticCurveTo(-.05,1.06,0,1.12);s.quadraticCurveTo(.05,1.06,.13,.95);s.lineTo(.075,.59);s.lineTo(.19,.91);s.bezierCurveTo(.24,.88,.29,.84,.31,.74);s.lineTo(.13,.39);s.lineTo(.35,.67);s.bezierCurveTo(.44,.58,.48,.4,.39,.24);s.bezierCurveTo(.38,.10,.14,-.02,0,0);for(const sign of [-1,1])for(const y of [.27,.45]){const hole=new THREE.Path();hole.absellipse(sign*.09,y,.025,.052,0,Math.PI*2,true);s.holes.push(hole);}}
 else{s.bezierCurveTo(-.29,.17,-.26,.62,0,.85);s.bezierCurveTo(.26,.62,.29,.17,0,0);}
 const g=new THREE.ShapeGeometry(s,10),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.abs(x)*.2-Math.sin(y*Math.PI)*.09);}g.computeVertexNormals();const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.5+p.getX(i)/.96,p.getY(i)/1.12);return g;
}

export function createRoom(scene,mobile=false){
 const room=new THREE.Group();room.name='Concrete studio';scene.add(room);
 const details=[],plantJobs=[],imageLoader=new THREE.ImageLoader();let detailsStarted=false,shadowDirty=true;
 const pbr=(file,x=1,y=1,color=false)=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=file.includes('normal')?'#8080ff':'#ffffff';ctx.fillRect(0,0,1,1);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;details.push(()=>new Promise(resolve=>imageLoader.load('assets/materials/'+file,img=>{t.dispose();t.image=img;t.needsUpdate=true;resolve();},undefined,()=>resolve())));return t;};
 function loadDetails(){if(detailsStarted)return;detailsStarted=true;let next=0;const worker=async()=>{while(next<details.length){await details[next++]();}};void Promise.all([worker(),worker()]);void (async()=>{for(const job of plantJobs)await job();})();}
 const concrete=concreteMap();const concreteNormal=pbr('concrete-normal.jpg',1,1),concreteRough=pbr('concrete-roughness.jpg',1,1);
 const wallMat=new THREE.MeshStandardMaterial({color:'#96958e',map:concrete,normalMap:concreteNormal,normalScale:new THREE.Vector2(.12,.12),roughnessMap:concreteRough,roughness:.96});
 wallMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat mottle=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(mottle),.65);');};

 const trim=mat('#222521',.32,.75),seam=mat('#52534f'),hole=mat('#43443f');
 function concreteBlock(w,h,d,x,y,z,material){
  const mesh=block(room,w,h,d,x,y,z,material),g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,(nx>.5?p.getZ(i)+z:p.getX(i)+x)/3,(ny>.5?p.getZ(i)+z:p.getY(i)+y)/3);}
  uv.needsUpdate=true;return mesh;
 }
 // Back wall has a real clerestory opening; side wall has a deep recessed rain window.
 concreteBlock(16,4.9,.40,0,2.45,-3.30,wallMat);concreteBlock(16,.44,.40,0,7.02,-3.30,wallMat);
 concreteBlock(.55,1.9,.40,-7.73,5.85,-3.30,wallMat);concreteBlock(.55,1.9,.40,7.73,5.85,-3.30,wallMat);
 concreteBlock(.48,7.25,2,-8.02,3.62,-2.5,wallMat);concreteBlock(.48,.6,7.4,-8.02,.3,2.2,wallMat);concreteBlock(.48,1.05,7.4,-8.02,6.72,2.2,wallMat);concreteBlock(.48,7.25,5.5,-8.02,3.62,8.6,wallMat);
 concreteBlock(.4,7.25,15,8.05,3.62,4.0,wallMat);concreteBlock(16.5,.3,65,0,7.3,29,wallMat);
 for(let x=-7;x<8;x+=2.5){block(room,.012,4.9,.012,x,2.45,-3.086,seam);for(const y of [.55,2.35,4.1]){const h=new THREE.Mesh(new THREE.CylinderGeometry(.037,.037,.008,16),hole);h.rotation.x=Math.PI/2;h.position.set(x+.45,y,-3.08);room.add(h);}}
 for(const y of [1.8,3.65])block(room,16,.012,.012,0,y,-3.086,seam);
 for(let z=-2;z<11.5;z+=2.5){block(room,.012,7.25,.012,7.844,3.62,z,seam);for(const y of [.55,2.35,4.1,5.95]){const h=new THREE.Mesh(new THREE.CylinderGeometry(.037,.037,.008,16),hole);h.rotation.z=Math.PI/2;h.position.set(7.842,y,z+.45);room.add(h);}}
 for(const y of [1.8,3.65,5.5])block(room,.012,.012,15,7.844,y,4,seam);
 // Window frame and individual tilted slats, not a flat striped image.
 for(const y of [4.9,6.79])block(room,15.2,.05,.18,0,y,-3.18,trim);
 for(const x of [-7.48,7.48])block(room,.05,1.92,.18,x,5.85,-3.18,trim);
 const blindMat=mat('#737a77',.57,.32);
 for(let y=4.98;y<6.8;y+=.085){const slat=block(room,14.94,.018,.09,0,y,-3.11,blindMat);slat.rotation.x=-.46;}
 for(const x of [-6,-3,0,3,6])block(room,.009,1.88,.009,x,5.85,-3.04,trim);
 for(const z of [-1.5,5.9])block(room,.13,5.65,.075,-7.91,3.43,z,trim);
 for(const y of [.6,6.23])block(room,.16,.065,7.45,-7.9,y,2.2,trim);
 block(room,.7,.12,7.5,-7.82,.6,2.2,wallMat);

 // Scanned parquet: colour, grain normal and roughness are independent maps.
 const woodMat=new THREE.MeshPhysicalMaterial({map:pbr('parquet-color.jpg',3.4,3.2,true),normalMap:pbr('parquet-normal.jpg',3.4,3.2),normalScale:new THREE.Vector2(.28,.28),roughnessMap:pbr('parquet-roughness.webp',3.4,3.2),roughness:1,metalness:0,color:'#666b70',clearcoat:0,specularIntensity:.3});
 const parquet=new THREE.Mesh(new THREE.PlaneGeometry(16.3,65.2),woodMat);parquet.rotation.x=-Math.PI/2;parquet.position.set(0,-.015,29.05);parquet.receiveShadow=true;const floorUv=parquet.geometry.attributes.uv;for(let i=0;i<floorUv.count;i++)floorUv.setY(i,(floorUv.getY(i)-1)*65.2/15.2+1);room.add(parquet);
 // Oiled, matte wood: keep roughness above .84, even in darker scan pixels.
 woodMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.84+.16*roughnessFactor;');};
 const rugTexture=rugMap();rugTexture.colorSpace=THREE.SRGBColorSpace;rugTexture.repeat.set(1.65,1);
 const rugMat=new THREE.MeshPhysicalMaterial({map:rugTexture,normalMap:pbr('carpet-normal.jpg',11,7.5),normalScale:new THREE.Vector2(.5,.5),roughnessMap:pbr('carpet-roughness.webp',11,7.5),roughness:1,sheen:1,sheenColor:new THREE.Color('#485256'),sheenRoughness:.92,color:'#8d979b'});
 block(room,6.3,.045,4.3,-.48,.012,-.63,rugMat);for(const z of [-2.78,1.52])block(room,6.32,.042,.022,-.48,.012,z,mat('#253239',1));for(const x of [-3.63,2.67])block(room,.022,.042,4.3,x,.012,-.63,mat('#253239',1));

 const veins=leafPigment(),leafGeo=leafGeometry(),monsterGeo=[monsteraLeaf(-1),monsteraLeaf(0),monsteraLeaf(1)];const leafMat=new THREE.MeshStandardMaterial({color:'#7a915e',map:veins,bumpMap:veins,bumpScale:.006,roughness:.59,side:THREE.DoubleSide});
 const monsterMat=new THREE.MeshPhysicalMaterial({color:'#d5d9ba',map:veins,bumpMap:veins,bumpScale:.008,roughness:.58,clearcoat:.06,clearcoatRoughness:.65,side:THREE.DoubleSide});
 // A thin leaf scatters ambient light through its back; opaque plastic shading
 // otherwise turns the broad leaves into black cutouts under grazing light.
 monsterMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*.32;');};
 const bark=new THREE.MeshStandardMaterial({color:'#7e7867',map:pbr('bark-color.jpg',1,3,true),normalMap:pbr('bark-normal.jpg',1,3),normalScale:new THREE.Vector2(.4,.4),roughness:.94}),potMat=new THREE.MeshStandardMaterial({color:'#373a32',roughness:.95,bumpMap:concrete,bumpScale:.06}),soil=mat('#151712');
 function pot(g,r=.43,h=.7){const p=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.75,h,32),potMat);p.position.y=h/2;g.add(p);const s=new THREE.Mesh(new THREE.CircleGeometry(r*.96,32),soil);s.rotation.x=-Math.PI/2;s.position.y=h+.003;g.add(s);}
 function monstera(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);room.add(g);pot(g,.49,.83);
 const leafPlan=[[-.52,1.20,.28,.86,-.75,-.46],[.62,1.36,.10,.82,-.65,.52],[-.32,1.78,-.24,.88,-.38,-.34],[.31,2.05,-.34,.92,-.3,.36],[.02,2.32,-.4,.74,-.20,-.05],[-.68,1.58,-.05,.72,-.48,-.9],[.68,1.85,-.26,.69,-.45,.85],[.02,1.42,.57,.91,-.62,.06],[-.2,1.13,.58,.64,-.8,-.4],[.18,1.05,.37,.53,-.6,.55]];
 for(const [lx,y,lz,size,rx,ry] of leafPlan){const start=new THREE.Vector3(.04*Math.sin(y*4),.7,0),tip=new THREE.Vector3(lx,y,lz),curve=new THREE.QuadraticBezierCurve3(start,new THREE.Vector3(lx*.2,y*.85,lz*.15),tip),stem=new THREE.Mesh(new THREE.TubeGeometry(curve,14,.012,6,false),leafMat);g.add(stem);const leaf=new THREE.Mesh(monsterGeo[Math.floor(random()*3)],monsterMat);leaf.position.copy(tip);leaf.scale.setScalar(size);leaf.rotation.set(-rx+.4,ry,(random()-.5)*.28);leaf.castShadow=true;leaf.receiveShadow=true;g.add(leaf);}
 g.name='Monstera';mergeChildren(g);return g;}
 // Tall broad-leaf tree at left, a similarly scaled Monstera cluster at the right corner.
 const tree=new THREE.Group();tree.position.set(-6.9,0,-1.65);room.add(tree);pot(tree,.48,.86);
 branch(tree,new THREE.Vector3(0,.65,0),new THREE.Vector3(.1,3.1,.06),.065,bark);
 for(let i=0;i<11;i++){const a=i*2.4,y=1.65+i*.19,tip=new THREE.Vector3(Math.cos(a)*(.55+random()*.45),y+.4,Math.sin(a)*.5);branch(tree,new THREE.Vector3(.06,y-.45,0),tip,.026,bark);for(let j=0;j<9;j++){const leaf=new THREE.Mesh(leafGeo,leafMat);leaf.position.copy(tip).add(new THREE.Vector3((random()-.5)*.55,(random()-.5)*.3,(random()-.5)*.6));leaf.rotation.set(random()*.7,random()*6,random()*2-1);leaf.scale.setScalar(.28+random()*.18);tree.add(leaf);}}
 mergeChildren(tree);const lowPlant=monstera(-7.05,1.2,.55);const rightPlant=monstera(6.65,-1.6,1.03);
 queueInteriorPlants(room,plantJobs,key=>{if(key==='left'){room.remove(tree,lowPlant);}else room.remove(rightPlant);shadowDirty=true;});


 // Rain is confined to actual panes. The room remains dry.
 const rainUniform={time:{value:0},strength:{value:1}};
 const paneMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:rainUniform,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;float h(float n){return fract(sin(n*127.1)*43758.5453);}void main(){vec2 uv=vUv;float drops=0.;for(int i=0;i<3;i++){float n=24.+float(i)*21.;float lane=floor(uv.x*n);float r=h(lane+float(i)*53.);float px=fract(uv.x*n)-.2-r*.5;float py=fract(uv.y*(5.+float(i)*3.)+time*(.18+r*.24)+r*7.);float head=exp(-px*px*1100.-pow(py-.25,2.)*190.);float trail=exp(-px*px*11000.)*smoothstep(.25,.33,py)*(1.-smoothstep(.33,.8,py));drops+=(head*.23+trail*.095)*step(.28,r);}gl_FragColor=vec4(vec3(.35,.44,.48)+drops, .045+drops);}`});
 function pane(w,h,x,y,z,rot=0){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),paneMaterial);mesh.position.set(x,y,z);mesh.rotation.y=rot;room.add(mesh);}
 pane(15,1.8,0,5.85,-3.35);pane(7.4,5.6,-8.06,3.42,2.2,Math.PI/2);
 const garden=createRainGarden(scene,mobile,details);

 const hemi=new THREE.HemisphereLight('#93b1c6','#251b13',.18);scene.add(hemi);
 const cool=new THREE.DirectionalLight('#c3ccce',.34);cool.position.set(-8,7,2);scene.add(cool);
 const practicals=[];
 function spot(x,y,z,tx,ty,tz,power,angle=.8){const l=new THREE.SpotLight('#ffdfb4',0,16,angle,.8,2);l.position.set(x,y,z);l.target.position.set(tx,ty,tz);l.castShadow=true;l.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);l.shadow.bias=-.00015;l.shadow.normalBias=.006;l.shadow.radius=5;scene.add(l,l.target);practicals.push([l,power]);return l;}
 spot(-.5,6.4,1,-.4,.3,-.5,45,1.0);RectAreaLightUniformsLib.init();const area=new THREE.RectAreaLight('#ffdfb7',0,7,4);area.position.set(0,4.5,5.5);area.lookAt(0,2,-2);scene.add(area);practicals.push([area,1.7]);const windowFill=new THREE.RectAreaLight('#91aabb',1.5,11,1.4);windowFill.position.set(0,5.7,-2.99);windowFill.lookAt(0,1.5,4);scene.add(windowFill);const sideFill=new THREE.RectAreaLight('#9caeaf',1.25,4.8,4);sideFill.position.set(-7.7,3.8,2);sideFill.lookAt(0,1.8,1);scene.add(sideFill);spot(4,3.35,-1.75,4,1.1,-2.7,15,.92);
 // Broad warm room bounce balances the side window on the right concrete.
 const wallBounce=new THREE.RectAreaLight('#ffdfb7',0,9,5);wallBounce.position.set(3.8,3.7,3.5);wallBounce.lookAt(8,3.5,3.5);scene.add(wallBounce);practicals.push([wallBounce,.55]);
 const plantFill=new THREE.RectAreaLight('#c5cfb9',0,2.4,3);plantFill.position.set(4.7,3,1);plantFill.lookAt(6.65,1.8,-1.6);scene.add(plantFill);practicals.push([plantFill,1.3]);
 const task=spot(-1.9,2.35,-1.9,-1.75,1.45,-1.6,26,.82);practicals.pop();
 const fill=new THREE.PointLight('#edc89b',0,11,2);fill.position.set(1,3.5,1);scene.add(fill);practicals.push([fill,9]);
 let level=0,desk=0,deskTarget=0;
 return {root:room,task,loadDetails,set(v){level=v;practicals.forEach(([l,p])=>l.intensity=p*v);scene.environmentIntensity=.12+v*.52;},setDesk(on){deskTarget=on?1:0;shadowDirty=true;},get deskOn(){return deskTarget>0;},update(t,dt=.016,reduced=false){
  const seconds=t*.001;rainUniform.time.value=seconds*(reduced?.3:1);garden.update(seconds,reduced);
  const changing=Math.abs(deskTarget-desk)>.002;desk+=(deskTarget-desk)*Math.min(1,dt*5);task.intensity=26*desk;
  const update=shadowDirty||changing;shadowDirty=false;return update;
 }};
}

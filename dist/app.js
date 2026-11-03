import {createRoomTelevision} from './room-television.js?v=room-30';
import {applyContent,createContentView,contentUrl} from './content-view.js?v=room-42';
const response=await fetch('./content.json?v=room-42');
if(!response.ok)throw new Error('Unable to load site content');
const siteContent=await response.json();
applyContent(siteContent);
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {dressStudio,studioEnvironment,batchStudio} from './studio-look.js?v=room-13';
import {createRoom} from './room-world.js?v=room-40';
import {anchorWallObjects} from './wall-mounts.js?v=room-12';
import {createModelDownload} from './model-download.js?v=room-39';
import {modelManifest} from './model-manifest.js?v=room-39';

import {createNightEntry} from './night-entry.js?v=room-22';

const $=s=>document.querySelector(s), scene=new THREE.Scene();scene.background=new THREE.Color('#070b0d');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#space').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.1,80);const mobile=()=>innerWidth<700||matchMedia('(pointer:coarse)').matches;
const startPos=new THREE.Vector3(2.2,2.15,15.7),endPos=new THREE.Vector3(2.2,1.95,13.3),endTarget=new THREE.Vector3(-.65,2.45,-.8);camera.position.copy(startPos);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(endTarget);controls.enabled=false;controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=2;controls.maxDistance=17;controls.minPolarAngle=.72;controls.maxPolarAngle=1.65;controls.minAzimuthAngle=-1.05;controls.maxAzimuthAngle=1.05;controls.enablePan=true;controls.panSpeed=.55;controls.rotateSpeed=.45;controls.update();camera.fov=44;camera.updateProjectionMatrix();
scene.environment=studioEnvironment(renderer);
const room=createRoom(scene,mobile());room.set(0);
const mat=(c,metal=0,rough=.5)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});const black=mat('#171819',.25,.32),leather=mat('#222223',.03,.66),chrome=mat('#c4c5c6',.94,.18),dark=mat('#343536',.6,.25),paper=mat('#ecebe6',0,.8),red=mat('#64252d',.55,.2),glass=new THREE.MeshPhysicalMaterial({color:'#929998',metalness:.1,roughness:.13,transparent:true,opacity:.36,side:THREE.DoubleSide});
function box(g,w,h,d,x,y,z,m=black){const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;g.add(a);return a}
function cyl(g,r,h,x,y,z,m=chrome,r2=r){const a=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,h,40),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;g.add(a);return a}
function rod(g,a,b,r=.024,m=chrome){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av),o=cyl(g,r,v.length(),...av.clone().add(bv).multiplyScalar(.5).toArray(),m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o}
function path(g,points,r=.025,m=chrome){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const o=new THREE.Mesh(new THREE.TubeGeometry(curve,48,r,10,false),m);o.castShadow=true;g.add(o);return o}
function group(x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);return g}
const manager=new THREE.LoadingManager();const loader=new THREE.TextureLoader(manager);function texture(src){const t=loader.load(contentUrl(src));t.colorSpace=THREE.SRGBColorSpace;return t}
function screenMaterial(src){const m=new THREE.MeshBasicMaterial({map:texture(src),side:THREE.DoubleSide});m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat tone=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(tone),diffuseColor.rgb,.48);');};m.customProgramCacheKey=()=> 'screen-preview-muted-v2';return m;}
function picture(g,w,h,x,y,z,src){const a=new THREE.Mesh(new THREE.PlaneGeometry(w,h),screenMaterial(src));a.position.set(x,y,z);g.add(a);return a}
const targets=[];function hit(g,key,label){g.userData={...g.userData,key,label};targets.push(g);return g}
const composer={render(){renderer.setRenderTarget(null);renderer.render(scene,camera);},setSize(){}};
// User-authored studio; original geometry and group transforms are retained.
let television=null;
let studioReady=false,studioLoading=false,studioRoot=null,studioLook=null,bookMotion=null,bookRest=null,detailTimer=null;let ceilingOn=false,lightLevel=0,lightMotion=null;const ceilingLight=new THREE.PointLight(0xffedcf,0,10,2);ceilingLight.position.set(-.4,4.8,2.1);scene.add(ceilingLight);
const disc=new THREE.Group();const lampLight=new THREE.PointLight(0xfff5e8,0,3);lampLight.position.set(-1.7,2.1,-2);scene.add(lampLight);
let pendingEntry=null,loadFailed=false;
function loadingStatus(message){$('#loading').classList.remove('hidden');$('#loading').textContent=message;$('#space').dataset.loadStage=message;}
function entryLabel(text){$('#enter').querySelector('span').textContent=text;}
const modelDownload=createModelDownload(modelManifest,{concurrency:4,onProgress:({loaded,total,retrying})=>{
 const percent=Math.min(100,Math.floor(loaded/total*100));
 loadingStatus((retrying?'Reconnecting · 正在重试':'Loading room · 正在加载房间')+' '+percent+'%');
 if(pendingEntry)entryLabel('Loading · '+percent+'%');
}});
function requestEntry(destination='enter'){
 if(mode!=='intro')return;
 if(studioReady){pendingEntry=destination;enter();return;}
 pendingEntry=destination;entryLabel('Loading… / 加载后进入');
 if(!studioLoading)loadStudio();
}
async function loadStudio(){
 if(studioLoading||studioReady)return;studioLoading=true;loadFailed=false;
 try{
 const loadStart=performance.now(),loadTimings={};
 const markStage=stage=>{loadTimings[stage]=Math.round(performance.now()-loadStart);$('#space').dataset.loadTimings=JSON.stringify(loadTimings);};
 loadingStatus('Loading room / 正在加载房间');
 const modelLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const data=await modelDownload.load();markStage('downloadCompleteMs');room.loadDetails();
 loadingStatus('Arranging the studio / 正在布置空间');
 const gltf=await modelLoader.parseAsync(data.buffer,'assets/');markStage('parseCompleteMs');
 const root=gltf.scene;studioRoot=root;root.scale.setScalar(2);root.position.set(-5.1,0,13.2);scene.add(root);root.updateMatrixWorld(true);
 studioLook=dressStudio(root);
 $('#space').dataset.wallMounts=JSON.stringify(anchorWallObjects(root,studioLook.nodes));
 const bindings={24:'architecture',60:'products',2145:'aigc',733:'photography',2487:'about',2264:'music',1150:'music',2176:'socials',8:'lamp',438:'ceiling'};
 root.traverse(o=>{const id=o.userData.sourceIndex;if(bindings[id])hit(o,bindings[id],bindings[id]);if(id===58)o.visible=false;if(id===56&&o.isMesh)o.material=screenMaterial(siteContent.sections.architecture.screen);});
 const book=studioLook.nodes.get(747);if(book){const center=new THREE.Box3().setFromObject(book).getCenter(new THREE.Vector3());const pivot=new THREE.Group();pivot.position.copy(center);scene.add(pivot);pivot.attach(book);hit(pivot,'photography','Photography');bookRest={object:pivot,position:center.clone(),quaternion:pivot.quaternion.clone()};}
 for(const key of Object.keys(focus)){const candidates=targets.filter(o=>o.userData.key===key);if(candidates.length){const box=new THREE.Box3().setFromObject(candidates[0]);focus[key].target=box.getCenter(new THREE.Vector3()).toArray();}}
 // The original freestanding screen retains its geometry and location.
 television=createRoomTelevision(studioLook.nodes.get(2174),siteContent.sections.aigc.items);
 batchStudio(root);let draws=0;root.traverseVisible(o=>{if(o.isMesh)draws++;});console.info("Studio ready: "+draws+" visible mesh draws; matte floor and stable shadows.");
 studioLook.bulbs.forEach(m=>m.emissiveIntensity=0);loadingStatus('Finishing the light / 正在准备光影');renderer.shadowMap.needsUpdate=true;
 markStage('setupCompleteMs');
 // Prewarming is optional: a stalled driver must not keep the entrance locked.
 await Promise.race([renderer.compileAsync(scene,camera).catch(error=>console.warn('Shader prewarm:',error)),new Promise(resolve=>setTimeout(resolve,6000))]);
 markStage('readyMs');
 studioReady=true;modelDownload.release();entryLabel('Step inside');$('#loading').classList.add('hidden');$('#space').dataset.loadStage='ready';renderer.shadowMap.needsUpdate=true;$('#ceiling-toggle').disabled=false;
 room.loadDetails();if(pendingEntry)enter();
 }catch(error){console.error('Studio load failed:',error);loadFailed=true;if(studioRoot){scene.remove(studioRoot);studioRoot=null;targets.length=0;}if(bookRest){scene.remove(bookRest.object);bookRest=null;}studioLook=null;entryLabel('Retry entry / 重试进入');$('#space').dataset.loadStage='failed';$('#loading').innerHTML='Connection interrupted. 已加载部分已保留。 <button id="retry-model">Retry / 继续加载</button>';$('#retry-model').onclick=()=>requestEntry(pendingEntry||'enter');}finally{studioLoading=false;}
}
// A single camera journey connects the room and every work surface.
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const dialog=$('#detail'),content=$('#content');let mode='intro',flight=null,returnView=null,activeKey=null,requestId=0,hover=null,activeTrack=-1;
const titles=Object.fromEntries(Object.entries(siteContent.sections).map(([key,value])=>[key,value.heading]));
const labels={...Object.fromEntries(Object.entries(siteContent.sections).map(([key,value])=>[key,value.label])),socials:['Xiaohongshu','小红书'],lamp:['Desk light','开关台灯'],ceiling:['Ceiling light','开关吊灯']};
const contentView=createContentView({host:content,data:siteContent,toast,onTrack:i=>activeTrack=i});
const focus={architecture:{target:[-.25,2.15,-1.1],offset:[.35,.2,3.6]},products:{target:[.77,1.85,-.75],offset:[.35,.27,2.6]},aigc:{target:[-3.65,2.39,-1.2],offset:[1.8,.1,3.4]},photography:{target:[-.65,3.35,-1.64],offset:[.1,.1,2.5]},about:{target:[2.8,3.05,-1.65],offset:[.15,.05,3]},music:{target:[3.2,1.25,-.15],offset:[.9,1.5,3.1]}};
const portrait=()=>innerHeight>innerWidth;
function overviewFov(){return portrait()?58:44;}
function overviewPosition(){
 const aspect=innerWidth/innerHeight;
 // Fit the room width instead of the old power approximation, which cropped plants.
 const distance=portrait()?Math.max(16,16.8/(2*Math.tan(THREE.MathUtils.degToRad(overviewFov()/2))*aspect)-3):Math.max(13.8,10/(2*Math.tan(THREE.MathUtils.degToRad(22))*aspect));
 return new THREE.Vector3(portrait()?0:3.0,portrait()?2.35:2.05,endTarget.z+distance);
}
function constrainView(){
 controls.minPolarAngle=1.30;controls.maxPolarAngle=1.67;
 controls.minAzimuthAngle=-.38;controls.maxAzimuthAngle=.38;
 controls.enablePan=false;
 controls.minDistance=portrait()?12:7;
 controls.maxDistance=Math.max(18,overviewPosition().distanceTo(endTarget)+1);
}
function snapshot(){return{pos:camera.position.clone(),target:controls.target.clone(),fov:camera.fov}}
function travel(pos,target,fov,duration,done){controls.enabled=false;controls.update();controls.enableDamping=false;controls.minDistance=.3;controls.maxDistance=35;flight={from:snapshot(),pos,target,fov,start:performance.now(),duration:duration,frames:0,done};document.body.classList.add('travelling');$('#tooltip').style.display='none'}
function finishTravel(){document.body.classList.remove('travelling');flight=null}
function explore(){television?.setActive(true);mode='explore';constrainView();controls.enableDamping=true;controls.enabled=true;$('#nav').inert=false;document.querySelectorAll('[data-open]').forEach(b=>b.classList.remove('active'))}
function enter(){if(mode!=='intro'||!studioReady)return;contentView.startMusic();television?.setActive(true);mode='entering';document.body.classList.add('entered','entering');$('#intro').inert=true;entry.enter();$('#nav').classList.remove('hidden');$('#nav').inert=true;$('#reset').classList.remove('hidden');$('#hint').innerHTML='A quiet night. A personal space.<small lang="zh-CN">雨在窗外，创作在这里。</small>';$('#journey-label').textContent='Step inside.';$('#cancel-flight').hidden=true;travel(overviewPosition(),endTarget.clone(),overviewFov(),reduced?350:2800,()=>{document.body.classList.remove('entering');explore();if(!ceilingOn)toggleCeiling();room.setDesk(true);$('#reset').focus({preventScroll:true});const destination=pendingEntry;pendingEntry=null;if(destination==='about'||destination==='works')open(destination==='about'?'about':'architecture');})}
const entry=createNightEntry({onEnter:requestEntry,isReady:()=>studioReady,reduced,renderer,world:scene,camera});
$('#enter').onclick=()=>requestEntry();renderer.domElement.addEventListener('wheel',e=>{if(mode==='intro'&&e.deltaY>0)requestEntry()},{passive:true});
const roomViews=document.createElement('nav');roomViews.id='room-views';roomViews.setAttribute('aria-label','房间取景');
roomViews.innerHTML='<button data-room-view="left">左侧</button><button data-room-view="all">全景</button><button data-room-view="right">右侧</button>';document.body.append(roomViews);
roomViews.addEventListener('click',e=>{const side=e.target.dataset.roomView;if(!side||mode!=='explore')return;
 mode='returning';$('#journey-label').textContent='Changing perspective';$('#cancel-flight').hidden=true;
 const x=side==='left'?-4.1:4.1;
 travel(side==='all'?overviewPosition():new THREE.Vector3(x,2.25,13),side==='all'?endTarget.clone():new THREE.Vector3(x,2.6,-.9),overviewFov(),750,explore);
});
$('#reset').onclick=()=>{if(mode!=='explore')return;mode='returning';$('#journey-label').textContent='Back to the overview.';$('#cancel-flight').hidden=true;travel(overviewPosition(),endTarget.clone(),overviewFov(),1000,explore)};
function returnToSpace(){clearTimeout(detailTimer);animateBook(false);requestId++;if(!returnView)return;const view=returnView;returnView=null;activeKey=null;document.body.classList.remove('viewing');mode='returning';$('#journey-label').textContent='Back to your perspective.';$('#cancel-flight').hidden=true;travel(view.pos,view.target,view.fov,1000,()=>{explore();$('#reset').focus({preventScroll:true})})}
function cancelFlight(){if(mode==='focusing'){flight=null;returnToSpace()}}$('#cancel-flight').onclick=cancelFlight;
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();function intersect(e){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);const h=ray.intersectObjects(targets,true)[0];if(!h)return null;let o=h.object;while(o&&!o.userData.key)o=o.parent;return o}
renderer.domElement.addEventListener('pointermove',e=>{if(mode!=='explore')return;hover=intersect(e);$('#tooltip').style.display=hover?'block':'none';if(hover){const l=labels[hover.userData.key];$('#tooltip').innerHTML=l[0]+'<small lang="zh-CN">'+l[1]+'</small>';$('#tooltip').style.left=Math.max(8,Math.min(e.clientX+16,innerWidth-205))+'px';$('#tooltip').style.top=Math.min(e.clientY+18,innerHeight-85)+'px'}renderer.domElement.style.cursor=hover?'pointer':'grab'});renderer.domElement.addEventListener('pointerleave',()=>$('#tooltip').style.display='none');let down;
renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY,button:e.button});renderer.domElement.addEventListener('pointerup',e=>{if(!down||down.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;if(mode==='intro'){enter();return}if(mode!=='explore')return;const o=intersect(e);if(!o)return;if(o.userData.key==='ceiling'){toggleCeiling();return}if(o.userData.key==='lamp'){room.setDesk(!room.deskOn);toast(room.deskOn?'Light on':'Light off',room.deskOn?'台灯已开启':'台灯已关闭');return}open(o.userData.key)});
let toastTimer;function toast(en,zh=''){clearTimeout(toastTimer);$('#toast').innerHTML=en+(zh?'<small lang="zh-CN">'+zh+'</small>':'');$('#toast').style.display='block';toastTimer=setTimeout(()=>$('#toast').style.display='none',3000)}
function toggleCeiling(){if(!studioReady)return;ceilingOn=!ceilingOn;lightMotion={from:lightLevel,to:ceilingOn?1:0,start:performance.now()};document.body.classList.toggle('lit',ceilingOn);const b=$('#ceiling-toggle');b.setAttribute('aria-pressed',String(ceilingOn));b.setAttribute('aria-label',ceilingOn?'关闭灯光':'打开灯光');b.title=ceilingOn?'点击关闭灯光':'点击打开灯光';b.innerHTML=(ceilingOn?'Lights on':'Lights off')+'<small lang="zh-CN">'+(ceilingOn?'灯光已开':'灯光已关')+'</small>';renderer.shadowMap.needsUpdate=true;}

$('#ceiling-toggle').onclick=toggleCeiling;
function animateBook(out){if(!bookRest)return;const obj=bookRest.object;bookMotion={obj,from:obj.position.clone(),to:bookRest.position.clone().add(new THREE.Vector3(0,out?.08:0,out?.85:0)),fromQ:obj.quaternion.clone(),toQ:out?new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12,.22,-.06)):bookRest.quaternion.clone(),start:performance.now(),duration:750};}
function open(key){if(mode!=='explore')return;if(key==='socials'){returnView=snapshot();activeKey=key;showDetail(key);return;}returnView=snapshot();activeKey=key;mode='focusing';$('#nav').inert=true;$('#journey-label').textContent=labels[key][0];$('#cancel-flight').hidden=false;document.querySelectorAll('[data-open]').forEach(b=>b.classList.toggle('active',b.dataset.open===key));const f=focus[key],target=new THREE.Vector3(...f.target),offset=new THREE.Vector3(...f.offset).multiplyScalar(mobile()?1.4:1);if(key==='photography')animateBook(true);travel(target.clone().add(offset),target,39,1000,()=>{mode='focusing';document.body.classList.add('travelling');detailTimer=setTimeout(()=>{if(mode==='focusing'){finishTravel();showDetail(key)}},220)})}
function showDetail(key){television?.setActive(false);mode='detail';document.body.classList.add('viewing');dialog.className='device-'+key+((key==='architecture'||key==='aigc')?' cinema':'');const center=new THREE.Vector3(...(focus[key]||focus.about).target).project(camera);dialog.style.transformOrigin=((center.x*.5+.5)*100)+'% '+((-center.y*.5+.5)*100)+'%';const heading=titles[key]||['ELSEWHERE','Xiaohongshu','小红书'];$('#category').textContent=heading[0];$('#title').textContent=heading[1];$('#subtitle').textContent=heading[2];content.innerHTML='';dialog.showModal();++requestId;
contentView.show(key);}
function changePage(delta){contentView.changePage(delta);}
function close(){if(mode!=='detail')return;mode='closing';requestId++;contentView.cleanup();dialog.querySelectorAll('video').forEach(v=>v.pause());dialog.classList.add('closing');setTimeout(()=>{dialog.close();dialog.classList.remove('closing');returnToSpace()},600)}$('#close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mode==='focusing')cancelFlight();if(mode==='detail'&&activeKey==='photography'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();changePage(e.key==='ArrowLeft'?-1:1)}});
let lastAspect=innerWidth/innerHeight;
window.addEventListener('resize',()=>{
 const aspect=innerWidth/innerHeight,changedOrientation=(aspect<1)!==(lastAspect<1);lastAspect=aspect;
 camera.aspect=aspect;renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
 if(mode==='explore'){
  constrainView();camera.fov=overviewFov();
  if(changedOrientation){camera.position.copy(overviewPosition());controls.target.copy(endTarget);}
  controls.update();
 }
 if(changedOrientation&&returnView)returnView={pos:overviewPosition(),target:endTarget.clone(),fov:overviewFov()};
 camera.updateProjectionMatrix();
});
let metricStart=0,metricFrames=0,previousFrame=0;function animate(t){requestAnimationFrame(animate);if(document.hidden)return;if(mode==='detail'&&t-previousFrame<50)return;const dt=Math.min(.05,(t-previousFrame)/1000||.016);previousFrame=t;if(room.update(t,dt,reduced))renderer.shadowMap.needsUpdate=true;if(lightMotion){const p=Math.min((t-lightMotion.start)/(reduced?100:1100),1),v=p*p*(3-2*p);lightLevel=THREE.MathUtils.lerp(lightMotion.from,lightMotion.to,v);room.set(lightLevel);renderer.shadowMap.needsUpdate=true;ceilingLight.intensity=0;studioLook?.bulbs.forEach(m=>m.emissiveIntensity=lightLevel*.75);if(p===1)lightMotion=null;}if(bookMotion){renderer.shadowMap.needsUpdate=true;const b=bookMotion,p=Math.min((t-b.start)/b.duration,1),v=p*p*(3-2*p);b.obj.position.lerpVectors(b.from,b.to,v);b.obj.quaternion.slerpQuaternions(b.fromQ,b.toQ,v);if(p===1){bookMotion=null;renderer.shadowMap.needsUpdate=true;}}if(flight){const f=flight;f.frames++;const p=Math.min((t-f.start)/f.duration,1),v=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;camera.position.lerpVectors(f.from.pos,f.pos,v);controls.target.lerpVectors(f.from.target,f.target,v);camera.fov=THREE.MathUtils.lerp(f.from.fov,f.fov,v);camera.updateProjectionMatrix();camera.lookAt(controls.target);if(p===1){console.info("Camera transition: "+Math.round(t-f.start)+" ms / "+f.frames+" frames");finishTravel();f.done()}}else if(mode==='explore'){controls.update();controls.target.x=THREE.MathUtils.clamp(controls.target.x,-5.8,5.8);controls.target.y=THREE.MathUtils.clamp(controls.target.y,.55,5.7);controls.target.z=THREE.MathUtils.clamp(controls.target.z,-2.5,6);camera.position.x=THREE.MathUtils.clamp(camera.position.x,-7.35,7.35);camera.position.y=THREE.MathUtils.clamp(camera.position.y,.4,6.9);camera.position.z=Math.max(camera.position.z,-2.5);}if(activeTrack>=0)disc.rotation.y+=.015;if(entry.active)entry.render(t,dt);else composer.render();metricFrames++;if(t-metricStart>1500){document.querySelector('#space').dataset.metrics=JSON.stringify({mode,ready:studioReady,lights:Number(lightLevel.toFixed(2)),fps:Math.round(metricFrames*1000/(t-metricStart)),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles});metricFrames=0;metricStart=t;}}requestAnimationFrame(animate);

window.__studio={get television(){return television?.state},get mode(){return mode},get ready(){return studioReady},get lightLevel(){return lightLevel},get deskOn(){return room.deskOn},get entry(){return entry.state},get renderInfo(){return {...renderer.info.render}},get camera(){return camera.position.toArray()},get nodes(){return scene.children.map(o=>o.name).filter(Boolean)}};
loadStudio();

renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();studioReady=false;$('#enter').disabled=true;$('#loading').classList.remove('hidden');$('#loading').innerHTML='The graphics session paused. <button onclick="location.reload()">Reload / 重新加载</button>';});

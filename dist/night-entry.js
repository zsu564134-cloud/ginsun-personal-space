import * as THREE from 'three';
import {createWetSurface} from './wet-surface.js?v=room-22';
import {createGlassInk} from './glass-ink.js?v=room-19';

// The live room continues seamlessly on the other side of the pane.
export function createNightEntry({onEnter,reduced,renderer,world,camera}) {
 const host=document.querySelector('#threshold');
 const events=new AbortController(),options={signal:events.signal};
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
 const surface=createWetSurface({reduced});
 const ink=createGlassInk(host);
 const uniforms={room:{value:target.texture},water:{value:surface.water},flow:{value:surface.flow},wipe:{value:surface.wipe},ink:{value:ink.texture},inkReveal:{value:0},
  resolution:{value:new THREE.Vector2()},waterSize:{value:new THREE.Vector2()},progress:{value:0}};
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D room,water,flow,wipe,ink;
  uniform vec2 resolution,waterSize;
  uniform float progress,inkReveal;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  // Pixel coordinates keep the scattered micro-beads round at every aspect ratio.
  vec3 micro(vec2 p,float scale,float density){
   vec2 cell=floor(p/scale),q=fract(p/scale)-.5;
   float seed=hash(cell);q-=(vec2(hash(cell+7.),hash(cell+19.))-.5)*.48;
   q.y*=.8+seed*.5;float radius=mix(.06,.21,hash(cell+3.));
   float d=length(q)/radius,h=max(0.,1.-d*d)*step(density,seed);
   return vec3(-q*h/radius,h);
  }
  void main(){
   float passage=smoothstep(.10,1.,progress),glass=1.-passage;
   vec2 guv=(vUv-.5)/(1.+passage*.23)+.5;
   vec2 pixel=1./waterSize;
   float clear=texture2D(wipe,guv).r;
   float cloud=noise(guv*vec2(6.,4.))*.65+noise(guv*vec2(23.,17.))*.35;
   float film=1.-clear*.94;
   float h=texture2D(water,guv).r*(1.-clear*.90)+texture2D(flow,guv).r;
   vec2 slope=vec2(texture2D(water,guv+vec2(pixel.x,0)).r-texture2D(water,guv-vec2(pixel.x,0)).r,
    texture2D(water,guv+vec2(0,pixel.y)).r-texture2D(water,guv-vec2(0,pixel.y)).r)*(1.-clear*.90);
   slope+=vec2(texture2D(flow,guv+vec2(pixel.x,0)).r-texture2D(flow,guv-vec2(pixel.x,0)).r,
    texture2D(flow,guv+vec2(0,pixel.y)).r-texture2D(flow,guv-vec2(0,pixel.y)).r);
   vec3 fine=micro(guv*resolution,12.,.61)+micro(guv*resolution+71.,5.,.84)*.35;
   fine*=film;
   vec2 normal=slope+fine.xy*.18;
   vec2 refracted=vUv+normal*vec2(19.,19.)/resolution*glass;
   float blurRadius=(2.2+cloud*8.5)*film*(1.-min(h,1.)*.75)*glass;
   vec3 blurred=vec3(0.);
   for(int i=0;i<16;i++){
    float a=float(i)*2.399963,r=sqrt((float(i)+.5)/16.);
    vec2 offset=vec2(cos(a),sin(a))*r*blurRadius/resolution;
    blurred+=texture2D(room,clamp(refracted+offset,.001,.999)).rgb/16.;
   }
   // Lettering sits immediately behind the pane, closer than the room. It shares
   // droplet refraction, but needs less defocus so small text remains readable.
   float reveal=smoothstep(0.,1.,inkReveal);
   vec2 inkUv=guv+normal*2.5/resolution+vec2(0.,(1.-reveal)*14./resolution.y);
   float inkRadius=(.2+cloud*.25)*film+(1.-reveal)*2.;
   float inkAlpha=0.;
   for(int j=0;j<8;j++){
    float a=float(j)*2.399963,r=sqrt((float(j)+.5)/8.);
    inkAlpha+=texture2D(ink,inkUv+vec2(cos(a),sin(a))*r*inkRadius/resolution).a/8.;
   }
   inkAlpha*=reveal*(1.-smoothstep(0.,.30,progress));
   blurred=mix(blurred,vec3(1.1),inkAlpha);
   // Surface reflection persists after wiping: clearing condensation must not cut a black hole.
   vec3 col=mix(blurred,vec3(.075,.091,.101),(.24+film*(.025+cloud*.08))*glass);
   float edge=clamp(length(normal)*2.6,0.,1.);
   float light=max(0.,dot(normal,normalize(vec2(-.6,.8))));
   float dark=max(0.,dot(normal,normalize(vec2(.65,-.76))));
   col*=1.-(edge*.17+dark*.36)*glass;
   col+=vec3(.17,.21,.23)*(pow(light,1.3)*.50+fine.z*.011)*glass;
   col+=(hash(floor(guv*resolution))-.5)*.0028*film*glass;
   col*=1.-.12*smoothstep(.25,.78,length(vUv-.5))*glass;
   gl_FragColor=vec4(max(col,vec3(0.)),1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(2,2);
 scene.add(new THREE.Mesh(geometry,material));
 const screenCamera=new THREE.Camera();
 let active=true,start=null,pointerId=null,last=null,lastWater=0,wheel=0,lastWheel=0;
 let origin=null,dragged=false,downAt=0,lastCoverage=0,cleared=0;
 function checkCoverage(now){
  lastCoverage=now;cleared=surface.coverage();host.dataset.wipeCoverage=cleared.toFixed(3);
  if(cleared>.60)onEnter();
 }
 function stop(){
  const captured=pointerId;pointerId=null;last=null;origin=null;host.classList.remove('wiping');
  if(captured!==null&&host.hasPointerCapture(captured))host.releasePointerCapture(captured);
 }
 function point(e){return {x:e.clientX,y:e.clientY};}
 host.addEventListener('pointerdown',e=>{
  if(!active||start!==null||e.button!==0||e.target.closest('button,a')||pointerId!==null)return;
  e.preventDefault();pointerId=e.pointerId;host.setPointerCapture(pointerId);last=point(e);
  origin=last;dragged=false;downAt=performance.now();
  surface.stroke(last,last,performance.now());host.classList.add('wiping','touched');
 },options);
 host.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointerId||start!==null)return;
  const samples=e.getCoalescedEvents?.()||[e];
  for(const sample of samples.length?samples:[e]){const next=point(sample);if(Math.hypot(next.x-origin.x,next.y-origin.y)>6)dragged=true;surface.stroke(last,next,performance.now());last=next;}
  if(performance.now()-lastCoverage>150)checkCoverage(performance.now());
 },options);
 host.addEventListener('pointerup',e=>{
  if(e.pointerId!==pointerId||start!==null)return;
  const tap=!dragged&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<=6&&performance.now()-downAt<500;
  stop();if(tap)onEnter();else checkCoverage(performance.now());
 },options);
 for(const event of ['pointercancel','lostpointercapture'])host.addEventListener(event,stop,options);
 window.addEventListener('blur',stop,options);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},options);
 host.addEventListener('wheel',e=>{
  if(start!==null||pointerId!==null||e.ctrlKey)return;
  e.preventDefault();const now=performance.now();if(now-lastWheel>450)wheel=0;lastWheel=now;
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
  wheel+=Math.abs(delta);if(wheel>=40){wheel=0;onEnter();}
 },{...options,passive:false});
 document.querySelectorAll('[data-entry]').forEach(button=>button.addEventListener('click',()=>onEnter(button.dataset.entry),options));
 function resize(){
  stop();const ratio=renderer.getPixelRatio();target.setSize(Math.round(innerWidth*ratio),Math.round(innerHeight*ratio));
  uniforms.resolution.value.set(innerWidth,innerHeight);surface.resize(innerWidth,innerHeight);
  uniforms.waterSize.value.set(surface.width,surface.height);
  ink.resize();
 }
 resize();window.addEventListener('resize',resize,options);
 return {
  get active(){return active;},get state(){return{wiping:pointerId!==null,strokes:surface.strokes,coverage:cleared}},
  enter(){if(start!==null)return;stop();start=performance.now();host.classList.add('crossing');host.inert=true;},
  render(t,dt){
   if(!active)return;
   const progress=start===null?0:Math.min((t-start)/(reduced?350:2800),1);uniforms.progress.value=progress;
   const inkProgress=ink.update(t);uniforms.inkReveal.value=reduced&&host.dataset.ink==='ready'?1:inkProgress;
   if(t-lastWater>33){surface.update(t,Math.min(.08,(t-lastWater)/1000));lastWater=t;}
   renderer.setRenderTarget(target);renderer.render(world,camera);
   renderer.setRenderTarget(null);renderer.render(scene,screenCamera);
   if(progress>=1){active=false;host.hidden=true;events.abort();ink.dispose();surface.dispose();target.dispose();geometry.dispose();material.dispose();}
  }
 };
}

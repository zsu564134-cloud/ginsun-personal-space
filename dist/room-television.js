import * as THREE from 'three';

// The authored TV display is source node 2174; 2175 is its bezel.
export function createRoomTelevision(screen, items) {
 if (!screen?.isMesh) return null;
 const playlist=items.filter(p=>p.published!==false&&p.category==='叙事短片')
  .flatMap(p=>(p.blocks||[]).filter(b=>b.type==='video'&&/^assets\//.test(b.src)));
 if (!playlist.length) return null;
 const geometry=screen.geometry.clone();geometry.computeBoundingBox();
 const {min,max}=geometry.boundingBox, width=max.z-min.z,height=max.y-min.y;
 const positions=geometry.getAttribute('position'),uv=new Float32Array(positions.count*2);
 for(let i=0;i<positions.count;i++){
  uv[i*2]=(positions.getZ(i)-min.z)/width;
  uv[i*2+1]=(positions.getY(i)-min.y)/height;
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));screen.geometry=geometry;
 const scale=screen.getWorldScale(new THREE.Vector3());
 const aspect=width*Math.abs(scale.z)/(height*Math.abs(scale.y));
 const material=new THREE.MeshBasicMaterial({color:0xb8b8b8,side:THREE.DoubleSide,toneMapped:false});
 screen.material=material;
 const video=document.createElement('video');
 video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='none';
 video.setAttribute('playsinline','');video.setAttribute('muted','');
 let active=false,started=false,last=-1,bag=[],texture=null,poster=null,failures=0;
 const crop=(map,w,h)=>{
  const sourceAspect=w/h;
  map.repeat.set(Math.min(1,aspect/sourceAspect),Math.min(1,sourceAspect/aspect));
  map.offset.set((1-map.repeat.x)/2,(1-map.repeat.y)/2);
  map.colorSpace=THREE.SRGBColorSpace;
 };
 const play=()=>{if(active&&!document.hidden)video.play().catch(()=>{});};
 function next(){
  if(!bag.length){
   bag=playlist.map((_,i)=>i);
   for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
   if(bag.length>1&&bag[bag.length-1]===last)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];
  }
  last=bag.pop();const film=playlist[last];
  video.pause();video.src=film.src;
  // Keep a cover visible during buffering or if the browser blocks autoplay.
  if(film.poster)new THREE.TextureLoader().load(film.poster,map=>{
   if(video.getAttribute('src')!==film.src){map.dispose();return;}
   crop(map,map.image.width,map.image.height);poster?.dispose();poster=map;
   if(video.readyState<2){material.map=poster;material.needsUpdate=true;}
  });
  video.load();play();
 }
 video.addEventListener('loadeddata',()=>{
  failures=0;texture?.dispose();texture=new THREE.VideoTexture(video);
  crop(texture,video.videoWidth,video.videoHeight);
  material.map=texture;material.needsUpdate=true;play();
 });
 video.addEventListener('ended',()=>{if(active)next();});
 video.addEventListener('error',()=>{if(active&&++failures<playlist.length)next();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else play();});
 document.addEventListener('pointerdown',play,{passive:true});
 return {
  setActive(value){
   if(active===value)return;active=value;
   if(!active){video.pause();return;}
   if(!started){started=true;next();}else if(video.ended)next();else play();
  },
  get state(){return {playing:!video.paused,src:video.getAttribute('src'),aspect,count:playlist.length};}
 };
}

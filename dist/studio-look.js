import * as THREE from 'three';
import {stabilizeShelfSurface} from './shelf-stability.js?v=room-13';
import {Reflector} from './vendor/Reflector.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {SSAOPass} from './vendor/postprocessing/SSAOPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';

const backdropGLSL=`vec3 studioBackdrop(vec2 uv){
  float glow=exp(-dot((uv-vec2(.42,.57))/vec2(.65,.55),(uv-vec2(.42,.57))/vec2(.65,.55)));
  return mix(vec3(.0015,.002,.0025),vec3(.009,.012,.014),glow);
}`;

// One photographic lighting rig, shared by every viewpoint. The large key
// illuminates the worktop while narrower cards describe the metal's curvature.
export function lightStudio(scene){
  RectAreaLightUniformsLib.init();
  const practicals=[];
  scene.add(new THREE.HemisphereLight('#a7bdc9','#13100d',.055));
  const softbox=(color,intensity,w,h,position,target)=>{
    const light=new THREE.RectAreaLight(color,intensity,w,h);
    light.position.set(...position);light.lookAt(...target);scene.add(light);return light;
  };
  practicals.push([softbox('#fff0d9',0,3.6,1.8,[-.5,5.3,.6],[0,1,-1]),6]);
  practicals.push([softbox('#f4e5d2',0,1.5,2,[4,3.8,1.5],[3,1,4]),3]);
  softbox('#b6c8d1',1.4,2.8,4,[-7,3.8,-3],[0,1,0]);
  softbox('#b9c8cd',1.2,2.2,4,[7,3.8,-3],[0,1,1]);
  const key=new THREE.SpotLight('#ffe7c8',0,20,.93,.85,2);
  key.position.set(-.5,5.6,1.6);key.target.position.set(0,.6,-1);
  key.castShadow=true;key.shadow.mapSize.set(1536,1536);key.shadow.bias=-.00015;key.shadow.normalBias=.025;key.shadow.radius=3;key.shadow.camera.near=.3;key.shadow.camera.far=20;
  scene.add(key,key.target);practicals.push([key,130]);

  // A camera-independent seamless cyclorama: broad tonal transitions, no walls.
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    depthWrite:false,
    vertexShader:'varying vec2 backgroundUv;void main(){backgroundUv=uv;gl_Position=vec4(position.xy,.999999,1.);}',
    fragmentShader:`varying vec2 backgroundUv;${backdropGLSL}
      void main(){gl_FragColor=vec4(studioBackdrop(backgroundUv),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));backdrop.name='studio-backdrop';backdrop.frustumCulled=false;backdrop.renderOrder=-10;scene.add(backdrop);
  return {set(value){practicals.forEach(([light,power])=>light.intensity=power*value);scene.environmentIntensity=.11+.64*value;}};
}

export function studioRenderer(renderer,scene,camera,floor,mobile){
  const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:mobile?2:4});
  const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
  const ao=new SSAOPass(scene,camera,innerWidth,innerHeight,16);
  ao.kernelRadius=.12;ao.minDistance=.00008;ao.maxDistance=.004;
  ao.copyMaterial.fragmentShader=ao.copyMaterial.fragmentShader.replace('gl_FragColor = opacity * texel;','gl_FragColor = vec4(mix(vec3(1.),texel.rgb,.3),1.);');
  // Contact detail on furniture only. Do not bring back projected ground shadows.
  const normals=ao._renderOverride.bind(ao),furniture=new Set([701,709,2132,2264,714,24,2176,8,733]);
  ao._renderOverride=(...args)=>{
    const hidden=[];scene.traverseVisible(o=>{if(!o.isMesh)return;let selected=false;for(let n=o;n;n=n.parent)if(furniture.has(n.userData.sourceIndex)){selected=true;break;}if(!selected){hidden.push(o);o.visible=false;}});
    try{normals(...args);}finally{hidden.forEach(o=>o.visible=true);}
  };
  const size=ao.setSize.bind(ao);ao.setSize=(w,h)=>size(Math.max(1,Math.round(w*.6)),Math.max(1,Math.round(h*.6)));
  ao.enabled=false;composer.addPass(ao);composer.addPass(new OutputPass());composer.setSize(innerWidth,innerHeight);
  return composer;
}

export function studioEnvironment(renderer){
  const stage=new THREE.Scene();stage.background=new THREE.Color('#070b0d');
  const card=(w,h,pos,power,color='#ffffff')=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));m.position.set(...pos);m.lookAt(0,1,0);stage.add(m);};
  card(3.6,1.8,[-.5,5.3,.6],5,'#fff0d9');card(1.2,5,[7,3,-3],3,'#bbccd4');card(2.8,4,[-7,3,-3],3,'#c1d0d5');card(1,2,[4,3,5],1.8,'#eadbc6');
  const pmrem=new THREE.PMREMGenerator(renderer),texture=pmrem.fromScene(stage,.025).texture;
  stage.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();return texture;
}

// The export's generic materials do not encode the furniture's real finishes.
// Use stable source IDs for leather, structural metal and glass; preserve artwork UVs.
export function dressStudio(root) {
  const grainData=new Uint8Array(128*128*4);let seed=73;
  for(let i=0;i<grainData.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=110+(seed%38);grainData.set([v,v,v,255],i);}
  const grain=new THREE.DataTexture(grainData,128,128);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(9,9);grain.needsUpdate=true;
  const finishes={
    leather:new THREE.MeshPhysicalMaterial({color:'#151718',roughness:.37,metalness:0,clearcoat:.2,clearcoatRoughness:.3,specularIntensity:.85,envMapIntensity:1.1,bumpMap:grain,bumpScale:.002,side:THREE.DoubleSide}),
    chrome:new THREE.MeshPhysicalMaterial({color:'#c9ced1',metalness:1,roughness:.19,clearcoat:.2,envMapIntensity:1}),
    brushed:new THREE.MeshStandardMaterial({color:'#919598',metalness:.92,roughness:.3,envMapIntensity:1.2}),
    black:new THREE.MeshPhysicalMaterial({color:'#252a2e',metalness:.08,roughness:.3,clearcoat:.16,envMapIntensity:.85}),
    desktop:new THREE.MeshPhysicalMaterial({color:'#212527',metalness:.16,roughness:.28,clearcoat:.45,clearcoatRoughness:.23,envMapIntensity:1,side:THREE.DoubleSide}),
    cabinet:new THREE.MeshPhysicalMaterial({color:'#1e2223',metalness:.08,roughness:.39,clearcoat:.22,clearcoatRoughness:.32,envMapIntensity:.8}),
    glass:new THREE.MeshPhysicalMaterial({color:'#cdd2d3',metalness:0,roughness:.12,transmission:.8,thickness:.12,ior:1.48,transparent:true,opacity:.72,side:THREE.DoubleSide}),
    porcelain:new THREE.MeshPhysicalMaterial({color:'#c4c4c1',metalness:0,roughness:.26,clearcoat:.7})
  };
  const clones=new Map(),shelfFinishes=new Map(),artFinishes=new Map();const nodes=new Map();const bulbs=[];
  root.traverse(o=>{if(o.userData.sourceIndex!==undefined)nodes.set(o.userData.sourceIndex,o);});
  const inGroup=(o,id)=>{for(let n=o;n;n=n.parent)if(n.userData.sourceIndex===id)return true;return false;};
  function neutral(original){
    if(clones.has(original))return clones.get(original);
    const m=original.clone(),name=m.name.toLowerCase();
    if(/glass/.test(name)||m.opacity<.65){clones.set(original,finishes.glass);return finishes.glass;}
    if(/chrome|crohme|metal|materdsg/.test(name)){clones.set(original,finishes.chrome);return finishes.chrome;}
    m.emissive?.set(0);m.envMapIntensity=.9;
    if(m.map){m.metalness=0;m.roughness=.58;m.color.set('#e3e0da');
      m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat neutralValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(neutralValue),diffuseColor.rgb,.65);');};
      m.customProgramCacheKey=()=> 'muted-artwork-v2';
    }else{
      const l=m.color.r*.2126+m.color.g*.7152+m.color.b*.0722;
      // Preserve source hue and luminance relationships instead of collapsing
      // every non-metal surface into the same black or silver material.
      const hsl=m.color.getHSL({},THREE.SRGBColorSpace);
      m.color.setHSL(hsl.h,Math.min(hsl.s*.4,.2),THREE.MathUtils.clamp(.12+Math.sqrt(l)*.58,.12,.72),THREE.SRGBColorSpace);
      m.metalness=.08;m.roughness=l<.36?.36:.46;
    }
    clones.set(original,m);return m;
  }
  root.traverse(o=>{
    if(o.isLine||o.isPoints)o.visible=false;
    if(!o.isMesh)return;
    const id=o.userData.sourceIndex;
    if(inGroup(o,733)&&!Array.isArray(o.material))stabilizeShelfSurface(o,o.material);
    // The worktop export carries inward-facing normals, crushing its top into
    // black. Correct this web copy without touching the user's source model.
    if(id===706){o.geometry=o.geometry.clone();const n=o.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i));n.needsUpdate=true;}
    const choose=m=>{
      if([2487,2490,2493].some(group=>inGroup(o,group))&&m.map){
        if(artFinishes.has(m))return artFinishes.get(m);
        const print=new THREE.MeshStandardMaterial({map:m.map,color:inGroup(o,2493)?'#cfcbc3':'#ffffff',roughness:.92,metalness:0,envMapIntensity:.15,side:THREE.DoubleSide});
        // These fixed wall prints were exported with normals facing into the
        // wall. Use the room-facing plane normal, retaining physical lighting.
        print.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(mat3(viewMatrix)*vec3(0.,0.,1.));');};
        print.customProgramCacheKey=()=> 'wall-print-facing-room-v1';
        artFinishes.set(m,print);return print;
      }
      // Satin rails and separately sorted single-sheet glass avoid shimmer.
      if(inGroup(o,733)){
        if(shelfFinishes.has(m))return shelfFinishes.get(m);
        const finish=neutral(m).clone();
        finish.roughness=m.map?.82:.72;finish.metalness=m.map?0:.4;
        finish.envMapIntensity=.18;finish.transparent=false;finish.opacity=1;
        if('transmission' in finish)finish.transmission=0;
        if('clearcoat' in finish)finish.clearcoat=0;
        finish.polygonOffset=false;
        if(m.opacity<.65){finish.transparent=true;finish.opacity=.12;finish.depthWrite=false;finish.metalness=0;finish.side=THREE.DoubleSide;finish.forceSinglePass=true;finish.color.set('#929c9c');}
        shelfFinishes.set(m,finish);return finish;
      }
      if([711,2135,2136,2137,2138,2140,2142].includes(id))return finishes.leather;
      if([713,708,2144,724,726,728,730].includes(id))return finishes.chrome;
      if(id===704)return finishes.black;
      if(id===706)return finishes.desktop;
      if(id===732)return finishes.glass;
      if(inGroup(o,438)){
        if(/24904|24906/.test(m.name)){const b=finishes.porcelain.clone();b.color.set('#51483d');b.emissive=new THREE.Color('#ffd2a0');b.emissiveIntensity=.75;bulbs.push(b);return b;}
        return finishes.chrome;
      }
      if(inGroup(o,2264)&&(/MDF|regflt|box2?$/.test(m.name)))return finishes.cabinet;
      return neutral(m);
    };
    o.material=Array.isArray(o.material)?o.material.map(choose):choose(o.material);
    o.castShadow=!(o.userData.shelfGlass||o.userData.shelfScrew);
    o.receiveShadow=![733,2487,2490,2493].some(group=>inGroup(o,group));
  });
  return {nodes,bulbs,finishes};
}

export function batchStudio(root){
  // Combine draw calls inside each interactive object, never across its boundary.
  // Original transforms remain available for picking and camera framing.
  const buckets=new Map(),barriers=new Set([24,60,8,733,438,2264,1150,2176,2487,2145,701,709,2132,714]);
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||!o.visible||Array.isArray(o.material)||o.material.transparent||[56,58].includes(o.userData.sourceIndex))return;
    let owner=o.parent;while(owner!==root&&!barriers.has(owner.userData.sourceIndex))owner=owner.parent;
    if(!owner)owner=root;
    const key=owner.uuid+':'+o.material.uuid+':'+o.castShadow+':'+o.receiveShadow+':'+Boolean(o.geometry.index)+':'+Object.keys(o.geometry.attributes).sort().join(',');
    if(!buckets.has(key))buckets.set(key,{owner,material:o.material,meshes:[]});buckets.get(key).meshes.push(o);
  });
  for(const {owner,material,meshes} of buckets.values()){
    if(meshes.length<2)continue;
    const inverse=owner.matrixWorld.clone().invert(),geometries=[];
    for(const mesh of meshes){
      const g=new THREE.BufferGeometry();
      for(const [name,a] of Object.entries(mesh.geometry.attributes)){
        const values=new Float32Array(a.count*a.itemSize);
        for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=a.getComponent(i,j);
        g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));
      }
      if(mesh.geometry.index)g.setIndex(mesh.geometry.index.clone());
      const transform=inverse.clone().multiply(mesh.matrixWorld);g.applyMatrix4(transform);
      if(transform.determinant()<0&&g.index){const a=g.index.array;for(let i=0;i<a.length;i+=3){const v=a[i+1];a[i+1]=a[i+2];a[i+2]=v;}}
      geometries.push(g);
    }
    const merged=mergeGeometries(geometries);if(merged){const mesh=new THREE.Mesh(merged,material);mesh.castShadow=meshes[0].castShadow;mesh.receiveShadow=meshes[0].receiveShadow;owner.add(mesh);meshes.forEach(m=>{m.visible=false;m.raycast=()=>{};});}geometries.forEach(g=>g.dispose());
  }
}

export function makeFloor(scene,mobile){
  // Low-resolution planar reflection softened with a small kernel, then mixed
  // with the resin tone. No projected shadows: the reflection is the sole ground cue.
  const shader={...Reflector.ReflectorShader,
    uniforms:{...THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),strength:{value:.13},lightLevel:{value:0},viewport:{value:new THREE.Vector2(innerWidth,innerHeight).multiplyScalar(Math.min(devicePixelRatio,1.5))}},
    vertexShader:Reflector.ReflectorShader.vertexShader.replace('varying vec4 vUv;','varying vec4 vUv;varying vec3 floorWorld;').replace('vUv = textureMatrix','floorWorld=(modelMatrix*vec4(position,1.)).xyz;vUv = textureMatrix'),
    fragmentShader:`uniform vec3 color;uniform sampler2D tDiffuse;uniform float strength;uniform float lightLevel;uniform vec2 viewport;varying vec4 vUv;varying vec3 floorWorld;${backdropGLSL}
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec2 uv=vUv.xy/vUv.w;vec3 reflected=vec3(0.);float radius=.0035;
        for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){reflected+=texture2D(tDiffuse,uv+vec2(float(x),float(y))*radius).rgb/9.;}}
        float pool=exp(-dot((floorWorld.xz-vec2(-.4,-.2))/vec2(4.,4.5),(floorWorld.xz-vec2(-.4,-.2))/vec2(4.,4.5)));
        float grain=fract(sin(dot(floorWorld.xz,vec2(213.7,127.3)))*43758.5);
        vec3 resin=vec3(.0025,.0035,.004)+color*pool*(.012+.38*lightLevel)*( .985+.03*grain);
        float horizon=smoothstep(7.,20.,length(floorWorld.xz));
        gl_FragColor=vec4(mix(mix(resin,reflected,strength*(.5+.5*pool)),studioBackdrop(gl_FragCoord.xy/viewport),horizon),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`};
  const floor=new Reflector(new THREE.PlaneGeometry(180,180),{color:'#74746c',textureWidth:mobile?384:768,textureHeight:mobile?384:768,multisample:0,clipBias:.003,shader});
  floor.rotation.x=-Math.PI/2;floor.position.y=-.045;scene.add(floor);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({color:'#000000',opacity:.36,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.035;contact.receiveShadow=true;scene.add(contact);
  // Reflector updates on every rendered frame, keeping its camera and projection
  // matrix in sync with orbit controls. Resolution, not refresh rate, limits cost.
  return floor;
}

export function rainyRoom(scene){
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(42,14),new THREE.MeshStandardMaterial({color:'#101517',roughness:.92}));wall.position.set(0,6,-3.5);wall.receiveShadow=true;scene.add(wall);
  const uniforms={time:{value:0}};
  const rain=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
    varying vec2 vUv;uniform float time;
    float hash(float p){return fract(sin(p*127.1)*43758.5453);}
    void main(){vec2 uv=vUv;vec3 col=mix(vec3(.006,.009,.012),vec3(.025,.039,.046),smoothstep(0.,1.,uv.y));
      float streak=0.;for(int i=0;i<3;i++){float scale=22.+float(i)*17.;vec2 p=uv*vec2(scale,5.+float(i)*3.);float lane=floor(p.x);float h=hash(lane+float(i)*79.);float x=fract(p.x)-.2-h*.5-.06*sin(p.y*5.+h*30.);float y=fract(p.y+time*(.12+h*.16)+h*7.);float drop=exp(-x*x*850.-(y-.18)*(y-.18)*130.);float tail=exp(-x*x*4000.)*smoothstep(.15,.35,y)*(1.-smoothstep(.35,.85,y));streak+=(drop*.1+tail*.024)*step(.26,h);}
      float haze=exp(-dot((uv-vec2(.2,.55))*vec2(2.5,2.),(uv-vec2(.2,.55))*vec2(2.5,2.)));
      col+=vec3(.04,.05,.055)*haze+streak*vec3(.32,.36,.38);
      col*=.5+.5*smoothstep(0.,.16,uv.x)*smoothstep(1.,.84,uv.x);gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const frameMat=new THREE.MeshStandardMaterial({color:'#11191b',metalness:.8,roughness:.32});
  for(const x of [-7.7,7.7]){
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(3.4,5.5),rain);pane.position.set(x,3.15,-3.45);scene.add(pane);
    for(const dx of [-1.72,0,1.72]){const frame=new THREE.Mesh(new THREE.BoxGeometry(.065,5.6,.1),frameMat);frame.position.set(x+dx,3.15,-3.36);scene.add(frame);}
    for(const y of [.35,3.15,5.95]){const frame=new THREE.Mesh(new THREE.BoxGeometry(3.5,.06,.1),frameMat);frame.position.set(x,y,-3.36);scene.add(frame);}
  }
  return {update(t){uniforms.time.value=t*.001;}};
}

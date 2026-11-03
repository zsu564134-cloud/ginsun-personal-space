import * as THREE from 'three';

// Height fields, not painted highlights: the shader derives refraction and shading.
export function createWetSurface({reduced=false}={}) {
 const canvas=()=>document.createElement('canvas');
 const field=canvas(),still=canvas(),trails=canvas(),mask=canvas(),brush=canvas(),bead=canvas();
 const ctx=field.getContext('2d'),sc=still.getContext('2d'),tc=trails.getContext('2d'),mc=mask.getContext('2d');
 const water=new THREE.CanvasTexture(field),wipe=new THREE.CanvasTexture(mask);
 const moisture=canvas(),residue=canvas();
 const fc=moisture.getContext('2d'),rc=residue.getContext('2d');
 const flow=new THREE.CanvasTexture(moisture);flow.minFilter=THREE.LinearFilter;flow.generateMipmaps=false;
 const sample=canvas();sample.width=96;sample.height=64;
 const sampleContext=sample.getContext('2d',{willReadFrequently:true});
 function coverage(){
  sampleContext.drawImage(mask,0,0,96,64);
  const pixels=sampleContext.getImageData(0,0,96,64).data;
  let cleared=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]>=128)cleared++;
  return cleared/(96*64);
 }
 for(const texture of [water,wipe]){texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;}
 bead.width=bead.height=64;
 const bc=bead.getContext('2d'),bg=bc.createRadialGradient(32,33,0,32,32,31);
 bg.addColorStop(0,'rgba(255,255,255,.98)');bg.addColorStop(.55,'rgba(255,255,255,.84)');
 bg.addColorStop(.82,'rgba(255,255,255,.55)');bg.addColorStop(1,'rgba(255,255,255,0)');
 bc.fillStyle=bg;bc.fillRect(0,0,64,64);
 brush.width=brush.height=160;
 const br=brush.getContext('2d'),g=br.createRadialGradient(80,80,8,80,80,77);
 g.addColorStop(0,'rgba(255,255,255,.30)');g.addColorStop(.55,'rgba(255,255,255,.28)');
 g.addColorStop(.78,'rgba(255,255,255,.14)');g.addColorStop(1,'rgba(255,255,255,0)');
 br.fillStyle=g;br.fillRect(0,0,160,160);
 let seed=1749,width=0,height=0,scale=1,lastStroke=-Infinity,strokes=0,fadeTime=0,drops=[];
 let runoffDistance=0,residueTime=0,edgeDistance=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // Fine gaps leave residual moisture, without a hard-edged brush outline.
 br.globalCompositeOperation='destination-out';
 for(let i=0;i<28;i++){br.fillStyle=`rgba(0,0,0,${.05+random()*.12})`;br.fillRect(random()*160,0,.3+random()*.8,160);}
 function draw(context,x,y,r,elongation=1,alpha=1){
  context.globalAlpha=alpha;context.drawImage(bead,x-r,y-r*elongation,r*2,r*2*elongation);context.globalAlpha=1;
 }
 function reset(d,initial=false){
  d.x=random()*width;d.y=initial?random()*height:-12;d.r=(1.8+random()*2.5)*scale;
  d.v=0;d.wait=.4+random()*7;d.phase=random()*6.28;d.travel=0;
 }
 function resize(w,h){
  const saved=canvas();saved.width=mask.width;saved.height=mask.height;saved.getContext('2d').drawImage(mask,0,0);
  scale=Math.min(1,1152/w,1152/h);width=Math.round(w*scale);height=Math.round(h*scale);
  for(const c of [field,still,trails,mask,moisture,residue]){c.width=width;c.height=height;}
  runoffDistance=0;residueTime=0;edgeDistance=0;
  sc.fillStyle='#000';sc.fillRect(0,0,width,height);mc.fillStyle='#000';mc.fillRect(0,0,width,height);
  if(saved.width>0)mc.drawImage(saved,0,0,width,height);
  seed=1749;
  const count=Math.round(w*h/650);
  for(let i=0;i<count;i++){
   const x=random()*width,y=random()*height,r=(.55+Math.pow(random(),2.4)*3.9)*scale;
   draw(sc,x,y,r,.83+random()*.7,.4+random()*.55);
  }
  drops=Array.from({length:Math.max(7,Math.round(w*h/65000))},()=>{const d={};reset(d,true);return d;});
  wipe.needsUpdate=true;water.needsUpdate=true;
 }
 function stroke(from,to,now){
  if(!from||!to)return;
  const dx=(to.x-from.x)*scale,dy=(to.y-from.y)*scale,distance=Math.hypot(dx,dy);
  const radius=Math.min(59,Math.max(35,innerWidth*.045))*scale;
  const steps=Math.max(1,Math.ceil(distance/(radius*.10))),angle=Math.atan2(dy,dx)+Math.PI/2;
  for(let i=0;i<=steps;i++){
   mc.save();mc.translate(from.x*scale+dx*i/steps,from.y*scale+dy*i/steps);mc.rotate(angle);
   mc.drawImage(brush,-radius,-radius,radius*2,radius*2);mc.restore();
   if(i>0)edgeDistance+=distance/steps;
   if(edgeDistance>18*scale){
    edgeDistance=0;
    const x=from.x*scale+dx*i/steps,y=from.y*scale+dy*i/steps;
    // Isolated edge beads only: no continuous border or moisture stroke.
    const offset=radius*(.64+random()*.22)*(random()<.5?-1:1);
    draw(rc,x+Math.cos(angle)*offset,y+Math.sin(angle)*offset,(1.1+random()*1.7)*scale,1.15,.3+random()*.25);
   }
  }
  runoffDistance+=distance;
  if(runoffDistance>110*scale&&drops.length<48){
   runoffDistance=0;
   const d={};reset(d,true);
   d.x=to.x*scale+Math.cos(angle)*radius*.66;d.y=to.y*scale+Math.sin(angle)*radius*.66;
   d.r=(2+random()*1.4)*scale;d.wait=.25+random()*.7;drops.push(d);
  }
  lastStroke=now;fadeTime=0;strokes++;wipe.needsUpdate=true;
 }
 function update(now,dt){
  residueTime+=dt;
  if(residueTime>.25){
   rc.globalCompositeOperation='destination-out';rc.fillStyle=`rgba(0,0,0,${1-Math.exp(-residueTime*.06)})`;
   rc.fillRect(0,0,width,height);rc.globalCompositeOperation='source-over';residueTime=0;
  }
  if(!reduced){
   tc.globalCompositeOperation='destination-out';tc.fillStyle=`rgba(0,0,0,${1-Math.exp(-dt*.38)})`;tc.fillRect(0,0,width,height);tc.globalCompositeOperation='source-over';
   for(const d of drops){
    d.wait-=dt;if(d.wait>0)continue;
    const oldX=d.x,oldY=d.y;
    d.v=Math.min(70*scale,d.v+dt*16*d.r);d.y+=d.v*dt;d.travel+=d.v*dt;
    d.x+=Math.sin(d.y/(27*scale)+d.phase)*dt*1.4*scale;
    const steps=Math.max(1,Math.ceil((d.y-oldY)/Math.max(.8,d.r*.35)));
    for(let i=0;i<steps;i++)draw(tc,oldX+(d.x-oldX)*i/steps,oldY+(d.y-oldY)*i/steps,d.r*.30,1.5,.12);
    if(d.travel>60*scale&&random()<dt*.7){d.wait=.15+random()*.9;d.v*=.25;d.travel=0;}
    if(d.y>height+15)reset(d);
   }
   for(let i=0;i<drops.length;i++)for(let j=i+1;j<drops.length;j++){
    const a=drops[i],b=drops[j];if(Math.hypot(a.x-b.x,a.y-b.y)<(a.r+b.r)*.7){
     a.r=Math.min(5.6*scale,Math.sqrt(a.r*a.r+b.r*b.r));a.v=Math.max(a.v,b.v);a.wait=0;reset(b);
    }
   }
  }
  ctx.drawImage(still,0,0);
  // Flowing water sits above condensation and survives the wipe mask.
  fc.fillStyle='#000';fc.fillRect(0,0,width,height);fc.drawImage(residue,0,0);fc.drawImage(trails,0,0);
  for(const d of drops)draw(fc,d.x,d.y,d.r,1.1+Math.min(.55,d.v/(95*scale)));
  water.needsUpdate=true;flow.needsUpdate=true;
  // Slow recondensation starts after a pause, even when the pointer is still on the glass.
  if(now-lastStroke>4000&&strokes){
   // Batch the fade to avoid alpha rounding to zero in an 8-bit canvas at high refresh rates.
   fadeTime+=dt;
   if(fadeTime>.25){mc.fillStyle=`rgba(0,0,0,${1-Math.exp(-fadeTime*.045)})`;mc.fillRect(0,0,width,height);wipe.needsUpdate=true;fadeTime=0;}
  }
 }
 return {water,wipe,flow,resize,stroke,update,coverage,get width(){return width;},get height(){return height;},get strokes(){return strokes;},
  dispose(){water.dispose();wipe.dispose();flow.dispose();for(const c of [field,still,trails,mask,brush,bead,sample,moisture,residue]){c.width=1;c.height=1;}drops=[];}};
}

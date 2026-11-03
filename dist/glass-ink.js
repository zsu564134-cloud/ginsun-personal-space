import * as THREE from 'three';

// Rasterize the real, accessible DOM layout only when its font or dimensions change.
// All animation, refraction and condensation are applied by the shared glass compositor.
export function createGlassInk(host){
 host.classList.add('ink-preparing');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 let dirty=true,ready=false,disposed=false,appeared=0;
 const observer=new ResizeObserver(()=>dirty=true);observer.observe(host);
 const fontChange=()=>{if(!disposed){ready=true;dirty=true;}};
 document.fonts.ready.then(fontChange);document.fonts.addEventListener('loadingdone',fontChange);
 function draw(t){
  if(disposed||!ready||!dirty)return;
  const ratio=Math.min(devicePixelRatio,1.5),w=innerWidth,h=innerHeight;
  canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.scale(ratio,ratio);
  let seed=719;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const el of host.querySelectorAll('[data-glass-ink]')){
   const rect=el.getBoundingClientRect(),style=getComputedStyle(el);if(!rect.width||!rect.height)continue;
   const size=parseFloat(style.fontSize),line=parseFloat(style.lineHeight)||size*1.2;
   ctx.font=`${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
   ctx.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
   ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';ctx.globalCompositeOperation='source-over';
   const metrics=ctx.measureText(el.textContent),ascent=metrics.fontBoundingBoxAscent??size*.8,descent=metrics.fontBoundingBoxDescent??size*.2;
   const baseline=rect.top+(line-ascent-descent)/2+ascent;
   ctx.fillText(el.textContent,rect.left,baseline);
   if(el.hasAttribute('data-grain')){
    ctx.save();ctx.beginPath();ctx.rect(rect.left,rect.top,rect.width,rect.height);ctx.clip();
    ctx.globalCompositeOperation='destination-out';
    for(let i=0,n=Math.round(rect.width*rect.height/37);i<n;i++){
     ctx.fillStyle=`rgba(0,0,0,${.12+random()*.6})`;ctx.beginPath();
     ctx.arc(rect.left+random()*rect.width,rect.top+random()*rect.height,.2+random()*.65,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
   }
  }
  texture.needsUpdate=true;dirty=false;if(!appeared)appeared=t;
  host.classList.add('ink-ready');host.classList.remove('ink-preparing');host.dataset.ink='ready';
 }
 return {texture,update(t){draw(t);return appeared?Math.min(1,(t-appeared)/1000):0;},
  resize(){dirty=true;},dispose(){disposed=true;observer.disconnect();document.fonts.removeEventListener('loadingdone',fontChange);texture.dispose();canvas.width=canvas.height=1;}};
}

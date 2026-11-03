import * as THREE from 'three';
import {mergeVertices} from './vendor/BufferGeometryUtils.js';

// Sculpted, subdivided leaves: apertures are geometry, not painted black spots.
export function monsteraLeaf(variant=0){
 const s=new THREE.Shape();s.moveTo(0,.06);
 s.bezierCurveTo(-.13,-.12,-.39,-.09,-.47,.18);
 s.bezierCurveTo(-.52,.30,-.49,.36,-.44,.41);s.bezierCurveTo(-.32,.41,-.21,.34,-.12,.31);
 s.bezierCurveTo(-.18,.38,-.35,.45,-.46,.46);s.bezierCurveTo(-.49,.53,-.45,.60,-.40,.66);s.bezierCurveTo(-.28,.63,-.16,.51,-.095,.45);
 s.bezierCurveTo(-.14,.55,-.25,.67,-.35,.71);s.bezierCurveTo(-.34,.77,-.29,.84,-.25,.87);s.bezierCurveTo(-.18,.79,-.10,.65,-.065,.59);
 s.bezierCurveTo(-.08,.73,-.15,.86,-.18,.94);s.quadraticCurveTo(-.10,1.06,0,1.16);
 s.quadraticCurveTo(.09,1.06,.17,.95);s.bezierCurveTo(.14,.83,.08,.71,.065,.59);
 s.bezierCurveTo(.12,.70,.19,.81,.24,.88);s.bezierCurveTo(.30,.84,.35,.77,.36,.71);s.bezierCurveTo(.23,.64,.15,.53,.10,.45);
 s.bezierCurveTo(.22,.56,.31,.63,.41,.66);s.bezierCurveTo(.47,.59,.49,.52,.46,.46);s.bezierCurveTo(.30,.42,.19,.37,.12,.31);
 s.bezierCurveTo(.24,.36,.35,.40,.45,.41);s.bezierCurveTo(.5,.33,.52,.23,.46,.13);s.bezierCurveTo(.36,-.09,.12,-.12,0,.06);
 for(const sign of [-1,1])for(const [x,y,rx,ry] of [[.08,.26,.027,.055],[.085,.43,.019,.044],[.064,.59,.013,.032]]){const h=new THREE.Path();h.absellipse(x*sign,y,rx,ry,0,Math.PI*2,true,sign*.22);s.holes.push(h);}
 let g=new THREE.ShapeGeometry(s,12).toNonIndexed();
 for(let level=0;level<2;level++){const p=g.attributes.position,a=[];for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j)),m=[v[0].clone().lerp(v[1],.5),v[1].clone().lerp(v[2],.5),v[2].clone().lerp(v[0],.5)];for(const q of [v[0],m[0],m[2],m[0],v[1],m[1],m[2],m[1],v[2],m[0],m[1],m[2]])a.push(q.x,q.y,q.z);}g.dispose();g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));}
 const p=g.attributes.position,uv=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=-(.16+variant*.035)*Math.sin(y*2.6)+Math.pow(Math.abs(x),1.5)*.42+Math.sin(y*9+x*13+variant)*Math.abs(x)*.045+variant*x*y*.055;p.setXYZ(i,x*(1+variant*.035*Math.sin(y*7)),y,z);uv.push(.5+x,y/1.22+.05);}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const smooth=mergeVertices(g,1e-5);g.dispose();smooth.computeVertexNormals();return smooth;
}
export function leafPigment(){
 const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d'),n=1024;let seed=48;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const im=ctx.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,grain=r()*9,wave=Math.sin(x*.025+y*.017)*2+Math.sin(x*.013-y*.021)*3,mid=10*Math.exp(-Math.pow((x-512)/65,2));im.data[i]=32+grain+wave+mid;im.data[i+1]=63+grain+wave+mid;im.data[i+2]=28+grain*.6+wave;im.data[i+3]=255;}ctx.putImageData(im,0,0);
 for(let y=95;y<1020;y+=65)for(const sign of [-1,1]){ctx.strokeStyle='#8b9b5555';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(512,y);ctx.bezierCurveTo(512+sign*100,y-25,512+sign*250,y-135,512+sign*490,y-205);ctx.stroke();for(let j=1;j<8;j++){const x=512+sign*j*52,yy=y-j*21;ctx.strokeStyle='#718d4720';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,yy);ctx.quadraticCurveTo(x+sign*24,yy-35,x+sign*50,yy-80);ctx.stroke();}}
 ctx.strokeStyle='#a1aa65aa';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(512,0);ctx.lineTo(512,1024);ctx.stroke();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

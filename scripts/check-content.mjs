import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
const data=JSON.parse(fs.readFileSync(path.join(root,'content.json'),'utf8'));
const errors=[];let assets=0;
const requireField=(ok,message)=>{if(!ok)errors.push(message);};
for(const key of ['about','architecture','aigc','photography','products','music']){
 const section=data.sections?.[key];requireField(section,`Missing section: ${key}`);
 requireField(section?.heading?.length===3,`Missing heading: ${key}`);
 requireField(section?.label?.length===2,`Missing label: ${key}`);
}
function asset(value,label){
 if(!value)return;
 if(/^https?:\/\//i.test(value)||/^mailto:/i.test(value))return;
 requireField(/^assets\//.test(value),`Invalid asset URL at ${label}: ${value}`);
 const file=path.resolve(root,value.split('?')[0]);
 requireField(file.startsWith(root+path.sep)&&fs.existsSync(file),`Missing asset at ${label}: ${value}`);assets++;
}
function walk(value,label='content'){
 if(Array.isArray(value)){
  const ids=value.filter(x=>x&&typeof x==='object'&&x.id).map(x=>x.id);
  requireField(new Set(ids).size===ids.length,`Duplicate IDs at ${label}`);
  value.forEach((v,i)=>{if(label.endsWith('.pages')&&typeof v==='string')asset(v,label);else walk(v,`${label}[${i}]`);});return;
 }
 if(value&&typeof value==='object'){
  if(value.type){requireField(['text','image','video','link','pdf'].includes(value.type),`Unknown block: ${value.type}`);if(value.type!=='text')requireField(value.src,`Missing block src: ${label}`);}
  for(const [k,v] of Object.entries(value)){if(['src','poster','cover','resume','image','screen','pdf','url','socialUrl'].includes(k))asset(v,`${label}.${k}`);else walk(v,`${label}.${k}`);}
 }
}
walk(data);
for(const key of ['architecture','aigc','products'])requireField(Array.isArray(data.sections[key].items),`items must be an array: ${key}`);
requireField(Array.isArray(data.sections.photography.albums),'albums must be an array');
for(const a of data.sections.photography.albums)requireField(Array.isArray(a.pages),`pages must be an array: ${a.id}`);
requireField(Array.isArray(data.sections.music.tracks),'tracks must be an array');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Content valid; ${assets} local asset references verified.`);

import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelDownload} from '../dist/model-download.js';

const manifest={bytes:4,parts:[{url:'a.bin',bytes:2},{url:'b.bin',bytes:2}]};
test('retries an interrupted stream and joins chunks in manifest order',async()=>{
 const calls={};
 const loader=createModelDownload(manifest,{retryMs:0,fetcher:async url=>{
   calls[url]=(calls[url]||0)+1;
   if(url.endsWith('a.bin')&&calls[url]===1)return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));c.error(new Error('Network interrupted'));}}));
   return new Response(new Uint8Array(url.endsWith('a.bin')?[1,2]:[3,4]));
 }});
 assert.deepEqual([...await loader.load()],[1,2,3,4]);
 assert.equal(calls['assets/a.bin'],2);assert.equal(calls['assets/b.bin'],1);
});
test('manual retry retains completed chunks after a failed attempt',async()=>{
 const calls={};let reconnect=false;
 const loader=createModelDownload(manifest,{attempts:1,fetcher:async url=>{
   calls[url]=(calls[url]||0)+1;
   if(url.endsWith('b.bin')&&!reconnect){await new Promise(r=>setTimeout(r,15));throw new Error('Offline');}
   return new Response(new Uint8Array(url.endsWith('a.bin')?[1,2]:[3,4]));
 }});
 await assert.rejects(loader.load(),/Offline/);reconnect=true;
 assert.deepEqual([...await loader.load()],[1,2,3,4]);assert.equal(calls['assets/a.bin'],1);
});
test('a progressing stream may take longer than the idle timeout',async()=>{
 const loader=createModelDownload({bytes:8,parts:[{url:'slow.bin',bytes:8}]},{idleMs:45,attempts:1,fetcher:async(url,{signal})=>new Response(new ReadableStream({start(c){
   let n=0;const timer=setInterval(()=>{c.enqueue(new Uint8Array([++n]));if(n===8){clearInterval(timer);c.close();}},15);
   signal.addEventListener('abort',()=>{clearInterval(timer);c.error(signal.reason);},{once:true});
 }}))});
 assert.deepEqual([...await loader.load()],[1,2,3,4,5,6,7,8]);
});
test('a stalled response times out and retries without hanging',async()=>{
 let calls=0;
 const loader=createModelDownload({bytes:2,parts:[{url:'stall.bin',bytes:2}]},{idleMs:10,retryMs:0,fetcher:async(url,{signal})=>{
   if(++calls>1)return new Response(new Uint8Array([1,2]));
   return new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(signal.reason),{once:true});}}));
 }});
 assert.deepEqual([...await loader.load()],[1,2]);assert.equal(calls,2);
});

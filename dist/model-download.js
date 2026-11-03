// Keep completed chunks across retries. A slow, progressing response must not
// be cancelled by a fixed total download deadline.
export function createModelDownload(manifest, {fetcher=fetch, onProgress=()=>{}, idleMs=60000, attempts=3, retryMs=700, concurrency=2}={}) {
  if(manifest.encoding==='gzip'&&typeof DecompressionStream==='undefined')manifest=manifest.fallback;
  const completed=new Map();
  let running=null;
  async function download() {
    const controller=new AbortController(), received=new Map();
    let next=0;
    const progress=(retrying=false)=>onProgress({
      loaded:[...completed.values()].reduce((sum,part)=>sum+part.length,0)+[...received.values()].reduce((a,b)=>a+b,0),
      total:manifest.bytes,retrying
    });
    async function part(index) {
      if(completed.has(index))return;
      const spec=manifest.parts[index];
      for(let attempt=0;attempt<attempts;attempt++) {
        if(controller.signal.aborted)throw controller.signal.reason;
        const request=new AbortController();
        const cancel=()=>request.abort(controller.signal.reason);
        controller.signal.addEventListener('abort',cancel,{once:true});
        let timer;
        const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(new Error('Download stalled')),idleMs);};
        try {
          received.set(index,0);progress(attempt>0);heartbeat();
          const response=await fetcher('assets/'+spec.url,{signal:request.signal,cache:'default'});
          if(!response.ok){const error=new Error('Model HTTP '+response.status);error.status=response.status;throw error;}
          if(/text\/html/i.test(response.headers.get('content-type')||''))throw new Error('Model response is a sign-in page');
          const reader=response.body.getReader(),chunks=[];let size=0;
          for(;;){const {done,value}=await reader.read();if(done)break;heartbeat();chunks.push(value);size+=value.length;received.set(index,size);progress(attempt>0);}
          if(size!==spec.bytes)throw new Error('Incomplete model chunk');
          const bytes=new Uint8Array(size);let offset=0;
          for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
          received.delete(index);completed.set(index,bytes);progress();return;
        }catch(error){
          received.delete(index);progress(true);
          if(controller.signal.aborted||attempt===attempts-1||[401,403].includes(error.status))throw error;
          await new Promise(resolve=>setTimeout(resolve,retryMs*(attempt+1)));
        }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);}
      }
    }
    async function worker(){while(next<manifest.parts.length){const index=next++;await part(index);}}
    progress();
    const workers=Array.from({length:Math.min(manifest.parts.length,Math.max(1,Math.min(6,Math.floor(concurrency)||2)))},()=>worker());
    try{await Promise.all(workers);}catch(error){controller.abort(error);await Promise.allSettled(workers);throw error;}
    const data=new Uint8Array(manifest.decodedBytes??manifest.bytes);let offset=0;
    for(let i=0;i<manifest.parts.length;i++){let bytes=completed.get(i);if(manifest.encoding==='gzip'){bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());if(bytes.length!==manifest.parts[i].decodedBytes)throw new Error('Decoded model chunk length mismatch');}data.set(bytes,offset);offset+=bytes.length;}
    if(offset!==(manifest.decodedBytes??manifest.bytes))throw new Error('Model length mismatch');
    return data;
  }
  return {load(){return running??=(download().finally(()=>running=null));},release(){completed.clear();}};
}

import {escapeText as esc,contentUrl} from './content-view.js?v=room-42';
const text=v=>esc(v).replace(/\n/g,'<br>'),url=v=>esc(contentUrl(v));
const zh=v=>v?`<small lang="zh-CN">${text(v)}</small>`:'';
const image=(src,alt,cls='')=>`<img class="${cls}" src="${url(src)}" alt="${esc(alt)}" loading="lazy">`;
const link=(src,label)=>`<a class="action" href="${url(src)}" target="_blank" rel="noopener noreferrer">${text(label)} ↗</a>`;
function blocks(items=[]){return items.map(b=>{
 if(b.type==='video')return `<div class="film-stage"><video controls playsinline preload="none" src="${url(b.src)}" poster="${url(b.poster)}" aria-label="${esc(b.alt||'Film')}"></video></div>`;
 if(b.type==='image')return `<figure class="content-figure"><button class="image-zoom" data-zoom="${url(b.src)}" aria-label="放大 ${esc(b.alt)}">${image(b.src,b.alt)}</button>${b.caption?`<figcaption>${text(b.caption)}${zh(b.captionZh)}</figcaption>`:''}</figure>`;
 if(b.type==='text')return `<p class="content-prose">${text(b.text)}${zh(b.zh)}</p>`;
 if(b.type==='link'||b.type==='pdf')return `<p>${link(b.src,b.labelZh||b.label||'View')}</p>`;
 return '';
}).join('')}

export function createContentView({host,data,toast,onTrack}){
 let section='',category='全部',tag='全部',album=null,page=0,turnTimer=null,turnBusy=false;
 let audio=null,activeTrack=-1,started=false,artist='全部',shuffle=[],filmResume=false;
 const tracks=data.sections.music.tracks;
 const visible=xs=>(xs||[]).filter(x=>x.published!==false);
 const jumpTop=()=>host.scrollTop=0;
 const shell=(label,title,note)=>`<div class="collection-intro"><span class="index">${text(label)}</span><h3>${text(title)}</h3><p>${text(note)}</p></div>`;
 function show(key){
  cleanup();section=key;category=tag='全部';
  if(key==='aigc'||key==='architecture')catalog();
  else if(key==='photography')library();
  else if(key==='music')music();
  else if(key==='products')products();
  else if(key==='about')about();
  else if(key==='socials')host.innerHTML=shell('ELSEWHERE','小红书','照片、日常与持续发生的创作。')+link(data.site.socialUrl,'前往小红书主页');
  jumpTop();
 }
 function catalog(){
  const items=visible(data.sections[section].items),isAI=section==='aigc';
  const cats=['全部',...new Set(items.map(i=>i.category))];
  const subset=items.filter(i=>category==='全部'||i.category===category);
  const tags=['全部',...new Set(subset.flatMap(i=>i.tags||[]))];if(!tags.includes(tag))tag='全部';
  const shown=subset.filter(i=>tag==='全部'||i.tags?.includes(tag));
  host.innerHTML=shell(isAI?'GENERATIVE PRACTICE / 35 FILMS':'SPATIAL PRACTICE / 05 PROJECTS',isAI?'From brief to final frame.':'Ideas, made spatial.',isAI?'Brief 拆解 → 脚本策划 → 画面制作 → 剪辑 → 交付。全部作品由我独立完成。':'从场地与概念出发，探索空间、时间与人的关系。')+
   (isAI?`<div class="filters" aria-label="作品用途">${cats.map(c=>`<button data-category="${esc(c)}" aria-pressed="${c===category}">${text(c)} <sup>${c==='全部'?items.length:items.filter(x=>x.category===c).length}</sup></button>`).join('')}</div><div class="tag-filters" aria-label="作品主题">${tags.map(t=>`<button data-tag="${esc(t)}" aria-pressed="${t===tag}">${text(t)}</button>`).join('')}</div>`:'')+
   `<p class="catalog-count" role="status">${String(shown.length).padStart(2,'0')} WORKS / ${isAI?'生成影像':'建筑设计'}</p><div class="work-grid ${isAI?'':'architecture-grid'}">${shown.map(i=>`<button class="work-tile" data-work="${esc(i.id)}"><div class="work-cover">${image(i.cover,i.title)}<span class="cover-action">${isAI?'PLAY FILM ↗':'EXPLORE ↗'}</span></div><div class="tile-meta"><span>${text(i.category)}</span><span>${String(items.indexOf(i)+1).padStart(2,'0')}</span></div><h4>${text(i.title)}</h4><p>${text(isAI?(i.tags||[]).join(' / '):i.description)}</p></button>`).join('')}</div>`;
  host.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;tag='全部';catalog()});
  host.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{tag=b.dataset.tag;catalog()});
  host.querySelectorAll('[data-work]').forEach(b=>b.onclick=()=>work(items.find(i=>i.id===b.dataset.work)));
 }
 function work(item){
  host.innerHTML=`<article class="work-detail"><button class="back-list">← 返回作品目录 / ALL WORKS</button><div class="work-heading"><span class="index">${text(item.category)}</span><h3>${text(item.title)}</h3><p>${text(item.description)}${zh(item.descriptionZh)}</p></div>${blocks(item.blocks)}<button class="action end-back">← 返回作品目录</button></article>`;
  host.querySelectorAll('.back-list,.end-back').forEach(b=>b.onclick=()=>{pauseFilms();catalog();jumpTop()});bindMedia();jumpTop();
 }
 function library(){
  const albums=visible(data.sections.photography.albums);album=null;
  host.innerHTML=shell('THE PERSONAL LIBRARY / 06 VOLUMES','Ways of seeing.','五册摄影，一册影像。打开一本书，沿着画面的顺序慢慢阅读。')+`<div class="library-grid">${albums.map((a,i)=>`<button class="volume" data-album="${i}"><span class="volume-object">${image(a.cover,a.title)}<span class="volume-spine"></span></span><span class="volume-number">VOL. ${String(i+1).padStart(2,'0')} / ${i===5?'MOVING IMAGE':'PHOTOGRAPHY'}</span><strong>${text(a.title)}</strong><small>${text(a.description)}</small></button>`).join('')}</div>`;
  host.querySelectorAll('[data-album]').forEach(b=>b.onclick=()=>openBook(albums[+b.dataset.album]));
 }
 function openBook(a){
  album=a;page=0;host.innerHTML=`<button class="back-list">← 六册作品集 / THE LIBRARY</button><div class="reading-title"><h3>${text(a.title)}</h3><p>${text(a.description)}</p></div><div class="pdf-toolbar"><div class="page-controls"><button id="prev" aria-label="上一页">←</button><span id="page-count" aria-live="polite"></span><button id="next" aria-label="下一页">→</button></div><span class="page-meta">左右键或滑动翻页 · 点击放大</span>${a.pdf?link(a.pdf,'图册 PDF'):''}</div><div class="reading-desk"><div class="paper-stack"><button class="paper-surface" aria-label="放大当前书页"><img id="page" alt=""></button><div class="turning-leaf" aria-hidden="true"></div><span class="paper-gutter"></span></div></div><div class="book-links"></div><div class="page-rail" aria-label="书页导航">${a.pages.map((p,i)=>`<button data-page="${i}" aria-label="第 ${i+1} 页">${i+1}</button>`).join('')}</div>`;
  host.querySelector('.back-list').onclick=()=>{clearTimeout(turnTimer);turnBusy=false;library();jumpTop()};
  host.querySelector('#prev').onclick=()=>changePage(-1);host.querySelector('#next').onclick=()=>changePage(1);
  host.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(+b.dataset.page));
  host.querySelector('.paper-surface').onclick=()=>zoom(pageSource(page),`${a.title} / ${page+1}`);
  let down=null;const desk=host.querySelector('.reading-desk');
  desk.addEventListener('touchstart',e=>down=e.touches[0].clientX,{passive:true});desk.addEventListener('touchend',e=>{if(down!==null){const dx=e.changedTouches[0].clientX-down;if(Math.abs(dx)>55)changePage(dx<0?1:-1);down=null}},{passive:true});
  updatePage();jumpTop();
 }
 const pageSource=i=>typeof album.pages[i]==='string'?album.pages[i]:album.pages[i].src;
 function updatePage(){
  const im=host.querySelector('#page');if(!im||!album)return;im.src=contentUrl(pageSource(page));im.alt=`${album.title} / ${page+1}`;
  im.onload=()=>host.querySelector('.paper-stack')?.classList.toggle('single-page',im.naturalWidth<im.naturalHeight);
  host.querySelector('#page-count').textContent=`${String(page+1).padStart(2,'0')} / ${album.pages.length}`;
  host.querySelector('#prev').disabled=page===0;host.querySelector('#next').disabled=page===album.pages.length-1;
  host.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-current',+b.dataset.page===page?'page':'false'));
  host.querySelector('.book-links').innerHTML=(album.links||[]).filter(l=>l.page===page).map(l=>link(l.src,l.title)).join('');
  if(page+1<album.pages.length){const preload=new Image();preload.src=contentUrl(pageSource(page+1))}
 }
 function setPage(next){
  if(!album||turnBusy||next===page||next<0||next>=album.pages.length)return;
  const leaf=host.querySelector('.turning-leaf'),forward=next>page;turnBusy=true;
  leaf.style.backgroundImage=`url("${contentUrl(pageSource(page))}")`;leaf.className=`turning-leaf ${forward?'turn-forward':'turn-back'}`;
  page=next;updatePage();turnTimer=setTimeout(()=>{leaf.className='turning-leaf';turnBusy=false},matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);
 }
 function changePage(delta){if(section==='photography'&&host.querySelector('#page')&&!document.querySelector('.image-lightbox[open]'))setPage(page+delta)}
 function zoom(src,alt){
  const d=document.createElement('dialog');d.className='image-lightbox';d.innerHTML=`<button class="zoom-close" aria-label="关闭放大图片">关闭 ✕</button><div>${image(src,alt)}</div>`;document.body.append(d);d.showModal();
  d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.onclick=e=>{if(e.target===d)d.close()};
 }
 function bindMedia(){
  host.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>zoom(b.dataset.zoom,b.querySelector('img').alt));
  host.querySelectorAll('video').forEach(v=>{v.addEventListener('play',()=>{host.querySelectorAll('video').forEach(other=>{if(other!==v)other.pause()});if(audio&&!audio.paused){filmResume=true;audio.pause();onTrack(-1);syncAudioUI()}});v.addEventListener('pause',resumeAfterFilm);v.addEventListener('ended',resumeAfterFilm);v.addEventListener('error',()=>toast('Film unavailable. Please try again.','视频加载失败，请重试'));});
 }
 function resumeAfterFilm(){if(filmResume&&!Array.from(host.querySelectorAll('video')).some(v=>!v.paused&&!v.ended)){filmResume=false;audio?.play().then(()=>{onTrack(activeTrack);syncAudioUI()}).catch(()=>syncAudioUI())}}
 function pauseFilms(){host.querySelectorAll('video').forEach(v=>v.pause());resumeAfterFilm()}
 function cleanup(){clearTimeout(turnTimer);turnBusy=false;pauseFilms();album=null}
 function products(){const items=visible(data.sections.products.items);host.innerHTML=items.map((p,i)=>`<article class="project-card"><div class="project-visual">${p.cover?image(p.cover,p.title):`<span class="project-monogram">0${i+1}.</span>`}</div><div class="project-info"><span class="index">${text(p.category)}</span><h3>${text(p.title)}</h3>${zh(p.titleZh)}<p>${text(p.description)}${zh(p.descriptionZh)}</p><button class="action" data-product="${i}">查看项目 ↗</button></div></article>`).join('');host.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>product(items[+b.dataset.product]));}
 function product(p){host.innerHTML=`<article class="project-detail"><button class="back-list">← 返回产品</button><h3>${text(p.detailTitle||p.title)}</h3>${blocks(p.blocks)}${p.copyCode?`<code>${esc(p.copyCode)}</code><button class="action" data-copy>复制口令</button>`:''}${p.url?link(p.url,'打开项目'):''}</article>`;host.querySelector('.back-list').onclick=products;if(p.copyCode)host.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(p.copyCode);toast('Copied','已复制')}catch{toast('Please select the code to copy.','请选中口令手动复制')}};bindMedia();jumpTop()}
 function about(){const a=data.sections.about;host.innerHTML=`<div class="about-layout"><div class="about-copy"><span class="index">${text(a.name)}</span><h3>${text(a.title)}</h3><p>${text(a.description)}${zh(a.descriptionZh)}</p>${link(a.resume,'查看完整简历')}<p class="note">${text(a.note)}${zh(a.noteZh)}</p>${link(data.site.socialUrl,'小红书')}${data.site.githubUrl?link(data.site.githubUrl,'GitHub'):''}</div><button class="image-zoom" data-zoom="${url(a.image)}">${image(a.image,'孙正基 · 简历','resume-page')}</button></div>`;bindMedia()}
 function music(){
  const artists=['全部',...new Set(tracks.map(t=>t.artist))];
  host.innerHTML=shell('ON THE TURNTABLE','A personal soundtrack.','按歌手收藏，随心选择。首曲 Hong Kong，之后随机续播。')+`<div class="listening-console"><img data-current-cover alt="当前唱片封面"><div><span class="index">NOW PLAYING</span><h4 data-current-title></h4><p data-current-artist></p><div class="transport"><button data-toggle aria-label="播放或暂停">播放</button><button data-next>下一首 ↗</button><label>音量 <input data-volume type="range" min="0" max="1" step="0.01" value="${audio?.volume??.28}" aria-label="音乐音量"></label></div></div></div><div class="filters">${artists.map(a=>`<button data-artist="${esc(a)}" aria-pressed="${artist===a}">${text(a)}</button>`).join('')}</div><div class="record-grid">${tracks.map((t,i)=>artist==='全部'||t.artist===artist?`<button class="record-tile" data-track="${i}">${image(t.cover,t.title)}<span class="record-state"></span><strong>${text(t.title)}</strong><small>${text(t.artist)}</small></button>`:'').join('')}</div>`;
  host.querySelectorAll('[data-artist]').forEach(b=>b.onclick=()=>{artist=b.dataset.artist;music()});host.querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>play(+b.dataset.track));host.querySelector('[data-toggle]').onclick=toggle;host.querySelector('[data-next]').onclick=next;host.querySelector('[data-volume]').oninput=e=>{if(audio)audio.volume=+e.target.value};syncAudioUI();
 }
 function syncAudioUI(){
  const t=tracks[activeTrack]||tracks.find(t=>t.id===data.sections.music.defaultTrack)||tracks[0],playing=audio&&!audio.paused;
  if(host.querySelector('[data-current-title]')){host.querySelector('[data-current-title]').textContent=t.title;host.querySelector('[data-current-artist]').textContent=t.artist;host.querySelector('[data-current-cover]').src=contentUrl(t.cover);host.querySelector('[data-toggle]').textContent=playing?'Ⅱ 暂停':'▶ 播放';host.querySelectorAll('[data-track]').forEach(b=>{const current=+b.dataset.track===activeTrack;b.setAttribute('aria-pressed',String(current&&playing));b.querySelector('.record-state').textContent=current?(playing?'NOW PLAYING':'PAUSED'):''})}
  const mini=document.querySelector('#sound-toggle');if(mini){mini.textContent=playing?'Ⅱ MUSIC':'▶ MUSIC';mini.setAttribute('aria-label',playing?'暂停音乐':'播放音乐');mini.setAttribute('aria-pressed',String(!!playing));mini.title=t.title+' / '+t.artist}
 }
 function ensureAudio(){if(audio)return;audio=new Audio();audio.preload='none';audio.volume=.28;audio.onended=next;audio.onpause=()=>{onTrack(-1);syncAudioUI()};audio.onplay=()=>{onTrack(activeTrack);syncAudioUI()};audio.onerror=()=>{onTrack(-1);syncAudioUI();toast('Track unavailable. Select another record.','歌曲加载失败，请选择其他曲目')};}
 async function play(i,force=false){
  ensureAudio();filmResume=false;
  if(i===activeTrack&&!force){if(audio.paused){try{await audio.play()}catch{toast('Tap play to start the music.','点击播放开始音乐')}}else audio.pause();syncAudioUI();return;}
  audio.pause();activeTrack=i;audio.src=contentUrl(tracks[i].src);audio.loop=false;
  try{await audio.play()}catch{syncAudioUI();toast('Tap MUSIC to start listening.','点击 MUSIC 开始播放音乐')}syncAudioUI();
 }
 function next(){if(!shuffle.length){shuffle=tracks.map((_,i)=>i).filter(i=>i!==activeTrack);for(let i=shuffle.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffle[i],shuffle[j]]=[shuffle[j],shuffle[i]]}}play(shuffle.pop(),true)}
 function toggle(){play(activeTrack>=0?activeTrack:Math.max(0,tracks.findIndex(t=>t.id===data.sections.music.defaultTrack)))}
 function startMusic(){if(started)return;started=true;const b=document.createElement('button');b.id='sound-toggle';b.className='sound-toggle';b.onclick=toggle;document.body.append(b);play(Math.max(0,tracks.findIndex(t=>t.id===data.sections.music.defaultTrack)),true)}
 return {show,changePage,cleanup,startMusic};
}

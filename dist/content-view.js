// Content editing belongs in content.json; room interaction stays in app.js.
export const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>escapeText(value).replace(/\n/g,'<br>');
export function contentUrl(value){
 const s=String(value??'');
 return /^(https?:\/\/|mailto:)/i.test(s)||/^(assets\/|\.\/assets\/)/.test(s)?s:'';
}
const url=value=>escapeText(contentUrl(value));
const zh=value=>value?`<small lang="zh-CN">${text(value)}</small>`:'';
function blocks(items=[]){return items.map(b=>{
 if(b.type==='video')return `<div class="film-stage"><video controls playsinline preload="metadata" src="${url(b.src)}" ${b.poster?`poster="${url(b.poster)}"`:''} aria-label="${escapeText(b.alt||'Film')}"></video></div>`;
 if(b.type==='image')return `<figure class="content-figure"><img loading="lazy" src="${url(b.src)}" alt="${escapeText(b.alt||'')}">${b.caption?`<figcaption>${text(b.caption)}${zh(b.captionZh)}</figcaption>`:''}</figure>`;
 if(b.type==='text')return `<p class="content-prose">${text(b.text)}${zh(b.zh)}</p>`;
 if(b.type==='link'||b.type==='pdf')return `<p><a class="action" href="${url(b.src)}" target="_blank" rel="noopener">${text(b.label||'View document')} ↗${zh(b.labelZh)}</a></p>`;
 return '';
}).join('');}

export function applyContent(data){
 document.title=data.site.title;
 document.querySelector('meta[name="description"]').content=data.site.description;
 const e=data.entrance,spans=lines=>lines.map(t=>`<span data-glass-ink>${escapeText(t)}</span>`).join('');
 document.querySelector('#intro .eyebrow').textContent=e.eyebrow;
 document.querySelector('#intro h1').innerHTML=e.name.map(t=>`<span class="name-line" data-glass-ink data-grain>${escapeText(t)}</span>`).join('');
 document.querySelector('#intro h1').setAttribute('aria-label',e.name.join(' '));
 document.querySelector('.poster-theme').innerHTML=spans(e.theme);
 document.querySelector('.poster-bio').innerHTML=e.bio.map(p=>`<p>${spans(p)}</p>`).join('');
 document.querySelector('#intro .intro-sub').innerHTML=spans(e.categories);
 document.querySelector('.poster-poem').innerHTML=`<p>${spans(e.quote)}</p><cite>${spans([e.attribution])}</cite>`;
}

export {createContentView} from './collection-view.js?v=room-42';

'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const data = window.CHEMRESEARCH_DATA;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const u = new URL(value); return ['http:','https:','ftp:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
  const labels = {tutorial:'深度教程',qa:'论坛帖',discipline:'学科频道',tool:'平台工具',software:'软件官网',archive:'邮件归档',resource:'资源索引',job:'学术招聘',conference:'学术会议',announcement:'公告',preprint:'预印本',paper:'期刊论文',repo:'开源仓库',database:'数据库'};
  const icons = {tutorial:'文',qa:'问',preprint:'P',paper:'P',repo:'⌘',software:'⌘',database:'◈',resource:'▦'};
  if (!data?.items?.length) { $('result-count').textContent='未能载入目录，请确认已完整解压，保留所有网页文件后重新打开。'; return; }
  const sources = new Map(data.sources.map(s => [s.id,s]));
  const items = data.items.map(i => ({...i, searchable:[i.title,i.excerpt,i.category,i.url,...(i.tags||[]),...(i.sourceRecords||[]).flatMap(r=>[r.title,r.excerpt,r.category,...(r.tags||[])]),...(i.atlasRecords||[]).flatMap(r=>[r.name,r.description,r.detail,r.access])].join(' ').toLocaleLowerCase()}));
  const params = new URLSearchParams(location.search);
  const state = {q:params.get('q')||'',collection:params.get('collection')||'',source:params.get('source')||'',type:params.get('type')||'',sort:'relevance',shown:24};
  let saved = new Set(), persistent = true, lastFocus = null, toastTimer;
  try { const value=JSON.parse(localStorage.getItem('chemresearch-saved')||'[]'); if(Array.isArray(value)) saved=new Set(value.filter(x=>typeof x==='string')); } catch { persistent=false; }
  const format = n => n.toLocaleString('zh-CN');
  const sourceNames = i => i.sourceIds.map(id=>sources.get(id)?.name||id);
  function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800); }
  // 自然语言问句逐字匹配常常为 0：退回到「英文词 + 中文双字 / 三字片段」的相关度打分。
  const STOP=new Set(['怎么','如何','什么','哪些','可以','用什','有哪','一下','请问','the','and','for','how','what','with']);
  function grams(q){const out=new Set(q.match(/[a-z0-9][a-z0-9+#.\-]{1,}/g)||[]);for(const run of q.match(/[㐀-鿿]+/g)||[]){if(run.length<=2)out.add(run);for(let i=0;i+2<=run.length;i++)out.add(run.slice(i,i+2));for(let i=0;i+3<=run.length;i++)out.add(run.slice(i,i+3));}return [...out].filter(t=>!STOP.has(t));}
  let fuzzy=false;
  function matches() {
    const T=window.MolAstriaTerms, terms=T?T.tokens(state.q):state.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const found=(text,t)=>T?T.matchesToken(text,t):text.includes(t);
    const scope=i=>(!state.source||i.sourceIds.includes(state.source)) && (!state.type||i.type===state.type) && (!state.collection||(state.collection==='saved'?saved.has(i.id):i.origins.includes(state.collection)));
    fuzzy=false;
    let result=items.filter(i=>terms.every(t=>found(i.searchable,t)) && scope(i));
    if(!result.length&&terms.length){
      const gs=grams(state.q.toLocaleLowerCase()), groups=T?T.groupsIn(state.q):[], need=groups.length?2:Math.max(2,Math.ceil(gs.length*0.3));
      const ranked=items.filter(scope).map(i=>{const t=i.title.toLocaleLowerCase();let hit=0,s=0;for(const g of gs){if(i.searchable.includes(g)){hit++;s+=(t.includes(g)?4:1)*(g.length>=3?1.5:1);}}for(const g of groups){if(g.some(x=>T.has(i.searchable,x))){hit+=2;s+=g.some(x=>T.has(t,x))?6:2;}}return {i,hit,s};}).filter(x=>x.hit>=need).sort((a,b)=>b.s-a.s);
      if(ranked.length){fuzzy=true;result=ranked.map(x=>x.i);if(state.sort==='relevance')return result;}
    }
    const score=i=>terms.reduce((sum,t)=>sum+(found(i.title.toLocaleLowerCase(),t)?5:0)+(i.atlasRecords?.some(r=>r.name.toLocaleLowerCase().includes(t))?3:0),0);
    if(state.sort==='date')result.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    else if(state.sort==='title')result.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
    else if(terms.length)result.sort((a,b)=>score(b)-score(a));
    else result.sort((a,b)=>Number(b.origins.includes('atlas'))-Number(a.origins.includes('atlas')));
    return result;
  }
  function syncURL() {
    const p=new URLSearchParams(); for(const k of ['q','collection','source','type'])if(state[k])p.set(k,state[k]);
    try {history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+location.hash);}catch{}
    $('network-query').href='hub/network.html'+(state.q?'?q='+encodeURIComponent(state.q):'');
  }
  function render() {
    const list=matches(), limit=list.slice(0,state.shown);
    $('result-count').textContent=fuzzy?`没有逐字匹配的结果，按相关度列出 ${format(list.length)} 条近似资源`:`找到 ${format(list.length)} 条资源${state.q?' · 多个关键词同时匹配':''}`;
    $('saved-count').textContent=`收藏 ${saved.size}`;
    $('results').innerHTML=limit.map(i=>`<article class="result-row"><div class="row-kind"><span class="kind-icon" aria-hidden="true">${icons[i.type]||'↗'}</span><span class="kind-name">${esc(labels[i.type]||i.type)}</span></div><div class="row-main"><h3><a href="${esc(safeURL(i.url))}" target="_blank" rel="noopener noreferrer">${esc(i.title)} <span aria-hidden="true">↗</span></a></h3><p class="excerpt">${esc(i.excerpt||i.atlasRecords?.[0]?.description||'原站目录未提供摘要，请点击标题查看原文。')}</p><div class="row-meta">${sourceNames(i).map(name=>`<span class="source-tag">${esc(name)}</span>`).join('')}${i.origins.length>1?'<span class="shared-tag">两站共同收录</span>':''}${i.mirror?'<span>目录交叉引用</span>':''}${i.date?`<time>${esc(i.date)}</time>`:''}${i.category?`<span>${esc(i.category)}</span>`:''}</div></div><div class="row-actions"><button class="save" data-save="${i.id}" aria-label="${saved.has(i.id)?'取消收藏':'收藏'} ${esc(i.title)}" aria-pressed="${saved.has(i.id)}">${saved.has(i.id)?'★':'☆'}</button><small>${esc(new URL(safeURL(i.url),'https://invalid.local').hostname)}</small><button class="detail-link" data-detail="${i.id}">来源与资源说明 ↗</button></div></article>`).join('');
    $('empty').hidden=!!list.length;
    $('search-next').hidden=!state.q||list.length>=5;
    $('next-network').href='hub/network.html?q='+encodeURIComponent(state.q);
    $('next-radar').href='radar/index.html?q='+encodeURIComponent(state.q);
    $('more').hidden=list.length<=state.shown;
    $('page-count').textContent=list.length?`已显示 ${format(Math.min(state.shown,list.length))} / ${format(list.length)} 条`:'';
    syncURL();
  }
  function reset() {Object.assign(state,{q:'',collection:'',source:'',type:'',sort:'relevance',shown:24}); for(const k of ['q','collection','source','type','sort'])$(k==='q'?'search':k).value=state[k];render();}
  function showDetails(id) {
    const i=items.find(x=>x.id===id);if(!i)return;
    lastFocus=document.activeElement;
    const atlas=i.atlasRecords||[];
    $('detail-body').innerHTML=`<p class="eyebrow">RESOURCE / PROVENANCE</p><h2 id="detail-title">${esc(i.title)}</h2><div class="detail-tags">${sourceNames(i).map(n=>`<span class="source-tag">${esc(n)}</span>`).join('')}</div><p>${esc(i.excerpt||atlas[0]?.description||'原站未提供摘要。')}</p>${i.authors?`<p>作者：${esc(i.authors)}</p>`:''}<div class="origin-list"><strong>保留的原始出处</strong>${(i.sourceRecords||[]).map(r=>`<p>${esc(sources.get(r.source)?.name||r.source)} · ${esc(r.date||'无单独日期')}<br><a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>${r.mirror?' · 目录交叉引用':''}</p>`).join('')}${atlas.map(r=>`<p>ChemDB Atlas 目录第 ${r.number} 条 · ${esc(r.category)}<br>${esc(r.name)} · ${esc(r.access)}<br>${esc(r.description)}</p>`).join('')}</div>${atlas.map(r=>`<h3>数据库使用说明</h3><p>${esc(r.detail||r.description)}</p><p>接入状态：${esc(({adapter:'已有独立适配器',optimade:'已有 OPTIMADE 模块',catalog:'资源目录',stub:'待实现'})[r.integration]||r.integration)}。适配器状态不代表 MCP 工具入口已完成。</p><a class="button" href="atlas/index.html#resources/${r.number}">查看数据库详情与工程说明 ↗</a>`).join('')}<p>合并目录仅整理已有快照。访问条件、最新内容与使用许可请以原始网站为准。</p><a class="button primary" href="${esc(safeURL(i.url))}" target="_blank" rel="noopener noreferrer">访问原始资源 ↗</a>`;
    $('details').showModal();
  }
  $('details').addEventListener('close',()=>lastFocus?.isConnected&&lastFocus.focus());
  $('close-details').onclick=()=>$('details').close();
  $('details').addEventListener('click',e=>{if(e.target===$('details')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  document.addEventListener('click',e=>{
    const detail=e.target.closest('[data-detail]');if(detail){showDetails(detail.dataset.detail);return;}
    const save=e.target.closest('[data-save]');if(save){const id=save.dataset.save;saved.has(id)?saved.delete(id):saved.add(id);try{localStorage.setItem('chemresearch-saved',JSON.stringify([...saved]));}catch{persistent=false;}render();document.querySelector(`[data-save="${id}"]`)?.focus();toast(saved.has(id)?(persistent?'已收藏，保存在当前浏览器':'已收藏，本次访问期间有效'):'已取消收藏');return;}
    const quick=e.target.closest('[data-query]');if(quick){state.q=quick.dataset.query;$('search').value=state.q;state.shown=24;render();}
  });
  $('source').innerHTML+=[...sources.values()].map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${format(s.itemCount)})</option>`).join('');
  $('type').innerHTML+=[...new Set(items.map(i=>i.type))].map(t=>`<option value="${esc(t)}">${esc(labels[t]||t)}</option>`).join('');
  for(const k of ['collection','source','type','sort']) {if(![...$(k).options].some(o=>o.value===state[k]))state[k]='';$(k).value=state[k];$(k).addEventListener('change',()=>{state[k]=$(k).value;state.shown=24;render();});}
  $('search').value=state.q;
  $('search').addEventListener('input',()=>{state.q=$('search').value.trim();state.shown=24;render();});
  $('next-ai').onclick=()=>window.ChemHub?.loadAI().then(ai=>ai.openDrawer({mode:'free',question:state.q})).catch(e=>alert(e.message));
  $('reset').onclick=reset;$('empty-reset').onclick=reset;$('more').onclick=()=>{state.shown+=24;render();};
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();$('catalog').scrollIntoView();}});
  $('export').onclick=()=>{
    const list=matches();
    const csv=v=>{let text=String(v??'');if(/^\s*[=+@-]/u.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=[['名称','类型','来源','原文链接','摘要','分类','日期','Atlas编号'],...list.map(i=>[i.title,labels[i.type]||i.type,sourceNames(i).join(' / '),i.url,i.excerpt,i.category,i.date,(i.atlasRecords||[]).map(r=>r.number).join(' / ')])];
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ChemResearch-资源目录.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast(`已导出 ${format(list.length)} 条资源`);
  };
  $('stat-total').textContent=format(data.stats.uniqueEntries);$('stat-atlas').textContent=format(data.stats.atlasEntries);$('stat-hub').textContent=format(data.stats.hubEntries);
  $('merge-note').textContent=`两站 ${format(data.stats.hubEntries+data.stats.atlasEntries)} 条目录记录，合并 ${data.stats.duplicates} 条重复地址，保留 ${format(data.stats.uniqueEntries)} 条资源及全部出处。`;
  render();
})();
/* 「用 AI 回答当前问题」：把搜索框里的问题交给 AI 助手的「问目录」模式。 */
document.getElementById('ask-ai')?.addEventListener('click', () => {
  const q = document.getElementById('search').value.trim();
  window.ChemHub?.loadAI().then((ai) => ai.openDrawer({ mode: 'catalog', question: q, autoSend: !!q })).catch((e) => alert(e.message));
});

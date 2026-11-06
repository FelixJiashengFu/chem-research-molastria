'use strict';
// 说明讲解手册（20 章）：中文正文在 atlas/content.js，英文版在 atlas/guides-en.js。地址是 manual/index.html#<章节 id>；
// 数据库页的旧地址 atlas/index.html#guide/<章节 id> 由 atlas/app.js 转到这里。
(() => {
  const { guides } = window.CHEMDB_CONTENT;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let guideIndex = 1;
  const guideLabels = ['封面与阅读地图','三分钟导读','全景与分层逻辑','01 · 综合化合物与化学信息','02 · 量子化学基准与参数','03 · 材料与晶体：计算库','03 · 材料与晶体：实验库','04 · 生物大分子结构','05 · 药物与化学空间','06–07 · 代谢与反应通路','08 · 光谱与波谱','09 · 机器学习：分子与催化','09 · 机器学习：材料与工具','17 · 科学语言模型与多模态','10 · 软件：量化与动力学','10 · 软件：分析与工作流','11 · 社区与中文入口','接入实况与边界','细读质疑与使用提醒','关键术语与附录'];
  // The handbook ships in Chinese and English (guides-en.js). It follows the site language until the reader picks one here;
  // the pick is remembered per site language, so switching the whole site switches the handbook too.
  const english = window.CHEMDB_GUIDES_EN;
  const hasEnglish = Boolean(english && english.guides.length === guides.length);
  const siteLang = document.documentElement.lang === 'en' ? 'en' : 'zh';
  let guideLang = hasEnglish ? siteLang : 'zh';
  try { const [site, lang] = (localStorage.getItem('molastria-guide-lang') || '').split(':'); if (hasEnglish && site === siteLang && (lang === 'zh' || lang === 'en')) guideLang = lang; } catch {}
  const guideText = () => guideLang === 'en' ? { list: english.guides, labels: english.labels } : { list: guides, labels: guideLabels };
  function setGuideLang(lang) {
    if (!hasEnglish || lang === guideLang) return;
    guideLang = lang;
    try { localStorage.setItem('molastria-guide-lang', `${siteLang}:${lang}`); } catch {}
    renderGuide();
  }
  function renderGuide() {
    const { list, labels } = guideText();
    $('#guide-lang').hidden = !hasEnglish;
    $$('[data-guide-lang]').forEach(b => { b.classList.toggle('active', b.dataset.guideLang === guideLang); b.setAttribute('aria-pressed', String(b.dataset.guideLang === guideLang)); });
    $('#guide-toc').lang = $('#guide-article').lang = $('#reader-progress').lang = guideLang === 'en' ? 'en' : 'zh-CN';
    $('#guide-toc').innerHTML = list.map((g,i)=>`<button data-guide="${i}" class="${i===guideIndex?'active':''}" ${i===guideIndex?'aria-current="true"':''}><span>${String(i+1).padStart(2,'0')}</span>${escape(labels[i])}</button>`).join('');
    // Source HTML is bundled locally; remove active content before displaying it.
    const doc = new DOMParser().parseFromString(list[guideIndex].html,'text/html');
    doc.querySelectorAll('script,iframe,object,embed,style,link,base,meta,form').forEach(n=>n.remove());
    doc.querySelectorAll('*').forEach(n=>[...n.attributes].forEach(a=>{if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*(javascript|data):/i.test(a.value)))n.removeAttribute(a.name);}));
    doc.querySelectorAll('a[href]').forEach(a=>{if(/^https?:/.test(a.getAttribute('href'))){a.target='_blank';a.rel='noopener noreferrer';}});
    $('#guide-article').innerHTML = doc.body.innerHTML;
    $('#reader-progress').textContent = `${String(guideIndex+1).padStart(2,'0')} / ${guides.length} · ${labels[guideIndex]}`;
    $('#guide-prev').disabled = guideIndex===0; $('#guide-next').disabled = guideIndex===guides.length-1;
  }
  function selectGuide(index) {
    guideIndex = Math.max(0,Math.min(index,guides.length-1)); renderGuide();
    history.replaceState(null,'',`#${guides[guideIndex].id}`);
    $('#view-guide .page-intro').scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.addEventListener('click',e=>{
    const g=e.target.closest('[data-guide]');if(g){selectGuide(Number(g.dataset.guide));return;}
    const gl=e.target.closest('[data-guide-lang]');if(gl)setGuideLang(gl.dataset.guideLang);
  });
  $('#guide-prev').onclick=()=>selectGuide(guideIndex-1);$('#guide-next').onclick=()=>selectGuide(guideIndex+1);
  $('#print-guide').onclick=()=>window.print();
  // #<chapter id> opens that chapter; any other hash (the skip link's #main) leaves the open chapter alone.
  function readHash(scroll){
    const i=guides.findIndex(g=>g.id===decodeURIComponent(location.hash.slice(1)));
    if(i<0&&scroll)return;
    if(i>=0)guideIndex=i;
    renderGuide();
    if(scroll)window.scrollTo({top:0,behavior:'smooth'});
  }
  window.addEventListener('hashchange',()=>readHash(true));
  readHash(false);
})();

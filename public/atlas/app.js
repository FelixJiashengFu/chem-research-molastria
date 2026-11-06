'use strict';
(() => {
  const { resources } = window.CHEMDB_CONTENT;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories = [...new Map(resources.map(r => [r.category_code, r.category])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const stateNames = {adapter:'独立适配器',optimade:'OPTIMADE 模块',catalog:'资源目录',stub:'待实现'};
  let saved = new Set();
  let storageAvailable = true;
  try { const value = JSON.parse(localStorage.getItem('chemdb-atlas-saved') || '[]'); if(Array.isArray(value)) saved = new Set(value.filter(Number.isInteger)); } catch { storageAvailable = false; }
  let filter = 'all', category = '', query = '', visible = 12, currentView = 'resources';
  let toastTimeout;
  function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('show'), 2800); }
  function toggleSaved(number) {
    if (saved.has(number)) saved.delete(number); else saved.add(number);
    try { localStorage.setItem('chemdb-atlas-saved', JSON.stringify([...saved])); } catch { storageAvailable = false; }
    renderResources();
    toast(saved.has(number) ? (storageAvailable ? '已收藏，保存在当前浏览器' : '已收藏，本次访问期间有效') : '已取消收藏');
    const dialogSave = $('#dialog-save');
    if(dialogSave && Number(dialogSave.dataset.number) === number) dialogSave.textContent = saved.has(number) ? '取消收藏 ★' : '收藏资源 ☆';
  }
  function getMatches() {
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return resources.filter(r => (!category || r.category_code === category) &&
      terms.every(term => [r.name,r.description,r.category,r.url,r.access,r.detail].join(' ').toLocaleLowerCase().includes(term)) &&
      (filter !== 'integrated' || ['adapter','optimade'].includes(r.integration)) &&
      (filter !== 'free' || r.access === '免费') && (filter !== 'saved' || saved.has(r.number)));
  }
  function setCategory(code, scroll = true) {
    category = code; $('#category-select').value = code; visible = 12;
    showView('resources', false); renderResources();
    if(scroll) $('#catalog').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderResources() {
    const matches = getMatches();
    $('#saved-count').textContent = saved.size;
    $('#results-count').textContent = `共 ${matches.length} 条资源`;
    $('#resource-grid').innerHTML = matches.slice(0,visible).map(r => {
      const integrated = ['adapter','optimade'].includes(r.integration);
      const short = ({'PubChem':'Pc','Basis Set Exchange':'BSE','Materials Project':'mp','AFLOW':'Af','NOMAD':'N','ChEMBL':'Ch','Crystallography Open Database':'COD'})[r.name] || r.name.replace(/[^A-Za-z0-9]/g,'').slice(0,2) || '化';
      return `<article class="resource-card"><div class="card-top"><span class="resource-avatar ${['','avatar-blue','avatar-sand','avatar-lilac'][Number(r.category_code)%4]}">${escape(short)}</span><button class="bookmark ${saved.has(r.number)?'saved':''}" data-save="${r.number}" aria-label="${saved.has(r.number)?'取消收藏':'收藏'} ${escape(r.name)}" aria-pressed="${saved.has(r.number)}">${saved.has(r.number)?'★':'☆'}</button></div><div class="card-heading"><h3>${escape(r.name)}</h3><span class="card-number">${String(r.number).padStart(3,'0')}</span></div><p class="resource-description">${escape(r.description)}</p><div class="card-tags"><span class="tag ${r.access==='免费'?'tag-free':'tag-register'}">${escape(r.access)}</span><span class="tag ${integrated?'tag-integrated':r.integration==='stub'?'tag-stub':''}">${integrated?'已有接入模块':stateNames[r.integration]}</span></div><div class="card-bottom"><span>${escape(r.category)}</span><button data-detail="${r.number}">查看资源 ↗</button></div></article>`;
    }).join('');
    $('#empty-state').hidden = matches.length !== 0;
    $('#load-more').hidden = matches.length <= visible;
    $('#load-note').textContent = matches.length ? `已显示 ${Math.min(visible,matches.length)} / ${matches.length} 条` : '';
    $$('.filter').forEach(b => {b.classList.toggle('active',b.dataset.filter === filter); b.setAttribute('aria-pressed',String(b.dataset.filter === filter));});
    $$('.category-button').forEach(b => {b.classList.toggle('active',b.dataset.category === category); b.setAttribute('aria-pressed',String(b.dataset.category === category));});
    $('#active-category').hidden = !category;
    $('#active-category').innerHTML = category ? `当前主题：${escape(categories.find(c=>c[0]===category)?.[1] || '')}<button id="clear-category">清除主题 ×</button>` : '';
  }
  function showResource(number) {
    const r = resources.find(item=>item.number === number);
    if (!r) return;
    const implemented = ['adapter','optimade'].includes(r.integration);
    $('#dialog-body').innerHTML = `<h2 id="dialog-title">${escape(r.name)}</h2><p>${escape(r.description)}</p><dl class="dialog-facts"><dt>研究主题</dt><dd>${escape(r.category)}</dd><dt>访问方式</dt><dd>${escape(r.access)}</dd><dt>工程状态</dt><dd>${escape(stateNames[r.integration])}${implemented?' · 源码已有模块':''}</dd><dt>接入备注</dt><dd>${escape(r.detail)}</dd><dt>来源网址</dt><dd>${escape(r.url)}</dd><dt>材料日期</dt><dd>2026-10-27 · 来源记录，未在本网页重新验证</dd></dl><div class="dialog-actions"><a class="primary-button" href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">访问原站 ↗</a><button class="secondary-button" id="dialog-save" data-number="${r.number}">${saved.has(r.number)?'取消收藏 ★':'收藏资源 ☆'}</button></div><p class="small-note">${implemented?'数据源模块与 MCP 工具入口的完成度不同；请在 Agent 工程页查看实际状态。':'本条提供资源导航，请按原站要求访问与使用。'}</p>`;
    $('#dialog-save').onclick = () => toggleSaved(number);
    if (!$('#resource-dialog').open) $('#resource-dialog').showModal();
    history.replaceState(null,'',`#resources/${number}`);
  }
  function showView(view,scroll = true) {
    if(!['resources','agent'].includes(view))view='resources';
    currentView = view;
    $$('.view').forEach(s=>s.hidden = s.id !== `view-${view}`);
    $$('.main-nav [data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
    $('#breadcrumb').textContent = ({resources:'资源导航',agent:'Agent 工程'})[view];
    document.title = `${$('#breadcrumb').textContent} · MolAstria`;
    if(location.hash.split('/')[0] !== `#${view}`)history.replaceState(null,'',`#${view}`);
    if(scroll)window.scrollTo({top:0,behavior:'smooth'});
  }
  const plans = {
    molecule:{title:'从一个分子名字，找到可靠身份与结构',ids:[1,43,5,8],steps:['用 search_molecules 查 PubChem，核对名称、标识符与三维构象。','需要药物与活性信息时加 ChEMBL，需要本体分类时加 ChEBI；二者给的是二维重原子结构。','需要计算精度基准时，查 NIST CCCBDB（仅收录导航，没有接口），并核对方法与实验参考。'],note:'分子记录没有能量，不能直接进训练集；也不能把二维重原子坐标当作三维量化结构。'},
    crystal:{title:'从材料化学式，走到可比较的晶体数据',ids:[74,20,23,22,25,29],steps:['用 search_structures 写化学式即可，NaCl、ClNa、Na2Cl2 等价；默认查 Alexandria、Materials Project 的 OPTIMADE 端点、COD 与 NOMAD。','看摘要里的 has_energy 与 theory_key：Alexandria、MC3D、NOMAD 带能量，其余库只有结构。','导出前确认能量类型、泛函、截断能与修正方式一致；不一致时用 level_of_theory 选定一种，来源清单会记下每条记录的出处。'],note:'Materials Project 官方接口需要 MP_API_KEY；没有时结果里会写明原因，结构仍可从 optimade-mp 查到（无能量）。'},
    basis:{title:'为计算方法，找到匹配的基组与赝势',ids:[17,18,19],steps:['用 get_basis 从 Basis Set Exchange 取目标元素的基组，选 ORCA、Gaussian、CP2K、PySCF 等输出格式。','涉及重元素时，同时返回有效芯势（ECP）；ORCA 格式用元素全名。','固体计算可阅读 SSSP；选择泛函时用 libxc 核对名称与实现。'],note:'Basis Set Exchange 随包安装，get_basis 不联网。SSSP 与 libxc 当前仅收录导航。'},
    qm:{title:'从量子化学数据集，走到可训练的数据文件',ids:[76,69,74],steps:['用 find_qm_data 按名称（如 SPICE）、方法与基组找 QCArchive 数据集，先看条数、规格与许可。','用 fetch_dataset_shard 下载一段到本地目录：Hartree、Bohr 换成 eV、Å，梯度转为力，只有色散校正的规格会被拒绝。','用 export_training_set 按数据集导出 extxyz 和来源清单，ase.io.read 读回即可交给训练框架。'],note:'QCArchive 不给逐条许可：SPICE 系列为 CC0，其余数据集要到引用里核对，来源清单会提示。QM9 目前只收录导航。'}
  };
  function renderPlan(task) {
    const p=plans[task];
    $$('.task-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.task===task);b.setAttribute('aria-pressed',String(b.dataset.task===task));});
    $('#plan-result').innerHTML = `<h3>${p.title}</h3><div class="plan-resource-list">${p.ids.map(id=>`<button data-detail="${id}">${escape(resources.find(r=>r.number===id)?.name||'')} ↗</button>`).join('')}</div><ol>${p.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p class="plan-note">${p.note}</p>`;
  }
  const codes = {
    install:`# 进入解压后的项目目录（需要 Python 3.11–3.13 与 uv）\ncd chemdb-agent\nuv sync\n# 不用 uv 时：python -m venv .venv，激活后 pip install -e . pytest vcrpy\n\n# 离线测试：用录好的接口返回，不联网\nuv run python -m pytest\n\n# 启动 MCP 服务器（供 MCP 客户端通过标准输入输出连接）\nuv run python -m chemdb_agent.server`,
    python:`# 独立 Python 示例；在项目目录内用 uv run python 执行（会联网查询 Alexandria）\nfrom chemdb_agent.adapters import optimade\nfrom chemdb_agent import export\n\nrecs = optimade.search_structures(formula="GaN", providers=["alexandria-pbe"], limit=5)\nfor r in recs:\n    print(r.record_id, r.energy, r.level_of_theory.method)\n\n# 导出 extxyz（能量 eV、力 eV/Å、应力 eV/Å³）与来源清单 gan.extxyz.manifest.json\nexport.export_training_set(recs, "data/exports/gan.extxyz", level_of_theory=recs[0].mix_key)`,
    mcp:JSON.stringify({mcpServers:{'chemdb-agent':{command:'uv',args:['--directory','/替换为项目绝对路径/chemdb-agent','run','python','-m','chemdb_agent.server']}}},null,2)
  };
  let currentCode = 'install';
  function renderCode(name){currentCode=name;$('#code-content').textContent=codes[name];$$('.code-tabs [data-code]').forEach(b=>{b.classList.toggle('active',b.dataset.code===name);b.setAttribute('aria-pressed',String(b.dataset.code===name));});}
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('代码已复制'); }
    catch { const t=document.createElement('textarea'); t.value=text; t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch{}t.remove();toast(ok?'代码已复制':'请选中代码后手动复制'); }
  }
  $('#category-nav').innerHTML = categories.map(([code,name])=>`<button class="category-button" data-category="${code}"><span class="category-number">${code}</span><span>${escape(name.replace('与基础参数','与参数').replace('、生物活性与化学空间','与化学空间'))}</span><span class="count">${resources.filter(r=>r.category_code===code).length}</span></button>`).join('');
  $('#category-select').innerHTML += categories.map(([code,name])=>`<option value="${code}">${code} · ${escape(name)}</option>`).join('');
  document.addEventListener('click',e=>{
    const view=e.target.closest('[data-view]');if(view){showView(view.dataset.view);return;}
    const c=e.target.closest('[data-category]');if(c){setCategory(c.dataset.category);return;}
    const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;visible=12;renderResources();return;}
    const s=e.target.closest('[data-save]');if(s){toggleSaved(Number(s.dataset.save));return;}
    const detail=e.target.closest('[data-detail]');if(detail){showResource(Number(detail.dataset.detail));return;}
    const task=e.target.closest('[data-task]');if(task){renderPlan(task.dataset.task);return;}
    const code=e.target.closest('[data-code]');if(code){renderCode(code.dataset.code);return;}
    if(e.target.closest('#clear-category'))setCategory('');
  });
  $('#search').addEventListener('input',e=>{query=e.target.value.trim();visible=12;renderResources();});
  $('#category-select').addEventListener('change',e=>setCategory(e.target.value,false));
  $('#load-more').onclick=()=>{visible+=12;renderResources();};
  $('#reset-filters').onclick=()=>{filter='all';category='';query='';visible=12;$('#search').value='';$('#category-select').value='';renderResources();};
  $('#export-filter').onclick=()=>{
    const matches=getMatches();
    const csvValue=v=>{let text=String(v??'');if (/^[\s]*[=+\-@\t\r]/.test(text)) text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=[['编号','资源名称','分类','说明','网址','访问方式','接入状态','备注'],...matches.map(r=>[r.number,r.name,r.category,r.description,r.url,r.access,stateNames[r.integration],r.detail])];
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ChemDB-资源目录.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast(`已导出 ${matches.length} 条资源`);
  };
  $('#close-dialog').onclick=()=>$('#resource-dialog').close();
  $('#resource-dialog').addEventListener('close',()=>{if(location.hash.startsWith('#resources/'))history.replaceState(null,'','#resources');});
  $('#resource-dialog').addEventListener('click',e=>{if(e.target===$('#resource-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('#copy-code').onclick=()=>copyText(codes[currentCode]);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showView('resources',false);$('#search').focus();$('#catalog').scrollIntoView({behavior:'smooth'});}});
  // The handbook has its own page now: old #guide and #guide/<chapter> addresses open the same chapter in manual/.
  function openManual(id){
    const target=`../manual/index.html${location.search}${id?`#${id}`:''}`;
    if(!window.__CHEM_LOCATION__){location.replace(target);return;}
    // Single-file edition: pages run in a srcdoc frame whose link shim turns in-site links into page switches.
    const a=document.createElement('a');a.href=target;document.body.append(a);a.click();a.remove();
  }
  function readHash(scroll=false){
    const [view,id]=location.hash.slice(1).split('/');
    if(view==='guide'){openManual(id);return;}
    if(['resources','agent'].includes(view))showView(view,scroll);
    if(view==='resources'&&id&&/^\d+$/.test(id))showResource(Number(id));
    else if($('#resource-dialog').open)$('#resource-dialog').close();
  }
  window.addEventListener('hashchange',()=>readHash(true));
  renderResources();renderPlan('molecule');renderCode('install');readHash();
})();

/* Shared navigation for every module; paths work on disk and under any hosting subdirectory. */
(() => {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const section = document.body.dataset.section || 'search';
  const links = [
    ['search', 'index.html', '统一搜索'],
    ['network', 'hub/network.html', '网状查询'],
    ['atlas', 'atlas/index.html#guide', '中文讲解与数据库'],
    ['hub', 'hub/index.html', '论文与社区'],
    ['agent', 'atlas/index.html#agent', 'Agent 工程']
  ];
  const nav = document.createElement('header');
  nav.className = 'cr-header';
  nav.innerHTML = `<a class="cr-brand" href="${new URL('index.html', base)}"><span class="cr-mark" aria-hidden="true">C<span>·</span>H</span><span>ChemResearch <b>Hub</b><small>计算化学研究导航</small></span></a><nav class="cr-links" aria-label="合并网站主导航">${links.map(([id,path,label])=>`<a href="${new URL(path,base)}" ${section===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav><span class="cr-edition">合并版 <b>2026.10</b></span>`;
  document.body.prepend(nav);
  const markCurrent = () => {
    const active = section === 'atlas' && location.hash.startsWith('#agent') ? 'agent' : section;
    nav.querySelectorAll('.cr-links a').forEach((a,index)=>{
      if (links[index][0]===active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
  };
  markCurrent();
  window.addEventListener('hashchange',markCurrent);
  const measure = () => document.documentElement.style.setProperty('--cr-nav-height', `${nav.offsetHeight}px`);
  measure();
  new ResizeObserver(measure).observe(nav);
})();

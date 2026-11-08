'use strict';
// 教学视频：从 YouTube 和哔哩哔哩收集的计算化学教学视频与课程，按主题分组，可筛选、搜索。
// 数据在 videos-data.js（标题和频道保留原文，说明中英两版）；界面文字写中文，由 i18n.js 翻译。
// 每张卡片先只显示封面图，点了才加载视频网站的播放器（不点就不向 YouTube / 哔哩哔哩发请求，除了封面图的后备地址）。
// 不能嵌入的视频（平台不允许，或者在桌面版里）点封面在新标签页 / 系统浏览器里打开原视频，封面下面始终有原视频链接。
// 封面图：发布时 tools/video-thumbs.mjs 下载到 thumbs/<id>.jpg（不进 git）；本地预览没有时退回平台的图片地址，再不行画一个占位图。
// 地址：#v-<id> 定位到该视频。
(() => {
  const D = window.MOLASTRIA_VIDEOS;
  if (!D) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const desktop = !!window.__MOLASTRIA_DESKTOP__;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (pair) => pair[en ? 1 : 0];
  const text = (t) => (t ? (en ? t.en : t.zh) : '');
  const list = D.items;
  const topics = Object.fromEntries(D.topics.map((t) => [t.id, t]));

  const PLATFORM = { yt: ['YouTube', 'YouTube'], bili: ['哔哩哔哩', 'Bilibili'] };
  const LEVEL = { intro: ['入门', 'Introductory'], intermediate: ['进阶', 'Intermediate'], advanced: ['深入', 'Advanced'] };
  const LANG = { zh: ['中文', 'Chinese'], en: ['英文', 'English'] };
  const langName = (code) => (LANG[code] ? L(LANG[code]) : en ? 'Other languages' : '其他语言');
  const langKey = (code) => (LANG[code] ? code : 'other');
  const KIND = { playlist: ['合集', 'Playlist'], multipart: ['分 P 合集', 'Multi-part'] };

  const pageUrl = (v) => (v.p === 'yt'
    ? (v.k === 'playlist' ? `https://www.youtube.com/playlist?list=${encodeURIComponent(v.id)}` : `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`)
    : `https://www.bilibili.com/video/${encodeURIComponent(v.id)}/`);
  const embedUrl = (v) => (v.p === 'yt'
    ? (v.k === 'playlist'
      ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(v.id)}&autoplay=1&rel=0`
      : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`)
    : `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(v.id)}&page=1&autoplay=1&danmaku=0&high_quality=1`);
  // Remote fallbacks for the cover: YouTube's own image host (a playlist uses its first video), the cover URL read on the Bilibili page.
  const remoteThumb = (v) => {
    if (v.p === 'yt') {
      const first = v.k === 'playlist' ? (String(v.thumb || '').match(/\/vi\/([\w-]{11})\//) || [])[1] : v.id;
      return first ? `https://i.ytimg.com/vi/${first}/mqdefault.jpg` : '';
    }
    return v.thumb ? String(v.thumb).replace(/^\/\//, 'https://').replace(/^http:/, 'https:').replace(/@.*$/, '') + '@320w_180h_1c.jpg' : '';
  };
  const canEmbed = (v) => !desktop && v.embed !== false;
  const span = (t) => `<span translate="no" lang="${lang}">${esc(t)}</span>`;

  const haystack = (v) => [v.id, v.title, v.channel, ...(v.sw || []), v.note?.zh, v.note?.en, ...Object.values(PLATFORM[v.p]),
    topics[v.topic]?.zh, topics[v.topic]?.en].filter(Boolean).join(' ').toLowerCase();
  const index = new Map(list.map((v) => [v.id, haystack(v)]));

  const play = '<svg class="vd-play" viewBox="0 0 68 48" aria-hidden="true"><rect x="1" y="1" width="66" height="46" rx="12"/><path d="M27 15v18l16-9z"/></svg>';
  function card(v) {
    const facts = [
      PLATFORM[v.p] ? L(PLATFORM[v.p]) : '',
      langName(v.lang) + (v.subs && v.subs !== v.lang ? (en ? `, ${langName(v.subs)} subtitles` : `，${langName(v.subs)}字幕`) : ''),
      L(LEVEL[v.level] || LEVEL.intro),
      KIND[v.k] ? L(KIND[v.k]) + (v.parts > 1 ? (en ? ` · ${v.parts} parts` : ` · 共 ${v.parts} 集`) : '') : '',
      v.duration || '', v.year || '',
    ].filter(Boolean);
    const tags = [
      v.official ? '<li data-t="official">官方</li>' : '',
      v.reupload ? `<li data-t="reupload">${v.original ? `<a href="${esc(v.original)}" target="_blank" rel="noopener noreferrer">转载 · 原视频</a>` : '转载'}</li>` : '',
      ...(v.sw || []).map((s) => `<li data-t="sw" translate="no">${esc(s)}</li>`),
    ].join('');
    const url = pageUrl(v);
    const where = v.p === 'yt' ? '在 YouTube 打开' : '在哔哩哔哩打开';
    const action = canEmbed(v) ? `<button type="button" class="vd-cover" data-play="${esc(v.id)}" aria-label="${en ? 'Play here: ' : '在本页播放：'}${esc(v.title)}">`
      : `<a class="vd-cover" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${en ? 'Open the video: ' : '打开原视频：'}${esc(v.title)}">`;
    const close = canEmbed(v) ? '</button>' : '</a>';
    return `<article class="vd-card" id="v-${esc(v.id)}" data-id="${esc(v.id)}">
  <div class="vd-media">${action}<img src="thumbs/${esc(v.id)}.jpg" data-remote="${esc(remoteThumb(v))}" alt="" width="320" height="180" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="vd-ph" aria-hidden="true"><b translate="no">${esc(L(PLATFORM[v.p]))}</b><span translate="no">${esc(v.title)}</span></span>${play}${canEmbed(v) ? '' : `<span class="vd-out">${where}</span>`}${close}</div>
  <h4><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" translate="no" lang="${v.lang === 'zh' ? 'zh-CN' : esc(v.lang || 'en')}">${esc(v.title)}</a></h4>
  <p class="vd-channel" translate="no">${esc(v.channel)}</p>
  <p class="vd-facts" translate="no" lang="${lang}">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</p>
  <p class="vd-note" translate="no" lang="${lang}">${esc(text(v.note))}</p>
  ${tags ? `<ul class="vd-tags">${tags}</ul>` : ''}
  <p class="vd-link"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${where} <i class="ico-ext" aria-hidden="true"></i></a><span class="vd-url" translate="no">${esc(url.replace(/^https:\/\/(www\.)?/, ''))}</span></p>
</article>`;
  }

  const listEl = $('#vd-list');
  listEl.innerHTML = D.topics.map((t) => {
    const items = list.filter((v) => v.topic === t.id);
    return items.length ? `<section class="vd-group" data-topic="${esc(t.id)}" id="t-${esc(t.id)}" aria-labelledby="vd-g-${esc(t.id)}"><h3 id="vd-g-${esc(t.id)}"><span translate="no" lang="${lang}">${esc(en ? t.en : t.zh)}</span><span class="vd-group-n"></span></h3>${t.related ? `<p class="vd-related">${t.related.map((r) => `<a href="${esc(r.href)}">${span(text(r))}</a>`).join(' · ')}</p>` : ''}<div class="vd-cards">${items.map(card).join('')}</div></section>` : '';
  }).join('');

  // Covers: the copy saved at release time, then the platform's image, then a drawn placeholder.
  listEl.querySelectorAll('.vd-cover img').forEach((img) => {
    const fail = () => {
      const next = img.dataset.remote;
      if (next) { img.dataset.remote = ''; img.src = next; return; }
      img.closest('.vd-cover').classList.add('no-img');
      img.remove();
    };
    img.addEventListener('error', fail);
    if (img.complete && !img.naturalWidth) fail();
  });

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-play]');
    if (!btn) return;
    const v = list.find((x) => x.id === btn.dataset.play);
    if (!v) return;
    const frame = document.createElement('iframe');
    frame.src = embedUrl(v);
    frame.title = v.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('translate', 'no');
    const media = btn.parentElement;
    media.classList.add('playing');
    btn.replaceWith(frame);
    frame.focus();
    history.replaceState(null, '', `#v-${v.id}`);
  });

  const fill = (sel, entries) => { sel.insertAdjacentHTML('beforeend', entries.map(([v, label]) => `<option value="${esc(v)}" lang="${lang}">${esc(label)}</option>`).join('')); };
  fill($('#vd-topic'), D.topics.filter((t) => list.some((v) => v.topic === t.id)).map((t) => [t.id, en ? t.en : t.zh]));
  fill($('#vd-platform'), Object.keys(PLATFORM).filter((p) => list.some((v) => v.p === p)).map((p) => [p, L(PLATFORM[p])]));
  fill($('#vd-lang'), ['zh', 'en', 'other'].filter((k) => list.some((v) => langKey(v.lang) === k || (k === 'zh' && v.subs === 'zh'))).map((k) => [k, k === 'other' ? langName('') : L(LANG[k])]));
  fill($('#vd-level'), Object.keys(LEVEL).filter((k) => list.some((v) => v.level === k)).map((k) => [k, L(LEVEL[k])]));

  const controls = ['#vd-q', '#vd-topic', '#vd-platform', '#vd-lang', '#vd-level'].map($);
  function applyFilters() {
    const [q, topic, platform, language, level] = controls.map((c) => c.value.trim());
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const v of list) {
      // 中文 also finds videos with Chinese subtitles.
      const langOk = !language || langKey(v.lang) === language || (language === 'zh' && v.subs === 'zh');
      const ok = (!topic || v.topic === topic) && (!platform || v.p === platform) && langOk && (!level || v.level === level)
        && words.every((w) => index.get(v.id).includes(w));
      document.getElementById(`v-${v.id}`).hidden = !ok;
      if (ok) shown++;
    }
    listEl.querySelectorAll('.vd-group').forEach((g) => {
      const n = g.querySelectorAll('.vd-card:not([hidden])').length;
      g.hidden = !n;
      g.querySelector('.vd-group-n').textContent = ` · ${n}`;
    });
    $('#vd-count').textContent = shown === list.length ? `共 ${list.length} 条视频与课程` : `显示 ${shown} 条，共 ${list.length} 条`;
    $('#vd-empty').hidden = shown > 0;
    $('#vd-reset').hidden = !controls.some((c) => c.value);
  }
  const reset = () => { controls.forEach((c) => { c.value = ''; }); applyFilters(); };
  controls.forEach((c) => c.addEventListener(c.tagName === 'SELECT' ? 'change' : 'input', applyFilters));
  $('#vd-reset').addEventListener('click', reset);
  $('#vd-empty-reset').addEventListener('click', () => { reset(); controls[0].focus(); });

  const count = (f) => list.filter(f).length;
  $('#vd-meta').textContent = `收录 ${list.length} 条 · ${D.topics.filter((t) => list.some((v) => v.topic === t.id)).length} 个主题 · YouTube ${count((v) => v.p === 'yt')} 条 · 哔哩哔哩 ${count((v) => v.p === 'bili')} 条 · 中文讲解 ${count((v) => v.lang === 'zh')} 条 · 链接核对于 ${D.checked}`;
  $('#vd-jump').innerHTML = D.topics.filter((t) => list.some((v) => v.topic === t.id)).map((t) => `<a href="#t-${esc(t.id)}">${span(en ? t.en : t.zh)}</a>`).join('');
  if (desktop) $('#vd-desktop').hidden = false;
  applyFilters();

  // #v-<id>: show that video even if a filter hides it, and mark it.
  const target = () => {
    const m = location.hash.match(/^#v-(.+)$/);
    const el = m && document.getElementById(`v-${decodeURIComponent(m[1])}`);
    if (!el) return;
    if (el.hidden) reset();
    el.classList.add('flash');
    el.scrollIntoView({ block: 'center' });
    setTimeout(() => el.classList.remove('flash'), 2400);
  };
  window.addEventListener('hashchange', target);
  target();
})();

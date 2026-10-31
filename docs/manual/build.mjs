// 《MolAstria 开发系统使用说明书》：写成 HTML，用已安装的 Chrome 打印成 PDF。
//   npm ci --prefix tools/e2e     首次运行前
//   node docs/manual/build.mjs
// 用法变了就改这里，再运行一次。这个仓库是公开的，不要写私人信息。
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../tools/e2e/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const here = fileURLToPath(new URL('.', import.meta.url));
const TITLE = 'MolAstria 开发系统使用说明书';
const DATE = '2026 年 10 月 31 日';
const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';

// ── 图 ──────────────────────────────────────────────────────────────────
const KIND = {
  you: ['#e5eefb', '#2f5f98'], claude: ['#e8f5ec', '#2e7d4f'], chat: ['#eef0f3', '#7a838e'],
  repo: ['#fdf2db', '#b7791f'], live: ['#e8f5ec', '#2e7d4f'], plain: ['#ffffff', '#b5bdc6'],
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function box(x, y, w, h, kind, lines, o = {}) {
  const [fill, stroke] = KIND[kind];
  const [title, ...subs] = lines;
  const total = 18 + subs.length * 17;
  const top = y + h / 2 - total / 2 + 14;
  let t = `<text x="${x + w / 2}" y="${top}" text-anchor="middle" font-size="${o.ts || 15}" font-weight="700" fill="#1d2733">${esc(title)}</text>`;
  subs.forEach((s, i) => { t += `<text x="${x + w / 2}" y="${top + 19 + i * 17}" text-anchor="middle" font-size="12.5" fill="#46505c">${esc(s)}</text>`; });
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>${t}`;
}
function arrow(x1, y1, x2, y2, o = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#55606c" stroke-width="1.7" ${o.both ? 'marker-start="url(#ah)"' : ''} marker-end="url(#ah)"/>`;
}
const label = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'middle'}" font-size="${o.fs || 12.5}" font-weight="${o.fw || 400}" fill="${o.fill || '#2a333d'}">${esc(s)}</text>`;
const svg = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family='${FONT}'><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#55606c"/></marker></defs>${inner}</svg>`;

const figIdea = () => svg(1000, 300, [
  label(135, 22, '聊天会话：用完就结束', { fw: 700 }),
  box(20, 38, 230, 66, 'chat', ['会话 A', '改价格页']),
  box(20, 124, 230, 66, 'chat', ['会话 B', '加一个新功能']),
  box(20, 210, 230, 66, 'chat', ['会话 C', '发布桌面版']),
  label(505, 22, '仓库：一直都在', { fw: 700 }),
  box(380, 38, 250, 238, 'repo', ['GitHub 仓库', '', '代码', '项目说明 CLAUDE.md', '文档 docs/', '项目命令 /ship-…', '测试']),
  arrow(252, 71, 378, 110, { both: true }), arrow(252, 157, 378, 157, { both: true }), arrow(252, 243, 378, 204, { both: true }),
  label(315, 292, '开始时读取，结束时写回'),
  label(860, 22, '线上：用户看到的', { fw: 700 }),
  box(750, 38, 230, 66, 'live', ['molastria.com', '网站']),
  box(750, 124, 230, 66, 'live', ['api.molastria.com', '账号服务']),
  box(750, 210, 230, 66, 'live', ['MolAstria 桌面版', 'Windows / Mac']),
  arrow(632, 110, 748, 71), arrow(632, 157, 748, 157), arrow(632, 204, 748, 243),
  label(690, 292, '输入 /ship-… 才上线'),
].join(''));

const figFlow = () => svg(1000, 270, [
  box(20, 20, 290, 96, 'you', ['① 新建会话', '文件夹选 ChemResearchHub']),
  box(355, 20, 290, 96, 'you', ['② 说要做什么', '说结果就行，可以贴截图']),
  box(690, 20, 290, 96, 'claude', ['③ 改代码、跑测试', 'Claude 做，不会自己上线']),
  arrow(310, 68, 353, 68), arrow(645, 68, 688, 68),
  '<path d="M835 116 V145 H165 V168" fill="none" stroke="#55606c" stroke-width="1.7" marker-end="url(#ah)"/>',
  box(20, 170, 290, 96, 'you', ['④ 看结果', '不满意就接着说']),
  box(355, 170, 290, 96, 'you', ['⑤ 输入 /ship-…', '这一步才真正上线']),
  box(690, 170, 290, 96, 'you', ['⑥ 说“收尾”', 'Claude 更新路线图和文档']),
  arrow(310, 218, 353, 218), arrow(645, 218, 688, 218),
].join(''));

const figShip = () => svg(1000, 330, [
  label(165, 22, '你改了什么', { fw: 700 }), label(500, 22, '输入', { fw: 700 }), label(830, 22, '结果', { fw: 700 }),
  box(20, 38, 290, 84, 'plain', ['网页、文字、样式、目录数据', 'public/ i18n/ tools/']),
  box(380, 38, 240, 84, 'you', ['/ship-site'], { ts: 17 }),
  box(690, 38, 290, 84, 'live', ['不到 1 分钟发布到网站', '刚上线要按 Ctrl+F5']),
  box(20, 138, 290, 84, 'plain', ['登录、额度、VIP 卡、成员', 'deploy/']),
  box(380, 138, 240, 84, 'you', ['/ship-worker'], { ts: 17 }),
  box(690, 138, 290, 84, 'live', ['账号服务立刻更新', '网页也改了，再 /ship-site']),
  box(20, 238, 290, 84, 'plain', ['想让桌面版用户也拿到新内容', '已经上线的网页改动也算']),
  box(380, 238, 240, 84, 'you', ['/ship-desktop 0.1.4'], { ts: 17 }),
  box(690, 238, 290, 84, 'live', ['构建 6–8 分钟', '用户重开应用时提示更新']),
  ...[80, 180, 280].flatMap((y) => [arrow(310, y, 378, y), arrow(620, y, 688, y)]),
].join(''));

// ── 排版小件 ─────────────────────────────────────────────────────────────
const fig = (n, caption, s) => `<figure><div class="fig">${s}</div><figcaption>图 ${n} · ${caption}</figcaption></figure>`;
const say = (...lines) => `<div class="say"><span>你说</span>${lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
const cmd = (...lines) => `<pre class="cmd">${lines.map(esc).join('\n')}</pre>`;
const tip = (t) => `<div class="tip">${t}</div>`;
const warn = (t) => `<div class="warn">${t}</div>`;
const table = (head, rows, cls = 'keep nw') => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="nm"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const task = (title, body) => `<div class="task"><h3>${title}</h3>${body}</div>`;

// ── 正文 ─────────────────────────────────────────────────────────────────
const BODY = `
<header class="cover">
  <p class="kicker">MolAstria · molastria.com</p>
  <h1>${TITLE}</h1>
  <p class="lead">以后怎么用 Claude 继续开发这个网站：每次开一个新会话，不用从头解释。</p>
  <p class="asof">${DATE}</p>
</header>

<section>
<h2>一、一分钟看懂</h2>
<p><b>聊天会结束，项目不会。</b>以前项目的背景都在一段聊天里，聊天一长就变慢，也可能丢内容。现在背景都写进了仓库。每个新会话启动时自动读取，等于新来的同事先看了一遍交接文档。</p>
${fig(1, '会话来来去去，项目知识留在仓库', figIdea())}
<p>你只要记住三件事：</p>
<ol class="three">
  <li><b>文件夹选对：</b>新建会话时选 <code>D:\\ChemDraw\\ChemResearchHub</code>。</li>
  <li><b>说清楚要什么：</b>直接说想要的结果，不用交代背景。</li>
  <li><b>做完说“收尾”：</b>Claude 会把进度写回文档，下一个会话就能接上。</li>
</ol>
</section>

<section>
<h2>二、开始一次新工作</h2>
<ol class="steps">
  <li>打开 Claude 桌面版，进入 <b>Code</b> 页，新建一个会话。</li>
  <li>文件夹选 <code>D:\\ChemDraw\\ChemResearchHub</code>。<b>每次都选这个。</b>选上一层的 <code>D:\\ChemDraw</code> 的话，启动状态不会出现。</li>
  <li>第一次会问是否信任这个文件夹，<b>选信任</b>，以后不再问。不信任的话，启动设置里的权限不会生效，测试和只读命令会反复弹确认。</li>
  <li>直接说要做什么。Claude 启动时已经读了项目说明，也看到了当前代码状态和路线图上的待办。</li>
</ol>
${say('把价格页“常见问题”里退款那一条改得更清楚，再加一条“可以开发票吗”。')}
<div class="keep"><p>喜欢用终端的话，效果一样：</p>
${cmd('cd D:\\ChemDraw\\ChemResearchHub', 'claude')}</div>
${tip('<b>想接着上次聊？</b>在侧栏点开旧会话就行（终端里是 <code>claude --continue</code>）。但已经很长的旧会话不如新开一个：背景都在文档里，不会丢。')}
</section>

<section>
<h2>三、怎么跟 Claude 说</h2>
${table(['想要', '这样说'], [
  ['改东西', '“账号页的额度条颜色太淡，深色模式下几乎看不见。”（能贴截图更好）'],
  ['加功能', '“我想让课题组购买者能导出成员名单。先告诉我打算怎么做。”'],
  ['先问再动手', '“先别改，告诉我这个要怎么做、要花多少钱。”'],
  ['看现状', '“现在什么情况？”或 <code>/site-status</code>'],
  ['问为什么', '“为什么账号服务不用 webhook？”（它会查决定记录）'],
  ['下次再做', '“把这件事记到路线图，今天先不做。”'],
  ['不想要了', '“撤销刚才的改动。”已经上线的就说“回退到上一个版本”。'],
])}
<ul>
  <li><b>说结果，不用说做法。</b>“手机上按钮太小”比“把 padding 改成 12px”好。</li>
  <li><b>一件事一个会话。</b>不相关的事新开一个，上下文干净，也不容易互相影响。</li>
  <li><b>上不上线由你决定。</b>Claude 改完不会自己发布，你输入 <code>/ship-…</code> 才会上线。</li>
</ul>
</section>

<section>
<h2>四、一次工作的完整流程</h2>
${fig(2, '蓝色是你做，绿色是 Claude 做', figFlow())}
<div class="keep"><p>举个例子，给价格页加一条常见问题：</p>
${table(['步骤', '你', 'Claude'], [
  ['开始', '新建会话，说“价格页加一条常见问题：可以开发票吗？答案是……”', '看到路线图和代码状态，找到文件，改好，补上英文翻译'],
  ['看结果', '看它发来的截图，不满意就接着说', '按你的意思调整'],
  ['上线', '输入 <code>/ship-site</code>', '跑测试、提交、推送，等发布完成，再到线上核对'],
  ['收尾', '说“收尾”', '更新路线图和文档'],
])}</div>
<h2>五、该用哪个发布命令</h2>
${fig(3, '三条上线路径，互不影响', figShip())}
${warn('<b>容易忘的两点：</b>账号服务（<code>deploy/</code>）推送到 GitHub 不会自动更新，必须 <code>/ship-worker</code>。桌面版里的网页是打包时固定的，网站改了之后，桌面用户要等你发下一个桌面版才能看到。')}
</section>

<section>
<h2>六、七个项目命令</h2>
<p>在对话框里输入。发布类的三个（<code>/ship-…</code>）只有你输入才会运行，Claude 不会自己触发。</p>
${table(['命令', '什么时候用', '它会做什么', '要你做什么'], [
  ['<code>/site-status</code>', '想知道现在什么情况；怀疑线上出问题', '查代码、GitHub 发布、线上网站、账号服务、桌面版，告诉你接下来最该做什么。只读', '看报告'],
  ['<code>/ship-site</code>', '网页、文字、数据改好了', '跑测试、提交、推送、等发布、线上核对', '可以附提交说明，不写也行'],
  ['<code>/ship-worker</code>', '登录、额度、VIP 卡这类逻辑改了', '跑测试，需要时升级数据库，部署账号服务，线上核对', '升级数据库前会先告诉你'],
  ['<code>/ship-desktop 0.1.4</code>', '想让桌面版用户更新', '列出这次包含什么，打版本标签，等构建 6–8 分钟，核对更新文件', '给版本号；发布后重开应用试一下'],
  ['<code>/refresh-chemrxiv</code>', '想更新 ChemRxiv 预印本', '从 Crossref 拉最近 3 周的计算化学预印本，补翻译，测试', '接着 <code>/ship-site</code>'],
  ['<code>/sync-radar</code>', '预印本雷达出了新版本', '把新版网页版复制进来，补翻译，测试', '接着 <code>/ship-site</code>'],
  ['<code>/wrap-up</code>', '一件事做完；或者直接说“收尾”', '更新路线图、决定记录、操作手册，告诉你哪些已上线、哪些还没有', '决定要不要提交'],
], 'nw')}
<h2>七、常见任务怎么做</h2>
${task('发 VIP 卡给朋友（不用 Claude）', `
<ol class="steps">
  <li>打开 <code>molastria.com/pro/account.html</code>，用站长邮箱收验证码登录。</li>
  <li>在“发 VIP 卡”里选数量和有效期，备注写给谁，点“生成”。</li>
  <li>点“复制邀请”，把这段文字发给朋友。朋友打开链接，填邮箱，收到验证码填进去，就开通了。</li>
  <li>想收回就点“收回”，对方只失去这张卡带来的时长。</li>
</ol>`)}
${task('网站好像坏了，或者收到 GitHub 的失败邮件', `
<p>GitHub 每周一自动检查一次网站，失败会给你发邮件。新开一个会话：</p>
${say('收到健康检查失败的邮件，帮我看看是什么问题。')}
<p>也可以输入 <code>/site-status</code>。如果长期没动过仓库，GitHub 可能暂停每周检查（60 天没活动就会），到仓库的 Actions 页重新启用。</p>`)}
${task('改坏了想回退', `
${say('刚才上线的改动有问题，回退到上一个版本。')}
<p>所有改动都在 Git 里，可以退回去。账号服务和桌面版要分别处理，Claude 会告诉你。</p>`)}
${task('加站长、取消站长（要你自己运行）', `
<p>在 PowerShell 里，把邮箱换成要加的那个：</p>
${cmd('cd D:\\ChemDraw\\ChemResearchHub\\deploy', 'npx.cmd wrangler d1 execute molastria --remote --command "INSERT INTO grants (email, source, expires, created) VALUES (\'邮箱\', \'admin\', NULL, unixepoch())"')}
<p>取消站长时，把引号里的 SQL 换成 <code>DELETE FROM grants WHERE email = '邮箱'</code>。</p>`)}
${task('更换密钥（要你自己粘贴）', `
<p>先到服务商后台新建密钥，再在 PowerShell 里运行对应的命令。提示输入时粘贴，回车，屏幕上只显示星号。确认没问题后，再到后台删掉旧密钥。</p>
${cmd('cd D:\\ChemDraw\\ChemResearchHub\\deploy', 'npx.cmd wrangler secret put STRIPE_KEY', 'npx.cmd wrangler secret put RESEND_API_KEY', 'npx.cmd wrangler secret put DEEPSEEK_API_KEY')}
<p>Stripe 新建的是受限密钥，只开 Customers、Checkout Sessions、Subscriptions 三项 Read。</p>`)}
${task('备份用户数据（建议每月一次）', `
${say('帮我把账号数据库备份到 D:\\备份\\MolAstria。')}
<p>备份文件里有用户邮箱，<b>不要放进仓库</b>。</p>`)}
</section>

<section>
<h2>八、哪些事只能你自己做</h2>
${table(['事情', '为什么'], [
  ['把真实密钥粘贴进终端', '密钥不经过 Claude，发到聊天里也不行。万一发了，就去后台换一个新的'],
  ['授予站长身份', '这是最高权限，所以只能你本人运行命令'],
  ['注册账户、付款、开通服务', 'Stripe、Cloudflare、Resend 这些账户是你的，也要用你的身份验证'],
  ['决定上线', '输入 <code>/ship-…</code>，或者明确说“提交并推送”'],
  ['看权限弹窗', 'Claude 要做敏感操作时会问你；看不懂就先拒绝，问它要做什么'],
  ['确认真实付款和真实邮件', '自动测试用的是假 Stripe 和假邮件，真实的只有实际操作才知道'],
])}
<h2>九、同时开几个会话</h2>
<p>可以同时开，但两个会话最好不要改同一批文件。启动状态里如果写着“落后”，说明别的会话推送过新内容，Claude 会先同步再改。</p>
<p>如果要同时做两件比较大的事，可以用工作树（worktree）：每个会话在独立的副本里改，完了再合并。日常一次一件事，不需要它。</p>
<h2>十、东西放在哪</h2>
${table(['内容', '在哪里', '丢了怎么办'], [
  ['代码、文档、命令、测试', 'GitHub 仓库', '重新下载'],
  ['私人笔记（你的邮箱、待办的密钥事项）', '本机 Claude 记忆', '换电脑时复制 <code>~/.claude/projects/D--ChemDraw/memory</code>'],
  ['服务密钥', 'Cloudflare 和 GitHub 的密钥存储；原件在密钥匣', '到服务商后台重新生成'],
  ['<b>桌面版更新签名私钥</b>', '<code>~/.tauri/molastria-updater.key</code> 和 GitHub', '<b>无法重新生成。</b>丢了，已安装的桌面版就再也收不到更新。现在就另存一份'],
  ['用户账号数据', 'Cloudflare D1', '定期备份，见第七节'],
], 'keep')}
<h2>十一、定期要做的事</h2>
${table(['多久', '做什么'], [
  ['每周', '不用管。GitHub 自动检查，失败才会发邮件'],
  ['每月', '备份账号数据库；看一眼 DeepSeek 余额（余额用完，Pro 用户的托管 AI 会报错）'],
  ['每年', '确认 Porkbun 域名续费成功。域名过期，网站和验证码邮件都会失效'],
  ['隔段时间', '输入 <code>/site-status</code>；看 <code>docs/ROADMAP.md</code>，把想做的事告诉 Claude'],
])}
</section>

<section>
<h2>十二、常见问题</h2>
${table(['问题', '怎么办'], [
  ['新会话不知道我们上次聊了什么', '正常。文档里有的它都知道，只是不记得聊天本身。重要的事说“记到文档里”。'],
  ['Claude 看起来不了解这个项目', '检查文件夹是不是 <code>ChemResearchHub</code>，或者让它“先读 CLAUDE.md”。'],
  ['上线了但网页没变', '按 Ctrl+F5。GitHub Pages 让浏览器缓存文件最多 10 分钟。'],
  ['PowerShell 说“禁止运行脚本”', '把 <code>npx</code> 写成 <code>npx.cmd</code>。'],
  ['wrangler 报 7403', 'Cloudflare 的偶发错误，再运行一次。'],
  ['显示“验证码会送达”但没收到', '这个邮箱可能没有订阅（按设计不发），也可能进了垃圾箱，或者当天已超过 Resend 的 100 封。'],
  ['AI 助手没用托管额度', '浏览器里存了自己的 key。在 AI 设置选 MolAstria Pro，或从账号页的按钮打开。'],
  ['一次提问扣了不止 1 次', '正常。<code>deepseek-v4-pro</code> 按 3 倍计，AI 实验室一轮计 3 次，内容特别长时按长度多计。'],
  ['桌面版没提示更新', '彻底退出再打开。点过“稍后”的话，3 天内不再提示。'],
  ['想知道花了多少钱', '看 <code>D:\\ChemDraw\\MolAstria_infra</code> 里的费用说明 PDF。'],
], '')}
<p>更详细的步骤在仓库的 <code>docs/RUNBOOK.md</code>，也可以直接问 Claude。</p>
</section>

<section class="pb card-page">
<h2>速查卡</h2>
<p class="cardlead">这一页可以单独打印。</p>
<div class="quick">
  <div><h3>开始</h3><p>Code 页 → 新建会话 → 选 <code>D:\\ChemDraw\\ChemResearchHub</code> → 直接说要做什么</p></div>
  <div><h3>结束</h3><p>说“收尾”，或输入 <code>/wrap-up</code></p></div>
</div>
${table(['我想……', '输入或说'], [
  ['知道现在什么情况', '<code>/site-status</code>'],
  ['发布网页改动', '<code>/ship-site</code>'],
  ['发布账号服务改动', '<code>/ship-worker</code>'],
  ['发布桌面版', '<code>/ship-desktop 0.1.4</code>（版本号要比上次大）'],
  ['更新 ChemRxiv', '<code>/refresh-chemrxiv</code>，再 <code>/ship-site</code>'],
  ['同步预印本雷达', '<code>/sync-radar</code>，再 <code>/ship-site</code>'],
  ['先问问怎么做', '“先别改，告诉我打算怎么做”'],
  ['下次再做', '“记到路线图”'],
  ['回退', '“回退到上一个版本”'],
  ['备份数据', '“备份账号数据库到 D:\\备份\\MolAstria”'],
  ['发 VIP 卡', '账号页 → 发 VIP 卡 → 生成 → 复制邀请'],
])}
${warn('<b>记住四条：</b>密钥自己粘贴，不发给 Claude。&nbsp; 备份文件不放进仓库。&nbsp; 账号服务要单独部署。&nbsp; 更新签名私钥务必另存一份。')}
</section>`;

const CSS = `
@page { size: A4; margin: 15mm 15mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ${FONT}; color: #1f2933; font-size: 11pt; line-height: 1.7; }
h1 { font-size: 25pt; margin: 4px 0 6px; color: #173f34; }
h2 { font-size: 15.5pt; margin: 20px 0 8px; color: #173f34; border-bottom: 2px solid #d7e3dc; padding-bottom: 4px; break-after: avoid; }
h3 { font-size: 12pt; margin: 0 0 4px; color: #173f34; break-after: avoid; }
p { margin: 6px 0; }
code { font-family: Consolas, "Microsoft YaHei", monospace; font-size: .92em; background: #eef2f4; padding: 1px 5px; border-radius: 4px; color: #173f34; white-space: nowrap; }
.cover { border-left: 6px solid #2e7d4f; padding: 6px 0 6px 16px; margin-bottom: 6px; }
.kicker { margin: 0; font-size: 9.5pt; letter-spacing: .14em; color: #2e7d4f; font-weight: 700; text-transform: uppercase; }
.lead { font-size: 12pt; color: #3a4652; margin: 0 0 4px; }
.asof { font-size: 9pt; color: #6b7682; margin: 0; }
figure { margin: 10px 0 8px; break-inside: avoid; }
.fig { border: 1px solid #e1e6eb; border-radius: 10px; padding: 8px; background: #fff; }
.fig svg { width: 100%; height: auto; display: block; }
figcaption { font-size: 9pt; color: #5b6672; margin-top: 5px; text-align: center; }
ol, ul { margin: 6px 0; padding-left: 22px; } li { margin: 4px 0; }
.three { background: #f4f8f5; border-radius: 10px; padding: 10px 14px 10px 34px; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; font-size: 9.8pt; line-height: 1.55; }
th { background: #173f34; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; }
td { border-bottom: 1px solid #e1e6eb; padding: 6px 8px; vertical-align: top; }
tr { break-inside: avoid; }
td.nm { font-weight: 700; color: #1d2733; }
.nw td.nm { white-space: nowrap; }
.keep { break-inside: avoid; }
.say { position: relative; background: #e5eefb; border-radius: 10px; padding: 8px 14px 8px 58px; margin: 8px 0; break-inside: avoid; }
.say span { position: absolute; left: 14px; top: 9px; font-size: 9pt; font-weight: 700; color: #2f5f98; }
.say p { margin: 2px 0; }
.cmd { background: #16201c; color: #e4f1e8; border-radius: 8px; padding: 10px 14px; font: 9.2pt/1.6 Consolas, "Microsoft YaHei", monospace; white-space: pre-wrap; word-break: break-all; margin: 8px 0; break-inside: avoid; }
.tip { background: #f4f8f5; border-left: 4px solid #2e7d4f; padding: 8px 12px; border-radius: 6px; margin: 10px 0; break-inside: avoid; }
.warn { background: #fdf2db; border-left: 4px solid #b7791f; padding: 8px 12px; border-radius: 6px; margin: 10px 0; break-inside: avoid; }
.task { border: 1px solid #e1e6eb; border-radius: 10px; padding: 10px 14px; margin: 10px 0; break-inside: avoid; }
.pb { break-before: page; }
.quick { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin: 8px 0; }
.quick > div { background: #e5eefb; border-radius: 10px; padding: 10px 14px; }
.quick p { margin: 0; }
.cardlead { color: #5b6672; font-size: 9.5pt; }
`;

const htmlPath = `${here}manual.html`;
writeFileSync(htmlPath, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${TITLE}</title><style>${CSS}</style></head><body>${BODY}</body></html>`);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
await page.pdf({
  path: `${here}MolAstria-使用说明书.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#8a949e;padding:0 15mm;display:flex;justify-content:space-between;font-family:'Microsoft YaHei',sans-serif"><span>${TITLE} · ${DATE}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log('wrote docs/manual/MolAstria-使用说明书.pdf');

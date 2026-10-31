// Printed into every new Claude Code session: where the code stands and what is next.
// Local and fast; the only network call is one short git fetch. Never fails the session.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  return r.status === 0 ? r.stdout.trimEnd() : ''; // keep leading spaces: `git status --porcelain` columns need them
};

const out = ['## MolAstria 当前状态（启动时自动生成）'];
try {
  const fetched = spawnSync('git', ['-c', 'credential.helper=', 'fetch', '-q', 'origin', '--tags'], { cwd: root, timeout: 5000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).status === 0;
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const [ahead = '0', behind = '0'] = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split(/\s+/);
  out.push(`- 分支 ${branch}；相对 origin/main 领先 ${ahead}、落后 ${behind}${fetched ? '' : '（这次没连上 GitHub，数字可能过时）'}`);
  if (Number(behind) > 0) out.push('- **有别的会话推送过新提交，开始改之前先 rebase。**');
  const changes = git('status', '--porcelain').split('\n').filter(Boolean);
  if (changes.length) out.push(`- 未提交的改动 ${changes.length} 处：${changes.slice(0, 8).map((l) => l.slice(3)).join('，')}${changes.length > 8 ? '…' : ''}`);
  out.push(`- 最近提交：${git('log', '-3', '--format=%h %s', 'origin/main').split('\n').join('；')}`);
  const desktop = git('tag', '--list', 'desktop-v*', '--sort=-v:refname').split('\n')[0];
  if (desktop) out.push(`- 最新桌面版：${desktop}（${Number(git('rev-list', '--count', `${desktop}..origin/main`))} 个提交尚未进入桌面版）`);
} catch { /* status is a convenience */ }

try {
  const roadmap = readFileSync(new URL('../../docs/ROADMAP.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const now = /## 现在\n+([\s\S]*?)\n## /.exec(roadmap)?.[1].trim();
  if (now) out.push('', '路线图“现在”（docs/ROADMAP.md）：', now);
} catch { /* no roadmap yet */ }

console.log(out.join('\n'));

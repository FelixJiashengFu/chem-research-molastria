-- MolAstria 账号服务的 D1 表结构（deploy/account-worker.js）。可以重复执行：
--   npx wrangler d1 execute molastria --remote --file deploy/schema.sql
-- 谁付了款以 Stripe 为准；accounts 只是缓存，每 6 小时向 Stripe 重新核对一次。

-- 登录会话：只存令牌的 SHA-256，不存令牌本身。
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_email ON sessions (email);

-- 从 Stripe 查到的订阅摘要。plan: free / pro / team；seats 为课题组席位数。
CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  seats INTEGER NOT NULL DEFAULT 0,
  cycle TEXT NOT NULL DEFAULT '',
  renews INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '',
  customers TEXT NOT NULL DEFAULT '[]',
  checked INTEGER NOT NULL DEFAULT 0
);

-- 邮箱验证码（只存哈希），10 分钟有效，最多试 5 次。card 是登录时一起提交、验证通过后才兑换的 VIP 卡。
-- （2026-10-29 之前建的库补一列：ALTER TABLE codes ADD COLUMN card TEXT;）
CREATE TABLE IF NOT EXISTS codes (
  email TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  card TEXT
);

-- 课题组成员：购买者（owner）把成员邮箱加进来，成员用自己的邮箱登录。
CREATE TABLE IF NOT EXISTS members (
  member TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  added INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS members_owner ON members (owner);

-- 手动赠送的 Pro。source = admin：站长本人，可以发 VIP 卡。只用 wrangler d1 execute 写入，不经过任何接口：
--   INSERT INTO grants (email, source, expires, created) VALUES ('你的邮箱', 'admin', NULL, unixepoch());
-- expires 为 NULL 表示永久。
CREATE TABLE IF NOT EXISTS grants (
  email TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  expires INTEGER,
  created INTEGER NOT NULL
);

-- VIP 卡：站长在账号页生成后送给朋友，兑换后为兑换邮箱开通 Pro。days 为 NULL 表示永久；revoked = 1 表示已收回。
-- 一个邮箱兑换的多张卡按兑换顺序首尾相接；收回其中一张只扣掉那一张的天数。
CREATE TABLE IF NOT EXISTS cards (
  code TEXT PRIMARY KEY,
  days INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  redeemed_by TEXT,
  redeemed_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);

-- AI 托管额度：按自然月（UTC）计数。asks 是正式问答，aux 是关键词提取、连接测试这类短调用。
CREATE TABLE IF NOT EXISTS usage (
  email TEXT NOT NULL,
  month TEXT NOT NULL,
  asks INTEGER NOT NULL DEFAULT 0,
  aux INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (email, month)
);

-- 频率限制计数（发验证码、AI 请求）。
CREATE TABLE IF NOT EXISTS throttle (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset INTEGER NOT NULL
);

-- 每周精选。week 是那一周周一的日期，body 是 JSON（deploy/digest.js）。
CREATE TABLE IF NOT EXISTS digests (
  week TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  body TEXT NOT NULL
);

-- 每周精选的邮件订阅。退订时整行删除。token 用于邮件里的退订链接。
CREATE TABLE IF NOT EXISTS digest_subs (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'zh',
  created INTEGER NOT NULL
);

-- 哪一期发给了谁。sent = 0 表示当时已不是 Pro，跳过了。
CREATE TABLE IF NOT EXISTS digest_sends (
  week TEXT NOT NULL,
  email TEXT NOT NULL,
  sent INTEGER NOT NULL,
  PRIMARY KEY (week, email)
);
CREATE INDEX IF NOT EXISTS digest_sends_sent ON digest_sends (sent);

-- 给程序用的 API key（计算接口 /v1/*）。只存 key 的 SHA-256，原文只在生成时显示一次；prefix 是开头几位，给账号页认 key 用。
-- 撤销就是删掉这一行。last_used 最多每小时更新一次。
CREATE TABLE IF NOT EXISTS api_keys (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  last_used INTEGER
);
CREATE INDEX IF NOT EXISTS api_keys_email ON api_keys (email);

-- 通过 API key 提交的计算（账号页“用量”一栏）：哪个 key、哪个模型、哪种计算、花了几次、什么时候。不记分子。
-- id 是电脑给的任务号，直接从缓存返回的结果没有任务号（空字符串，cached = 1）。定时任务每天删掉 30 天前的记录。
CREATE TABLE IF NOT EXISTS api_jobs (
  id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  key_id TEXT NOT NULL,                 -- api_keys.hash 的前 16 位；key 撤销后这里对不上，账号页显示“已撤销的 key”
  model TEXT NOT NULL,
  job TEXT NOT NULL,
  cost INTEGER NOT NULL,
  cached INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS api_jobs_email ON api_jobs (email, created);

-- 服务状态，每样一行 JSON。uptime：定时任务每 15 分钟探测一次站长的 GPU，body 是
-- { last: { slot, online, gpu }, days: { "2026-11-09": [在线次数, 探测次数], … } }，保留 35 天；/v1/status 读它。
CREATE TABLE IF NOT EXISTS status (
  name TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated INTEGER NOT NULL
);

-- 云同步（2026-11-10）：每个账号的学习记录和收藏，一份 localStorage 存档一行，原文照存（账号服务不解析）。
-- v 是这个账号里递增的版本号（每写一次取账号里最大的加一），设备凭它只拉改过的、并且不覆盖别的设备刚传的。
-- size 是 body 的 UTF-8 字节数，用来算空间（SYNC_FREE_KB / SYNC_PRO_KB）。body 为空字符串表示那份存档在别的设备上被清空了。
-- 删除云端副本就是删掉这个账号的所有行。
CREATE TABLE IF NOT EXISTS sync_items (
  email TEXT NOT NULL,
  key TEXT NOT NULL,
  v INTEGER NOT NULL,
  body TEXT NOT NULL,
  size INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (email, key)
);

-- 讨论室（2026-11-11）：账号在讨论室里的代号。uid 是 12 位随机的小写字母和数字，账号第一次登录着连上讨论室时生成，以后不变。
-- 邮箱只在这张表里和 uid 对上：讨论室的消息、昵称、禁言都存在 Durable Object ChatHub 自己的 SQLite 里（deploy/chat.js），
-- 那边只认 uid，没有邮箱。删掉这里的一行，那个账号下次连上会拿到新的 uid（旧消息还在，但和这个账号对不上了）。
CREATE TABLE IF NOT EXISTS chat_users (
  email TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL
);

-- 网状查询没找到的词（2026-11-10）：访客的浏览器第一次记下一个术语表认不出的词时匿名报一次（POST /net/miss）。
-- 只存词本身：term 是 NFKC + 小写后的写法（主键），shown 是最近一次的原样写法，n 是报过几次（大致是多少个浏览器查过），
-- hits 是最近一次的全文命中数，first / last 是第一次和最近一次的时间。不存 IP、账号、来源网站。最多 3000 行，满了先删报得少、最久没报的。
CREATE TABLE IF NOT EXISTS net_misses (
  term TEXT PRIMARY KEY,
  shown TEXT NOT NULL,
  n INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  first INTEGER NOT NULL,
  last INTEGER NOT NULL
);

-- 注册时间（2026-11-11）：每个邮箱第一次登录成功时写一行（createSession 里 INSERT OR IGNORE），站长账号页的“增长”一栏读它。
-- exact = 1 是真实的第一次登录时间；exact = 0 是这张表上线前就有的账号（登录时已经有会话），
-- created 取能找到的最早记录（会话、API key、精选订阅、VIP 卡兑换），只表示“不晚于”，账号页显示为“上线前”。
-- GET /admin/growth 每次先把还没登记的旧账号以 exact = 0 补进来（INSERT OR IGNORE，只加不改）。部署后站长马上打开一次
-- 账号页，旧账号就都登记好了；在那之前，会话全都过期了的老用户再登录会被当成新注册（上线时只有几个账号，影响很小）。
CREATE TABLE IF NOT EXISTS signups (
  email TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  exact INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS signups_created ON signups (created);

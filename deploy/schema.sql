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

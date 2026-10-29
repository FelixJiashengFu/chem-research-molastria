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

-- 邮箱验证码（只存哈希），10 分钟有效，最多试 5 次。
CREATE TABLE IF NOT EXISTS codes (
  email TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0
);

-- 课题组成员：购买者（owner）把成员邮箱加进来，成员用自己的邮箱登录。
CREATE TABLE IF NOT EXISTS members (
  member TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  added INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS members_owner ON members (owner);

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

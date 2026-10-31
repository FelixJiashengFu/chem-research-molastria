# 开通收款 · Turning on payments

网站的价格页（`/pro/`）和结账窗口已经上线；只差你的收款链接。收款本身不需要服务器（第 1–3 节，约 20 分钟）；第 4 节的 Pro 账号服务用一个免费的 Cloudflare Worker。
The pricing page and checkout window are live; they only need your payment links. Payments need no server (sections 1–3); Pro accounts in section 4 run on a free Cloudflare Worker.

## 1. 开通 Stripe 账户 · Create a Stripe account

1. 打开 <https://dashboard.stripe.com/register>，用你本人的信息注册（个人 / 独资经营者即可）。按提示填写银行账户以接收打款。
2. Stripe 审核时会访问你的网站，以下页面已经准备好：价格页 `https://molastria.com/pro/`、服务条款 `/pro/terms.html`、退款政策 `/pro/refund.html`、隐私政策 `/pro/privacy.html`。**正式收款前请通读并按你的实际情况修改这三份文件**（运营者名称、联系方式、退款承诺都是默认写法）。
3. 在 **Settings → Payment methods** 里打开想用的方式：银行卡、Apple Pay、Google Pay 默认可用；支付宝、微信支付视你的账户所在地是否提供，开通后改 `public/pay/config.js` 里的 `methods`，只列真正开通的。

## 2. 先在测试模式里建 4 个 Payment Link · Four Payment Links, test mode first

**先切到测试环境**：左上角账户菜单 → **Sandbox / Test mode**（页面顶部出现测试提示条）。测试环境里建的东西不会真实扣款；测试链接形如 `https://buy.stripe.com/test_…`，网站会自动在结账窗口提示“测试模式”。

**不需要 API 密钥。** 下面全部在后台网页里点选完成；付款链接本身是公开网址，可以放心发出。密钥（`sk_…` / `rk_…`）不要发给任何人，也不要放进仓库。

在 **Product catalog → Add product** 建 4 个产品，币种都选 **CNY**：

| 套餐 id | 产品名（建议） | 价格设置 | Payment Link 里的额外设置 |
| --- | --- | --- | --- |
| `pro_year` | MolAstria Pro（年付早鸟） | Recurring · Yearly · ¥199.00 | — |
| `pro_month` | MolAstria Pro（月付） | Recurring · Monthly · ¥29.00 | — |
| `team_year` | MolAstria 课题组版 | Recurring · Yearly · **¥298.00（每席位）** | 数量默认 5；勾选 **Let customers adjust quantity**，最少 5、最多 200 |
| `sponsor` | 支持 MolAstria | One-off · **Customer chooses price**（建议默认 ¥50，最低 ¥10） | — |

（Pro 年付与月付也可以建成同一个产品下的两个价格，各自建一个 Payment Link 即可。）

然后对每个价格 **Create payment link**（或 **Payment Links → New**）：

1. **After payment** → **Don't show confirmation page** → **Redirect customers to your website**，填
   `https://molastria.com/pro/success.html?session_id={CHECKOUT_SESSION_ID}&plan=pro_year`
   把末尾的 `pro_year` 换成该链接的套餐 id（`pro_month`、`team_year`、`sponsor`）。
2. 订阅会自动收集邮箱；`sponsor` 请勾选收集邮箱，方便开收据。
3. 保存后复制链接。

**账户设置（只需一次）**

- **Settings → Billing → Customer portal**：打开，允许顾客取消订阅、更新银行卡。服务条款里“随时取消”靠的就是它。
- **Settings → Customer emails**：打开“成功付款”收据和“即将续费”提醒（年付尤其需要）。
- **Settings → Payment methods**：确认银行卡、Apple Pay、Google Pay 已开；支付宝、微信支付若可用再打开，并同步改 `config.js` 的 `methods`。

**用测试卡走一遍**：打开测试链接，卡号 `4242 4242 4242 4242`，有效期填任意未来日期，CVC 任意 3 位。确认：付款后跳回本站确认页（会标“测试订单”）、收到收据邮件、能从收据里的链接进入客户门户取消订阅。

**切到正式环境**：测试链接在正式环境里不能用。在测试环境的产品页点 **Copy to live mode** 复制产品，然后在正式环境里按上面的步骤重新建 4 个 Payment Link，用正式链接替换测试链接。

## 3. 把链接填进网站 · Paste the links

编辑 `public/pay/config.js`（或把链接发给维护者代填）：

```js
contactEmail: 'support@你的域名',          // 售后与退款邮箱
plans: {
  pro_year:  { …, checkoutUrl: 'https://buy.stripe.com/test_xxxxxxxx' },
  pro_month: { …, checkoutUrl: 'https://buy.stripe.com/test_yyyyyyyy' },
  team_year: { …, checkoutUrl: 'https://buy.stripe.com/test_zzzzzzzz' },
  sponsor:   { …, checkoutUrl: 'https://buy.stripe.com/test_wwwwwwww' }
}
```

`price`、`list`、`seatPrice` 只用于展示，单位是人民币，必须与 Stripe 里的价格一致。英文页显示 `CN¥` 价格并附美元约数，汇率在 `usdPerCny`。
推送到 `main` 后约一分钟生效。填了链接的套餐，结账按钮立刻可以付款；没填的仍显示“收款通道正在开通”。

## 4. 开通 Pro 账号服务 · Turn on Pro accounts

账号服务是一个 Cloudflare Worker（`deploy/account-worker.js`，数据存在 Cloudflare D1）。开通后：付款回到本站自动登录；换设备用付款邮箱收 6 位验证码登录；Pro 每月 300 次免配 key 的 AI 托管额度；课题组购买者在账号页添加成员。谁付了款以 Stripe 为准，Worker 直接向 Stripe 查询，**不需要 webhook**。没开通之前，账号页显示“账号服务正在开通”，其余功能照常。

需要三个账户：Cloudflare（免费套餐即可）、[Resend](https://resend.com)（发验证码邮件，免费额度够起步）、DeepSeek（托管额度的模型费用从这里扣）。

1. **把 molastria.com 的 DNS 搬到 Cloudflare（推荐）。** `workers.dev` 地址在中国大陆通常打不开，用 `api.molastria.com` 需要域名在 Cloudflare 上。Cloudflare 后台 → **Add a domain** → `molastria.com` → Free；它会导入现有记录。GitHub Pages 的 A / AAAA 记录和 `www` CNAME 设为 **DNS only（灰色云朵）**，再到 Porkbun 把 nameserver 换成 Cloudflare 给的两个。网站不会中断。（跳过这一步也能用，地址是 `https://molastria-account.<你的子域>.workers.dev`，只是大陆访问不稳。）
2. **Resend 发信。** 注册后 **Domains → Add domain → molastria.com**，把它给的几条 DNS 记录加到 Cloudflare（或 Porkbun），验证通过后 **API Keys → Create**（Sending access）。发件地址默认 `login@molastria.com`，可在 `deploy/wrangler.toml` 的 `MAIL_FROM` 修改。
3. **Stripe 只读受限密钥。** Stripe 后台 **Developers → API keys → Create restricted key**，名字填 MolAstria account，权限只开三项 **Read**：Customers、Checkout Sessions、Subscriptions，其余保持 None。正式环境建正式密钥（`rk_live_…`），测试环境的测试链接配测试密钥（`rk_test_…`）。**这个密钥只粘贴进下面的命令，不要发给任何人，也不要放进仓库。**
4. **部署**（在仓库的 `deploy` 目录打开终端，先运行 `npm ci`；Windows PowerShell 里把 `npx` 写成 `npx.cmd`。已完成，以后的操作见 `docs/RUNBOOK.md`）：
   ```bash
   npx wrangler login
   npx wrangler d1 create molastria                       # 把输出里的 database_id 填进 wrangler.toml
   npx wrangler d1 execute molastria --remote --file schema.sql
   npx wrangler secret put STRIPE_KEY                     # 粘贴第 3 步的受限密钥
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put DEEPSEEK_API_KEY
   npx wrangler deploy
   ```
   `wrangler.toml` 顶部的 `routes` 把服务地址设为 `https://api.molastria.com`（需要第 1 步）；跳过第 1 步的话，删掉 `routes` 那一行，并把 `workers_dev` 改成 `true`。打开服务地址，看到 `{"ok":true,"service":"molastria-account"}` 即部署成功。
5. **客户门户登录链接。** Stripe **Settings → Billing → Customer portal** 里复制登录链接（`https://billing.stripe.com/p/login/…`），账号页的“管理订阅”按钮会用它。
6. **填进网站。** 编辑 `public/pay/config.js`：
   ```js
   accountApi: 'https://api.molastria.com',
   portalUrl: 'https://billing.stripe.com/p/login/…',
   ```
   推送后，价格页的“AI 托管额度”变成“开通即享”，确认页会自动登录。已经付过款的人打开 `/pro/account.html` 用付款邮箱登录即可。
7. **桌面版**内置的是打包时的网页，发一个新版本（`desktop-v0.1.2`）后桌面版才有账号页和托管额度。

### 站长账号与 VIP 卡 · Admin account and VIP cards

站长本人永久免费使用 Pro，并且可以在账号页生成 VIP 卡送给朋友。站长身份只能用命令写进数据库，网站上没有任何接口能授予（在 `deploy` 目录运行，把邮箱换成你自己的；有几个邮箱就各运行一次）：

```bash
npx wrangler d1 execute molastria --remote --command "INSERT INTO grants (email, source, expires, created) VALUES ('你的邮箱', 'admin', NULL, unixepoch())"
```

之后用这个邮箱在 `/pro/account.html` 收验证码登录，账号页显示“站长 · 永久 Pro”，下面多出“发 VIP 卡”：选数量（1–50）、有效期（永久 / 1 年 / 3 个月 / 1 个月 / 7 天）和只有你看得到的备注，点“生成”。每张卡旁边的“复制邀请”会复制一段带链接的邀请文字（`/pro/account.html?card=VIP-…`），朋友打开后填自己的邮箱、收验证码就开通了，不需要付款。

- 一张卡只能用一次；在验证码填对之前卡不算用掉。
- 同一个人兑换多张有期限的卡，有效期首尾相接；永久卡让 Pro 变成永久。
- 点“收回”后这张卡作废；已经兑换的人只失去这张卡带来的时长，他兑换的其他卡照常有效。
- 取消站长身份：`npx wrangler d1 execute molastria --remote --command "DELETE FROM grants WHERE email = '你的邮箱'"`。

可调的设置在 `wrangler.toml` 的 `[vars]`：`MONTHLY_ASKS`（每席位每月次数，默认 300）、`HOSTED_MODELS`（托管额度可用的模型）。改完重新 `npx wrangler deploy`。

本地测试：`deno run --allow-read tools/account-test.ts` 跑接口测试（假 Stripe、假邮件）；`tools/account-local.ts` 起一个带假 Stripe 的本地服务，用来在浏览器里走完整流程（说明在文件开头）。

## 5. 之后 · Afterwards

- 顾客、订阅、退款都在 Stripe 后台管理；收据和续费提醒由 Stripe 自动发送。退款或取消后，账号服务最多 6 小时内同步，Pro 权益随之结束。
- 其余“开发中”的 Pro 功能上线时接到账号服务上（以 `/me` 返回的 `pro` 为准），付费用户自动获得，不用逐个开通。
- 换用其他平台（Lemon Squeezy、Paddle、爱发电等）时，把 `provider` 改成平台名，`checkoutUrl` 填该平台的结账链接即可。

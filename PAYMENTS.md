# 开通收款 · Turning on payments

网站的价格页（`/pro/`）和结账窗口已经上线；只差你的收款链接。整个过程大约 20 分钟，不需要服务器。
The pricing page and checkout window are live; they only need your payment links. No server is required.

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

## 4. 之后 · Afterwards

- 顾客、订阅、退款都在 Stripe 后台管理；收据和续费提醒由 Stripe 自动发送。
- “开发中”的 Pro 功能上线后，用 Stripe 后台的顾客邮箱为付费用户开通。
- 换用其他平台（Lemon Squeezy、Paddle、爱发电等）时，把 `provider` 改成平台名，`checkoutUrl` 填该平台的结账链接即可。

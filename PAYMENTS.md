# 开通收款 · Turning on payments

网站的价格页（`/pro/`）和结账窗口已经上线；只差你的收款链接。整个过程大约 20 分钟，不需要服务器。
The pricing page and checkout window are live; they only need your payment links. No server is required.

## 1. 开通 Stripe 账户 · Create a Stripe account

1. 打开 <https://dashboard.stripe.com/register>，用你本人的信息注册（个人 / 独资经营者即可）。按提示填写银行账户以接收打款。
2. Stripe 审核时会访问你的网站，以下页面已经准备好：价格页 `https://molastria.com/pro/`、服务条款 `/pro/terms.html`、退款政策 `/pro/refund.html`、隐私政策 `/pro/privacy.html`。**正式收款前请通读并按你的实际情况修改这三份文件**（运营者名称、联系方式、退款承诺都是默认写法）。
3. 在 **Settings → Payment methods** 里打开想用的方式：银行卡、Apple Pay、Google Pay 默认可用；支付宝、微信支付视你的账户所在地是否提供，开通后改 `public/pay/config.js` 里的 `methods`，只列真正开通的。

## 2. 为每个套餐创建 Payment Link · One Payment Link per plan

在 **Product catalog** 新建产品和价格，然后 **Payment Links → New**：

| 套餐 id | 建议设置 | 价格（与 config.js 展示价一致） |
| --- | --- | --- |
| `pro_year` | 订阅 · 每年 | ¥199（或 US$29） |
| `pro_month` | 订阅 · 每月 | ¥29（或 US$4.99） |
| `team_year` | 订阅 · 每年，允许顾客调整数量（最少 5） | ¥1,490 / 5 席位 |
| `sponsor` | 一次性 · “顾客自定金额” | — |

每个 Payment Link 的 **After payment → Don't show confirmation page → Redirect to your website**，填：

```
https://molastria.com/pro/success.html?session_id={CHECKOUT_SESSION_ID}&plan=pro_year
```

把末尾的 `pro_year` 换成对应套餐 id。勾选 **Collect customers' email**（订阅默认收集）。

## 3. 把链接填进网站 · Paste the links

编辑 `public/pay/config.js`：

```js
plans: {
  pro_year:  { …, checkoutUrl: 'https://buy.stripe.com/xxxxxxxx' },
  pro_month: { …, checkoutUrl: 'https://buy.stripe.com/yyyyyyyy' },
  …
}
```

推送到 `main` 后约一分钟生效。填了链接的套餐，结账按钮立刻可以付款；没填的仍显示“收款通道正在开通”。
建议先在 Stripe 的 **Test mode** 生成测试链接、用测试卡 `4242 4242 4242 4242` 走一遍，再换成正式链接。

## 4. 之后 · Afterwards

- 顾客、订阅、退款都在 Stripe 后台管理；收据和续费提醒由 Stripe 自动发送。
- “开发中”的 Pro 功能上线后，用 Stripe 后台的顾客邮箱为付费用户开通。
- 换用其他平台（Lemon Squeezy、Paddle、爱发电等）时，把 `provider` 改成平台名，`checkoutUrl` 填该平台的结账链接即可。

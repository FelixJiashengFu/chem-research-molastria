/* MolAstria 收款配置 —— 站长唯一需要改的文件。
   收款由 Stripe（或任何提供“托管结账页”的平台：Lemon Squeezy、Paddle、爱发电等）完成，
   本站不接触卡号，也不需要服务器。步骤见仓库根目录 PAYMENTS.md：
     1. 在 Stripe 后台为每个套餐创建 Payment Link（价格以 Stripe 中设置的为准，下方 price 只用于展示，二者要一致）。
     2. Payment Link 的“付款后跳转”设为 https://molastria.com/pro/success.html?session_id={CHECKOUT_SESSION_ID}&plan=<套餐 id>
     3. 把链接填进下面的 checkoutUrl，推送到 GitHub。填了链接的套餐，结账按钮立即变成可付款状态。 */
window.MOLASTRIA_PAY = {
  provider: 'stripe',          // 'stripe' 会自动附带邮箱、语言与套餐标记；其他平台照原样打开链接
  operator: 'MolAstria',       // 出现在条款与收据说明里的运营者名称
  contactEmail: '',            // 售后与退款邮箱；留空时显示 GitHub Issues 链接
  contactUrl: 'https://github.com/FelixJiashengFu/chem-research-molastria/issues',
  methods: ['card', 'applepay', 'googlepay'],   // 只列你在 Stripe 后台真正开通的方式；开通后可加 'alipay'、'wechat'
  // Pro 账号服务（deploy/account-worker.js，见 PAYMENTS.md 第 4 节）。填上地址后：付款后自动登录、AI 托管额度、课题组成员管理生效。
  accountApi: 'https://api.molastria.com',
  portalUrl: '',               // Stripe 客户门户登录链接（Settings → Billing → Customer portal），形如 https://billing.stripe.com/p/login/…
  // 价格单位是人民币（CNY），与 Stripe 里的价格一致。英文页另附美元约数，只用于展示，按下面的汇率换算。
  usdPerCny: 0.15,             // 2026-10-28 汇率约 0.150
  plans: {
    pro_year:  { price: 199,  list: 299, period: 'year',  checkoutUrl: 'https://buy.stripe.com/00wfZb7EA0V070jbp48Zq00' },   // 测试链接形如 https://buy.stripe.com/test_…
    pro_month: { price: 29,   period: 'month', checkoutUrl: 'https://buy.stripe.com/cNidR3bUQ6fk1FZ78O8Zq01' },
    team_year: { price: 1490, seatPrice: 298, seats: 5, period: 'year', checkoutUrl: 'https://buy.stripe.com/3cI14h8IEdHMfwP8cS8Zq04' },   // Stripe 里按席位 ¥298/年，数量最少 5
    sponsor:   { price: null, checkoutUrl: 'https://buy.stripe.com/bJe00d0c89rwbgzgJo8Zq03' }                     // Stripe 里设为“顾客自定金额”
  }
};

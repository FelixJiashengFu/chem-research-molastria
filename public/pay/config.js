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
  plans: {
    pro_year:  { price: { cny: 199, usd: 29 },  list: { cny: 299, usd: 42 }, period: 'year',  checkoutUrl: '' },
    pro_month: { price: { cny: 29, usd: 4.99 }, period: 'month', checkoutUrl: '' },
    team_year: { price: { cny: 1490, usd: 199 }, period: 'year', seats: 5, checkoutUrl: '' },
    sponsor:   { price: null, checkoutUrl: '' }                     // Stripe 里设为“顾客自定金额”
  }
};

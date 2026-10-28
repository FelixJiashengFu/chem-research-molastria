/* 站长配置（可选）。
   默认留空：访客在「AI 设置」里填自己的 DeepSeek / Muse key，key 只存在访客自己的浏览器，请求直接发往服务商。
   如果你部署了 deploy/ai-proxy-worker.js（key 存在 Cloudflare 的加密变量里），把它的地址填进 proxy，
   访客无需自备 key 也能使用 AI；Worker 里可以限制来源网站、模型与每次输出长度。 */
window.CHEMHUB_AI_CONFIG = Object.assign({
  proxy: '',            // 例如 'https://chemhub-ai.<你的账号>.workers.dev'
  proxyLabel: '站点代理',
  defaultProvider: 'deepseek'
}, window.CHEMHUB_AI_CONFIG || {});

//! Native notifications for pages inside the app.
//!
//! The system WebView does not give pages a working Web Notification API: macOS's WKWebView has no
//! `Notification` at all, and WebView2's needs a permission the app never grants. So the preprint
//! radar's "test notification" said the browser had not allowed notifications. SCRIPT runs in every
//! frame before the page's own scripts (the radar lives in an iframe) and replaces `Notification`
//! with one that sends the title and body to tauri-plugin-notification through the top window, the
//! same way save.rs reaches the app. Desktop apps need no permission, so it reports "granted".
//! Clicking a notification does nothing: the plugin has no click callback on desktop.
pub const SCRIPT: &str = r#"
(() => {
  let tauri = null;
  try { tauri = window.__TAURI_INTERNALS__ || window.top.__TAURI_INTERNALS__; } catch {}
  if (!tauri || !tauri.invoke) return; // a frame from another site: leave it alone
  const call = (cmd, args) => tauri.invoke('plugin:notification|' + cmd, args || {});
  let permission = 'default';
  const settle = (v) => (permission = v === true || v === 'granted' ? 'granted' : v === false || v === 'denied' ? 'denied' : 'default');
  call('is_permission_granted').then(settle, () => {});
  function Notification(title, options) {
    if (!(this instanceof Notification)) throw new TypeError("Failed to construct 'Notification': Please use the 'new' operator.");
    const o = options || {};
    this.title = String(title);
    this.body = o.body == null ? '' : String(o.body);
    this.tag = o.tag == null ? '' : String(o.tag);
    this.onclick = this.onshow = this.onclose = this.onerror = null;
    call('notify', { options: { title: this.title, body: this.body || undefined } })
      .then(() => { if (typeof this.onshow === 'function') this.onshow(); }, (e) => { if (typeof this.onerror === 'function') this.onerror(e); });
  }
  Notification.prototype.close = function () {};
  Notification.prototype.addEventListener = function () {};
  Notification.prototype.removeEventListener = function () {};
  Object.defineProperty(Notification, 'permission', { get: () => permission, enumerable: true });
  Notification.maxActions = 0;
  Notification.requestPermission = (done) => call('request_permission').then(settle, () => permission)
    .then((p) => { if (typeof done === 'function') done(p); return p; });
  Object.defineProperty(window, 'Notification', { value: Notification, writable: true, configurable: true });
})();
"#;
